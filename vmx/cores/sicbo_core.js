// SIC BO for the VMX's 64x64 1-bit screen: the common Macau table. Our own art and code.
// Three dice are shaken under a cup. Each die is 1-6 exactly 1 in 6 (rejection sampling on the seeded RNG, no
// modulo bias), thrown BEFORE the cup comes down; the shake and the lift only reveal them.
// Bets (chips from VMX CASINO's shared bank, 0-20 on each bet, several a round, the total never over the stash; a
// win pays the stake back plus the winnings). House edges exact over all 216 rolls (tools/sicbo_odds.py):
//   SMALL (total 4-10) 1:1, BIG (11-17) 1:1, ODD 1:1, EVEN 1:1; all four lose on any triple. Edge 1/36 = 2.78%.
//   SUM n (one total 4-17, chosen on the TOTAL row): 4 or 17 pays 60:1 (edge 15.28%), 5/16 30:1 (13.89%),
//     6/15 17:1 (16.67%), 7/14 12:1 (9.72%), 8/13 8:1 (12.50%), 9/12 6:1 (18.98%), 10/11 6:1 (12.50%).
//     A triple counts as its total here.
//   TRIPS (any triple) 30:1, the kinder house rule (24:1 would be 30.56%): edge 5/36 = 13.89%.
//   fff (one triple, e.g. 666; the face chosen on the TRIPLE row) 150:1: edge 65/216 = 30.09%.
//   DIE n (single die number, the face chosen on the SINGLE row): 1:1 per die showing it (one die 1:1, two 2:1,
//     three 3:1): edge 17/216 = 7.87%.
// Controls: Up/Down choose a row, Left/Right take a chip off / put one on (held = repeat; on the TOTAL, TRIPLE and
// SINGLE rows they choose the number or face that the row below bets on), A shakes, B clears every bet. Bets stay
// on for the next round (cut down if the stash can't cover them). After the reveal: A goes back to the table.
// Everything is integer so the C# port in vmx-firmware/games/sicbo plays exactly the same; keep it that way (div()
// for /, every product under 2^31, no Math.sin/sqrt/sort/random).
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here). Broke (no chips) =
// "OUT OF CHIPS / MORE TOMORROW" until the bank's daily top-up.
// Input: held buttons (edges found here); { auto: true } = the computer bets (demo: mostly BIG or SMALL, sometimes
// a single-die number or a total, now and then odd/even or any triple).
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const FONTCH = "ABCDEFGHIKLMNOPRSTUVWXYZ0123456789:!-<>+ ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "101101110101101", "100100100100111", "101111111101101",
  "110101101101101", "010101101101010", "110101110100100", "110101110101101", "011100010001110", "111010010010010",
  "101101101101111", "101101101101010", "101101111111101", "101101010101101", "101101010010010", "111001010100111",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "001010100010001", "100010001010100", "000010111010000", "000000000000000" ];
const CHIP = [14, 31, 27, 31, 14];                        // 5x5 chip icon, bit 4 = left
const NAMES = ["SMALL", "BIG", "ODD", "EVEN", "TOTAL", "SUM", "TRIPS", "TRIPLE", "ON", "SINGLE", "DIE"];
const SMALL = 0, BIG = 1, ODD = 2, EVEN = 3, TPICK = 4, TOTAL = 5, ANY = 6, FPICK = 7, TRIPLE = 8, DPICK = 9, DIE = 10;
const NB = 11, VIS = 3, CAP = 20;
const TPAY = [0, 0, 0, 0, 60, 30, 17, 12, 8, 6, 6, 6, 6, 8, 12, 17, 30, 60, 0];   // SUM n pays TPAY[n]:1
const PLO = [4, 1, 1], PN = [14, 6, 6];                   // the picks: total 4-17, triple face 1-6, die face 1-6
const CUPW = [2, 3, 3, 2, 8, 11, 13, 14, 15, 16, 16, 17, 17, 18, 18, 18, 19, 20, 20];   // the cup's half-widths
const CX = 44, CDOWN = 9;                                 // the cup's centre and its top row when down
const DX = [25, 38, 51];                                  // the dice's resting columns on the felt
const JIG = [0, 1, 2, 1, 0, -1, -2, -1];
const DROP = 8, SHK = 44, LF = 24, ROLLT = SHK + LF + 6;  // cup down / shaken / lifted / the result
const T2 = 34, LAG = 3;                                   // a title die's flight ticks; each die lags the next
const REST = 15, TREST = 31;                              // the dice's resting top row on the felt / the title

const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

// ==== DICE ART (the casino's shared dice look: SIC BO and CHUCK-A-LUCK copy this section) =========================
// Two sizes: sz 0 = big, a 12x12 die (pips 2x2 on a 3x3 grid at 2/5/8), sz 1 = small, a 7x7 die (pips 1x1 at
// 1/3/5). A face is a lit body with the corners cut and dark pips, so it reads on a dark felt. drawDie(b, x, y,
// face, sz) draws face 1-6 with its top-left at x, y. drawTumble(b, x, y, k, sz) draws tumbling frame k (0-2: the
// die turned about 22, 45 and 67 degrees, a few pips showing); only its lit pixels are set. dieFrame(g, k, u, f)
// below is the rolling animation: where die k is u ticks into its throw, and which frame shows.
const DSZ = [12, 7], PIPW = [2, 1], PIPC = [[2, 5, 8], [1, 3, 5]];
const PIPS = [0, 16, 68, 84, 325, 341, 455];              // face n: pips on the 3x3 grid, bit (row * 3 + col)
const TUMBLE = [                                          // rows, bit 0 = left
  [[24, 248, 1020, 4068, 4070, 2046, 2046, 1663, 639, 1020, 496, 384],      // 12x12, ~22 degrees, 2 pips
   [96, 240, 408, 924, 2046, 3219, 3219, 2046, 924, 408, 240, 96],          // 12x12, 45 degrees, 5 pips
   [384, 496, 1020, 831, 1855, 2046, 2046, 4046, 4044, 1020, 248, 24]],     // 12x12, ~67 degrees, 2 pips
  [[4, 62, 126, 54, 63, 62, 16], [8, 28, 62, 107, 62, 28, 8], [16, 62, 47, 62, 122, 62, 4]] ];   // 7x7
const FLICK = [3, 5, 2, 6, 1, 4];                         // faces flashed between tumbling frames
function drawDie(b, x, y, face, sz) {
  const n = DSZ[sz], w = PIPW[sz], pc = PIPC[sz], m = PIPS[face];
  fill(b, x + 1, y, n - 2, 1, 1); fill(b, x, y + 1, n, n - 2, 1); fill(b, x + 1, y + n - 1, n - 2, 1, 1);
  for (let k = 0; k < 9; k++) if ((m >> k) & 1) fill(b, x + pc[k % 3], y + pc[div(k, 3)], w, w, 0);
}
function drawTumble(b, x, y, k, sz) {
  const fr = TUMBLE[sz][k], n = DSZ[sz];
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if ((fr[r] >> q) & 1) px(b, x + q, y + r, 1);
}
function hop(u) {                                         // height above the felt u ticks into the throw
  if (u < 10) return 6 - div(6 * u * u, 100);             // falls in from the throw...
  if (u < 22) { const t = u - 10; return div(16 * t * (12 - t), 144); }   // ...and bounces twice
  if (u < 30) { const t = u - 22; return div(8 * t * (8 - t), 64); }
  return 0;
}
// die k (0 left, 1 right; throw the right one LAG ticks first so they never cross) u ticks (0..T2) into its throw, landing on face f: [x, y offset up, frame] where frame
// 1-6 = that face, -1..-3 = tumble frame 0..2. It slides in from off the left edge and rolls as it goes.
function dieFrame(k, u, f) {
  const xf = 37 + 13 * k, s = T2 - u, x = xf - div((xf + 13) * s * s, T2 * T2), q = div(x + 13, 3);
  let fr = f;
  if (s > 2) fr = (q & 1) === 1 ? -1 - ((div(q, 2) + k) % 3) : FLICK[(div(q, 2) + 3 * k) % 6];
  return [x, hop(u), fr];
}
function drawDieAt(b, k, u, f, left, top) {             // left: shift across (0 = land on the felt's right)
  const d = dieFrame(k, u, f);
  if (d[2] > 0) drawDie(b, d[0] + left, top - d[1], d[2], 0); else drawTumble(b, d[0] + left, top - d[1], -1 - d[2], 0);
}
// ==== end of dice art =============================================================================================

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, holdT: 0, msg: "", msgT: 0, auto: false,
    st: Array(NB).fill(0), rst: Array(NB).fill(0), oc: Array(NB).fill(0), amt: Array(NB).fill(0), pr: [],
    pk: [10, 6, 1], sel: 0, d1: 0, d2: 0, d3: 0, hist: [], histT: [], net: 0, call: "", bestPay: 0,
    dRow: [0, 0], dAmt: [0, 0], dPk: [0, 0], dN: 0, dk: 0, dClr: false,
    pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function die(g) {                                         // 1-6, each exactly 1 in 6: 65532 = 6 x 10922
  let r = rnd(g);
  while (r >= 65532) r = rnd(g);
  return r % 6 + 1;
}
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 50; }
function total(g) { let s = 0; for (let i = 0; i < NB; i++) s += g.st[i]; return s; }
const isPick = r => r === TPICK || r === FPICK || r === DPICK;
const pickOf = r => r === TOTAL ? 0 : r === TRIPLE ? 1 : r === DIE ? 2 : -1;   // the pick a stake row bets on
const pickRow = r => r === TPICK ? 0 : r === FPICK ? 1 : 2;
function label(g, r) {
  if (r === TOTAL) return "SUM " + g.pk[0];
  if (r === TRIPLE) { const f = "" + g.pk[1]; return f + f + f; }
  if (r === DIE) return "DIE " + g.pk[2];
  return NAMES[r];
}
function payText(g, r) {
  if (r === TOTAL) return TPAY[g.pk[0]] + ":1";
  return r === ANY ? "30:1" : r === TRIPLE ? "150:1" : "1:1";
}
function toBet(g) {                                       // back to the table: last bets stay, cut to the stash
  let run = 0;
  for (let i = 0; i < NB; i++) { g.st[i] = Math.min(g.st[i], g.bank.chips - run); run += g.st[i]; }
  setPhase(g, g.bank.chips < 1 ? "broke" : "bet");
  g.dClr = false; g.dk = 0; g.dN = 0;
}
function shake(g) {
  const tot = total(g);
  if (tot === 0) { say(g, "PLACE A BET"); return; }
  g.bank.chips -= tot;
  for (let i = 0; i < NB; i++) g.rst[i] = g.st[i];
  g.d1 = die(g); g.d2 = die(g); g.d3 = die(g);            // the result, before the cup comes down
  setPhase(g, "roll");
}
function settle(g) {                                      // pay out; note each bet's outcome for the result screen
  const s = g.d1 + g.d2 + g.d3, trip = g.d1 === g.d2 && g.d2 === g.d3;
  let paid = 0, net = 0;
  g.pr = [];
  for (let i = 0; i < NB; i++) {
    const st = g.st[i];
    if (st === 0) continue;
    g.pr.push(i);
    let ret = 0;                                          // returned: stake + winnings, 0 = lost
    if (i === SMALL) { if (!trip && s <= 10) ret = 2 * st; }
    else if (i === BIG) { if (!trip && s >= 11) ret = 2 * st; }
    else if (i === ODD) { if (!trip && (s & 1) === 1) ret = 2 * st; }
    else if (i === EVEN) { if (!trip && (s & 1) === 0) ret = 2 * st; }
    else if (i === TOTAL) { if (s === g.pk[0]) ret = st * (TPAY[s] + 1); }
    else if (i === ANY) { if (trip) ret = 31 * st; }
    else if (i === TRIPLE) { if (trip && g.d1 === g.pk[1]) ret = 151 * st; }
    else {
      const f = g.pk[2], c = (g.d1 === f ? 1 : 0) + (g.d2 === f ? 1 : 0) + (g.d3 === f ? 1 : 0);
      if (c > 0) ret = st * (c + 1);
    }
    if (ret > 0) { g.oc[i] = 1; paid += ret; g.amt[i] = ret - st; net += ret - st; }
    else { g.oc[i] = 2; g.amt[i] = st; net -= st; }
  }
  g.bank.chips += paid; g.net = net;
  if (paid > g.bestPay) g.bestPay = paid;
  g.call = trip ? "TRIPLE " + g.d1 : (s <= 10 ? "SMALL " : "BIG ") + s;
  g.hist.unshift(s); g.histT.unshift(trip ? 1 : 0);
  if (g.hist.length > 5) { g.hist.pop(); g.histT.pop(); }
  setPhase(g, "res");
}
function act(g, aUp, aDown, aLeft, aRight, aA, aB) {      // one betting move (from the pad or the demo)
  if (aUp) g.sel = (g.sel + NB - 1) % NB;
  if (aDown) g.sel = (g.sel + 1) % NB;
  if (isPick(g.sel)) {
    const p = pickRow(g.sel), lo = PLO[p], n = PN[p];
    if (aLeft) g.pk[p] = lo + (g.pk[p] - lo + n - 1) % n;
    if (aRight) g.pk[p] = lo + (g.pk[p] - lo + 1) % n;
  } else {
    if (aLeft && g.st[g.sel] > 0) g.st[g.sel]--;
    if (aRight) {
      if (g.st[g.sel] >= CAP) say(g, "TABLE MAX 20");
      else if (total(g) >= g.bank.chips) say(g, "NOT ENOUGH CHIPS");
      else g.st[g.sel]++;
    }
  }
  if (aB) { for (let i = 0; i < NB; i++) g.st[i] = 0; }
  if (aA) shake(g);
}
function plan(g) {                                        // the demo's bets for this round
  const c = g.bank.chips;
  g.dN = 1; g.dRow[0] = rnd(g) % 2; g.dPk[0] = 0;          // SMALL or BIG
  if (c < 10) { g.dAmt[0] = c; return; }
  g.dAmt[0] = 2 + rnd(g) % 6;
  const k = rnd(g) % 10;
  if (k < 3) { g.dN = 2; g.dRow[1] = DIE; g.dPk[1] = 1 + rnd(g) % 6; g.dAmt[1] = 1 + rnd(g) % 3; }
  else if (k < 5) { g.dN = 2; g.dRow[1] = TOTAL; g.dPk[1] = 7 + rnd(g) % 8; g.dAmt[1] = 1 + rnd(g) % 2; }
  else if (k === 5) { g.dN = 2; g.dRow[1] = ANY; g.dPk[1] = 0; g.dAmt[1] = 1; }
  else if (k === 6) { g.dN = 2; g.dRow[1] = ODD + rnd(g) % 2; g.dPk[1] = 0; g.dAmt[1] = 2 + rnd(g) % 4; }
}
function demoMove(g) {                                    // one press: clear, then walk to each bet and chip it up
  let u = false, d = false, l = false, r = false, a = false, b = false;
  if (!g.dClr) { g.dClr = true; if (total(g) > 0) b = true; }
  else if (g.dk < g.dN) {
    const tr = g.dRow[g.dk], p = pickOf(tr);
    const want = p >= 0 && g.pk[p] !== g.dPk[g.dk] ? tr - 1 : tr;
    if (g.sel < want) d = true;
    else if (g.sel > want) u = true;
    else if (want !== tr) { if ((g.dPk[g.dk] - g.pk[p] + PN[p]) % PN[p] <= div(PN[p], 2)) r = true; else l = true; }
    else if (g.st[tr] < g.dAmt[g.dk] && g.st[tr] < CAP && total(g) < g.bank.chips) r = true;
    else g.dk++;
  } else a = true;
  act(g, u, d, l, r, a, b);
}

export function step(g, h) {
  g.t++; g.pt++; if (g.msgT > 0) g.msgT--;
  const auto = !!h.auto;
  const up = !auto && !!h.up, down = !auto && !!h.down, left = !auto && !!h.left, right = !auto && !!h.right,
    a = !auto && !!h.a, b = !auto && !!h.b;
  const eUp = up && !g.pUp, eDown = down && !g.pDown, eLeft = left && !g.pLeft, eRight = right && !g.pRight,
    eA = a && !g.pA, eB = b && !g.pB;
  g.pUp = up; g.pDown = down; g.pLeft = left; g.pRight = right; g.pA = a; g.pB = b;
  if (up || down || left || right) g.holdT++; else g.holdT = 0;
  const rep = g.holdT > 9 && (g.holdT & 1) === 0;          // held: repeat every 2nd tick after a moment
  g.auto = auto;

  switch (g.phase) {
    case "title":
      if (eA || (auto && g.pt > 40)) toBet(g);
      break;
    case "bet":
      if (auto) {
        if (g.dN === 0) plan(g);
        if (g.pt > 12 && g.pt % 4 === 0) demoMove(g);
      } else act(g, eUp || (up && rep), eDown || (down && rep), eLeft || (left && rep), eRight || (right && rep), eA, eB);
      break;
    case "roll":
      if (g.pt >= ROLLT) settle(g);
      break;
    case "res":
      if ((eA && g.pt > 10) || (auto && g.pt > 75) || g.pt > 600) toBet(g);
      break;
    case "broke":
      break;
  }
}
export function demo(g) { return { auto: true }; }

// ---- drawing -----------------------------------------------------------------------------------------------------
function px(b, x, y, v) { if (x >= 0 && x < 64 && y >= 0 && y < 64) b[y * 64 + x] = v; }
function fill(b, x, y, w, h, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(b, i, j, v); }
function rect(b, x, y, w, h, dots) {                      // outline; dots: every other pixel
  for (let i = 0; i < w; i++) if (!dots || (i & 1) === 0) { px(b, x + i, y, 1); px(b, x + i, y + h - 1, 1); }
  for (let j = 0; j < h; j++) if (!dots || (j & 1) === 0) { px(b, x, y + j, 1); px(b, x + w - 1, y + j, 1); }
}
function text(b, x, y, s, v) {
  for (let n = 0; n < s.length; n++) {
    let f = FONTCH.indexOf(s[n]); if (f < 0) f = FONTCH.length - 1;
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (FONT[f][r * 3 + q] === "1") px(b, x + q, y + r, v);
    x += 4;
  }
}
function big(b, x, y, s, v) {
  for (let n = 0; n < s.length; n++) {
    let f = FONTCH.indexOf(s[n]); if (f < 0) f = FONTCH.length - 1;
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (FONT[f][r * 3 + q] === "1") fill(b, x + q * 2, y + r * 2, 2, 2, v);
    x += 8;
  }
}
const centre = (b, y, s) => text(b, 32 - ((s.length * 4 - 1) >> 1), y, s, 1);
const right = (b, x, y, s, v) => text(b, x - s.length * 4, y, s, v);   // ends just before x
function boxed(b, y, s) {
  const w = s.length * 4 + 3, x = 32 - (w >> 1);
  fill(b, x, y, w, 9, 0); rect(b, x, y, w, 9, false); text(b, x + 2, y + 2, s, 1);
}
function topBar(g, b) {                                   // the name and the last totals (triples underlined)
  text(b, 1, 1, "SIC BO", 1);
  let x = 64;
  for (let k = 0; k < g.hist.length; k++) {               // newest at the right, boxed
    const s = "" + g.hist[k], w = s.length * 4 + 1;
    x -= w;
    if (x < 27) break;
    if (k === 0) { fill(b, x, 0, w, 7, 1); text(b, x + 1, 1, s, 0); } else text(b, x + 1, 1, s, 1);
    if (g.histT[k] === 1) fill(b, x, 7, w, 1, 1);
    x -= 2;
  }
}
function cup(b, cx, top) {                                // the shaker cup, its top row at top
  for (let r = 0; r < 19; r++) {
    const hw = CUPW[r], y = top + r;
    fill(b, cx - hw - 1, y, 2 * hw + 2, 1, 0); fill(b, cx - hw, y, 2 * hw, 1, 1);
    if (r === 3) fill(b, cx - 1, y, 2, 1, 0);             // the knob's neck
    if (r >= 6 && r <= 13) px(b, cx - hw + 3, y, 0);      // the shine
    if (r >= 8 && r <= 11) px(b, cx - hw + 5, y, 0);
    if (r === 15) fill(b, cx - hw + 1, y, 2 * hw - 2, 1, 0);   // the rim band
  }
}
function felt(g, b) {                                     // the felt with its dashed rail, the dice, the call / the cup
  rect(b, 0, 8, 64, 21, true);
  if (g.phase === "roll") {
    const p = g.pt;
    if (p >= SHK) {                                       // the cup lifts off the dice
      drawDie(b, DX[0], REST, g.d1, 0); drawDie(b, DX[1], REST, g.d2, 0); drawDie(b, DX[2], REST, g.d3, 0);
      const u = Math.min(LF, p - SHK);
      cup(b, CX, CDOWN - div(30 * u * u, LF * LF));
    } else if (p < DROP) {                                // it comes down on the felt...
      const u = DROP - p;
      cup(b, CX, CDOWN - div(28 * u * u, DROP * DROP));
    } else {                                              // ...and rattles
      const j = JIG[(p >> 1) & 7];
      cup(b, CX + j, CDOWN - ((p & 2) >> 1));
      if (j !== 0) { const x = j < 0 ? 16 : 19; fill(b, x, 15, 2, 1, 1); fill(b, x + 1, 19, 2, 1, 1); fill(b, x, 23, 2, 1, 1); }
    }
    return;
  }
  if (g.d1 === 0) { centre(b, 16, "PLACE BETS"); return; }
  drawDie(b, DX[0], REST, g.d1, 0); drawDie(b, DX[1], REST, g.d2, 0); drawDie(b, DX[2], REST, g.d3, 0);
  const s = g.d1 + g.d2 + g.d3, ss = "" + s;
  const w = g.d1 === g.d2 && g.d2 === g.d3 ? "TRIPLE" : s <= 10 ? "SMALL" : "BIG";
  big(b, 12 - ((ss.length * 8 - 2) >> 1), 10, ss, 1);
  text(b, 12 - ((w.length * 4 - 1) >> 1), 22, w, 1);
}
function stash(g, b, y) {
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if ((CHIP[r] >> (4 - q)) & 1) px(b, 1 + q, y + r, 1);
  text(b, 8, y, "" + g.bank.chips, 1);
}
function drawBets(g, b, cursor) {
  const top = Math.max(0, Math.min(g.sel - 1, NB - VIS));
  for (let i = 0; i < VIS; i++) {
    const r = top + i, y = 30 + i * 7, on = cursor && r === g.sel, v = on ? 0 : 1;
    if (on) fill(b, 0, y, 63, 7, 1);
    text(b, 2, y + 1, isPick(r) ? NAMES[r] : label(g, r), v);
    if (r === TPICK) {
      if (on) right(b, 63, y + 1, "<" + g.pk[0] + ">", v); else right(b, 59, y + 1, "" + g.pk[0], v);
    } else if (isPick(r)) {                               // a face: small dice (three for a triple)
      const f = g.pk[pickRow(r)], x0 = r === FPICK ? 36 : 52;
      if (on) { fill(b, x0 - 1, y, 60 - x0, 7, 0); text(b, x0 - 5, y + 1, "<", 0); text(b, 60, y + 1, ">", 0); }
      for (let x = x0; x < 59; x += 8) drawDie(b, x, y, f, 1);
    } else {
      right(b, 47, y + 1, payText(g, r), v);
      if (on) right(b, 63, y + 1, "<" + g.st[r] + ">", v);
      else if (g.st[r] > 0) right(b, 59, y + 1, "" + g.st[r], v);
    }
  }
  const th = div(21 * VIS, NB), ty = 30 + div(21 * top, NB);   // scroll bar
  for (let j = 0; j < th; j++) px(b, 63, ty + j, 1);
  fill(b, 0, 51, 64, 1, 1);
  stash(g, b, 53);
  right(b, 64, 53, "BET " + total(g), 1);
}
function drawRes(g, b) {
  const pages = div(g.pr.length + VIS - 1, VIS), pg = pages > 1 ? div(g.pt, 60) % pages : 0;
  for (let i = 0; i < VIS; i++) {
    const k = pg * VIS + i;
    if (k >= g.pr.length) break;
    const r = g.pr[k], y = 30 + i * 7, win = g.oc[r] === 1, v = win ? 0 : 1;
    if (win) fill(b, 0, y, 64, 7, 1);
    text(b, 2, y + 1, label(g, r), v);
    right(b, 41, y + 1, "" + g.rst[r], v);
    right(b, 64, y + 1, (win ? "+" : "-") + g.amt[r], v);
  }
  fill(b, 0, 51, 64, 1, 1);
  stash(g, b, 53);
  right(b, 64, 53, g.net > 0 ? "WON " + g.net : g.net < 0 ? "LOST " + (0 - g.net) : "EVEN", 1);
  centre(b, 59, g.pt > 40 && ((g.t >> 4) & 1) === 1 ? "A: NEXT" : g.call);
}
function titleDice(g, b) {                                // the title's three dice, thrown again and again
  const c = div(g.pt, 75), tt = g.pt % 75;
  for (let k = 0; k < 3; k++) {
    const u = Math.max(0, Math.min(T2, tt - LAG * (2 - k)));
    drawDieAt(b, k, u, FLICK[(c + 2 * k) % 6], -24, TREST);
  }
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    titleDice(g, b);
    big(b, 9, 15, "SIC BO", 1);
    fill(b, 0, 44, 64, 1, 1);
    if (g.phase === "broke") { boxed(b, 2, "OUT OF CHIPS"); if ((g.t >> 5) & 1) boxed(b, 53, "MORE TOMORROW"); return b; }
    if (g.msgT > 0) boxed(b, 2, g.msg);
    if ((g.t >> 4) & 1) boxed(b, 53, "A: START");
    return b;
  }
  topBar(g, b);
  felt(g, b);
  if (g.phase === "bet") {
    drawBets(g, b, true);
    if (g.msgT > 0) centre(b, 59, g.msg);
    else if ((g.t >> 4) & 1) centre(b, 59, "A:SHAKE B:CLEAR");
    return b;
  }
  if (g.phase === "roll") { drawBets(g, b, false); return b; }
  drawRes(g, b);
  return b;
}
