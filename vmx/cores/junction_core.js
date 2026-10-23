// JUNCTION for the VMX's 64x64 1-bit screen: a Digidrive-style puzzle (working name; "Digidrive" is Nintendo's /
// Q-Games', bit Generations 2006). Our own code and art. The rules first came from the GameFAQs guides (curtmack's
// FAQ v1.2, indigonight's guide v0.5); the numbers and the fine print are now the cartridge's own, read from the
// owner's ROM (docs/digidrive/NOTES.md: traced code, ROM tables, and a bot playing it with a never-die cheat).
//   A plus-shaped junction: shapes drive in from all four roads. HOLD a direction and they turn into that road;
//   hold nothing and they carry straight on; nothing turns back the way it came. A road stacks what reaches it.
//   Five of one shape make it ACTIVE, with a pod worth BASE[tier] + 10 a feed (triangle 100, square 450 after 4
//   feeds, pentagon 1800 after 8 more, hexagon 3000 after 12, circle 6000 after 24, then 8000 + 85 a feed after 40).
//   An active road must be fed its shape (about 40 s of life) or it starves: the pod is lost. A wrong shape breaks
//   it: every other active road gains the broken pod's whole size in feeds (two others = doubled), and the disc
//   slips back 2560 units. A broken unfinished stack is sent back out, one shape at a time.
//   The flashing ATTACK shape (sometimes in traffic; A launches one from stock, up to 3, +1 every 5000 m and after
//   an Auto Bahn) into an active road launches its pod: value x 16 x 48 units (16384 = 1 m) pour into the disc's
//   fuel pool, which drains 1/16 a frame into the distance. All four roads active = AUTO BAHN: a spiral, much more
//   traffic, the piston waits, and the first pod to go launches. The piston creeps up (faster as the game goes on,
//   slower when close, never more than 19.2 m behind); when it reaches the disc, the game is over. Score =
//   distance. Shapes 2 and 3 join at about 52 s and 3.5 min. Input: held buttons. Pure logic + 64x64 bits, 30 Hz
//   (two GBA frames a tick).

export const W = 64, H = 64;
const CX = 24, CY = 32, ARM = 24, CORE = 4;               // junction centre; roads run from r = 4 to r = 24
const OUT = [[0, -1], [1, 0], [0, 1], [-1, 0]];           // N E S W, pointing away from the centre
const SLOT = k => 22 - 4 * k;                              // stack slots along a road, outermost first
const SHAPES = [                                           // 3 x 3, pointing right (+x); rotated for each road
  ["#..", ".#.", "#.."],                                   // chevron
  [".#.", "#.#", ".#."],                                   // round
  ["##.", "###", "##."]];                                  // block
// Pods (from the cartridge, 0x08011498): value = BASE[tier] + 10 x count; a tier fills after NEXT[tier] feeds
const BASE = [0, 100, 450, 1800, 3000, 6000, 8000], STEP = [0, 10, 10, 10, 10, 10, 85], NEXT = [0, 4, 8, 12, 24, 40];
const podValue = rd => (rd.active ? BASE[rd.tier] + STEP[rd.tier] * rd.cnt : 0);
const podUnits = rd => NEXT.slice(1, rd.tier).reduce((a, b) => a + b, 0) + rd.cnt + 1;   // feeds it took, +1
const tierOf = v => (v >= 8000 ? 6 : v >= 6000 ? 5 : v >= 3000 ? 4 : v >= 1800 ? 3 : v >= 450 ? 2 : 1);   // the pod shape shown
const FONT = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",D:"110101101101110",E:"111100110100111",G:"011100101101011",
  H:"101101111101101",I:"111010010010111",J:"001001001101010",L:"100100100100111",M:"101111111101101",N:"110101101101101",
  O:"010101101101010",P:"110101110100100",R:"110101110101101",S:"011100010001110",T:"111010010010010",U:"101101101101111",
  V:"101101101101010",X:"101101010101101",Y:"101101010010010",":":"000010000010000","!":"010010010000010",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110","4":"101101111001001",
  "5":"111100110001110","6":"011100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001110",
  " ":"000000000000000","?":"110001010000010" };
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function newGame(seed = 1, level = 1) {
  return { rnd: rng(seed), t: 0, phase: "title", level, best: 0, prev: {} };
}
function start(g) {
  Object.assign(g, {
    phase: "play", dist: 0, pool: 0, packets: 0, piston: -138240, R: 0, route: -1, pellets: [], queue: [[], [], [], []], spawnT: 30,
    roads: [0, 1, 2, 3].map(() => ({ shape: -1, count: 0, active: false, tier: 1, cnt: 0, hunger: 0 })),
    attacks: 1, nextBonus: MILESTONE[Math.min(2, g.level - 1)], trance: false, tranceT: 0, shapes: 1, popups: [], over: 0, warn: 0,
  });
}
// Disc, piston and timing from the real cartridge (docs/digidrive/NOTES.md); units: 16384 = 1 m, GBA frames 60 Hz
const UNIT = 16384, GAP_MAX = 0x4ce00, PACKET = 576;
const R_CAP = [1200, 1400, 1600], MILESTONE = [5000, 6250, 7500];
const HUNGER = g => Math.round(108800 / 45 / 2);           // road life: 108800, -45 a GBA frame (rises later: TBD)
const metres = g => g.dist >> 14;
const speed = g => (g.trance ? 1.0 : 0.45 + Math.min(0.35, g.R / 3000)) * (1 + g.level * 0.08);   // ramp: provisional
// lane positions: traffic keeps to its right; r = distance from the centre along road `side`
function lanePos(side, r, outgoing) {
  const [ox, oy] = OUT[side], dir = outgoing ? [ox, oy] : [-ox, -oy], right = [-dir[1], dir[0]];
  return [CX + ox * r + right[0] * 2 - 0.5, CY + oy * r + right[1] * 2 - 0.5];
}
function spawn(g, side, shape, attack = false) {
  const blocked = g.pellets.some(p => !p.out && p.side === side && p.r > ARM - 5);
  if (blocked) return false;
  g.pellets.push({ side, r: ARM + 1, out: false, shape, attack });
  return true;
}
function fuelTo(g, road, feeds) {                         // feeds: matching shapes into an active road
  for (let k = 0; k < feeds; k++) {
    road.cnt++;
    if (road.tier < 6 && road.cnt >= NEXT[road.tier]) { road.tier++; road.cnt = 0; }   // tier 6: 8000 + 85 a feed
  }
}
function breakRoad(g, s, byShape) {                        // a wrong shape into road s
  const rd = g.roads[s];
  if (rd.active) {
    const others = g.roads.filter((o, i) => i !== s && o.active);
    // cartridge (watched in play): each other active road gains the broken pod's whole size in feeds (so with two
    // others it doubles); in Auto Bahn the first pod to go launches instead. A wrong shape also costs 2560 units.
    if (g.trance) launch(g, podValue(rd), s);
    else for (const o of others) { fuelTo(g, o, podUnits(rd)); o.hunger = HUNGER(g); }
    if (others.length && !g.trance) g.popups.push({ s, text: others.length > 1 ? "X2" : "+", t: 0 });
    g.pool -= 2560;
  } else for (let k = 0; k < rd.count; k++) g.queue[s].push(rd.shape);   // sent back out, one at a time
  Object.assign(rd, { shape: byShape, count: 1, active: false, tier: 1, cnt: 0, hunger: 0 });
  endTrance(g);
}
function launch(g, fuel, s) {                              // a pod's fuel flies to the disc as packets of 576
  g.packets += Math.round(fuel * 16 / 12);                   // x16 (single), packets of 12 x 48 = 576 units
  g.popups.push({ s, text: "GO", t: 0, big: true });
}
function endTrance(g) {
  if (!g.trance) return;
  g.trance = false; if (g.attacks < 3) g.attacks++;
}
function arrive(g, p) {                                    // a shape reaches the end of its stack on road p.side
  const s = p.side, rd = g.roads[s];
  if (p.attack) {
    if (rd.active) { launch(g, podValue(rd), s); Object.assign(rd, { shape: -1, count: 0, active: false, tier: 1, cnt: 0 }); endTrance(g); }
    return;
  }
  if (rd.shape < 0 || rd.count === 0) { Object.assign(rd, { shape: p.shape, count: 1, active: false, tier: 1, cnt: 0 }); return; }
  if (rd.shape !== p.shape) { breakRoad(g, s, p.shape); return; }
  if (rd.active) { fuelTo(g, rd, 1); rd.hunger = HUNGER(g); return; }   // +1 a shape, Auto Bahn too (just faster traffic)
  rd.count++;
  if (rd.count >= 5) { rd.active = true; rd.tier = 1; rd.cnt = 0; rd.hunger = HUNGER(g); rd.count = 5;
    if (g.roads.every(r => r.active)) { g.trance = true; g.tranceT = 0; } }
}

export function step(g, inp) {
  g.t++;
  const e = k => inp[k] && !g.prev[k];
  if (g.phase === "title") {
    if (e("left")) g.level = Math.max(1, g.level - 1);
    if (e("right")) g.level = Math.min(5, g.level + 1);
    if (e("a")) start(g);
    g.prev = { ...inp }; return;
  }
  if (g.phase === "over") { if (--g.over <= 0) g.phase = "title"; g.prev = { ...inp }; return; }
  // controls
  // the cartridge routes by the direction HELD (0x080377e0 clears it every frame): nothing held = straight on
  g.route = inp.up ? 0 : inp.right ? 1 : inp.down ? 2 : inp.left ? 3 : -1;
  if (e("a") && g.attacks > 0) {
    const sides = [0, 1, 2, 3].sort(() => g.rnd() - 0.5);
    for (const s of sides) if (spawn(g, s, -1, true)) { g.attacks--; break; }
  }
  g.prev = { ...inp };
  // traffic
  g.playT = (g.playT || 0) + 1;                             // shapes 2 and 3 arrive on a clock (seen ~52 s, ~3.5 min)
  if (g.playT >= 52 * 30 && g.shapes < 2) g.shapes = 2;
  if (g.playT >= 210 * 30 && g.shapes < 3) g.shapes = 3;
  if (--g.spawnT <= 0) {
    g.spawnT = Math.round(36 * (g.trance ? 0.4 : 1));   // 0x4800 at 256 a GBA frame = 72 frames (0x080371f4); Auto Bahn ~2.5x
    const s = Math.floor(g.rnd() * 4), attack = g.rnd() < 0.025;
    if (spawn(g, s, attack ? -1 : Math.floor(g.rnd() * g.shapes), attack)) g.R = Math.min(R_CAP[Math.min(2, g.level - 1)], g.R + 1);
  }
  for (let s = 0; s < 4; s++) if (g.queue[s].length && g.t % 10 === 0 && spawn(g, s, g.queue[s][0])) g.queue[s].shift();
  const v = speed(g);
  for (const p of g.pellets) {
    if (!p.out) {
      const ahead = g.pellets.filter(q => q !== p && !q.out && q.side === p.side && q.r < p.r && p.r - q.r < 4.5);
      if (ahead.length && p.r > CORE + 1) continue;          // queue behind the one in front
      p.r -= v;
      if (p.r <= 0) {                                        // the centre: turn if a route is set and allowed
        const from = p.side, straight = (from + 2) % 4;
        p.side = g.route >= 0 && g.route !== from ? g.route : straight; p.out = true; p.r = 0;
      }
    } else {
      p.r += v;
      const rd = g.roads[p.side], target = rd.active || p.attack ? CORE + 2 : SLOT(Math.min(rd.count, 4));
      if (p.r >= target) { arrive(g, p); p.done = true; }
    }
  }
  g.pellets = g.pellets.filter(p => !p.done);
  // roads go hungry
  for (let s = 0; s < 4; s++) {
    const rd = g.roads[s]; if (!rd.active) continue;
    if (--rd.hunger <= 0) {
      if (g.trance) launch(g, podValue(rd), s);
      // starving loses the pod, with no push back (the push is only for a wrong shape)
      Object.assign(rd, { shape: -1, count: 0, active: false, tier: 1, cnt: 0 });
      endTrance(g);
    }
  }
  // the disc and the piston
  for (let sub = 0; sub < 2; sub++) {                       // two GBA frames a tick
    if (g.packets > 0) { g.pool += PACKET; g.packets--; }
    const sb = Math.min(g.pool >> 4, 0x3f00);               // 1/16 of the pool a frame (0x0802eef8)
    g.pool -= sb; g.dist += sb;
    if (!g.trance) {                                        // 0x0802e45c / 0x0802eadc
      const base = (g.R / 4 + 40) * 320 / 256;
      g.piston += Math.max(1, Math.floor(base * (g.dist - g.piston + 0x6000) / GAP_MAX));
    }
    if (g.dist - g.piston > GAP_MAX) g.piston = g.dist - GAP_MAX;   // the lead is capped at 19.2 m
  }
  if (metres(g) >= g.nextBonus) { g.nextBonus += MILESTONE[Math.min(2, g.level - 1)]; if (g.attacks < 3) g.attacks++; }
  g.warn = g.dist - g.piston < 3 * UNIT;
  if (g.piston >= g.dist) { g.best = Math.max(g.best, metres(g)); g.phase = "over"; g.over = 150; }
  for (const p of g.popups) p.t++;
  g.popups = g.popups.filter(p => p.t < 30);
}

// ---- demo: route the next shape to arrive where it does the most good -----------------------------------------
export function demo(g) {
  if (g.phase === "title") return { a: (g.t % 40) < 2 };
  if (g.phase !== "play") return {};
  const inp = {};
  const next = g.pellets.filter(p => !p.out).sort((a, b) => a.r - b.r)[0];
  if (next) {
    const from = next.side, opts = [0, 1, 2, 3].filter(s => s !== from);
    const value = s => {
      const rd = g.roads[s];
      if (next.attack) return rd.active ? 100 + podValue(rd) / 50 : -50;
      if (rd.active) {
        if (rd.shape === next.shape) return 35 + 70 * (1 - rd.hunger / HUNGER(g));        // feed, the hungriest first
        const others = g.roads.filter((o, i) => i !== s && o.active).length;
        return others ? 5 + podValue(rd) / 50 * (others > 1 ? 3 : 1) - 30 : -100;                    // a double-up, if any
      }
      if (rd.count === 0 || rd.shape < 0) return 55;                                       // build towards Auto Bahn
      if (rd.shape === next.shape) return 70 + rd.count * 6;
      return -10 - rd.count * 4;
    };
    let best = opts[0]; for (const s of opts) if (value(s) > value(best)) best = s;
    const want = best === (from + 2) % 4 ? -1 : best;           // hold the target's direction (none = straight)
    if (want >= 0) inp[["up", "right", "down", "left"][want]] = true;
  }
  const biggest = Math.max(0, ...g.roads.filter(r => r.active).map(r => podValue(r)));
  if (g.attacks > 0 && g.warn && biggest >= 100 && (g.t % 3 === 0)) inp.a = true;
  return inp;
}

// ---- drawing -----------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function text(b, x, y, s, v = 1) { for (const ch of s) { const f = FONT[ch] || FONT[" "]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r, v); x += 4; } }
function shape(b, x, y, k, dir, v = 1) {                  // dir: 0 N, 1 E, 2 S, 3 W (pointing that way)
  const sp = SHAPES[k];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    if (sp[j][i] !== "#") continue;
    let u = i - 1, w = j - 1;                               // rotate the right-pointing sprite
    if (dir === 0) [u, w] = [w, -u]; else if (dir === 2) [u, w] = [-w, u]; else if (dir === 3) [u, w] = [-u, w];
    px(b, x + 1 + u, y + 1 + w, v);
  }
}
function pod(b, x, y, fuel, t) {                          // the fuel pod: grows through the shapes
  const tier = tierOf(fuel) - 1;
  const n = [3, 4, 5, 6, 24][tier], R = 3 + Math.min(tier, 2) * 0.5, pts = [];
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; pts.push([x + Math.cos(a) * R, y + Math.sin(a) * R]); }
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n], m = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= m; k++) px(b, x0 + (x1 - x0) * k / m, y0 + (y1 - y0) * k / m);
  }
  if (tier === 4 && fuel >= 12000) text(b, x < 24 ? x - 12 : x + 5, y - 2, (fuel >= 48000 ? "?" : fuel >= 24000 ? "4" : "2") + "X");   // multipliers shown: provisional
}
export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  if (g.phase === "title") {
    text(b, 16, 8, "JUNCTION");
    for (let s = 0; s < 4; s++) shape(b, CX - 1 + OUT[s][0] * 9 + 8, 28 + OUT[s][1] * 6, (g.t >> 4) % 3, s);
    text(b, 8, 40, "LEVEL < " + g.level + " >");
    if ((g.t >> 4) & 1) text(b, 16, 48, "A: START");
    if (g.best) text(b, 8, 57, "BEST " + g.best + "M");
    return b;
  }
  if (g.trance) for (let y = 7; y < 58; y++) for (let x = 0; x < 49; x++) {   // the Auto Bahn spiral
    const dx = x - CX, dy = y - CY, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
    if (((a * 3 + r * 0.35 - g.t * 0.25) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) < 0.35 && r > 6) px(b, x, y);
  }
  // the roads: kerbs, centre lines, the junction box
  for (let s = 0; s < 4; s++) {
    const [ox, oy] = OUT[s], px2 = [-oy, ox];
    for (let r = CORE; r <= ARM; r++) {
      for (const side of [-1, 1]) px(b, CX - 0.5 + ox * r + px2[0] * 4.5 * side, CY - 0.5 + oy * r + px2[1] * 4.5 * side, g.trance ? 0 : 1);
      if (r % 3 === 0) px(b, CX - 0.5 + ox * r, CY - 0.5 + oy * r);
      if (g.trance) for (const side of [-1, 1]) px(b, CX - 0.5 + ox * r + px2[0] * 4.5 * side, CY - 0.5 + oy * r + px2[1] * 4.5 * side);
    }
    const rd = g.roads[s];
    if (rd.active) {                                         // an active road: its stack lane lit, shapes dark
      const blink = rd.hunger < 60 && (g.t >> 2) & 1;
      for (let k = 0; k < 5; k++) {
        const [x, y] = lanePos(s, SLOT(k), true);
        if (!blink) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) px(b, x + 1 + i, y + 1 + j);
        shape(b, x, y, rd.shape, s, 0);
      }
      const corner = [[37, 13], [37, 51], [11, 51], [11, 13]][s];
      pod(b, corner[0], corner[1], podValue(rd), g.t);
    } else for (let k = 0; k < rd.count; k++) { const [x, y] = lanePos(s, SLOT(k), true); shape(b, x, y, rd.shape, s); }
  }
  // the route arrow in the junction box
  if (g.route >= 0) { const [ox, oy] = OUT[g.route]; for (let k = -1; k <= 2; k++) px(b, CX - 0.5 + ox * k, CY - 0.5 + oy * k); px(b, CX - 0.5 + ox * 2 - oy, CY - 0.5 + oy * 2 + ox, 1); px(b, CX - 0.5 + ox * 2 + oy, CY - 0.5 + oy * 2 - ox); }
  else px(b, CX - 0.5, CY - 0.5);
  for (const p of g.pellets) {
    const [x, y] = lanePos(p.side, Math.max(0, p.r), p.out), dir = p.out ? p.side : (p.side + 2) % 4;
    if (p.attack) { if ((g.t >> 1) & 1) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if ((i + j) % 2 === 0) px(b, x + i, y + j); else px(b, x + 1, y + 1); }
    else shape(b, x, y, p.shape, dir);
  }
  for (const p of g.popups) {
    const [ox, oy] = OUT[p.s];
    if ((p.t >> 2) & 1 || p.big) text(b, CX - 4 + ox * 14, CY - 2 + oy * 14 - p.t / 4, p.text);
  }
  // top: distance and attack stock
  text(b, 0, 0, String(metres(g)).padStart(5, " ") + "M");
  for (let k = 0; k < 3; k++) {
    const x = 28 + k * 6;
    if (k < g.attacks) { px(b, x + 1, 0); px(b, x, 1); px(b, x + 2, 1); px(b, x + 1, 2); px(b, x + 1, 1); px(b, x + 1, 3); }
    else px(b, x + 1, 2);
  }
  // right: the disc ahead of the piston, zooming in as the gap closes
  const gap = (g.dist - g.piston) / UNIT, scale = 48 / 19.2;     // the meter spans the 19.2 m maximum lead
  for (let y = 7; y < 64; y++) { px(b, 51, y); px(b, 63, y); }
  const dy = Math.max(9, 58 - gap * scale);
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= 5) px(b, 57 + i, dy + j);
  if (!(g.warn && (g.t >> 2) & 1)) for (let y = 60; y < 63; y++) for (let x = 53; x < 62; x++) px(b, x, y);   // piston head
  for (let y = 59; y > 58 - 1; y--) px(b, 57, y);
  if (g.trance) text(b, 0, 58, "AUTO BAHN");
  if (g.phase === "over") {
    for (let y = 22; y < 42; y++) for (let x = 2; x < 47; x++) px(b, x, y, y === 22 || y === 41 || x === 2 || x === 46 ? 1 : 0);
    text(b, 8, 25, "GAME OVER"); const s = metres(g) + "M"; text(b, 25 - s.length * 2, 33, s);
  }
  return b;
}
