// CHECKERS for the VMX's 64x64 1-bit screen. Written from scratch: American checkers (English draughts) - 8x8,
// pieces on dark squares, men move forward diagonally, captures are mandatory and multi-jumps chain, a man reaching
// the far row is crowned and moves both ways; no legal move = loss; 40 moves of kings only with no capture = draw. You (solid discs) play the computer (hollow
// rings; kings get a crown mark), which searches ahead with alpha-beta. D-pad moves the cursor, A picks up / puts
// down, B drops the selection. Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64, N = 8;
const SQ = 7, BX = 0, BY = 4;                         // board 56 x 56 at (0,4); right strip 57-63
const FONT = { Y:"101101010010010",O:"010101101101010",U:"101101101101111",W:"101101111111101",I:"111010010010111",N:"110101101101101",
  L:"100100100100111",S:"011100010001110",E:"111100110100111",C:"011100100100011",P:"110101110100100",M:"101111111101101",T:"111010010010010",
  A:"010101111101101",D:"110101101101110",R:"110101110101101",V:"101101101101010",K:"101101110101101",H:"101101111101101",G:"011100101101011",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110","4":"101101111001001","5":"111100110001110",
  "6":"011100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001110"," ":"000000000000000","!":"010010010000010" };
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// board: 64 cells, 0 empty, 1 / 2 = player 1 (you, moves up) / player 2 (CPU, moves down), +2 = king (3, 4)
const owner = v => v === 0 ? 0 : (v - 1) % 2 + 1, isKing = v => v >= 3;
export function newGame(seed = 1) {
  const b = Array(64).fill(0);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((r + c) % 2 === 1) { if (r < 3) b[r * 8 + c] = 2; if (r > 4) b[r * 8 + c] = 1; }
  return { rnd: rng(seed), t: 0, b, turn: 1, cur: [5, 2], sel: null, chain: null, msg: "", msgT: 0, over: 0, think: 0,
           anim: null, lost: [0, 0], quiet: 0 };
}

function dirs(v) { const k = isKing(v), o = owner(v); return k ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : o === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]; }
function jumpsFrom(b, i) {
  const r = i >> 3, c = i & 7, v = b[i], out = [];
  for (const [dr, dc] of dirs(v)) {
    const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
    const m = b[r1 * 8 + c1];
    if (m && owner(m) !== owner(v) && !b[r2 * 8 + c2]) out.push({ from: i, to: r2 * 8 + c2, cap: r1 * 8 + c1 });
  }
  return out;
}
function stepsFrom(b, i) {
  const r = i >> 3, c = i & 7, out = [];
  for (const [dr, dc] of dirs(b[i])) { const r1 = r + dr, c1 = c + dc; if (r1 >= 0 && r1 < 8 && c1 >= 0 && c1 < 8 && !b[r1 * 8 + c1]) out.push({ from: i, to: r1 * 8 + c1 }); }
  return out;
}
export function moves(b, side, only = null) {         // legal single steps or jumps (captures are mandatory)
  const cells = only !== null ? [only] : [...Array(64).keys()].filter(i => owner(b[i]) === side);
  const jumps = cells.flatMap(i => jumpsFrom(b, i));
  if (jumps.length || only !== null) return jumps;
  return cells.flatMap(i => stepsFrom(b, i));
}
function apply(b, m) {                                // returns the new board and whether the turn continues
  const nb = b.slice(); const v = nb[m.from]; nb[m.from] = 0; nb[m.to] = v;
  let crowned = false;
  if (!isKing(v) && ((owner(v) === 1 && m.to < 8) || (owner(v) === 2 && m.to >= 56))) { nb[m.to] = v + 2; crowned = true; }
  if (m.cap !== undefined) { nb[m.cap] = 0; if (!crowned && jumpsFrom(nb, m.to).length) return { b: nb, more: true, crowned }; }
  return { b: nb, more: false, crowned };
}

// ---- search ---------------------------------------------------------------------------------------------------
function evaluate(b) {                                // from player 2's view
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const v = b[i]; if (!v) continue;
    const r = i >> 3, c = i & 7, sgn = owner(v) === 2 ? 1 : -1;
    let val = isKing(v) ? 160 : 100;
    if (!isKing(v)) val += (owner(v) === 2 ? r : 7 - r) * 4;          // advance
    if (c === 0 || c === 7) val += 4;                                   // edges are safe
    if (!isKing(v) && ((owner(v) === 2 && r === 0) || (owner(v) === 1 && r === 7))) val += 8;   // back row guard
    s += sgn * val;
  }
  return s;
}
function turns(b, side) {                             // whole turns (multi-jumps expanded) -> [{path, b}]
  const out = [];
  const go = (bb, only, path) => {
    const ms = moves(bb, side, only);
    if (!ms.length) { if (path.length) out.push({ path, b: bb }); return; }
    for (const m of ms) { const r = apply(bb, m); if (r.more) go(r.b, m.to, [...path, m]); else out.push({ path: [...path, m], b: r.b }); }
  };
  go(b, null, []);
  return out;
}
function search(b, side, depth, a, bb) {
  const ts = turns(b, side);
  if (!ts.length) return side === 2 ? -1e5 : 1e5;
  if (depth === 0) return evaluate(b);
  if (side === 2) { let best = -1e9; for (const t of ts) { best = Math.max(best, search(t.b, 1, depth - 1, a, bb)); a = Math.max(a, best); if (a >= bb) break; } return best; }
  let best = 1e9; for (const t of ts) { best = Math.min(best, search(t.b, 2, depth - 1, a, bb)); bb = Math.min(bb, best); if (a >= bb) break; } return best;
}
export function bestTurn(g, side, depth = 5) {
  const ts = turns(g.b, side); if (!ts.length) return null;
  let best = null;
  for (const t of ts) {
    let v = search(t.b, side === 1 ? 2 : 1, depth - 1, -1e9, 1e9); if (side === 1) v = -v;
    v += g.rnd() * 6;                                 // a little variety between equal moves
    if (!best || v > best.v) best = { ...t, v };
  }
  return best;
}

// ---- play ------------------------------------------------------------------------------------------------------
function finishTurn(g) {
  g.turn = g.turn === 1 ? 2 : 1; g.chain = null; g.sel = null;
  if (!turns(g.b, g.turn).length) { g.over = 150; g.msg = g.turn === 1 ? "YOU LOSE" : "YOU WIN!"; g.msgT = 150; }
}
function play(g, m) {
  const before = g.b[m.from];
  g.quiet = (m.cap !== undefined || !isKing(before)) ? 0 : g.quiet + 1;   // draw: 40 king moves, no capture
  const r = apply(g.b, m); g.anim = { from: m.from, to: m.to, v: before, t: 0 }; g.b = r.b;
  if (m.cap !== undefined) g.lost[owner(before) === 1 ? 1 : 0]++;
  if (r.crowned) { g.msg = "KING ME"; g.msgT = 40; }
  if (r.more) { g.chain = m.to; g.sel = m.to; } else finishTurn(g);
  if (!g.over && g.quiet >= 40) { g.over = 150; g.msg = "DRAW"; g.msgT = 150; }
}
export function step(g, inp, cpuSides = [2]) {        // inp: edge presses up/down/left/right/a/b
  g.t++;
  if (g.msgT) g.msgT--;
  if (g.anim && ++g.anim.t > 6) g.anim = null;
  if (g.over) { if (--g.over === 0) Object.assign(g, newGame(Math.floor(g.rnd() * 1e9))); return; }
  if (g.anim) return;
  if (cpuSides.includes(g.turn)) {
    if (++g.think < 18) return; g.think = 0;          // a beat between moves
    if (!g.plan || g.plan.side !== g.turn) { const t = bestTurn(g, g.turn); g.plan = { side: g.turn, path: t ? t.path : [] }; }
    const m = g.plan.path.shift(); if (m) play(g, m);
    if (!g.plan.path.length) g.plan = null;
    return;
  }
  // you: cursor, pick up, put down
  const [r, c] = g.cur;
  if (inp.up) g.cur = [Math.max(0, r - 1), c]; if (inp.down) g.cur = [Math.min(7, r + 1), c];
  if (inp.left) g.cur = [r, Math.max(0, c - 1)]; if (inp.right) g.cur = [r, Math.min(7, c + 1)];
  const i = g.cur[0] * 8 + g.cur[1];
  if (inp.b && g.chain === null) g.sel = null;
  if (inp.a) {
    const legal = moves(g.b, 1, g.chain);
    if (g.sel !== null) {
      const m = legal.find(m => m.from === g.sel && m.to === i);
      if (m) play(g, m);
      else if (g.chain === null && owner(g.b[i]) === 1 && legal.some(m => m.from === i)) g.sel = i;
    } else if (owner(g.b[i]) === 1 && legal.some(m => m.from === i)) g.sel = i;
    else if (owner(g.b[i]) === 1 && legal.length && legal[0].cap !== undefined) { g.msg = "MUST JUMP"; g.msgT = 40; }
  }
}

// ---- drawing ---------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function text(b, x, y, s, v = 1) { for (const ch of s) { const f = FONT[ch] || FONT[" "]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r, v); x += 4; } }
function piece(b, x, y, v, ink = 1) {                // 5x5 inside a 7x7 square at (x, y); ink 0 = dark on a lit square
  const mine = owner(v) === 1;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
    const d = (i - 2) ** 2 + (j - 2) ** 2; if (d > 5) continue;
    const ring = d >= 3;
    let on = mine ? true : ring;
    if (isKing(v) && i === 2 && j === 2) on = !mine;   // crown mark: a hole in yours, a dot in theirs
    if (isKing(v) && (d === 1) && j === 2) on = !mine;
    px(b, x + 1 + i, y + 1 + j, on ? ink : 1 - ink);
  }
}
export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const x = BX + c * SQ, y = BY + r * SQ;
    if ((r + c) % 2 === 1) for (let j = 0; j < SQ; j++) for (let i = 0; i < SQ; i++) px(b, x + i, y + j);   // playable squares solid
                                                                                                    // (owner), the others black
  }
  for (let i = 0; i < 64; i++) {
    const v = g.b[i]; if (!v) continue;
    if (g.anim && i === g.anim.to) continue;
    if (g.sel === i && (g.t >> 3) & 1) continue;      // selected: blinks
    piece(b, BX + (i & 7) * SQ, BY + (i >> 3) * SQ, v, 0);
  }
  if (g.anim) { const k = g.anim.t / 6, f = g.anim.from, to = g.anim.to; piece(b, BX + ((f & 7) + ((to & 7) - (f & 7)) * k) * SQ, BY + ((f >> 3) + ((to >> 3) - (f >> 3)) * k) * SQ, g.b[to] || g.anim.v, 0); }
  if (g.turn === 1 && !g.over) {                      // cursor: corner brackets
    const x = BX + g.cur[1] * SQ, y = BY + g.cur[0] * SQ;                 // brackets that flip what they cover
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [6, 0], [5, 0], [6, 1], [0, 6], [1, 6], [0, 5], [6, 6], [5, 6], [6, 5]]) { const k = (y + dy) * W + x + dx; b[k] ^= 1; }
  }
  // right strip: whose turn (a piece), pieces taken
  for (let y = 0; y < H; y++) px(b, 57, y);
  piece(b, 57, 2, g.turn === 1 ? 1 : 2);
  text(b, 0, 0, "", 1);
  const cap1 = String(g.lost[1]).padStart(2, "0"), cap2 = String(g.lost[0]).padStart(2, "0");
  piece(b, 57, 22, 2); text(b, 59, 30, cap1[0]); text(b, 59, 36, cap1[1]);   // CPU pieces you took
  piece(b, 57, 44, 1); text(b, 59, 52, cap2[0]); text(b, 59, 58, cap2[1]);   // yours they took
  if (g.msgT) {
    const w = g.msg.length * 4 + 3, x = Math.round((56 - w) / 2);
    for (let y = 26; y < 37; y++) for (let i = 0; i < w; i++) px(b, x + i, y, y === 26 || y === 36 || i === 0 || i === w - 1 ? 1 : 0);
    text(b, x + 2, 29, g.msg);
  }
  return b;
}
