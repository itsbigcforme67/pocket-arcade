// CRAPS for the VMX's 64x64 1-bit screen: the core of a real craps table. Our own art and code.
// Two dice, each 1-6 exactly 1 in 6 (rejection sampling on the seeded RNG, no modulo bias), thrown BEFORE the dice
// tumble; the animation only lands on them.
// Bets (chips from VMX CASINO's shared bank, the total on the table never over the stash):
//   PASS (pass line, 1-20, come-out only): come-out 7/11 wins 1:1, 2/3/12 loses, else that number is the POINT;
//     then the point before a 7 wins 1:1, a 7 first ("SEVEN OUT") loses. House edge 1.41%.
//   DONT (don't pass, 1-20, come-out only): come-out 2/3 wins 1:1, 12 pushes, 7/11 loses; then a 7 before the point
//     wins 1:1, the point first loses. House edge 1.36%. Only one of PASS / DONT at a time.
//   Line bets can't be taken down or changed once a point is set.
//   ODDS (behind the line bet, once a point is set; up to 3x the line bet; take it down any time): true odds, house
//     edge 0%. Behind PASS it pays 2:1 on 4/10, 3:2 on 5/9, 6:5 on 6/8; behind DONT (lay odds) 1:2 on 4/10, 2:3 on
//     5/9, 5:6 on 6/8. So every payout is whole chips, odds go on in steps (pass: 1 on 4/10, 2 on 5/9, 5 on 6/8;
//     lay: 2, 3, 6), the 3x cap rounded down to a whole step. Decided with its line bet.
//   FIELD (one roll, 1-20): 3, 4, 9, 10, 11 pay 1:1, 2 pays 2:1, 12 pays 3:1; 5, 6, 7, 8 lose. House edge 1/36 = 2.78%.
//   ANY 7 (one roll, 1-20): 7 pays 4:1. House edge 16.7%.     CRAPS (any craps, one roll, 1-20): 2, 3 or 12 pays
//   7:1. House edge 11.1%.
// A win pays the stake back plus the winnings. One-roll bets and decided line bets stay on for the next roll (cut
// down if the stash can't cover them); odds come down when decided.
// Chips: a bet's new chips are taken from the bank when the dice are thrown; odds taken down give theirs back.
// Controls: Up/Down choose a bet, Left/Right take chips off / put them on (held = repeat), A rolls, B clears every
// bet that may come down. After the roll: A goes back to the table.
// Everything is integer so the C# port in vmx-firmware/games/craps plays exactly the same; keep it that way (div()
// for /, every product under 2^31, no Math.sin/sqrt/sort/random).
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here). Broke (no chips and
// nothing riding on the table) = "OUT OF CHIPS / MORE TOMORROW" until the bank's daily top-up.
// Input: held buttons (edges found here); { auto: true } = the computer bets (demo: pass line with odds, sometimes
// don't pass, sometimes the field, now and then ANY 7 / CRAPS).
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
const PUCKON = [28, 62, 127, 127, 127, 62, 28];           // 7x7 point puck, bit 6 = left: ON (lit) / OFF (ring)
const PUCKOFF = [28, 34, 65, 65, 65, 34, 28];
const NAMES = ["PASS", "DONT", "ODDS", "FIELD", "ANY 7", "CRAPS"];
const NUMS = ["", "", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE"];
const ON = [0, 0, 0, 0, 2, 3, 6, 0, 6, 3, 2], OD = [0, 0, 0, 0, 1, 2, 5, 0, 5, 2, 1];   // pass odds pay ON:OD
const PASS = 0, DONT = 1, ODDS = 2, FIELD = 3, ANY7 = 4, CRAPS = 5, NB = 6, VIS = 3, CAP = 20;
const T2 = 34, LAG = 3, SETTLE = T2 + LAG + 4;            // a die's flight ticks; the left die lags; result after landing
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
    st: Array(NB).fill(0), cm: Array(NB).fill(0), rst: Array(NB).fill(0), oc: Array(NB).fill(0),
    amt: Array(NB).fill(0), pr: [], dec: false, sel: 0, point: 0, d1: 0, d2: 0, hist: [], net: 0, call: "", hand: 0,
    bestRun: 0, bestPay: 0, dT: Array(NB).fill(0), dk: 0, dPlan: false, dClr: false,
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
function fresh(g) { let s = 0; for (let i = 0; i < NB; i++) s += g.st[i] - g.cm[i]; return s; }   // not yet taken
function riding(g) { let s = 0; for (let i = 0; i < NB; i++) s += g.cm[i]; return s; }
const isLine = i => i === PASS || i === DONT;
function side(g) { return g.st[PASS] > 0 ? PASS : g.st[DONT] > 0 ? DONT : -1; }   // the line bet the odds are behind
function stepOf(g, i) {
  if (i !== ODDS || g.point === 0) return 1;
  return side(g) === DONT ? ON[g.point] : OD[g.point];
}
function oddsCap(g) {
  const s = side(g);
  if (g.point === 0 || s < 0) return 0;
  const st = stepOf(g, ODDS);
  return div(3 * g.st[s], st) * st;
}
function blockAdd(g, i) {                                 // why chips can't go on bet i ("" = they can)
  const step = stepOf(g, i);
  if (isLine(i) && g.point !== 0) return "LINE BETS LOCKED";
  if ((i === PASS && g.st[DONT] > 0) || (i === DONT && g.st[PASS] > 0)) return "ONE LINE BET";
  if (i === ODDS) {
    if (g.point === 0) return "ODDS AFTER POINT";
    if (side(g) < 0) return "NEED A LINE BET";
    const cap = oddsCap(g);
    if (g.st[i] + step > cap) return cap === 0 ? "LINE TOO SMALL" : "ODDS MAX 3X";
  } else if (g.st[i] >= CAP) return "TABLE MAX 20";
  if (fresh(g) + step > g.bank.chips) return "NOT ENOUGH CHIPS";
  return "";
}
const canSub = (g, i) => !(isLine(i) && g.point !== 0) && g.st[i] >= stepOf(g, i);
function refund(g, i) {                                   // chips already taken for bet i, now taken down
  if (g.st[i] < g.cm[i]) { g.bank.chips += g.cm[i] - g.st[i]; g.cm[i] = g.st[i]; }
}
function addChip(g, i) { const w = blockAdd(g, i); if (w !== "") say(g, w); else g.st[i] += stepOf(g, i); }
function takeChip(g, i) {
  if (isLine(i) && g.point !== 0) { if (g.st[i] > 0) say(g, "LINE BETS LOCKED"); return; }
  if (g.st[i] >= stepOf(g, i)) { g.st[i] -= stepOf(g, i); refund(g, i); }
}
function clearBets(g) {
  for (let i = 0; i < NB; i++) if (!(isLine(i) && g.point !== 0)) { g.st[i] = 0; refund(g, i); }
}
function toBet(g) {                                       // back to the table: bets not yet taken cut to the stash
  let run = 0;
  for (let i = 0; i < NB; i++) {
    const n = Math.min(g.st[i] - g.cm[i], g.bank.chips - run);
    g.st[i] = g.cm[i] + n; run += n;
  }
  setPhase(g, g.bank.chips < 1 && riding(g) === 0 ? "broke" : "bet");
  g.dPlan = false; g.dClr = false; g.dk = 0;
}
function roll(g) {
  if (total(g) === 0) { say(g, "PLACE A BET"); return; }
  g.bank.chips -= fresh(g);
  for (let i = 0; i < NB; i++) { g.cm[i] = g.st[i]; g.rst[i] = g.st[i]; }
  g.d1 = die(g); g.d2 = die(g);                           // the result, before the dice move
  g.hand++;
  setPhase(g, "roll");
}
function settle(g) {                                      // pay out; note each bet's outcome for the result screen
  const s = g.d1 + g.d2, p = g.point, sd = side(g);
  let paid = 0, net = 0;
  g.dec = false;
  g.pr = [];
  for (let i = 0; i < NB; i++) {
    const st = g.st[i];
    if (st === 0) continue;
    g.pr.push(i);
    let r = 4;                                            // 1 win (ret = stake + winnings), 2 lose, 3 push, 4 stays
    let ret = 0;
    if (i === PASS) {
      if (p === 0) { if (s === 7 || s === 11) r = 1; else if (s === 2 || s === 3 || s === 12) r = 2; }
      else if (s === p) r = 1; else if (s === 7) r = 2;
      ret = 2 * st;
    } else if (i === DONT) {
      if (p === 0) { if (s === 2 || s === 3) r = 1; else if (s === 12) r = 3; else if (s === 7 || s === 11) r = 2; }
      else if (s === 7) r = 1; else if (s === p) r = 2;
      ret = 2 * st;
    } else if (i === ODDS) {
      if (s === p) r = sd === PASS ? 1 : 2; else if (s === 7) r = sd === PASS ? 2 : 1;
      ret = st + (sd === PASS ? div(st * ON[p], OD[p]) : div(st * OD[p], ON[p]));
    } else if (i === FIELD) {
      r = s === 2 || s === 3 || s === 4 || s === 9 || s === 10 || s === 11 || s === 12 ? 1 : 2;
      ret = s === 2 ? 3 * st : s === 12 ? 4 * st : 2 * st;
    } else if (i === ANY7) { r = s === 7 ? 1 : 2; ret = 5 * st; }
    else { r = s === 2 || s === 3 || s === 12 ? 1 : 2; ret = 8 * st; }
    g.oc[i] = r;
    if (r === 1) { paid += ret; g.amt[i] = ret - st; net += ret - st; }
    else if (r === 2) { g.amt[i] = st; net -= st; }
    else if (r === 3) { paid += st; g.amt[i] = 0; }
    if (r !== 4) { g.dec = true; g.cm[i] = 0; if (i === ODDS) g.st[i] = 0; }
  }
  g.bank.chips += paid; g.net = net;
  if (paid > g.bestPay) g.bestPay = paid;
  if (p === 0) {
    if (s === 7 || s === 11) g.call = "WINNER " + s;
    else if (s === 2 || s === 3 || s === 12) g.call = "CRAPS " + s;
    else { g.point = s; g.call = "POINT IS " + s; }
  } else if (s === p) { g.point = 0; g.call = "WINNER " + s; }
  else if (s === 7) {
    g.point = 0; g.call = "SEVEN OUT";
    if (g.hand - 1 > g.bestRun) g.bestRun = g.hand - 1;   // rolls before the seven-out
    g.hand = 0;
  } else g.call = g.oc[FIELD] === 1 && g.st[FIELD] > 0 ? "FIELD WINS" : "ROLL AGAIN";
  g.hist.unshift(s); if (g.hist.length > 4) g.hist.pop();
  setPhase(g, "res");
}
function act(g, aUp, aDown, aLeft, aRight, aA, aB) {      // one betting move (from the pad or the demo)
  if (aUp) g.sel = (g.sel + NB - 1) % NB;
  if (aDown) g.sel = (g.sel + 1) % NB;
  if (aLeft) takeChip(g, g.sel);
  if (aRight) addChip(g, g.sel);
  if (aB) clearBets(g);
  if (aA) roll(g);
}
function plan(g) {                                        // the demo's targets for this roll
  for (let i = 0; i < NB; i++) g.dT[i] = g.st[i];
  if (g.point === 0) {
    const ln = rnd(g) % 4 === 0 ? DONT : PASS;
    g.dT[PASS] = 0; g.dT[DONT] = 0; g.dT[ODDS] = 0;
    g.dT[ln] = 2 + rnd(g) % 5;
  } else if (side(g) >= 0 && g.st[ODDS] === 0) {
    const k = div(oddsCap(g), stepOf(g, ODDS));
    g.dT[ODDS] = k > 0 ? stepOf(g, ODDS) * (1 + rnd(g) % k) : 0;
  }
  g.dT[FIELD] = rnd(g) % 3 === 0 ? 1 + rnd(g) % 3 : 0;
  g.dT[ANY7] = rnd(g) % 10 === 0 ? 1 : 0;
  g.dT[CRAPS] = rnd(g) % 8 === 0 ? 1 : 0;
  g.dPlan = true;
}
function demoMove(g) {                                    // one press: clear, then walk to each bet and chip it
  let u = false, d = false, l = false, r = false, a = false, b = false;
  if (!g.dClr) { g.dClr = true; if (g.point === 0) b = true; }   // come-out: start from a clean table
  else {
    while (g.dk < NB) {
      const i = g.dk;
      if ((g.st[i] < g.dT[i] && blockAdd(g, i) === "") || (g.st[i] > g.dT[i] && canSub(g, i))) break;
      g.dk++;
    }
    if (g.dk < NB) {
      if (g.sel < g.dk) d = true;
      else if (g.sel > g.dk) u = true;
      else if (g.st[g.dk] < g.dT[g.dk]) r = true;
      else l = true;
    } else a = true;
  }
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
        if (!g.dPlan) plan(g);
        if (g.pt > 12 && g.pt % 4 === 0) demoMove(g);
      } else act(g, eUp || (up && rep), eDown || (down && rep), eLeft || (left && rep), eRight || (right && rep), eA, eB);
      break;
    case "roll":
      if (g.pt >= SETTLE) settle(g);
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
function topBar(g, b) {                                   // the point puck and the last rolls
  const pk = g.point !== 0 ? PUCKON : PUCKOFF;
  for (let r = 0; r < 7; r++) for (let q = 0; q < 7; q++) if ((pk[r] >> (6 - q)) & 1) px(b, q, r, 1);
  text(b, 9, 1, g.point !== 0 ? "POINT " + g.point : "COME OUT", 1);
  let x = 64;
  for (let k = 0; k < g.hist.length; k++) {               // newest at the right, boxed
    const s = "" + g.hist[k], w = s.length * 4 + 1;
    x -= w;
    if (x < 44) break;
    if (k === 0) { fill(b, x, 0, w, 7, 1); text(b, x + 1, 1, s, 0); } else text(b, x + 1, 1, s, 1);
    x -= 2;
  }
}
function felt(g, b, still) {                              // the felt with its dashed rail; still: dice at rest
  if (still) {
    if (g.d1 === 0) { centre(b, 16, "PLACE BETS"); }
    else {
      drawDie(b, 37, REST, g.d1, 0); drawDie(b, 50, REST, g.d2, 0);
      const s = g.d1 + g.d2, ss = "" + s;
      big(b, 18 - ((ss.length * 8 - 2) >> 1), 10, ss, 1);
      text(b, 18 - ((NUMS[s].length * 4 - 1) >> 1), 22, NUMS[s], 1);
    }
  } else {
    for (let k = 0; k < 2; k++) {
      const u = Math.max(0, Math.min(T2, g.pt - LAG * (1 - k)));
      drawDieAt(b, k, u, k === 0 ? g.d1 : g.d2, 0, REST);
    }
  }
  rect(b, 0, 8, 64, 21, true);
}
function stash(g, b, y) {
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if ((CHIP[r] >> (4 - q)) & 1) px(b, 1 + q, y + r, 1);
  text(b, 8, y, "" + g.bank.chips, 1);
}
function payText(g, r) {
  if (r === ODDS) {
    if (g.point === 0) return "--";
    return side(g) === DONT ? OD[g.point] + ":" + ON[g.point] : ON[g.point] + ":" + OD[g.point];
  }
  return r === ANY7 ? "4:1" : r === CRAPS ? "7:1" : "1:1";
}
function drawBets(g, b, cursor) {
  const top = Math.max(0, Math.min(g.sel - 1, NB - VIS));
  for (let i = 0; i < VIS; i++) {
    const r = top + i, y = 30 + i * 7, on = cursor && r === g.sel, v = on ? 0 : 1;
    if (on) fill(b, 0, y, 63, 7, 1);
    text(b, 2, y + 1, NAMES[r], v);
    text(b, 34, y + 1, payText(g, r), v);
    const lock = isLine(r) && g.point !== 0;
    if (on && !lock) right(b, 63, y + 1, "<" + g.st[r] + ">", v);
    else if (g.st[r] > 0) right(b, 59, y + 1, "" + g.st[r], v);
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
    const r = g.pr[k], y = 30 + i * 7, o = g.oc[r], win = o === 1, v = win ? 0 : 1;
    if (win) fill(b, 0, y, 64, 7, 1);
    text(b, 2, y + 1, NAMES[r], v);
    right(b, 41, y + 1, "" + g.rst[r], v);
    right(b, 64, y + 1, o === 1 ? "+" + g.amt[r] : o === 2 ? "-" + g.amt[r] : o === 3 ? "PUSH" : "ON", v);
  }
  fill(b, 0, 51, 64, 1, 1);
  stash(g, b, 53);
  right(b, 64, 53, g.net > 0 ? "WON " + g.net : g.net < 0 ? "LOST " + (0 - g.net) : g.dec ? "EVEN" : "BET " + total(g), 1);
  centre(b, 59, g.pt > 40 && ((g.t >> 4) & 1) === 1 ? "A: NEXT" : g.call);
}
function titleDice(g, b) {                                // the title's dice, thrown again and again
  const c = div(g.pt, 75), tt = g.pt % 75;
  for (let k = 0; k < 2; k++) {
    const u = Math.max(0, Math.min(T2, tt - LAG * (1 - k)));
    drawDieAt(b, k, u, FLICK[(c + 4 * k) % 6], -18, TREST);
  }
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    titleDice(g, b);
    big(b, 13, 15, "CRAPS", 1);
    fill(b, 0, 44, 64, 1, 1);
    if (g.phase === "broke") { boxed(b, 2, "OUT OF CHIPS"); if ((g.t >> 5) & 1) boxed(b, 53, "MORE TOMORROW"); return b; }
    if (g.msgT > 0) boxed(b, 2, g.msg);
    if ((g.t >> 4) & 1) boxed(b, 53, "A: START");
    return b;
  }
  topBar(g, b);
  if (g.phase === "bet") {
    felt(g, b, true);
    drawBets(g, b, true);
    if (g.msgT > 0) centre(b, 59, g.msg);
    else if ((g.t >> 4) & 1) centre(b, 59, "A:ROLL B:CLEAR");
    return b;
  }
  if (g.phase === "roll") { felt(g, b, false); drawBets(g, b, false); return b; }
  felt(g, b, true);                                       // res
  drawRes(g, b);
  return b;
}
