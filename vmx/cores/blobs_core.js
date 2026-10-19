// BLOBS: a falling-pairs, match-four game for the VMX's 64x64 1-bit screen (working name). Written from scratch;
// the rules follow the genre as described in Sega's public "Puyo Puyo Programming" booklet (mechanics only; no
// code, names or art of theirs are used - their code licence allows learning use only, owner 2026-10-18).
// Pure logic + drawing into a 64x64 bit buffer, seeded, fixed 30 Hz ticks: the page (blobs.html) and the film
// exporter (tools/blobs_film.mjs) run the same code.
//
// Rules: a 6 x 12 board, 4 kinds of blob. A pair falls (faster while Down is held, +1 point per row); left/right
// move it unless a wall or blob is in the way (while falling, the row below must be clear too); A / B turn it 90
// degrees (blocked against a wall it kicks away from it; turning into the floor lifts it a row); once it lands
// there is a short grace period before it locks. 4+ touching blobs of a kind (up/down/left/right) pop, the rest
// fall, and any new groups pop as a chain. A new pair that can't appear is game over (it restarts).

export const W = 64, H = 64, COLS = 6, ROWS = 12, KINDS = 4, CELL = 5;
const BX = 2, BY = 3;                                // board's top-left on screen (30 x 60 px)
const FALL = 0.06, SOFT = 0.5, LOCK = 15;            // rows per tick; ticks of grace once landed
const POP_T = 24;
const BLOB = [                                       // 5x5 patterns, one per kind
  [".###.", "#####", "#####", "#####", ".###."],     // solid
  [".###.", "#...#", "#...#", "#...#", ".###."],     // ring
  [".#.#.", "#.#.#", ".#.#.", "#.#.#", ".#.#."],     // checker
  [".###.", "#.#.#", "#####", "#...#", ".###."],     // face
];
const FONT = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",E:"111100110100111",G:"011100101101011",H:"101101111101101",
  I:"111010010010111",L:"100100100100111",M:"101111111101101",N:"110101101101101",O:"010101101101010",R:"110101110101101",
  S:"011100010001110",T:"111010010010010",V:"101101101101010",X:"101101010101101",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110","4":"101101111001001",
  "5":"111100110001110","6":"011100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001110",
  " ":"000000000000000","!":"010010010000010"
};

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function newGame(seed = 1) {
  const g = { rnd: rng(seed), t: 0, board: Array.from({ length: ROWS }, () => Array(COLS).fill(-1)),
              score: 0, chain: 0, best: 0, phase: "spawn", pair: null, next: null, pop: null, over: 0, banner: 0, bannerText: "" };
  g.next = [Math.floor(g.rnd() * KINDS), Math.floor(g.rnd() * KINDS)];
  return g;
}

const OFF = [[0, -1], [1, 0], [0, 1], [-1, 0]];      // child offset by rotation: up, right, down, left
const free = (g, x, y) => x >= 0 && x < COLS && y < ROWS && (y < 0 || g.board[y][x] < 0);
function fits(g, x, y, rot) {                         // pair (pivot at x, floor(y)) fits; y is fractional
  const [dx, dy] = OFF[rot], yi = Math.floor(y), yc = Math.ceil(y);
  return free(g, x, yi) && free(g, x, yc) && free(g, x + dx, yi + dy) && free(g, x + dx, yc + dy);
}

function groups(board) {                              // groups of 4+ touching blobs of a kind
  const seen = new Set(), out = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const k = board[y][x]; if (k < 0 || seen.has(y * COLS + x)) continue;
    const grp = [], stack = [[x, y]]; seen.add(y * COLS + x);
    while (stack.length) {
      const [cx, cy] = stack.pop(); grp.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && board[ny][nx] === k && !seen.has(ny * COLS + nx)) {
          seen.add(ny * COLS + nx); stack.push([nx, ny]);
        }
      }
    }
    if (grp.length >= 4) out.push(grp);
  }
  return out;
}

function settle(board) {                              // blobs fall; true if anything moved
  let moved = false;
  for (let x = 0; x < COLS; x++) {
    const col = []; for (let y = ROWS - 1; y >= 0; y--) if (board[y][x] >= 0) col.push(board[y][x]);
    for (let y = ROWS - 1, i = 0; y >= 0; y--, i++) { const v = i < col.length ? col[i] : -1; if (board[y][x] !== v) moved = true; board[y][x] = v; }
  }
  return moved;
}

export function step(g, input) {                      // input: {left, right, rotL, rotR} edge presses, {down} held
  g.t++;
  if (g.banner) g.banner--;
  if (g.over) { if (--g.over === 0) Object.assign(g, newGame(Math.floor(g.rnd() * 1e9))); return; }
  if (g.phase === "spawn") {
    g.pair = { x: 2, y: -1, rot: 0, kinds: g.next, lock: 0 };
    g.next = [Math.floor(g.rnd() * KINDS), Math.floor(g.rnd() * KINDS)];
    if (!fits(g, 2, 0, 0)) { g.over = 90; g.banner = 90; g.bannerText = "GAME OVER"; return; }
    g.phase = "fall"; g.chain = 0;
  }
  if (g.phase === "fall") {
    const p = g.pair;
    if (input.left && fits(g, p.x - 1, p.y, p.rot)) p.x--;
    if (input.right && fits(g, p.x + 1, p.y, p.rot)) p.x++;
    for (const [pressed, dir] of [[input.rotR, 1], [input.rotL, 3]]) {
      if (!pressed) continue;
      const r = (p.rot + dir) % 4;
      if (fits(g, p.x, p.y, r)) p.rot = r;
      else if (fits(g, p.x - OFF[r][0], p.y, r)) { p.x -= OFF[r][0]; p.rot = r; }     // kick off the wall
      else if (OFF[r][1] === 1 && fits(g, p.x, p.y - 1, r)) { p.y -= 1; p.rot = r; }   // into the floor: lift
    }
    const dy = input.down ? SOFT : FALL;
    if (fits(g, p.x, p.y + dy, p.rot)) {
      if (input.down && Math.floor(p.y + dy) > Math.floor(p.y)) g.score += 1;
      p.y += dy; p.lock = 0;
    } else {
      p.y = Math.floor(p.y + dy - 1e-9);
      while (!fits(g, p.x, p.y, p.rot)) p.y--;
      if (++p.lock >= (input.down ? 2 : LOCK)) {      // lock: place both, they settle on their own
        const [dx, ddy] = OFF[p.rot], y = Math.round(p.y);
        if (y >= 0) g.board[y][p.x] = p.kinds[0];
        if (y + ddy >= 0) g.board[y + ddy][p.x + dx] = p.kinds[1];
        g.pair = null; settle(g.board); g.phase = "check";
      }
    }
  }
  if (g.phase === "check") {
    const grp = groups(g.board);
    if (!grp.length) { g.phase = "spawn"; return; }
    g.chain++;
    const n = grp.reduce((a, gr) => a + gr.length, 0);
    g.score += n * 10 * Math.pow(2, g.chain - 1);    // our own scoring: 10 a blob, doubled every chain step
    g.best = Math.max(g.best, g.chain);
    if (g.chain >= 2) { g.banner = 40; g.bannerText = g.chain + " CHAIN!"; }
    g.pop = { cells: new Set(grp.flat().map(([x, y]) => y * COLS + x)), t: POP_T };
    g.phase = "pop";
  }
  if (g.phase === "pop" && --g.pop.t <= 0) {
    for (const c of g.pop.cells) g.board[Math.floor(c / COLS)][c % COLS] = -1;
    g.pop = null; settle(g.board); g.phase = "check";
    if (g.board.every(r => r.every(v => v < 0))) { g.score += 2100; g.banner = 60; g.bannerText = "ALL CLEAR!"; }
  }
}

// ---- drawing ------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function text(b, x, y, s) { for (const ch of s) { const f = FONT[ch] || FONT[" "]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r); x += 4; } }
function blob(b, x, y, k) { BLOB[k].forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === "#") px(b, x + i, y + j); }); }

export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  for (let y = BY - 1; y <= BY + ROWS * CELL; y++) { px(b, BX - 1, y); px(b, BX + COLS * CELL, y); }   // well
  for (let x = BX - 1; x <= BX + COLS * CELL; x++) px(b, x, BY + ROWS * CELL);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const k = g.board[y][x]; if (k < 0) continue;
    if (g.pop && g.pop.cells.has(y * COLS + x) && (g.pop.t >> 2) % 2) continue;                    // pop blink
    blob(b, BX + x * CELL, BY + y * CELL, k);
  }
  if (g.pair) {
    const p = g.pair, [dx, dy] = OFF[p.rot], sy = Math.round(p.y * CELL);
    if (p.y >= 0) blob(b, BX + p.x * CELL, BY + sy, p.kinds[0]);
    if (p.y + dy >= 0) blob(b, BX + (p.x + dx) * CELL, BY + sy + dy * CELL, p.kinds[1]);
  }
  // side panel: NEXT pair, score, best chain
  text(b, 36, 2, "NEXT");
  for (let y = 8; y <= 20; y++) { px(b, 38, y); px(b, 46, y); } for (let x = 38; x <= 46; x++) { px(b, x, 8); px(b, x, 20); }
  if (g.next) { blob(b, 40, 9, g.next[1]); blob(b, 40, 14, g.next[0]); }
  text(b, 36, 26, "SCORE");
  text(b, 36, 33, String(g.score % 1000000).padStart(6, "0").slice(-6).slice(0, 3));
  text(b, 48, 33, String(g.score % 1000000).padStart(6, "0").slice(-3));
  if (g.banner) {
    const words = g.bannerText.split(" ");
    words.forEach((w, i) => text(b, 36, 44 + i * 7, w));
  } else if (g.best >= 2) { text(b, 36, 44, "BEST"); text(b, 36, 51, g.best + " CH"); }
  return b;
}

// ---- demo player (for the film): tries every column and turn, simulates the drop and the chain it sets off, and
// prefers chains, then blobs next to their own kind, then a low stack ----------------------------------------------
function placements(board, kinds) {                // every column and turn for a pair, dropped onto board
  const out = [];
  for (let rot = 0; rot < 4; rot++) for (let x = 0; x < COLS; x++) {
    const [dx, dy] = OFF[rot]; if (x + dx < 0 || x + dx >= COLS) continue;
    const bd = board.map(r => r.slice());
    const drop = (cx, k) => { let y = -1; while (y + 1 < ROWS && bd[y + 1][cx] < 0) y++; if (y < 0) return false; bd[y][cx] = k; return true; };
    const first = dy === 1 ? 1 : 0;                   // the lower blob lands first
    const xs = [x, x + dx];
    if (!drop(xs[first], kinds[first]) || !drop(xs[1 - first], kinds[1 - first])) continue;
    let chain = 0, popped = 0, grp;
    while ((grp = groups(bd)).length) { chain++; for (const gr of grp) for (const [cx, cy] of gr) { bd[cy][cx] = -1; popped++; } settle(bd); }
    out.push({ x, rot, bd, chain, popped });
  }
  return out;
}

function value(bd) {                                  // how good a board is to build on
  let adj = 0, height = 0, threes = 0;
  const seen = new Set();
  for (let y = 0; y < ROWS; y++) for (let cx = 0; cx < COLS; cx++) {
    if (bd[y][cx] < 0) continue; height += ROWS - y;
    if (cx + 1 < COLS && bd[y][cx + 1] === bd[y][cx]) adj++;
    if (y + 1 < ROWS && bd[y + 1][cx] === bd[y][cx]) adj++;
  }
  const tall = Math.max(...Array.from({ length: COLS }, (_, cx) => { let y = 0; while (y < ROWS && bd[y][cx] < 0) y++; return ROWS - y; }));
  const danger = (bd[1][2] >= 0 || bd[1][3] >= 0) ? 5000 : 0;
  return adj * 8 - height * 0.5 - Math.max(0, tall - 8) * 30 - danger;
}

function worth(m, stackH) {                           // a move's own reward: chains count a lot, lone pops little
  const early = stackH < 24 && m.chain === 1;         // keep building while the board is low
  return m.chain * m.chain * m.chain * 80 + (early ? -60 : m.popped * 4);
}

export function plan(g) {
  if (!g.pair) return null;
  const stackH = g.board.flat().filter(v => v >= 0).length;
  let best = null;
  for (const m of placements(g.board, g.pair.kinds)) {
    let follow = -1e9;                                // best follow-up with the next pair (2-step look-ahead)
    for (const m2 of placements(m.bd, g.next)) follow = Math.max(follow, worth(m2, stackH) * 0.8 + value(m2.bd));
    const sc = worth(m, stackH) + (follow > -1e9 ? follow : value(m.bd) - 3000);
    if (!best || sc > best.score) best = { x: m.x, rot: m.rot, score: sc };
  }
  return best;
}

export function demo(g) {
  const want = { left: false, right: false, rotL: false, rotR: false, down: false };
  if (!g.pair) return want;
  if (!g.goal || g.goal.pair !== g.pair) g.goal = { pair: g.pair, ...(plan(g) || { x: g.pair.x, rot: g.pair.rot }) };
  if (g.t % 3) return want;                            // a human-ish 10 inputs a second
  const p = g.pair;
  if (p.rot !== g.goal.rot) want.rotR = true;
  else if (p.x < g.goal.x) want.right = true;
  else if (p.x > g.goal.x) want.left = true;
  else want.down = true;
  return want;
}
