// REVERSI for the VMX's 64x64 1-bit screen (the generic name; "Othello" is a trademark). Written from scratch.
// 8x8, the four centre discs to start; place a disc so it brackets a line of the other side's discs, which flip.
// No legal move = pass; neither side can move = game over, most discs wins. You (solid discs) play the computer
// (rings), which searches with alpha-beta on a corner/edge-weighted evaluation. D-pad moves the cursor (legal
// squares are dotted), A places. Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const SQ = 7, BX = 3, BY = 0;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const WEIGHT = [120, -20, 20, 5, 5, 20, -20, 120, -20, -40, -5, -5, -5, -5, -40, -20, 20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5, 5, -5, 3, 3, 3, 3, -5, 5, 20, -5, 15, 3, 3, 15, -5, 20, -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120];
const FONT = { Y:"101101010010010",O:"010101101101010",U:"101101101101111",W:"101101111111101",I:"111010010010111",N:"110101101101101",
  L:"100100100100111",S:"011100010001110",E:"111100110100111",P:"110101110100100",A:"010101111101101",D:"110101101101110",
  R:"110101110101101",V:"101101101101010",C:"011100100100011",T:"111010010010010",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110","4":"101101111001001","5":"111100110001110",
  "6":"011100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001110"," ":"000000000000000","!":"010010010000010" };
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function newGame(seed = 1) {
  const b = Array(64).fill(0); b[27] = b[36] = 2; b[28] = b[35] = 1;
  return { rnd: rng(seed), t: 0, b, turn: 1, cur: [2, 3], flips: [], msg: "", msgT: 0, over: 0, think: 0, passes: 0 };
}
function flipsFor(b, i, side) {                       // discs that placing at i would flip
  if (b[i]) return [];
  const r = i >> 3, c = i & 7, other = 3 - side, out = [];
  for (const [dr, dc] of DIRS) {
    const line = []; let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === other) { line.push(rr * 8 + cc); rr += dr; cc += dc; }
    if (line.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === side) out.push(...line);
  }
  return out;
}
export const legal = (b, side) => [...Array(64).keys()].filter(i => flipsFor(b, i, side).length);
function place(b, i, side) { const nb = b.slice(), f = flipsFor(b, i, side); nb[i] = side; for (const j of f) nb[j] = side; return { b: nb, f }; }

function evaluate(b) {                                // from side 2's view
  let s = 0, n1 = 0, n2 = 0;
  for (let i = 0; i < 64; i++) { if (b[i] === 2) { s += WEIGHT[i]; n2++; } else if (b[i] === 1) { s -= WEIGHT[i]; n1++; } }
  const m2 = legal(b, 2).length, m1 = legal(b, 1).length;
  return s + (m2 - m1) * 8 + (n1 + n2 > 54 ? (n2 - n1) * 10 : 0);
}
function search(b, side, depth, a, bb) {
  const ms = legal(b, side);
  if (depth === 0) return evaluate(b);
  if (!ms.length) {
    if (!legal(b, 3 - side).length) { let d = 0; for (const v of b) d += v === 2 ? 1 : v === 1 ? -1 : 0; return d * 1000; }
    return search(b, 3 - side, depth - 1, a, bb);
  }
  if (side === 2) { let best = -1e9; for (const i of ms) { best = Math.max(best, search(place(b, i, 2).b, 1, depth - 1, a, bb)); a = Math.max(a, best); if (a >= bb) break; } return best; }
  let best = 1e9; for (const i of ms) { best = Math.min(best, search(place(b, i, 1).b, 2, depth - 1, a, bb)); bb = Math.min(bb, best); if (a >= bb) break; } return best;
}
export function bestMove(g, side, depth = 4) {
  let best = null;
  for (const i of legal(g.b, side)) {
    let v = search(place(g.b, i, side).b, 3 - side, depth - 1, -1e9, 1e9); if (side === 1) v = -v;
    v += g.rnd() * 4;
    if (best === null || v > best.v) best = { i, v };
  }
  return best && best.i;
}

function play(g, i) {
  const r = place(g.b, i, g.turn); g.b = r.b;
  g.flips = r.f.map(j => ({ i: j, t: 0, to: g.turn })); g.placed = { i, t: 0 };
  g.turn = 3 - g.turn; afterTurn(g);
}
function afterTurn(g) {
  if (legal(g.b, g.turn).length) return;
  if (!legal(g.b, 3 - g.turn).length) {             // nobody can move: count
    const n1 = g.b.filter(v => v === 1).length, n2 = g.b.filter(v => v === 2).length;
    g.msg = n1 > n2 ? "YOU WIN!" : n1 < n2 ? "YOU LOSE" : "DRAW"; g.msgT = 150; g.over = 150; return;
  }
  g.msg = g.turn === 1 ? "YOU PASS" : "CPU PASS"; g.msgT = 40; g.turn = 3 - g.turn;
}
export function step(g, inp, cpuSides = [2]) {
  g.t++;
  if (g.msgT) g.msgT--;
  for (const f of g.flips) f.t++;
  g.flips = g.flips.filter(f => f.t < 10);
  if (g.placed && ++g.placed.t > 8) g.placed = null;
  if (g.over) { if (--g.over === 0) Object.assign(g, newGame(Math.floor(g.rnd() * 1e9))); return; }
  if (g.flips.length || (g.msgT && g.msg.endsWith("PASS"))) return;
  if (cpuSides.includes(g.turn)) {
    if (++g.think < 20) return; g.think = 0;
    const i = bestMove(g, g.turn); if (i !== null && i !== undefined) play(g, i);
    return;
  }
  const [r, c] = g.cur;
  if (inp.up) g.cur = [Math.max(0, r - 1), c]; if (inp.down) g.cur = [Math.min(7, r + 1), c];
  if (inp.left) g.cur = [r, Math.max(0, c - 1)]; if (inp.right) g.cur = [r, Math.min(7, c + 1)];
  if (inp.a) { const i = g.cur[0] * 8 + g.cur[1]; if (flipsFor(g.b, i, 1).length) play(g, i); }
}

// ---- drawing -----------------------------------------------------------------------------------------------------
// Solid 1 px grid (owner), 7 px pitch: 57 x 57 board centred across the top; each square's 6 x 6 opening holds a 4 x 4 disc with a
// 1 px margin all round, so discs never touch the lines. Row underneath (y 58-62): both counts, the mover's disc blinks.
const DISC = { 1: [".##.", "####", "####", ".##."], 2: [".##.", "#..#", "#..#", ".##."] };
function px(b, x, y, v = 1) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function text(b, x, y, s, v = 1) { for (const ch of s) { const f = FONT[ch] || FONT[" "]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r, v); x += 4; } }
function disc(b, x, y, side, w = 4) {                 // 4 x 4 disc at (x, y); w = 2 is the mid-flip edge-on view
  const s = DISC[side];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (w === 2 && (c === 0 || c === 3)) continue;
    if (w === 2 ? (r > 0 && r < 3 && side === 2 ? 0 : 1) : s[r][c] === "#") px(b, x + c, y + r);
  }
}
export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  for (let k = 0; k <= 8; k++) for (let t = 0; t <= 56; t++) { px(b, BX + k * SQ, BY + t); px(b, BX + t, BY + k * SQ); }
  const flipping = new Map(g.flips.map(f => [f.i, f]));
  for (let i = 0; i < 64; i++) {
    const v = g.b[i]; if (!v) continue;
    const x = BX + (i & 7) * SQ + 2, y = BY + (i >> 3) * SQ + 2, f = flipping.get(i);
    if (f) disc(b, x, y, f.t < 5 ? 3 - f.to : f.to, f.t >= 3 && f.t < 7 ? 2 : 4);
    else if (g.placed && g.placed.i === i && g.placed.t < 3) disc(b, x, y, v, 2);
    else disc(b, x, y, v);
  }
  if (g.turn === 1 && !g.over) {
    if ((g.t >> 4) & 1) for (const i of legal(g.b, 1)) for (const [dx, dy] of [[3, 3], [4, 3], [3, 4], [4, 4]])
      px(b, BX + (i & 7) * SQ + dx, BY + (i >> 3) * SQ + dy);                       // hints: a small centre dot
    const x = BX + g.cur[1] * SQ, y = BY + g.cur[0] * SQ;                            // cursor: the square's inner rim
    for (let k = 1; k <= 6; k++) for (const [xx, yy] of [[x + k, y + 1], [x + k, y + 6], [x + 1, y + k], [x + 6, y + k]])
      px(b, xx, yy);
  }
  const n1 = g.b.filter(v => v === 1).length, n2 = g.b.filter(v => v === 2).length;
  const blink = !g.over && (g.t >> 3) & 1;
  for (const [side, n, x] of [[1, n1, 4], [2, n2, 45]]) {
    if (!(blink && g.turn === side)) disc(b, x, 59, side);
    text(b, x + 6, 58, String(n).padStart(2, "0"));
  }
  if (g.msgT) {
    const w = g.msg.length * 4 + 3, x = BX + Math.round((57 - w) / 2);
    for (let y = 26; y < 37; y++) for (let i = 0; i < w; i++) px(b, x + i, y, y === 26 || y === 36 || i === 0 || i === w - 1 ? 1 : 0);
    text(b, x + 2, 29, g.msg);
  }
  return b;
}
