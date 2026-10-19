// Tricky Wicks for the VMX's 64x64 1-bit screen: the owner's game, its rules unchanged (the compiled C core in
// tricky_rules.js, from TRICKY WICKS/v1.5), redrawn for 64x64. Run a wick from a flame to a bomb; Up drops the
// piece, A / B turn it. This file is the glue (buttons in, state out of the core's memory, as the v1.5 page does),
// the CPU player (the core's own AI) and a 1-bit renderer: a 6 x 8 field of 7 px cells + a side panel.
import { CORE } from "./tricky_rules.js";

export const W = 64, H = 64, COLS = 6, ROWS = 8, TS = 16;
const C = 7, FX = 1, FY = 5;                         // field at (1,5): 42 x 56
const KINDS = [null, "rope", "bomb", "cannon", "fire", "bigfire", "block"];
const BUTTONS = ["left", "right", "up", "down", "a", "b"];
// rope tiles: which sides each connects (N E S W), read off the v1.5 sprite sheet's mini tiles
const CONN = ["EW", "NS", "ES", "SW", "NW", "NE", "ESW", "NSW", "NEW", "NES", "NESW", "ESW", "NSW", "NEW", "NES", "NESW"];
const MEM8 = new Uint8Array(CORE.memory.buffer), MEM16 = new Uint16Array(CORE.memory.buffer), MEM32 = new Uint32Array(CORE.memory.buffer);
const cString = p => { let s = ""; while (MEM8[p]) s += String.fromCharCode(MEM8[p++]); return s; };
const FIELD = {};
cString(CORE.web_names()).split(",").filter(Boolean).forEach((name, i) => {
  const p = (CORE.web_layout() >> 2) + i * 2; FIELD[name] = { at: MEM32[p], size: MEM32[p + 1] };
});
const FONT = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",E:"111100110100111",G:"011100101101011",H:"101101111101101",
  I:"111010010010111",K:"101101110101101",L:"100100100100111",M:"101111111101101",N:"110101101101101",O:"010101101101010",
  R:"110101110101101",S:"011100010001110",T:"111010010010010",V:"101101101101010",W:"101101111111101",X:"101101010101101",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110","4":"101101111001001",
  "5":"111100110001110","6":"011100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001110",
  " ":"000000000000000","x":"000101010101000","+":"000010111010000"
};

export function newGame(seed = 1, slot = 0) {
  const base = CORE.web_game(slot);
  const rd = (name, i) => { const f = FIELD[name], a = base + f.at + (i | 0) * f.size; return f.size === 1 ? MEM8[a] : f.size === 2 ? MEM16[a >> 1] : MEM32[a >> 2]; };
  CORE.web_use(slot); CORE.tw_init(seed & 0xFFFF, 0);
  return { slot, rd, t: 0, seed };
}
export function step(g, held, pressed) {             // held / pressed: {left, right, up, down, a, b}
  const bits = o => BUTTONS.reduce((m, k, i) => o && o[k] ? m | (1 << i) : m, 0);
  CORE.web_use(g.slot); CORE.tw_step(bits(held), bits(pressed)); g.t++;
  if (g.rd("over")) { g.overT = (g.overT || 0) + 1; if (g.overT > 90) Object.assign(g, newGame((g.seed = g.seed * 31 + 7) & 0xFFFF, g.slot)); }
}
export function aiInit(g, seed) { CORE.web_use(g.slot); CORE.tw_ai_init(seed & 0xFFFF); }
export function ai(g) {                              // the core's own CPU player: buttons to press this frame
  CORE.web_use(g.slot); const b = CORE.tw_ai_think();
  return BUTTONS.reduce((o, k, i) => (o[k] = !!(b & (1 << i)), o), {});
}

// ---- drawing --------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function text(b, x, y, s) { for (const ch of s) { const f = FONT[ch] || FONT[" "]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r); x += 4; } }
function tile(b, x, y, k, t, timer, frame) {         // one 7x7 cell
  const blink = timer !== undefined && ((frame >> 2) & 1);
  if (k === "rope") {
    if (blink) return;                                                                   // burning: flickers
    // (no tile-corner dots: owner)
    // a 3 px rope from the centre to each connected edge (owner: bolder wicks): its two edges solid, its middle
    // dotted every other pixel (the braid); a solid knot where the ropes meet
    const conn = CONN[t] || "";
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
      const inV = i >= 2 && i <= 4, inH = j >= 2 && j <= 4;
      const armV = inV && ((j < 2 && conn.includes("N")) || (j > 4 && conn.includes("S")));
      const armH = inH && ((i < 2 && conn.includes("W")) || (i > 4 && conn.includes("E")));
      const knot = inV && inH;
      const on = knot ? !(i === 3 && j === 3) || conn.length > 2
               : armV ? (i !== 3 || j % 2 === 0)
               : armH ? (j !== 3 || i % 2 === 0) : false;
      if (on) px(b, x + i, y + j);
    }
  } else if (k === "bomb" || k === "cannon") {     // solid ball, cut highlight and fuse cap (owner:
    // more distinct from the flames, which are hollow)
    if (blink) return;
    // a still fuse, no spark (owner: an animated spark made new players think it would go off on its own; a lit
    // bomb still blinks, which is the game's real "about to go")
    const m = [".....#.", "....#..", "..###..", ".#####.", "##.####", "#######", ".#####."];
    m.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === "#") px(b, x + i, y + j); });
  } else if (k === "fire" || k === "bigfire") {     // hollow flame with an inner tongue; the tip flickers
    const flick = (frame >> 3) & 1;
    const f = k === "fire"
      ? [flick ? "...#..." : "..#....", "..#.#..", ".#...#.", ".#.#.#.", "#..#..#", "#.###.#", ".#####."]
      : [flick ? "...#..." : "..#....", "..###..", ".##.##.", ".#####.", "##.#.##", "#.###.#", ".#####."];   // big:
                                         // the same flame, fuller, with a solid core (owner: the 2-tongue one read as an X)
    f.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === "#" && !(blink && j < 2)) px(b, x + i, y + j); });
  } else if (k === "block") {
    if (blink) return;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (i === 0 || j === 0 || i === 6 || j === 6 || (i + j) % 3 === 0) px(b, x + i, y + j);
  }
}

export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  const rd = g.rd;
  for (let y = FY - 1; y <= FY + ROWS * C; y++) { px(b, FX - 1 + 0, y); px(b, FX + COLS * C, y); }
  for (let x = FX - 1; x <= FX + COLS * C; x++) px(b, x, FY + ROWS * C);
  for (let r = 0, i = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++, i++) {
    const k = KINDS[rd("kind", i)]; if (!k) continue;
    const tm = rd("tm", i);
    tile(b, FX + c * C, FY + r * C + Math.round(rd("off", i) * C / TS), k, rd("t", i), tm !== 255 ? tm : undefined, g.t);
  }
  const pk = KINDS[rd("p_kind")];
  if (pk) tile(b, FX + rd("p_col") * C, FY + Math.round((rd("p_y") - TS) * C / TS), pk, rd("p_t"), undefined, g.t);
  for (let i = 0, n = rd("n_booms"); i < n; i++) {                                   // explosions
    const cx = FX + rd("boom_c", i) * C + 3, cy = FY + rd("boom_r", i) * C + 3, t = rd("boom_t", i);
    const r = Math.min(7, t / 2);
    for (let a = 0; a < 16; a++) { const an = a * Math.PI / 8 + t * 0.2; px(b, cx + Math.cos(an) * r, cy + Math.sin(an) * r); if (a % 2) px(b, cx + Math.cos(an) * r * 0.5, cy + Math.sin(an) * r * 0.5); }
  }
  // side panel
  text(b, 45, 0, "NXT");
  for (let y = 6; y <= 14; y++) { px(b, 46, y); px(b, 54, y); } for (let x = 46; x <= 54; x++) { px(b, x, 6); px(b, x, 14); }
  const nk = KINDS[rd("n_kind")]; if (nk) tile(b, 47, 7, nk, rd("n_t"), undefined, g.t);
  const sc = String(rd("score") % 1000000).padStart(6, "0");
  text(b, 45, 18, sc.slice(0, 3)); text(b, 45, 24, sc.slice(3));
  text(b, 45, 32, "LV"); text(b, 45, 38, String(rd("level")).padStart(2, "0"));
  text(b, 45, 46, "WK"); text(b, 45, 52, "x" + String(rd("wick")).padStart(2, "0"));
  for (let i = 0, n = rd("n_pops"); i < n; i++) {                                    // pop text: x2, CHAIN x2...
    const a = rd("pop_a", i), bb = rd("pop_b", i), type = rd("pop_type", i);
    const s = ["x" + bb, "x" + bb, "CHAIN", "", "+" + a][type] || "";
    if (s && rd("pop_t", i) >= 8) { const w = s.length * 4 - 1; const x = Math.max(1, Math.min(42 - w, Math.round(FX + (rd("pop_x", i) - 8) * C / TS - w / 2))); for (let yy = -1; yy < 6; yy++) for (let xx = -1; xx <= w; xx++) px(b, x + xx, 20 + yy, 0); text(b, x, 20, s); }
  }
  if (rd("over")) { for (let y = 22; y < 37; y++) for (let x = 0; x < 43; x++) px(b, x, y, (y === 22 || y === 36) ? 1 : 0); text(b, 8, 24, "GAME"); text(b, 8, 30, "OVER"); }
  return b;
}
