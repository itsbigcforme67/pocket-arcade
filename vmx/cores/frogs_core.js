// FROG RACE for the VMX's 64x64 1-bit screen: a VMX CASINO table. Our own art and code; the frogs, lily pads,
// water and cattails come from our BOG HOP (bog_core.js).
// Each race has 4-6 named frogs. Every frog gets a hidden strength (a random weight, one frog boosted as the
// favourite); its posted odds o:1 are the ladder value 1,2,3,4,5,6,7,8,10,12,15 nearest to 0.9 x (total strength /
// its strength) - 1. Then the strengths are thrown away: a frog's EXACT chance to win is its odds' share of the book,
//     p_i = (1 / (o_i + 1)) / BOOK,   BOOK = sum over the field of 1 / (o_i + 1),
// computed in integers as weights w_i = 720720 / (o_i + 1) (720720 is divisible by every o + 1 on the ladder, so the
// weights are exact) over S = sum w_i. A WIN bet on any frog then returns exactly p_i x (o_i + 1) = 720720 / S of its
// stake on average, the same for every frog in the race: house edge = 1 - 720720 / S. A field is only used if its
// edge is between 9.50% and 11.11% (S in 796395..810810; otherwise the field is redrawn), so the odds can never
// favour the player; the race card shows that race's edge to 0.1% (HOUSE EDGE 10.4%).
// The finishing order is drawn FIRST, before the race is run: 1st from the weights, 2nd from the remaining frogs'
// weights, and so on (exact: 30-bit random numbers with rejection, no modulo bias). Finish times are then dealt in
// that order (a photo finish, 1 tick apart, in about 1 race in 4), and each frog's hops are scripted to land on the
// far bank exactly at its time; the hopping only shows the result, it never decides it.
// Bets: WIN on any frogs at their posted odds, 0-20 chips each, the total never more than the stash. A winning bet
// returns stake x (odds + 1) including the stake. No place/show bets (they would not keep the exact edge simple).
// Controls (race card): Up/Down choose a frog, Left/Right stake -1/+1 (repeats when held), A starts the race, B clears
// every stake. After the race: the results (1st, 2nd, 3rd and each bet won or lost); A = the next race.
// Demo player: puts 2-8 chips on the favourite and, one race in three, 1-3 on the longest shot.
// Everything is integer maths (no floats, no sort) so the VMX's C# port in vmx-firmware/games/frogs plays exactly the
// same; keep it that way.
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here); the stakes are taken
// when the race starts and the winning bet paid when it ends. Out of chips = "OUT OF CHIPS / MORE TOMORROW".
// Input: held buttons (edges found here); { auto: true } = the demo player.
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const FONTCH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:!-<>+/^.% ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "001001001101010", "101101110101101", "100100100100111",
  "101111111101101", "110101101101101", "010101101101010", "110101110100100", "010101101110011", "110101110101101",
  "011100010001110", "111010010010010", "101101101101111", "101101101101010", "101101111111101", "101101010101101",
  "101101010010010", "111001010100111",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "001010100010001", "100010001010100", "000010111010000", "001001010100100", "010111000111010",
  "000000000000010", "101001010100101", "000000000000000" ];
const CHIP = [14, 21, 27, 21, 14];                        // 5x5 chip icon
const SIT = [54, 126, 255, 511, 198];                     // BOG HOP's frog, 9 wide, facing right, bit 8 = left
const AIR = [13, 63, 127, 254, 387];
const SITR = [254, 510, 1023, 2047, 2047, 2047];          // the same grown by 1 px (not below): the dark ring, 11 wide
const AIRR = [63, 255, 511, 1023, 2047, 2047];
const SITO = [54, 66, 129, 257, 198];                     // hollow: the frogs you have no stake on
const AIRO = [13, 51, 65, 254, 387];
const NAMES = ["HOPPS", "LILY", "BOGEY", "CROAK", "RIBBIT", "TOADY", "GULP", "MUDDY", "REEDS", "SLICK", "BUBBA",
  "JUMBO", "PEEPER", "BOING", "WARTS", "DUKE", "ZIPPY", "MOSSY", "PUDDLE", "DASH", "SKIPPY", "FLICK", "SWAMPY",
  "NEWTON", "LEAPY", "GOOEY", "TADDY", "SPLASH"];
const NN = 28;
const LAD = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15];
const K = 720720, SLO = 796395, SHI = 810810;             // book x K kept within 1.105 .. 1.125
const PADS = 10;                                          // pad 0 = the near bank, 10 = the far bank
const PLACE = ["1ST", "2ND", "3RD"];
const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, n: 4, nm: Array(NN).fill(0), name: [0, 0, 0, 0, 0, 0],
    odds: [0, 0, 0, 0, 0, 0], w: [0, 0, 0, 0, 0, 0], S: 0, edge: 0, stake: [0, 0, 0, 0, 0, 0], cur: 0,
    order: [0, 0, 0, 0, 0, 0], place: [0, 0, 0, 0, 0, 0], fin: [0, 0, 0, 0, 0, 0], prof: [0, 0, 0],
    hs: Array(60).fill(0), hz: Array(60).fill(0), hm: [0, 0, 0, 0, 0, 0], hk: [0, 0, 0, 0, 0, 0], hj: [0, 0, 0, 0, 0, 0],
    rt: 0, nfin: 0, winT: 0, photo: false, lead: 0, win: 0, best: 0, rep: 0,
    dq: [0, 0], da: [0, 0], dn: 0, di: 0, msg: "", msgT: 0, auto: false,
    pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  for (let i = 0; i < NN; i++) g.nm[i] = i;
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function r30(g, total) {                                  // exact 0..total-1 from 30 random bits (rejection)
  const lim = 1073741824 - 1073741824 % total;
  let r = (rnd(g) << 14) | (rnd(g) >> 2);
  while (r >= lim) r = (rnd(g) << 14) | (rnd(g) >> 2);
  return r % total;
}
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 90; }
const total = g => { let s = 0; for (let i = 0; i < g.n; i++) s += g.stake[i]; return s; };
const hopT = z => z === 1 ? 7 : 11;
const padX = j => 3 + 5 * j;

// ---- a race: the field, the odds, the result, the script ----------------------------------------------------------
function field(g) {
  const s = [0, 0, 0, 0, 0, 0];
  for (let tries = 0; tries < 200; tries++) {
    g.n = 4 + rnd(g) % 3;
    let S = 0;
    for (let i = 0; i < g.n; i++) s[i] = 2 + rnd(g) % 9;
    const f = rnd(g) % g.n;
    s[f] += 6 + rnd(g) % 10;
    for (let i = 0; i < g.n; i++) S += s[i];
    let B = 0;
    for (let i = 0; i < g.n; i++) {                       // the ladder odds nearest to 0.9 x S / s - 1
      let best = 0, bd = 1 << 30;
      for (let l = 0; l < 11; l++) {
        const d = Math.abs((LAD[l] + 1) * s[i] * 10 - 9 * S);
        if (d < bd) { bd = d; best = l; } else break;
      }
      g.odds[i] = LAD[best]; B += div(K, LAD[best] + 1);
    }
    if (B >= SLO && B <= SHI) return;
  }
  g.n = 4; g.odds[0] = 1; g.odds[1] = 3; g.odds[2] = 4; g.odds[3] = 5;   // never needed in practice: book 1.117
}
function newRace(g) {
  field(g);
  for (let i = 0; i < g.n; i++) {                         // names: a partial shuffle of the list
    const j = i + rnd(g) % (NN - i), tt = g.nm[i]; g.nm[i] = g.nm[j]; g.nm[j] = tt;
    g.name[i] = g.nm[i];
  }
  g.S = 0;
  for (let i = 0; i < g.n; i++) { g.w[i] = div(K, g.odds[i] + 1); g.S += g.w[i]; g.stake[i] = 0; }
  g.edge = 1000 - div(div(1441440000, g.S) + 1, 2);       // in 0.1%, rounded
  // the result, first: each place drawn from the weights of the frogs still left
  const left = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < g.n; i++) left[i] = g.w[i];
  let rest = g.S;
  for (let p = 0; p < g.n; p++) {
    let r = r30(g, rest), i = 0;
    while (r >= left[i]) { r -= left[i]; i++; }
    g.order[p] = i; g.place[i] = p; rest -= left[i]; left[i] = 0;
  }
  // finish times in that order (photo finish: 1 tick)
  g.fin[g.order[0]] = 240 + rnd(g) % 60;
  g.photo = rnd(g) % 4 === 0;
  g.fin[g.order[1]] = g.fin[g.order[0]] + (g.photo ? 1 : 3 + rnd(g) % 14);
  for (let p = 2; p < g.n; p++) g.fin[g.order[p]] = g.fin[g.order[p - 1]] + 2 + rnd(g) % 16;
  const closer = rnd(g) % 2 === 0, fast = 1 + rnd(g) % (g.n - 1);
  for (let p = 0; p < g.n; p++) {                         // each frog's hops, landing exactly on its time
    const i = g.order[p];
    for (let s = 0; s < 3; s++) g.prof[s] = 1 + rnd(g) % 8;
    if (p === 0 && closer) { g.prof[0] = 8; g.prof[1] = 5; g.prof[2] = 1; }   // slow start, fast finish
    if (p === fast) { g.prof[0] = 1; g.prof[1] = 3; g.prof[2] = 9; }          // fast start, fades
    let rem = PADS, m = 0, sumD = 0;
    while (rem > 0) {
      const z = rem >= 2 && rnd(g) % 4 === 0 ? 2 : 1;
      g.hz[i * 10 + m] = z; rem -= z; sumD += hopT(z); m++;
    }
    g.hm[i] = m;
    const extra = g.fin[i] - sumD - 2 * m, wk = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let sw = 0, pads = 0;
    for (let k = 0; k < m; k++) {
      wk[k] = g.prof[div(pads * 3, PADS)] * 4 + rnd(g) % 3; sw += wk[k]; pads += g.hz[i * 10 + k];
    }
    let used = 0;
    for (let k = 0; k < m; k++) { wk[k] = 2 + div(extra * wk[k], sw); used += wk[k] - 2; }
    wk[0] += extra - used;                                // the rounding left over: a slower start
    let tt = 0;
    for (let k = 0; k < m; k++) { tt += wk[k]; g.hs[i * 10 + k] = tt; tt += hopT(g.hz[i * 10 + k]); }
    g.hk[i] = 0; g.hj[i] = 0;
  }
  g.rt = 0; g.nfin = 0; g.winT = 0; g.lead = -1; g.win = 0;
}
function toCard(g) {
  if (g.bank.chips < 1) { setPhase(g, "broke"); return; }
  newRace(g);
  g.cur = 0; g.rep = 0;
  setPhase(g, "card");
  if (g.auto) {                                           // demo: the favourite, sometimes the longest shot too
    let fav = 0, lng = 0;
    for (let i = 1; i < g.n; i++) { if (g.odds[i] < g.odds[fav]) fav = i; if (g.odds[i] > g.odds[lng]) lng = i; }
    g.dq[0] = fav; g.da[0] = Math.min(2 + rnd(g) % 7, g.bank.chips); g.dn = 1; g.di = 0;
    if (rnd(g) % 3 === 0 && g.bank.chips > g.da[0]) { g.dq[1] = lng; g.da[1] = Math.min(1 + rnd(g) % 3, g.bank.chips - g.da[0]); g.dn = 2; }
  }
}
function addStake(g, i, d) {
  if (d > 0) { if (g.stake[i] < 20 && total(g) < g.bank.chips) g.stake[i]++; }
  else if (g.stake[i] > 0) g.stake[i]--;
}
function startRace(g) {
  const tot = total(g);
  if (tot < 1) { say(g, "PLACE A BET"); return; }
  g.bank.chips -= tot;
  setPhase(g, "race");
}
function x0f(g, i) {                                      // a frog's x now (its centre)
  const k = g.hk[i], j = g.hj[i];
  if (k < g.hm[i] && g.rt >= g.hs[i * 10 + k]) {
    const z = g.hz[i * 10 + k], e = g.rt - g.hs[i * 10 + k];
    return padX(j) + div(5 * z * e, hopT(z));
  }
  return padX(j);
}
function runRace(g) {
  g.rt++;
  for (let i = 0; i < g.n; i++) {
    const k = g.hk[i];
    if (k < g.hm[i] && g.rt === g.hs[i * 10 + k] + hopT(g.hz[i * 10 + k])) {
      g.hj[i] += g.hz[i * 10 + k]; g.hk[i]++;
      if (g.hj[i] === PADS) { if (g.nfin === 0) g.winT = g.rt; g.nfin++; }
    }
  }
  let bx = -1;                                            // the leader (ties keep the old one)
  if (g.lead >= 0) bx = x0f(g, g.lead);
  for (let i = 0; i < g.n; i++) { const x = x0f(g, i); if (x > bx) { bx = x; g.lead = i; } }
}
function settle(g) {
  const w = g.order[0];
  g.win = g.stake[w] * (g.odds[w] + 1);
  g.bank.chips += g.win;
  if (g.win > g.best) g.best = g.win;
  setPhase(g, "result");
}

export function step(g, h) {
  g.t++; g.pt++; if (g.msgT > 0) g.msgT--;
  const auto = !!h.auto;
  const up = !auto && !!h.up, down = !auto && !!h.down, left = !auto && !!h.left, right = !auto && !!h.right,
    a = !auto && !!h.a, b = !auto && !!h.b;
  const eUp = up && !g.pUp, eDown = down && !g.pDown, eLeft = left && !g.pLeft, eRight = right && !g.pRight,
    eA = a && !g.pA, eB = b && !g.pB;
  g.pUp = up; g.pDown = down; g.pLeft = left; g.pRight = right; g.pA = a; g.pB = b;
  g.auto = auto;

  switch (g.phase) {
    case "title":
      if (eA || (auto && g.pt > 40)) toCard(g);
      break;
    case "card":
      if (auto) {
        if (g.pt > 20 && g.pt % 4 === 0) {
          if (g.di < g.dn) {
            const q = g.dq[g.di];
            if (g.cur !== q) g.cur = g.cur < q ? g.cur + 1 : g.cur - 1;
            else if (g.stake[q] < g.da[g.di]) addStake(g, q, 1);
            else g.di++;
          } else if (g.pt > 60) startRace(g);
        }
      } else {
        if (eUp) g.cur = (g.cur + g.n - 1) % g.n;
        if (eDown) g.cur = (g.cur + 1) % g.n;
        if (left || right) g.rep++; else g.rep = 0;
        const rp = g.rep > 12 && g.rep % 3 === 0;
        if (eRight || (right && rp)) addStake(g, g.cur, 1);
        if (eLeft || (left && rp)) addStake(g, g.cur, -1);
        if (eB) for (let i = 0; i < g.n; i++) g.stake[i] = 0;
        if (eA) startRace(g);
      }
      break;
    case "race":
      if (g.pt > 45) runRace(g);
      if (g.nfin === g.n && g.rt > g.fin[g.order[g.n - 1]] + 30) settle(g);
      break;
    case "result":
      if ((eA && g.pt > 10) || (auto && g.pt > 120)) toCard(g);
      break;
    case "broke":
      break;
  }
}
export function demo(g) { return { auto: true }; }

// ---- drawing -----------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { if (x >= 0 && x < 64 && y >= 0 && y < 64) b[y * 64 + x] = v; }
function fill(b, x, y, w, h, v) {
  if (x < 0) { w += x; x = 0; } if (y < 0) { h += y; y = 0; } if (x + w > 64) w = 64 - x; if (y + h > 64) h = 64 - y;
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) b[j * 64 + i] = v;
}
function text(b, x, y, s, v = 1) {
  for (let n = 0; n < s.length; n++) {
    let f = FONTCH.indexOf(s[n]); if (f < 0) f = FONTCH.length - 1;
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (FONT[f][r * 3 + q] === "1") px(b, x + q, y + r, v);
    x += 4;
  }
}
function big(b, x, y, s) {
  for (let n = 0; n < s.length; n++) {
    let f = FONTCH.indexOf(s[n]); if (f < 0) f = FONTCH.length - 1;
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (FONT[f][r * 3 + q] === "1") fill(b, x + q * 2, y + r * 2, 2, 2, 1);
    x += 8;
  }
}
const centre = (b, y, s) => text(b, 32 - ((s.length * 4 - 1) >> 1), y, s);
const bigCentre = (b, y, s) => big(b, 32 - ((s.length * 8 - 2) >> 1), y, s);
const right = (b, y, s) => text(b, 64 - s.length * 4, y, s);
function sprite(b, x, y, rows, w, v) {
  for (let r = 0; r < rows.length; r++) for (let q = 0; q < w; q++) if ((rows[r] >> (w - 1 - q)) & 1) px(b, x + q, y + r, v);
}
// a frog: x = centre, y = bottom row; air = the leaping sprite; dim = hollow (not one of your frogs)
function frog(b, x, y, air, dim) {
  sprite(b, x - 5, y - 5, air ? AIRR : SITR, 11, 0);
  sprite(b, x - 4, y - 4, dim ? (air ? AIRO : SITO) : (air ? AIR : SIT), 9, 1);
}
function cattail(b, x, y0) { fill(b, x, y0 + 4, 1, 64 - y0 - 4, 1); fill(b, x - 1, y0, 3, 4, 1); px(b, x, y0 - 1); }
function pond(b, t, y) {                                  // the title's pond: pads on the water line y
  for (let k = 0; k < 6; k++) fill(b, ((k * 13 + (t >> 3) * (k & 1 ? 1 : -1)) % 64 + 64) % 64, y + 2 + (k % 2) * 2, 3, 1, 1);
  fill(b, 8, y, 15, 1, 1); fill(b, 9, y + 1, 13, 1, 1); px(b, 17, y + 1, 0);
  fill(b, 40, y, 15, 1, 1); fill(b, 41, y + 1, 13, 1, 1); px(b, 49, y + 1, 0);
  cattail(b, 2, y - 18); cattail(b, 4, y - 12); cattail(b, 60, y - 16); cattail(b, 62, y - 10);
}
function drawArt(g, b) {                                  // title / broke: a frog leaping across the pond
  bigCentre(b, 2, "FROG"); bigCentre(b, 14, "RACE");
  pond(b, g.t, 44);
  fill(b, 0, 49, 64, 15, 0);                              // room for the messages under the water line
  const c = g.t % 60;                                     // the left frog leaps to the right pad and back
  if (c < 16) {
    const e = c, x = 15 + div(32 * e, 16), yy = 43 - div(4 * 10 * e * (16 - e), 256);
    frog(b, x, yy, true, false);
  } else if (c < 30) frog(b, 47, 43, false, false);
  else if (c < 46) {
    const e = c - 30, x = 47 - div(32 * e, 16), yy = 43 - div(4 * 10 * e * (16 - e), 256);
    frog(b, x, yy, true, false);
  } else frog(b, 15, 43, false, false);
}
function drawCard(g, b) {
  sprite(b, 1, 1, CHIP, 5, 1); text(b, 8, 1, "" + g.bank.chips);
  right(b, 1, "BET " + total(g));
  for (let i = 0; i < g.n; i++) {
    const y = 9 + i * 7, sel = i === g.cur;
    if (sel) fill(b, 0, y - 1, 64, 7, 1);
    text(b, 1, y, NAMES[g.name[i]], sel ? 0 : 1);
    const o = g.odds[i] + ":1";
    text(b, 46 - o.length * 4, y, o, sel ? 0 : 1);
    const s = g.stake[i] > 0 ? "" + g.stake[i] : "-";
    text(b, 64 - s.length * 4, y, s, sel ? 0 : 1);
  }
  fill(b, 0, 53, 64, 1, 1);
  if (g.msgT > 0) centre(b, 57, g.msg);
  else if (g.auto || ((g.t >> 6) & 1) === 0) centre(b, 57, "HOUSE EDGE " + div(g.edge, 10) + "." + g.edge % 10 + "%");
  else centre(b, 57, "A:RACE B:CLEAR");
}
function drawRace(g, b) {
  const sp = div(56, g.n);
  if (g.photo && g.nfin > 0 && g.rt - g.winT < 2) { fill(b, 0, 0, 64, 64, 1); return; }   // the camera's flash
  for (let y = 9; y < 64; y += 2) px(b, 49, y);           // the finish line
  cattail(b, 62, 10); cattail(b, 60, 24);
  for (let i = 0; i < g.n; i++) {
    const py = 8 + (i + 1) * sp - 2;
    fill(b, 0, py, 6, 2, 1); fill(b, 50, py, 9, 2, 1);    // the banks
    for (let j = 1; j < PADS; j++) { const x = padX(j); fill(b, x - 2, py, 4, 1, 1); fill(b, x - 1, py + 1, 2, 1, 1); }
    for (let k = 0; k < 2; k++) fill(b, ((i * 17 + k * 29 + (g.t >> 3) * (i & 1 ? 1 : -1)) % 48 + 48) % 48 + 4, py + 3, 2, 1, 1);
  }
  for (let i = 0; i < g.n; i++) {
    const py = 8 + (i + 1) * sp - 2, k = g.hk[i];
    let x = padX(g.hj[i]), y = py - 1, air = false;
    if (k < g.hm[i] && g.rt >= g.hs[i * 10 + k]) {
      const z = g.hz[i * 10 + k], D = hopT(z), e = g.rt - g.hs[i * 10 + k], hh = Math.min(sp - 4, z === 1 ? 4 : 6);
      x += div(5 * z * e, D); y -= div(4 * hh * e * (D - e), D * D); air = true;
    }
    frog(b, x, y, air, g.stake[i] === 0);
    if (g.hj[i] === PADS) { fill(b, 57, py - 7, 5, 7, 0); text(b, 58, py - 6, "" + (g.place[i] + 1)); }
  }
  fill(b, 0, 0, 64, 6, 0);
  if (g.pt <= 45) centre(b, 1, g.pt < 30 ? "READY" : "GO!");
  else if (g.nfin === 0) centre(b, 1, "LEAD " + NAMES[g.name[g.lead]]);
  else if (g.photo && g.rt - g.winT < 45) { if ((g.t >> 2) & 1) centre(b, 1, "PHOTO FINISH"); }
  else centre(b, 1, "WINNER " + NAMES[g.name[g.order[0]]]);
}
function drawResult(g, b) {
  for (let p = 0; p < 3; p++) {
    const i = g.order[p], o = g.odds[i] + ":1";
    text(b, 1, 1 + p * 6, PLACE[p] + " " + NAMES[g.name[i]]); right(b, 1 + p * 6, o);
  }
  fill(b, 0, 19, 64, 1, 1);
  let y = 22;
  for (let i = 0; i < g.n; i++) {
    if (g.stake[i] === 0) continue;
    text(b, 1, y, NAMES[g.name[i]] + " " + g.stake[i]);
    right(b, y, i === g.order[0] ? "+" + g.win : "LOSE");
    y += 6;
  }
  if (y <= 40) {                                          // room left: the winner hops for joy on its pad
    const up = (g.t >> 3) & 1;
    fill(b, 26, 50, 13, 1, 1); fill(b, 27, 51, 11, 1, 1); px(b, 34, 51, 0);
    frog(b, 32, 49 - up * 3, up === 1, false);
  }
  text(b, 1, 58, g.win > 0 ? "WON " + g.win : "NO WIN");
  if (!g.auto && (g.t >> 4) & 1) right(b, 58, "A:NEXT");
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    drawArt(g, b);
    if (g.phase === "broke") {
      centre(b, 50, "OUT OF CHIPS"); if ((g.t >> 5) & 1) centre(b, 57, "MORE TOMORROW");
      return b;
    }
    if (g.msgT > 0) centre(b, 50, g.msg);
    if ((g.t >> 4) & 1) centre(b, 57, "A: START");
    return b;
  }
  if (g.phase === "card") drawCard(g, b);
  else if (g.phase === "race") drawRace(g, b);
  else drawResult(g, b);
  return b;
}
