// INTERCEPT: a missile-defence game for the VMX's 64x64 1-bit screen (owner: "gimme a Missile Command"; working
// name - "Missile Command" is an Atari trademark, the gameplay is free to use). Written from scratch.
// Six cities and three bases on the ground; incoming missiles streak down toward them (later waves split, and
// fall faster). Steer the crosshair; A fires from the nearest base with ammo, X / Y / B from the left / middle /
// right base. A counter-missile flies to the crosshair and bursts; anything in a burst is destroyed and bursts in
// turn (chains). End of wave: bonus for ammo left and cities standing. Bonus city every 10000. No cities = over.
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const GROUND = 58;
const CITY_X = [9, 16, 23, 40, 47, 54], BASE_X = [3, 32, 61];
const AMMO = 10, BURST_R = 6, BURST_T = 30, SHOT_SPEED = 3;
const FONT = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",D:"110101101101110",E:"111100110100111",G:"011100101101011",
  I:"111010010010111",M:"101111111101101",N:"110101101101101",O:"010101101101010",R:"110101110101101",S:"011100010001110",
  T:"111010010010010",U:"101101101101111",V:"101101101101010",W:"101101111111101",X:"101101010101101",Y:"101101010010010",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110","4":"101101111001001",
  "5":"111100110001110","6":"011100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001110",
  " ":"000000000000000","!":"010010010000010","+":"000010111010000"
};
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function newGame(seed = 1) {
  const g = { rnd: rng(seed), t: 0, cx: 32, cy: 30, cities: CITY_X.map(() => true), score: 0, nextBonus: 10000,
              wave: 0, banner: 0, bannerText: "", over: 0 };
  startWave(g);
  return g;
}
function startWave(g) {
  g.wave++; g.ammo = [AMMO, AMMO, AMMO]; g.bases = [true, true, true];
  g.toLaunch = 10 + g.wave * 3; g.launchIn = 40; g.enemy = []; g.shots = []; g.bursts = [];
  g.speed = 0.12 + g.wave * 0.025; g.banner = 50; g.bannerText = "WAVE " + g.wave;
}
function targets(g) {                                 // standing cities and bases, as x positions
  return [...CITY_X.filter((_, i) => g.cities[i]), ...BASE_X.filter((_, i) => g.bases[i])];
}
function launch(g, x0, y0, tx) {
  const dx = tx - x0, dy = GROUND - y0, len = Math.hypot(dx, dy);
  g.enemy.push({ x0, y0, x: x0, y: y0, vx: dx / len * g.speed, vy: dy / len * g.speed, tx, split: g.wave >= 3 && g.rnd() < 0.25 ? 20 + g.rnd() * 15 : 0 });
}

export function step(g, inp) {                        // inp: dx, dy (-1..1 analog), fire: null | "auto" | 0 | 1 | 2
  g.t++;
  if (g.banner) g.banner--;
  if (g.over) { if (--g.over === 0) Object.assign(g, newGame(Math.floor(g.rnd() * 1e9))); return; }
  g.cx = Math.max(1, Math.min(62, g.cx + (inp.dx || 0) * 1.6));
  g.cy = Math.max(4, Math.min(GROUND - 6, g.cy + (inp.dy || 0) * 1.6));
  if (inp.fire !== null && inp.fire !== undefined) {
    let b = inp.fire;
    if (b === "auto") {                               // nearest base with ammo
      b = [0, 1, 2].filter(i => g.bases[i] && g.ammo[i] > 0).sort((p, q) => Math.abs(BASE_X[p] - g.cx) - Math.abs(BASE_X[q] - g.cx))[0];
    }
    if (b !== undefined && g.bases[b] && g.ammo[b] > 0) {
      g.ammo[b]--;
      const x0 = BASE_X[b], y0 = GROUND - 3, len = Math.hypot(g.cx - x0, g.cy - y0);
      g.shots.push({ x0, y0, x: x0, y: y0, tx: g.cx, ty: g.cy, vx: (g.cx - x0) / len * SHOT_SPEED, vy: (g.cy - y0) / len * SHOT_SPEED });
    }
  }
  // launches
  if (g.toLaunch > 0 && --g.launchIn <= 0) {          // salvos of 1-3
    const tg = targets(g), n = Math.min(g.toLaunch, 1 + Math.floor(g.rnd() * 3));
    for (let k = 0; k < n && tg.length; k++) launch(g, 2 + g.rnd() * 60, 0, tg[Math.floor(g.rnd() * tg.length)]);
    g.toLaunch -= n; g.launchIn = Math.max(30, 90 - g.wave * 8) + Math.floor(g.rnd() * 40);
  }
  // counter-missiles fly to their mark and burst
  for (const s of g.shots) {
    s.x += s.vx; s.y += s.vy;
    if ((s.tx - s.x) * s.vx + (s.ty - s.y) * s.vy <= 0) { s.done = true; g.bursts.push({ x: s.tx, y: s.ty, t: 0 }); }
  }
  g.shots = g.shots.filter(s => !s.done);
  // bursts grow then shrink; they take out missiles (which burst too: chains)
  for (const b of g.bursts) { b.t++; b.r = BURST_R * Math.sin(Math.PI * Math.min(1, b.t / BURST_T)); }
  for (const e of g.enemy) {
    e.x += e.vx; e.y += e.vy;
    if (e.split && e.y >= e.split) {                  // MIRV: splits into 2-3
      e.split = 0; const tg = targets(g);
      for (let k = 0; k < 1 + Math.floor(g.rnd() * 2) && tg.length; k++) launch(g, e.x, e.y, tg[Math.floor(g.rnd() * tg.length)]);
    }
    for (const b of g.bursts) if (Math.hypot(e.x - b.x, e.y - b.y) <= b.r + 0.5) { e.dead = true; g.score += 25 * Math.min(6, (g.wave + 1) >> 1); g.bursts.push({ x: e.x, y: e.y, t: 0 }); break; }
    if (!e.dead && e.y >= GROUND - 2) {                // impact: the city or base it was aimed at
      e.dead = true; g.bursts.push({ x: e.x, y: GROUND - 2, t: 0 });
      CITY_X.forEach((x, i) => { if (Math.abs(x - e.tx) < 1) g.cities[i] = false; });
      BASE_X.forEach((x, i) => { if (Math.abs(x - e.tx) < 1) { g.bases[i] = false; g.ammo[i] = 0; } });
    }
  }
  g.enemy = g.enemy.filter(e => !e.dead);
  g.bursts = g.bursts.filter(b => b.t < BURST_T);
  if (g.score >= g.nextBonus) {                       // bonus city
    g.nextBonus += 10000; const i = g.cities.indexOf(false); if (i >= 0) { g.cities[i] = true; g.banner = 40; g.bannerText = "BONUS CITY"; }
  }
  if (!g.cities.some(c => c)) { g.over = 120; g.banner = 120; g.bannerText = "THE END"; return; }
  if (g.toLaunch <= 0 && !g.enemy.length && !g.shots.length && !g.bursts.length) {
    const bonus = g.ammo.reduce((a, b) => a + b, 0) * 5 + g.cities.filter(c => c).length * 100;
    g.score += bonus; g.bonusShown = bonus; startWave(g); g.banner = 60; g.bannerText = "+" + bonus;
  }
}

// ---- drawing -------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function line(b, x0, y0, x1, y1) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let i = 0; i <= n; i++) px(b, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); }
function text(b, x, y, s) { for (const ch of s) { const f = FONT[ch] || FONT[" "]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r); x += 4; } }
const tw = s => s.length * 4 - 1;

export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  // ground
  for (let x = 0; x < W; x++) { px(b, x, GROUND + 1); if (x % 2 === 0) px(b, x, GROUND + 3); px(b, x, H - 1); }
  // cities: a little skyline each
  CITY_X.forEach((x, i) => {
    if (g.cities[i]) { for (const [dx, h] of [[-2, 2], [-1, 3], [0, 4], [1, 2], [2, 3]]) for (let y = 0; y < h; y++) px(b, x + dx, GROUND - y); }
    else { px(b, x - 2, GROUND); px(b, x, GROUND); px(b, x + 2, GROUND); }
  });
  // bases: a mound with the ammo left as dots
  BASE_X.forEach((x, i) => {
    if (!g.bases[i]) return;
    for (let dx = -3; dx <= 3; dx++) for (let y = 0; y < 3 - Math.floor(Math.abs(dx) / 2); y++) px(b, x + dx, GROUND - y);
    for (let k = 0; k < g.ammo[i]; k++) px(b, x - 4 + (k % 5) * 2, GROUND + 2 + Math.floor(k / 5) * 2, 0), px(b, x - 4 + (k % 5) * 2, GROUND + 2);
  });
  // incoming trails + heads, counter-missiles, bursts
  for (const e of g.enemy) { line(b, e.x0, e.y0, e.x, e.y); if (g.t % 4 < 2) px(b, e.x + 1, e.y); }
  for (const s of g.shots) { line(b, s.x0, s.y0, s.x, s.y); px(b, s.tx - 1, s.ty - 1); px(b, s.tx + 1, s.ty + 1); px(b, s.tx + 1, s.ty - 1); px(b, s.tx - 1, s.ty + 1); }
  for (const bu of g.bursts) {
    const r = bu.r || 0;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      if (((x + y + (bu.t >> 2)) & 1) || x * x + y * y > (r - 1) * (r - 1)) px(b, bu.x + x, bu.y + y);
    }
  }
  // crosshair
  if (!g.over) for (const [dx, dy] of [[-2, 0], [-1, 0], [1, 0], [2, 0], [0, -2], [0, -1], [0, 1], [0, 2]]) px(b, g.cx + dx, g.cy + dy);
  // score / banner
  if (g.banner) text(b, (W - tw(g.bannerText)) >> 1, 20, g.bannerText);
  text(b, 1, 0, String(g.score).padStart(6, "0"));
  return b;
}

// ---- demo player: the most urgent missile (soonest to land), led so the burst meets it ------------------------
export function demo(g) {
  const want = { dx: 0, dy: 0, fire: null };
  if (g.over) return want;
  const covered = e => g.bursts.some(b => Math.hypot(e.x - b.x, e.y - b.y) < BURST_R + 2) || g.shots.some(s => Math.hypot(e.x + e.vx * 15 - s.tx, e.y + e.vy * 15 - s.ty) < BURST_R);
  const threats = g.enemy.filter(e => !covered(e) && e.y > 20)    // lets them come on a way: better to watch.sort((a, b) => (GROUND - a.y) / a.vy - (GROUND - b.y) / b.vy);
  const e = threats[0]; if (!e) { want.dx = (32 - g.cx) / 20; want.dy = (28 - g.cy) / 20; return want; }
  // lead: where the missile will be when a shot from the nearest base gets there
  const base = [0, 1, 2].filter(i => g.bases[i] && g.ammo[i] > 0).sort((p, q) => Math.abs(BASE_X[p] - e.x) - Math.abs(BASE_X[q] - e.x))[0];
  if (base === undefined) return want;
  let lx = e.x, ly = e.y;
  for (let i = 0; i < 3; i++) { const tt = Math.hypot(lx - BASE_X[base], ly - GROUND) / SHOT_SPEED + 8; lx = e.x + e.vx * tt; ly = Math.min(GROUND - 6, e.y + e.vy * tt); }
  const dx = lx - g.cx, dy = ly - g.cy, d = Math.hypot(dx, dy);
  want.dx = Math.max(-1, Math.min(1, dx / 4)); want.dy = Math.max(-1, Math.min(1, dy / 4));
  if (d < 2.5 && g.t % 6 === 0) want.fire = base;
  return want;
}
