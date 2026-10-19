// BLOX: a Klax-style tile game for the VMX's 64x64 1-bit screen (owner: "let's make Klax real quick"; working name,
// Klax is a trademark). Pure logic + drawing into a 64x64 bit buffer; no DOM, so the browser page (blox.html) and
// the film exporter (tools/blox_film.mjs) run the same code. Deterministic: seeded RNG, fixed 30 Hz ticks.
//
// Screen: rows 0-5 score / KLAX banner, 6-27 the conveyor (5 lanes, tiles tumble toward you), 28-31 the paddle
// (holds up to 5 tiles), 33-63 the bin (5 x 5). Tiles: 5 patterns (solid, checker, hollow, stripes, diagonal).
// Controls: left/right move the paddle, A drops the paddle's top tile into the bin column under it.
// A line of 3+ same tiles across, down or diagonal in the bin is a klax: it flashes, clears, the bin settles.
// Missed tiles use up drops (3 = game over, it restarts).

export const W = 64, H = 64, LANES = 5, ROWS = 5, STACK = 5;
const LX = l => 4 + l * 11;                         // lane / column left x (tiles 10 wide)
const BELT0 = 6, BELT1 = 27, PADDLE_Y = 29, BIN_Y = 34, CELL_H = 6;
const FONT = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",D:"110101101101110",E:"111100110100111",G:"011100101101011",
  K:"101101110101101",L:"100100100100111",M:"101111111101101",N:"110101101101101",O:"010101101101010",P:"110101110100100",
  R:"110101110101101",S:"011100010001110",T:"111010010010010",V:"101101101101010",X:"101101010101101",Y:"101101010010010",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110","4":"101101111001001",
  "5":"111100110001110","6":"011100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001110",
  " ":"000000000000000","!":"010010010000010","x":"000101010101000"
};

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function newGame(seed = 1) {
  return { rnd: rng(seed), t: 0, belt: [], paddle: 2, stack: [], bin: Array.from({ length: LANES }, () => []),
           score: 0, drops: 3, flash: null, banner: 0, bannerText: "", spawnIn: 20, over: 0, klaxes: 0 };
}

function spawn(g) {
  g.belt.push({ lane: Math.floor(g.rnd() * LANES), kind: Math.floor(g.rnd() * 5), y: BELT0 });
  g.spawnIn = 34 + Math.floor(g.rnd() * 30) - Math.min(20, g.klaxes * 2);
}

function lines(bin) {                                // cells in 3+ runs of the same tile (across, down, diagonals)
  const at = (c, r) => (bin[c] && bin[c][r] !== undefined) ? bin[c][r] : -1;
  const hit = new Set();
  for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]])
    for (let c = 0; c < LANES; c++) for (let r = 0; r < ROWS; r++) {
      const k = at(c, r); if (k < 0) continue;
      let n = 1; while (at(c + dc * n, r + dr * n) === k) n++;
      if (n >= 3) for (let i = 0; i < n; i++) hit.add((c + dc * i) + "," + (r + dr * i));
    }
  return hit;
}

export function step(g, input) {                     // input: {left, right, a} edge-triggered presses this tick
  g.t++;
  if (g.over) { if (--g.over === 0) Object.assign(g, newGame(Math.floor(g.rnd() * 1e9)), { rnd: g.rnd }); return; }
  if (input.left) g.paddle = Math.max(0, g.paddle - 1);
  if (input.right) g.paddle = Math.min(LANES - 1, g.paddle + 1);
  if (input.a && g.stack.length && !g.flash) {
    const col = g.bin[g.paddle];
    if (col.length < ROWS) { col.push(g.stack.pop()); const hit = lines(g.bin); if (hit.size) g.flash = { hit, t: 18 }; }
  }
  if (g.flash && --g.flash.t === 0) {                // clear the klax, settle, chain
    const n = g.flash.hit.size;
    for (let c = 0; c < LANES; c++) g.bin[c] = g.bin[c].filter((_, r) => !g.flash.hit.has(c + "," + r));
    g.score += n * 50 * (g.chain = (g.chain || 0) + 1); g.klaxes++;
    g.banner = 40; g.bannerText = g.chain > 1 ? `BLOX x${g.chain}` : "BLOX!";
    const hit = lines(g.bin); g.flash = hit.size ? { hit, t: 18 } : null; if (!g.flash) g.chain = 0;
  }
  if (--g.spawnIn <= 0) spawn(g);
  const speed = 1 / (5 - Math.min(3, g.klaxes / 4));             // px per tick, speeds up with klaxes
  for (const tile of g.belt) tile.y += speed;
  for (const tile of g.belt.filter(t => t.y >= BELT1)) {
    g.belt.splice(g.belt.indexOf(tile), 1);
    if (tile.lane === g.paddle && g.stack.length < STACK) g.stack.push(tile.kind);
    else if (--g.drops <= 0) { g.over = 90; g.bannerText = "GAME OVER"; g.banner = 90; }
  }
  if (g.banner) g.banner--;
}

// ---- drawing --------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function text(b, x, y, s) { for (const ch of s) { const f = FONT[ch] || FONT[" "]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r); x += 4; } }
const tw = s => s.length * 4 - 1;
function tile(b, x, y, kind, h, flashOn = true) {   // a 10 x h tile in pattern `kind`
  for (let j = 0; j < h; j++) for (let i = 0; i < 10; i++) {
    const edge = i === 0 || i === 9 || j === 0 || j === h - 1;
    const on = [true, (i + j) % 2 === 0, edge, edge || j % 2 === 0, edge || (i + j) % 3 === 0][kind];
    if (on && flashOn) px(b, x + i, y + j);
  }
}

export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  // score, drops left, banner
  if (g.banner) text(b, (W - tw(g.bannerText)) >> 1, 0, g.bannerText);
  else { text(b, 1, 0, String(g.score).padStart(5, "0")); for (let i = 0; i < g.drops; i++) for (let j = 0; j < 3; j++) px(b, 61 - i * 4, 2, 1), px(b, 60 - i * 4, 1 + j, 1); }
  // conveyor: lane rails + tumbling tiles (height cycles 1..4 as it rolls)
  for (let l = 0; l <= LANES; l++) for (let y = BELT0; y <= BELT1; y += 2) px(b, LX(l) - 1, y);
  for (const t of g.belt) { const h = [4, 3, 1, 3][Math.floor(t.y / 2) % 4]; tile(b, LX(t.lane), Math.round(t.y) - h + 1, t.kind, h); }
  // paddle with its stack (each held tile 2 px tall above the paddle)
  const x = LX(g.paddle);
  for (let i = -1; i <= 10; i++) px(b, x + i, PADDLE_Y + 2);
  px(b, x - 1, PADDLE_Y + 1); px(b, x + 10, PADDLE_Y + 1);
  g.stack.forEach((k, i) => tile(b, x, PADDLE_Y - i * 2, k, 2));
  // bin
  for (let i = 2; i < 61; i++) px(b, i, H - 1);
  for (let y = BIN_Y - 1; y < H; y++) { px(b, 2, y); px(b, 60, y); }
  g.bin.forEach((col, c) => col.forEach((k, r) => {
    const on = !(g.flash && g.flash.hit.has(c + "," + r) && (g.flash.t >> 2) % 2);
    tile(b, LX(c), H - 2 - (r + 1) * CELL_H + 1, k, CELL_H - 1, on);
  }));
  return b;
}

// ---- demo player (for the film): catch the nearest tile; drop where it makes a klax, else on a matching tile -----
export function demo(g) {
  const want = { left: false, right: false, a: false };
  if (g.t % 4) return want;                          // a human-ish 7.5 moves a second
  // chase a tile only when it is about to arrive (time to get there + a margin), else go and drop what it holds
  const speed = 1 / (5 - Math.min(3, g.klaxes / 4));
  const near = g.belt.filter(t => (BELT1 - t.y) / speed < (Math.abs(t.lane - g.paddle) + 2) * 4 + 6)
                     .sort((a, b) => b.y - a.y)[0];
  let target = near && g.stack.length < STACK ? near.lane : null;
  if (target === null && g.stack.length) {
    const k = g.stack[g.stack.length - 1];
    let best = -1, bestScore = -1e9;
    for (let c = 0; c < LANES; c++) {
      if (g.bin[c].length >= ROWS) continue;
      const trial = g.bin.map(col => col.slice()); trial[c].push(k);
      const s = lines(trial).size * 100 + (g.bin[c][g.bin[c].length - 1] === k ? 10 : 0) - g.bin[c].length;
      if (s > bestScore) { bestScore = s; best = c; }
    }
    target = best;
    if (target === g.paddle) { want.a = true; return want; }
  }
  if (target === null) return want;
  if (target < g.paddle) want.left = true; else if (target > g.paddle) want.right = true;
  return want;
}
