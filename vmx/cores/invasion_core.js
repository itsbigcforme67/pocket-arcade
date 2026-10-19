// INVASION for the VMX's 64x64 1-bit screen: a Space Invaders-style shooter (working name; "Space Invaders" is
// Taito's trademark, and the sprites here are our own). 7 x 5 ranks march one alien at a time (the classic ripple, so
// they speed up as they thin out), drop and turn at the edges and shoot back; three shields crumble pixel by pixel;
// a mystery ship crosses now and then. D-pad left/right moves (held), A fires (one shot on screen at a time).
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks. step() takes HELD buttons.

export const W = 64, H = 64;
const COLS = 7, ROWS = 5, DX = 7, DY = 6, AW = 5, AH = 4, TOP = 13, PY = 57, SHIELD_Y = 48;
const PER_TICK = 2, DROP = 3, LIVES = 3;
const ALIEN = [                                        // [frame 0, frame 1] per kind; row 0 = top (30 pts)
  [["..#..", ".###.", "#.#.#", ".#.#."], ["..#..", ".###.", "#.#.#", "#...#"]],
  [["#...#", ".###.", "##.##", ".#.#."], [".#.#.", ".###.", "##.##", "#...#"]],
  [[".###.", "#####", "#.#.#", "#...#"], [".###.", "#####", "#.#.#", ".#.#."]]];
const KIND = [0, 1, 1, 2, 2], POINTS = [30, 20, 10];
const CANNON = ["..#..", ".###.", "#####"], UFO = [".#####.", "##.#.##", ".#####."];
const BOOM = ["#.#.#", ".#.#.", "#.#.#", ".#.#."];
const SHIELD = [".#######.", "#########", "#########", "##.....##"], SHIELD_X = [6, 27, 48];
const FONT = { A:"010101111101101",E:"111100110100111",G:"011100101101011",M:"101111111101101",O:"010101101101010",R:"110101110101101",
  V:"101101101101010",W:"101101111111101",S:"011100010001110",C:"011100100100011",L:"100100100100111",I:"111010010010111",
  N:"110101101101101",D:"110101101101110",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110","4":"101101111001001","5":"111100110001110",
  "6":"011100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001110"," ":"000000000000000","?":"110001010000010" };
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function newGame(seed = 1) {
  const g = { rnd: rng(seed), t: 0, score: 0, lives: LIVES, wave: 0, over: 0, prevA: false };
  newWave(g, true);
  return g;
}
function newWave(g, first) {
  if (!first) g.wave++;
  const y0 = TOP + DROP * Math.min(g.wave, 4);
  g.aliens = [];
  for (let r = ROWS - 1; r >= 0; r--) for (let c = 0; c < COLS; c++)            // bottom-left first: the ripple order
    g.aliens.push({ r, c, x: 8 + c * DX, y: y0 + r * DY, f: 0, alive: true });
  g.dir = 1; g.next = 0; g.dropNext = false; g.turnNext = false;
  g.px = 30; g.shot = null; g.bombs = []; g.booms = []; g.dead = 0; g.ufo = null; g.ufoT = 600; g.clear = 0;
  g.fireT = 40;
  resetShields(g);                                      // fresh shields each wave
}
function resetShields(g) {
  g.shield = new Uint8Array(W * H);
  for (const sx of SHIELD_X) SHIELD.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === "#") g.shield[(SHIELD_Y + j) * W + sx + i] = 1; }));
}
const alive = g => g.aliens.filter(a => a.alive);
function erode(g, x, y, up) {                          // a shot's blast: a ragged little crater
  for (let j = -2; j <= 2; j++) for (let i = -1; i <= 1; i++) {
    const xx = x + i, yy = y + j * (up ? -1 : 1);
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    if (Math.abs(j) + Math.abs(i) <= 2 && g.rnd() < 0.8 - Math.abs(j) * 0.15) g.shield[yy * W + xx] = 0;
  }
}
const shieldAt = (g, x, y) => x >= 0 && y >= 0 && x < W && y < H && g.shield[y * W + x];

export function step(g, inp) {
  g.t++;
  const fire = inp.a && !g.prevA; g.prevA = !!inp.a;
  for (const b of g.booms) b.t++; g.booms = g.booms.filter(b => b.t < 8);
  if (g.over) { if (--g.over === 0) Object.assign(g, newGame(Math.floor(g.rnd() * 1e9))); return; }
  if (g.clear) { if (--g.clear === 0) newWave(g); return; }
  if (g.dead) {                                        // the cannon's explosion, then the next life or the end
    if (--g.dead === 0) { if (g.lives <= 0) { g.over = 150; return; } g.px = 30; }
    return;
  }
  // cannon
  if (inp.left) g.px = Math.max(1, g.px - 1);
  if (inp.right) g.px = Math.min(W - 6, g.px + 1);
  if (fire && !g.shot) g.shot = { x: g.px + 2, y: PY - 2 };
  // the ranks: PER_TICK aliens move each tick, bottom-left to top-right; a full sweep = one step for the formation
  const live = alive(g);
  if (!live.length) { g.clear = 60; return; }
  for (let k = 0; k < PER_TICK; k++) {
    while (g.next < g.aliens.length && !g.aliens[g.next].alive) g.next++;
    if (g.next >= g.aliens.length) {                   // sweep done: decide the next one
      g.next = 0;
      const lx = Math.min(...live.map(a => a.x)), rx = Math.max(...live.map(a => a.x + AW - 1));
      if (g.dropNext) { g.dropNext = false; g.dir = -g.dir; }
      else if ((g.dir > 0 && rx >= W - 2) || (g.dir < 0 && lx <= 1)) g.dropNext = true;
      break;
    }
    const a = g.aliens[g.next++];
    if (g.dropNext) a.y += DROP; else a.x += g.dir;
    a.f ^= 1;
    for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) if (a.y + j < H) g.shield[(a.y + j) * W + a.x + i] = 0;
    if (a.y + AH >= PY) { g.lives = 0; g.dead = 45; g.booms.push({ x: g.px, y: PY, t: 0 }); return; }
  }
  // player shot
  if (g.shot) {
    for (let s = 0; s < 3 && g.shot; s++) {
      g.shot.y--;
      const { x, y } = g.shot;
      if (y < 6) { g.shot = null; break; }
      if (shieldAt(g, x, y)) { erode(g, x, y, true); g.shot = null; break; }
      const hit = live.find(a => x >= a.x && x < a.x + AW && y >= a.y && y < a.y + AH);
      if (hit) { hit.alive = false; g.score += POINTS[KIND[hit.r]]; g.booms.push({ x: hit.x, y: hit.y, t: 0 }); g.shot = null; break; }
      if (g.ufo && x >= g.ufo.x && x < g.ufo.x + 7 && y >= 6 && y < 9) {
        const pts = [50, 100, 150, 300][Math.floor(g.rnd() * 4)];
        g.score += pts; g.ufoPts = { x: g.ufo.x, pts, t: 45 }; g.ufo = null; g.shot = null; break;
      }
      const b = g.bombs.findIndex(b => Math.abs(b.x - x) <= 1 && y >= b.y - 1 && y <= b.y + 2);
      if (b >= 0) { g.bombs.splice(b, 1); g.shot = null; break; }
    }
  }
  // alien bombs: from the lowest alien of a column, often the one over the cannon
  if (--g.fireT <= 0 && g.bombs.length < 2 + Math.min(g.wave, 2)) {
    g.fireT = 18 + Math.floor(g.rnd() * 30) - Math.min(g.wave * 3, 10);
    const cols = [...new Set(live.map(a => a.c))];
    const over = cols.filter(c => { const a = live.find(q => q.c === c); return Math.abs(a.x + 2 - (g.px + 2)) <= 4; });
    const c = over.length && g.rnd() < 0.5 ? over[0] : cols[Math.floor(g.rnd() * cols.length)];
    const low = live.filter(a => a.c === c).reduce((p, q) => (q.y > p.y ? q : p));
    g.bombs.push({ x: low.x + 2, y: low.y + AH, kind: Math.floor(g.rnd() * 2) });
  }
  for (const b of g.bombs) {
    b.y += g.t % 3 === 0 ? 2 : 1;
    if (shieldAt(g, b.x, b.y + 2)) { erode(g, b.x, b.y + 2, false); b.gone = true; continue; }
    if (b.y + 2 >= PY && b.y < PY + 3 && b.x >= g.px && b.x < g.px + 5) {
      b.gone = true; g.lives--; g.dead = 50; g.booms.push({ x: g.px, y: PY - 1, t: 0 }); g.bombs = []; g.shot = null; return;
    }
    if (b.y > 61) b.gone = true;
  }
  g.bombs = g.bombs.filter(b => !b.gone);
  // mystery ship
  if (g.ufoPts && --g.ufoPts.t <= 0) g.ufoPts = null;
  if (!g.ufo && --g.ufoT <= 0 && live.length > 6) { const l = g.rnd() < 0.5; g.ufo = { x: l ? -7 : W, d: l ? 1 : -1 }; g.ufoT = 500 + Math.floor(g.rnd() * 400); }
  if (g.ufo && g.t % 2 === 0) { g.ufo.x += g.ufo.d; if (g.ufo.x < -8 || g.ufo.x > W + 1) g.ufo = null; }
}

// Demo: stand under the nearest low alien (or the mystery ship), fire when lined up, step out from under bombs.
export function demo(g) {
  const live = alive(g), c = g.px + 2, inp = {};
  let tx = c;
  if (g.ufo && g.ufo.x > 0 && g.ufo.x < W - 8) tx = g.ufo.x + 3 + g.ufo.d * 6;
  else if (live.length) {
    const low = live.filter(a => !live.some(q => q.c === a.c && q.y > a.y));
    tx = low.reduce((p, q) => (Math.abs(q.x + 2 - c) < Math.abs(p.x + 2 - c) ? q : p)).x + 2 + g.dir;
  }
  const danger = g.bombs.filter(b => b.y > 34 && Math.abs(b.x - c) <= 4);
  if (danger.length) { const d = danger[0].x >= c ? -1 : 1; if (d < 0) inp.left = true; else inp.right = true; }
  else if (tx < c - 1) inp.left = true; else if (tx > c + 1) inp.right = true;
  if (Math.abs(tx - c) <= 2 && !danger.length) inp.a = (g.t >> 1) & 1;
  return inp;
}

// ---- drawing -----------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function sprite(b, x, y, rows, v = 1) { rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === "#") px(b, x + i, y + j, v); })); }
function text(b, x, y, s, v = 1) { for (const ch of s) { const f = FONT[ch] || FONT[" "]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r, v); x += 4; } }
export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  text(b, 0, 0, String(g.score).padStart(5, "0"));
  for (let i = 0; i < Math.max(0, g.lives - (g.dead ? 0 : 1)); i++) sprite(b, 59 - i * 6, 1, CANNON);
  for (let i = 0; i < W * H; i++) if (g.shield[i]) b[i] = 1;
  for (const a of g.aliens) if (a.alive) sprite(b, a.x, a.y, ALIEN[KIND[a.r]][a.f]);
  for (const o of g.booms) if (o.t < 8) sprite(b, o.x, o.y, BOOM);
  if (g.ufo) sprite(b, g.ufo.x, 6, UFO);
  if (g.ufoPts && (g.t >> 2) & 1) text(b, Math.max(0, Math.min(W - 12, g.ufoPts.x - 2)), 6, String(g.ufoPts.pts));
  if (!g.dead) sprite(b, g.px, PY, CANNON);
  else if ((g.t >> 2) & 1) sprite(b, g.px, PY - 1, BOOM);
  if (g.shot) for (let j = 0; j < 2; j++) px(b, g.shot.x, g.shot.y + j);
  for (const o of g.bombs) {                                            // two kinds: zigzag and plunger
    if (o.kind === 0) for (let j = 0; j < 3; j++) px(b, o.x + ((o.y + j + (g.t >> 2)) & 1), o.y + j);
    else { for (let j = 0; j < 3; j++) px(b, o.x, o.y + j); px(b, o.x - 1, o.y + 2); px(b, o.x + 1, o.y + 2); }
  }
  for (let x = 0; x < W; x++) px(b, x, 62);
  if (g.clear) { const s = "WAVE " + (g.wave + 2); text(b, (W - s.length * 4 + 1) >> 1, 28, s); }
  if (g.over) { const s = "GAME OVER"; for (let y = 25; y < 36; y++) for (let x = 12; x < 52; x++) px(b, x, y, y === 25 || y === 35 || x === 12 || x === 51 ? 1 : 0); text(b, 15, 28, s); }
  return b;
}
