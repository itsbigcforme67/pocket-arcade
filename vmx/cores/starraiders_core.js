// STAR RAIDERS (Atari, 1979, Doug Neubauer) on the VMX: the original cartridge code runs unchanged on our 6502
// (starraiders_machine.js); we draw its state at 64x64 1-bit instead of emulating the Atari's video chips.
//   view   the game's own playfield (stars, crosshairs, attack computer, scan) + players/missiles (ships,
//          torpedoes), max-pooled into 64 x 57 so single-pixel stars survive
//   chart  the Galactic Chart is text on the Atari: drawn natively from the game's 16 x 8 sector map, 4 px a sector
//   HUD    the Control Panel's velocity / kills / energy decoded from the game's text memory, our 3x5 font
//   title  the game's title line (RED ALERT, NOVICE MISSION, ...) in a bar at the top while it shows
// Controls: D-pad = joystick, A = fire. B opens the command menu (the Atari's keyboard): views, chart, scan,
// hyperwarp, shields, computer, tracking, speed 0-9, start/select. The game pauses while the menu is open.
// This is the copyrighted 1979 game: internal / trailer use, like the J2ME footage.
import { StarRaidersMachine } from "./starraiders_machine.js";

export const W = 64, H = 64;
const VIEW_H = 57, CC0 = 48, CC1 = 208;                 // colour clocks shown: all 160 (a 12% squeeze)
const FONT = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",D:"110101101101110",E:"111100110100111",F:"111100110100100",
  G:"011100101101011",H:"101101111101101",I:"111010010010111",J:"001001001101010",K:"101101110101101",L:"100100100100111",
  M:"101111111101101",N:"110101101101101",O:"010101101101010",P:"110101110100100",Q:"010101101110011",R:"110101110101101",
  S:"011100010001110",T:"111010010010010",U:"101101101101111",V:"101101101101010",W:"101101111111101",X:"101101010101101",
  Y:"101101010010010",Z:"111001010100111",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110","4":"101101111001001",
  "5":"111100110001110","6":"011100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001110",
  ":":"000010000010000","-":"000000111000000","+":"000010111010000",".":"000000000000010","!":"010010010000010",
  "~":"000101010101000","(":"001010010010001",")":"100010010010100","'":"010010000000000"," ":"000000000000000" };
// custom charset codes in the Control Panel (CCS.* in the source)
const CCS = "0123456789 :#E~-+PVR@KTC";                // # = border, ~ = infinity, P = phi, @ = theta
const MENU = [
  ["FRONT VIEW", "F"], ["AFT VIEW", "A"], ["GALACTIC CHART", "G"], ["LONG RANGE SCN", "L"], ["HYPERWARP", "H"],
  ["SPEED", "speed"], ["SHIELDS", "S"], ["ATTACK COMPUTR", "C"], ["TRACKING", "T"], ["MANUAL TARGET", "M"],
  ["PAUSE", "P"], ["START GAME", "start"], ["MISSION LEVEL", "select"]];

export function newGame(seed = 1, cart) {
  return { m: new StarRaidersMachine(cart, seed), t: 0, menu: null, speed: 6, prev: {}, consolT: 0 };
}

export function step(g, inp) {
  g.t++;
  const edge = k => inp[k] && !g.prev[k];
  const m = g.m;
  if (g.menu) {
    const it = MENU[g.menu.i];
    if (edge("up")) g.menu.i = (g.menu.i + MENU.length - 1) % MENU.length;
    if (edge("down")) g.menu.i = (g.menu.i + 1) % MENU.length;
    if (it[1] === "speed" && (edge("left") || edge("right"))) { g.speed = Math.max(0, Math.min(9, g.speed + (edge("right") ? 1 : -1))); m.key(String(g.speed)); }
    if (edge("b")) g.menu = null;
    else if (edge("a")) {
      if (it[1] === "speed") m.key(String(g.speed));
      else if (it[1] === "start" || it[1] === "select") { m.consol = it[1] === "start" ? 6 : 5; g.consolT = 4; }
      else m.key(it[1]);
      g.menu = null;
    }
    g.prev = { ...inp };
    if (g.menu) return;                                  // paused while choosing
  } else if (edge("b")) { g.menu = { i: g.lastMenu || 0 }; g.prev = { ...inp }; return; }
  m.joy = 0x0f & ~((inp.up ? 1 : 0) | (inp.down ? 2 : 0) | (inp.left ? 4 : 0) | (inp.right ? 8 : 0));
  m.trig = inp.a ? 0 : 1;
  if (g.consolT && --g.consolT === 0) m.consol = 7;
  m.runFrame(); m.runFrame();                           // the Atari's 60 Hz, two frames per VMX tick
  g.prev = { ...inp };
}

// ---- reading the game's screen memory -----------------------------------------------------------------------------
function rows(m) {                                       // the display list: [{ line, mode, addr }]
  const HT = { 2: 8, 3: 10, 4: 8, 5: 16, 6: 8, 7: 16, 8: 8, 9: 4, 10: 4, 11: 2, 12: 1, 13: 2, 14: 1, 15: 1 };
  const BY = { 2: 40, 3: 40, 4: 40, 5: 40, 6: 20, 7: 20, 8: 10, 9: 10, 10: 20, 11: 20, 12: 20, 13: 40, 14: 40, 15: 40 };
  const out = []; let pc = m.antic[2] | (m.antic[3] << 8), line = 8, addr = 0;
  for (let k = 0; k < 240 && line < 248; k++) {
    const ins = m.mem[pc]; pc = (pc + 1) & 0xffff; const mode = ins & 15;
    if (mode === 0) { line += ((ins >> 4) & 7) + 1; continue; }
    if (mode === 1) { if (ins & 0x40) break; pc = m.mem[pc] | (m.mem[pc + 1] << 8); continue; }
    if (ins & 0x40) { addr = m.mem[pc] | (m.mem[pc + 1] << 8); pc = (pc + 2) & 0xffff; }
    out.push({ line, mode, addr, h: HT[mode], bytes: BY[mode] });
    addr += BY[mode]; line += HT[mode];
  }
  return out;
}
export function panel(m) {                               // the Control Panel's two text rows
  const s = i => [...m.mem.slice(0x0949 + i * 20, 0x0949 + i * 20 + 20)].map(v => CCS[v & 0x3f] || " ").join("");
  return [s(0), s(1)];
}
export function title(m) { return String.fromCharCode(...m.mem.slice(0x0d1f, 0x0d1f + 20).map(v => (v & 0x3f) + 32)).trim(); }

// ---- drawing -----------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function text(b, x, y, s, v = 1) { for (const ch of s) { const f = FONT[ch] || FONT[" "]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r, v); x += 4; } }
function chart(g, b) {
  const m = g.m, mem = m.mem, blink = (g.t >> 3) & 1, Y0 = 9;
  for (let x = 0; x < W; x++) { px(b, x, Y0 - 1); px(b, x, Y0 + 32); }
  for (let i = 0; i < 128; i++) {
    const v = mem[0x08c9 + i], x = (i & 15) * 4, y = Y0 + (i >> 4) * 4;
    if (v & 0x80) { px(b, x + 1, y + 1); px(b, x + 2, y + 1); px(b, x + 1, y + 2); px(b, x + 2, y + 2); px(b, x + 1, y); px(b, x + 2, y + 3); }  // starbase
    else for (let k = 0; k < Math.min(4, v & 7); k++) px(b, x + 1 + (k & 1), y + 1 + (k >> 1));                     // 1-4 Zylon units
    if (i === mem[0x90] && blink) for (let k = 0; k < 4; k++) { px(b, x + k, y); px(b, x + k, y + 3); px(b, x, y + k); px(b, x + 3, y + k); }  // us
  }
  const ax = mem[0x8f] >> 1, ay = Y0 + (mem[0x8e] >> 2);                   // arrival hyperwarp marker
  if (!blink) for (let k = -3; k <= 3; k++) if (Math.abs(k) > 1) { px(b, ax + k, ay, 1); px(b, ax, ay + k, 1); }
  const txt = String.fromCharCode(...mem.slice(0x0971, 0x0971 + 40).map(v => (v & 0x3f) + 32));
  const warp = (txt.slice(0, 20).match(/(\d+)/) || ["", ""])[1], tgt = (txt.slice(20).match(/TARGETS:\s*(\d)/) || ["", "?"])[1];
  const dc = (txt.slice(20).match(/DC:\s*([A-Z]+)/) || ["", ""])[1];
  text(b, 0, Y0 + 36, "WARP E:" + warp.replace(/^0+(?=\d)/, ""));
  text(b, 0, Y0 + 43, "TARGETS:" + tgt);
  text(b, 0, Y0 + 50, "DC:" + dc);
}
export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  const m = g.m, rs = rows(m), gfx = rs.filter(r => r.mode >= 8);
  if (m.mem[0xd0] === 0x80) chart(g, b);
  else if (gfx.length) {
    const top = gfx[0].line, bot = gfx[gfx.length - 1].line + gfx[gfx.length - 1].h, sy = VIEW_H / (bot - top), sx = W / (CC1 - CC0);
    // playfield (2 bits per pixel, 1 colour clock wide in GR7)
    for (const r of gfx) for (let i = 0; i < r.bytes; i++) {
      const v = m.mem[(r.addr + i) & 0xffff]; if (!v) continue;
      for (let p = 0; p < 4; p++) if ((v >> (6 - 2 * p)) & 3) {
        const cc = 48 + i * 4 + p;
        if (cc < CC0 || cc >= CC1) continue;
        for (let l = 0; l < r.h; l += 2) px(b, Math.floor((cc - CC0) * sx), Math.floor((r.line + l - top) * sy));
      }
    }
    // players / missiles (single-line P/M at PMBASE)
    const base = (m.antic[7] & 0xf8) << 8;
    for (let L = top; L < bot; L++) {
      const y = Math.floor((L - top) * sy);
      for (let n = 0; n < 4; n++) {
        const v = m.mem[base + 0x400 + n * 0x100 + L]; if (!v) continue;
        for (let bit = 0; bit < 8; bit++) if ((v >> (7 - bit)) & 1) { const cc = m.gtia[n] + bit; if (cc >= CC0 && cc < CC1) px(b, Math.floor((cc - CC0) * sx), y); }
      }
      const ms = m.mem[base + 0x300 + L];
      if (ms) for (let k = 0; k < 4; k++) for (let d = 0; d < 2; d++) if ((ms >> (2 * k + 1 - d)) & 1) {
        const cc = m.gtia[4 + k] + d; if (cc >= CC0 && cc < CC1) px(b, Math.floor((cc - CC0) * sx), y);
      }
    }
  }
  // title line
  const t = title(m);
  if (t) {
    for (let y = 0; y < 7; y++) for (let x = 0; x < W; x++) px(b, x, y, 1);
    const s = t.length > 16 ? t.slice(Math.min(t.length - 16, Math.max(0, (g.t >> 3) % (t.length - 8) - 4))) : t;
    text(b, Math.max(0, (W - Math.min(16, s.length) * 4 + 1) >> 1), 1, s.slice(0, 16), 0);
  }
  // HUD: velocity, kills, energy from the Control Panel
  const [p0] = panel(m), num = k => (p0.slice(p0.indexOf(k + ":") + 2).match(/^[0-9~]+/) || [""])[0];
  if (m.mem[0xd0] !== 0x80) {                           // (the chart has its own text)
  for (let x = 0; x < W; x++) px(b, x, 58, 0);
  text(b, 0, 59, "V" + num("V"));
  text(b, 21, 59, "K" + num("K"));
  text(b, 43, 59, "E" + num("E").replace(/^0+(?=\d)/, ""));
  }
  if (g.menu) {
    for (let y = 8; y < 56; y++) for (let x = 2; x < 62; x++) px(b, x, y, y === 8 || y === 55 || x === 2 || x === 61 ? 1 : 0);
    const first = Math.max(0, Math.min(g.menu.i - 3, MENU.length - 7));
    for (let r = 0; r < 7; r++) {
      const k = first + r, [name, act] = MENU[k], y = 10 + r * 6, sel = k === g.menu.i;
      if (sel) for (let j = -1; j < 6; j++) for (let x = 3; x < 61; x++) px(b, x, y + j, 1);
      text(b, 4, y, (act === "speed" ? "SPEED < " + g.speed + " >" : name).slice(0, 14), sel ? 0 : 1);
    }
  }
  return b;
}

// ---- autopilot (demo / footage): plays the real game through its own controls ----------------------------------
// Like a player: START, Attack Computer + shields on, then Galactic Chart -> steer the arrival marker onto the
// nearest Zylon sector -> HYPERWARP -> front view -> fight: steer the nearest live Zylon (the game's PLAYER tables:
// PLnCOLUMN = horizontal P/M position, PLnROW = top P/M row) to the crosshairs (column 124, row 119), fire when close.
// Sector cleared -> chart again. Reads only what the game itself keeps in RAM (addresses from Wiest's source).
const A = { LIFE: 0xe9, COL: 0x0c2a, ROW: 0x0c5b, SHAP: 0x0c8c, HGT: 0x0cbd, ZSIGN: 0x09ad, VIEW: 0xd0, GC: 0x08c9,
  CURR: 0x90, ARRV: 0x92, AROW: 0x8e, ACOL: 0x8f, WARP: 0xc0 };
export function pilot(g) {
  const m = g.m, mem = m.mem, inp = {};
  const p = g.pl || (g.pl = { t: 0, phase: "start", wait: 0 });
  p.t++;
  const key = (k, w = 20) => { m.key(k); p.wait = w; };
  if (p.wait > 0) { p.wait--; return inp; }
  const zylons = () => [0, 1].filter(n => mem[A.LIFE + n] && [1, 7, 8].includes(mem[A.SHAP + n] >> 4));
  switch (p.phase) {
    case "start": if (p.t < 20) return inp; m.consol = 6; g.consolT = 4; p.phase = "setup"; p.wait = 30; p.k = 0; return inp;
    case "setup": { const ks = ["C", "S", "6"]; if (p.k < ks.length) key(ks[p.k++], 25); else p.phase = "chart"; return inp; }
    case "chart": {
      let best = null;
      for (let i = 0; i < 128; i++) {
        const v = mem[A.GC + i]; if (v & 0x80 || !(v & 7)) continue;
        const d = Math.abs((i & 15) - (mem[A.CURR] & 15)) + Math.abs((i >> 4) - (mem[A.CURR] >> 4));
        if (!best || d < best.d) best = { i, d };
      }
      if (!best) return inp;
      p.target = best.i; key("G", 30); p.phase = "aim"; p.aimT = 0; return inp;
    }
    case "aim": {
      if (++p.aimT > 900) { p.phase = "chart"; return inp; }
      if (mem[A.ARRV] === p.target) { key("H", 40); p.phase = "warp"; p.warpT = 0; return inp; }
      const tc = (p.target & 15) * 8 + 4, tr = (p.target >> 4) * 16 + 8;
      if (mem[A.ACOL] < tc - 2) inp.right = true; else if (mem[A.ACOL] > tc + 2) inp.left = true;
      if (mem[A.AROW] < tr - 4) inp.down = true; else if (mem[A.AROW] > tr + 4) inp.up = true;
      return inp;
    }
    case "warp":
      if (++p.warpT === 2) key("F", 10);
      if (p.warpT > 30 && !mem[A.WARP]) { p.phase = "fight"; p.idle = 0; key("3", 10); }
      return inp;
    case "fight": {
      const zs = zylons();
      if (!zs.length) { if (++p.idle > 240 && !(mem[A.GC + mem[A.CURR]] & 7)) p.phase = "chart"; inp.left = (p.t >> 6) & 1; return inp; }
      p.idle = 0;
      if (mem[A.VIEW] !== 0) { key("F", 6); return inp; }
      // steer on the game's 3D positions (17-bit: sign byte 1 = +, mantissa two's complement). The game's ROTATE
      // (Wiest's notes): stick left x += z/64, z -= x/64 -> push toward the target; vertical measured on a star
      const c3 = (sg, hi, lo, n) => (mem[sg + n] ? 0 : -65536) + mem[hi + n] * 256 + mem[lo + n];
      let best = null;
      for (const n of zs) {
        const z = c3(0x09ad, 0x0a40, 0x0ad3, n), x = c3(0x09de, 0x0a71, 0x0b04, n), y = c3(0x0a0f, 0x0aa2, 0x0b35, n);
        const d = Math.hypot(x, y, z) + (z < 0 ? 40000 : 0);
        if (!best || d < best.d) best = { n, x, y, z, d };
      }
      g.target = best;
      const { x, y, z } = best;
      const k = Math.max(0, z) * 0.03;
      if (x < -k) inp.left = true; else if (x > k) inp.right = true;      // also swings a target behind us round
      if (z > 0) { if (y < -k) inp.up = true; else if (y > k) inp.down = true; }   // measured: stick up raises y (nose down)
      if (Math.abs(x) < z * 0.08 && Math.abs(y) < z * 0.08 && z < 16000) inp.a = (p.t >> 2) & 1;
      return inp;
    }
  }
  return inp;
}
