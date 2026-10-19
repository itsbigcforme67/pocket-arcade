// ZORK on the VMX's 64x64 1-bit screen: our Z-machine (zmachine.js) running Zork I (MIT-licensed by Microsoft, 2025:
// github.com/historicalsource/zork1, COMPILED/zork1.z3). No keyboard, so commands are built from word lists:
//   MOVE  directions (one pick = go)          VERB  actions (LOOK etc. go at once, the rest wait for a noun)
//   SEEN  nouns + adjectives the game printed lately, newest first (the dictionary's own noun/adjective flags)
//   LINK  WITH, IN, ON, TO ...                A-Z   the whole dictionary by first letter
//   MISC  WAIT, AGAIN, SCORE, SAVE ...
// Screen: room name (inverted bar), 8 lines x 16 columns of text, the command line. Reading: up/down scroll, A pages
// on, then A opens the word picker. Picker: left/right category, up/down word, A adds it (<ENTER> sends), B takes
// the last word back (or closes the picker). Pure logic + drawing into a 64x64 bit buffer, 30 Hz ticks.
import { ZMachine } from "./zmachine.js";

export const W = 64, H = 64;
const COLS = 16, ROWS = 8, TY = 8, LH = 6, PICK_ROWS = 7;
const F = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",D:"110101101101110",E:"111100110100111",F:"111100110100100",
  G:"011100101101011",H:"101101111101101",I:"111010010010111",J:"001001001101010",K:"101101110101101",L:"100100100100111",
  M:"101111111101101",N:"110101101101101",O:"010101101101010",P:"110101110100100",Q:"010101101110011",R:"110101110101101",
  S:"011100010001110",T:"111010010010010",U:"101101101101111",V:"101101101101010",W:"101101111111101",X:"101101010101101",
  Y:"101101010010010",Z:"111001010100111",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110","4":"101101111001001",
  "5":"111100110001110","6":"011100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001110",
  ".":"000000000000010",",":"000000000010100","!":"010010010000010","?":"110001010000010","'":"010010000000000",
  '"':"101101000000000","-":"000000111000000",":":"000010000010000",";":"000010000010100","(":"001010010010001",
  ")":"100010010010100","/":"001001010100100",">":"100010001010100","<":"001010100010001","&":"010101010101011",
  "*":"000101010101000","#":"101111101111101","+":"000010111010000","=":"000111000111000","_":"000000000000111",
  "[":"011010010010011","]":"110010010010110","%":"101001010100101"," ":"000000000000000" };
const MOVE = ["NORTH", "SOUTH", "EAST", "WEST", "NE", "NW", "SE", "SW", "UP", "DOWN", "IN", "OUT"];
const VERB = ["LOOK", "INVENTORY", "EXAMINE", "TAKE", "DROP", "OPEN", "CLOSE", "READ", "PUT", "TURN ON", "TURN OFF",
  "MOVE", "PUSH", "PULL", "ATTACK", "THROW", "GIVE", "CLIMB", "ENTER", "EAT", "DRINK", "TIE", "UNLOCK", "LOCK", "DIG",
  "FILL", "POUR", "INFLATE", "WAVE", "RING", "PRAY", "LISTEN", "SMELL", "SEARCH", "WIND", "KNOCK", "BURN", "LIGHT"];
const SOLO = new Set(["LOOK", "INVENTORY", "LISTEN", "PRAY", ...MOVE]);
const LINK = ["WITH", "IN", "ON", "TO", "AT", "FROM", "UNDER", "OFF", "ALL", "IT", "AND", "EXCEPT"];
const MISC = ["WAIT", "AGAIN", "SCORE", "DIAGNOSE", "SAVE", "RESTORE", "VERBOSE", "BRIEF", "RESTART", "YES", "NO", "HELLO"];
const CATS = ["MOVE", "VERB", "SEEN", "LINK", "A-Z", "MISC"];
const ENTER = "<ENTER>", SEEN_MAX = 40;
const STOP = new Set(["the", "a", "an", "you", "your", "it", "is", "are", "there", "here", "of", "to", "and", "with", "in"]);

export function newGame(seed = 1, story) {
  const vm = new ZMachine(story, seed);
  const g = { vm, t: 0, lines: [], top: 0, pick: null, cmd: [], seen: [], full: new Map(), demoAt: 0, wait: 0 };
  const words = vm.words.filter(w => w.flags & 0xa0 && !(w.flags & 0x04) && /^[a-z]+$/.test(w.text));
  g.az = {}; for (const w of words) (g.az[w.text[0].toUpperCase()] ||= []).push(w.text);
  vm.run(); absorb(g, vm.take(), 0);
  return g;
}
function wrap(text) {
  const out = [];
  for (const para of text.toUpperCase().split("\n")) {
    let line = "";
    for (let word of para.split(/ +/)) {
      if (!word) { if (!line && para.startsWith(" ")) line = ""; continue; }
      while (word.length > COLS) { if (line) { out.push(line); line = ""; } out.push(word.slice(0, COLS)); word = word.slice(COLS); }
      if (!line) line = word; else if (line.length + 1 + word.length <= COLS) line += " " + word; else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}
function absorb(g, text, from) {                       // new game text: wrap, remember its nouns, show from `from`
  text = text.replace(/\n*>\s*$/, "").replace(/^\n+/, "");
  g.lines.push(...wrap(text));
  if (g.lines.length > 600) { const k = g.lines.length - 600; g.lines.splice(0, k); from = Math.max(0, from - k); }
  g.top = from;
  const fresh = [];
  for (const m of text.toLowerCase().matchAll(/[a-z]+/g)) {
    const w = m[0], e = g.vm.lookup(w);
    if (!e || STOP.has(w) || !(g.vm.m[e + 4] & 0xa0) || g.vm.m[e + 4] & 0x04) continue;
    const up = w.toUpperCase();
    if (MOVE.includes(up) || VERB.includes(up) || LINK.includes(up)) continue;
    g.full.set(w.slice(0, 6), up);
    if (!fresh.includes(up)) fresh.push(up);
  }
  fresh.reverse();                                     // last mentioned first: a room's objects come at its end
  g.seen = [...fresh, ...g.seen.filter(w => !fresh.includes(w))].slice(0, SEEN_MAX);
}
function submit(g) {
  const cmd = g.cmd.join(" "); g.cmd = []; g.pick = null;
  if (g.demoing) g.demoAt++;
  const from = g.lines.length;
  g.lines.push("> " + cmd);
  g.vm.input(cmd.toLowerCase()); g.vm.run();
  absorb(g, g.vm.take(), from);
  if (g.vm.state === "quit") { g.lines.push("", "*** THE END ***"); }
}
export function items(g, cat) {
  const c = CATS[cat]; let list;
  if (c === "MOVE") list = MOVE; else if (c === "VERB") list = VERB; else if (c === "SEEN") list = g.seen;
  else if (c === "LINK") list = LINK; else if (c === "MISC") list = MISC;
  else list = g.pick && g.pick.letter ? g.az[g.pick.letter].map(w => g.full.get(w) || w.toUpperCase()) : Object.keys(g.az).sort();
  return g.cmd.length ? [ENTER, ...list] : list.slice();
}
function openPick(g) {
  const cat = g.cmd.length ? 2 : 0;
  g.pick = { cat, cur: CATS.map(() => 0), scroll: CATS.map(() => 0), letter: null };
}
export const more = g => g.top + ROWS < g.lines.length;

export function step(g, inp) {
  g.t++;
  if (g.vm.state === "quit") return;
  if (!g.pick) {
    if (inp.down && more(g)) g.top++;
    if (inp.up && g.top > 0) g.top--;
    if (inp.a || inp.b) { if (more(g)) g.top = Math.min(g.top + ROWS - 1, g.lines.length - ROWS); else openPick(g); }
    return;
  }
  const p = g.pick, list = items(g, p.cat);
  if (inp.left || inp.right) {
    p.cat = (p.cat + (inp.right ? 1 : CATS.length - 1)) % CATS.length;
    return;
  }
  if (inp.up) p.cur[p.cat] = Math.max(0, p.cur[p.cat] - 1);
  if (inp.down) p.cur[p.cat] = Math.min(list.length - 1, p.cur[p.cat] + 1);
  const cur = p.cur[p.cat];
  if (cur < p.scroll[p.cat]) p.scroll[p.cat] = cur;
  if (cur >= p.scroll[p.cat] + PICK_ROWS) p.scroll[p.cat] = cur - PICK_ROWS + 1;
  if (inp.b) {
    if (CATS[p.cat] === "A-Z" && p.letter) { p.letter = null; p.cur[p.cat] = p.scroll[p.cat] = 0; }
    else if (g.cmd.length) { g.cmd.pop(); }
    else g.pick = null;
    return;
  }
  if (!inp.a || !list.length) return;
  const it = list[cur];
  if (it === ENTER) return submit(g);
  if (CATS[p.cat] === "A-Z" && !p.letter) { p.letter = it; p.cur[p.cat] = p.scroll[p.cat] = 0; return; }
  const solo = !g.cmd.length && SOLO.has(it);
  g.cmd.push(it);
  if (solo) return submit(g);
  if (CATS[p.cat] === "A-Z") p.letter = null;
  p.cat = CATS[p.cat] === "VERB" || CATS[p.cat] === "LINK" ? 2 : CATS[p.cat] === "SEEN" ? 2 : p.cat;   // then a noun
  const nounNext = VERB.includes(it) || LINK.includes(it);
  p.cur = p.cur.map(() => (nounNext ? 1 : 0)); p.scroll = p.scroll.map(() => 0);   // after a verb: the first noun; after a noun: <ENTER>
}

// Demo: plays a list of commands through the same picker, a key at a time, reading each answer at a human pace.
export const DEMO = [["OPEN", "MAILBOX"], ["READ", "LEAFLET"], ["NORTH"], ["EAST"], ["OPEN", "WINDOW"], ["WEST"],
  ["WEST"], ["TAKE", "LANTERN"], ["MOVE", "RUG"], ["OPEN", "TRAP", "DOOR"], ["TURN ON", "LANTERN"], ["DOWN"]];
export function demo(g) {
  g.demoing = true;
  if (g.wait > 0) { g.wait--; return {}; }
  const key = (k, w = 5) => { g.wait = w; return { [k]: true }; };
  if (!g.pick) {
    if (g.demoAt >= DEMO.length || g.vm.state === "quit") return {};
    if (!g.readT) { g.readT = 1; g.wait = more(g) ? 70 : 75; return {}; }   // read the page, then A: next page
    g.readT = 0; return key("a");                                            // or, at the end, the picker
  }
  const want = DEMO[g.demoAt], p = g.pick;
  const goal = g.cmd.length >= want.length ? ENTER : want[g.cmd.length];
  const here = items(g, p.cat).indexOf(goal);
  if (here >= 0) { const c = p.cur[p.cat]; return here < c ? key("up") : here > c ? key("down") : key("a", 10); }
  for (let k = 1; k < CATS.length; k++)                                      // nearest category that has it
    for (const d of [k, -k]) {
      const c = (p.cat + d + CATS.length * 2) % CATS.length;
      if (CATS[c] !== "A-Z" && items(g, c).includes(goal)) return key(d > 0 ? "right" : "left");
    }
  const az = CATS.indexOf("A-Z");                                            // last resort: the dictionary
  if (p.cat !== az) return key((az - p.cat + CATS.length) % CATS.length <= CATS.length / 2 ? "right" : "left");
  if (!p.letter) { const i = items(g, az).indexOf(goal[0]), c = p.cur[az]; return i < c ? key("up") : i > c ? key("down") : key("a"); }
  return key("b");
}

// ---- drawing -----------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function text(b, x, y, s, v = 1) {
  for (const ch of s) { const f = F[ch] || F["?"]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r, v); x += 4; }
}
function bar(b, y, h) { for (let j = 0; j < h; j++) for (let i = 0; i < W; i++) px(b, i, y + j); }
export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  // room bar
  bar(b, 0, 7);
  let room = ((g.vm.status && g.vm.status.room) || "ZORK I").toUpperCase();
  if (room.length > COLS) { const k = Math.floor(g.t / 8) % (room.length - COLS + 8); room = room.slice(Math.max(0, Math.min(k - 4, room.length - COLS))); }
  text(b, Math.max(0, (W - room.slice(0, COLS).length * 4 + 1) >> 1), 1, room.slice(0, COLS), 0);
  for (let i = 0; i < W; i += 2) px(b, i, 57);
  if (!g.pick) {
    for (let r = 0; r < ROWS; r++) { const s = g.lines[g.top + r]; if (s) text(b, 0, TY + r * LH, s); }
    if (more(g)) { if ((g.t >> 3) & 1) for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [1, 1], [2, 1], [3, 1], [2, 2]]) px(b, 59 + dx, 59 + dy); text(b, 0, 59, "MORE"); }
    else if (g.vm.state === "quit") text(b, 0, 59, "THE END");
    else { text(b, 0, 59, ">"); if ((g.t >> 3) & 1) text(b, 4, 59, "_"); }
    return b;
  }
  const p = g.pick, list = items(g, p.cat), name = CATS[p.cat] === "A-Z" && p.letter ? "A-Z: " + p.letter : CATS[p.cat];
  text(b, 0, TY, "<"); text(b, 60, TY, ">"); text(b, (W - name.length * 4 + 1) >> 1, TY, name);
  for (let r = 0; r < PICK_ROWS; r++) {
    const k = p.scroll[p.cat] + r, it = list[k]; if (it === undefined) break;
    const y = TY + 7 + r * LH, sel = k === p.cur[p.cat];
    if (sel) bar(b, y - 1, 7);
    text(b, 2, y, it.slice(0, 15), sel ? 0 : 1);
  }
  if (!list.length) text(b, 2, TY + 7, "(NOTHING YET)");
  if (p.scroll[p.cat] > 0) px(b, 62, TY + 7), px(b, 61, TY + 8), px(b, 63, TY + 8);
  if (p.scroll[p.cat] + PICK_ROWS < list.length) px(b, 62, TY + 7 + PICK_ROWS * LH - 2), px(b, 61, TY + 6 + PICK_ROWS * LH - 2), px(b, 63, TY + 6 + PICK_ROWS * LH - 2);
  let cmd = "> " + g.cmd.join(" ") + ((g.t >> 3) & 1 ? "_" : "");
  if (cmd.length > COLS) cmd = cmd.slice(cmd.length - COLS);
  text(b, 0, 59, cmd);
  return b;
}
