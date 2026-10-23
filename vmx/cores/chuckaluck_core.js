// CHUCK-A-LUCK for the VMX's 64x64 1-bit screen: the carnival "birdcage" dice game. Our own art and code.
// Three dice sit in an hourglass wire cage; A flips the cage end over end and the dice tumble through the waist to
// the new bottom. Each die is 1-6 exactly 1 in 6 (rejection sampling on the seeded RNG, no modulo bias), thrown
// BEFORE the cage turns; the animation only lands on them.
// Bets (chips from VMX CASINO's shared bank, 0-20 on each box, the total never over the stash):
//   FACE 1-6: for each face you bet on, one die showing it pays 1:1, two dice 2:1, three dice 10:1 (the generous
//     carnival pay table), none loses. Exact over all 216 outcomes (tools/chuckaluck_odds.py): return per chip
//     (75 x 2 + 15 x 3 + 1 x 11) / 216 = 206/216, house edge 10/216 = 4.63%. (The classic 1/2/3 table is 7.87%;
//     1/2/12 would be 3.70%.)
//   LO (sum 4-10) / HI (sum 11-17): 1:1, both lose on any triple. House edge 6/216 = 2.78%. One of LO / HI at a time.
// A win pays the stake back plus the winnings. Bets stay on between flips (cut down if the stash can't cover them).
// Chips: the whole stake is taken from the bank when the cage flips; winnings (with stakes) are paid at the result.
// Controls: Left/Right move between the boxes (LO, 1-6, HI), Up/Down put a chip on / take one off (held = repeat),
// A flips the cage, B clears every bet. After the flip: A goes back to the table.
// Everything is integer so the C# port in vmx-firmware/games/chuckaluck plays exactly the same; keep it that way
// (div() for /, every product under 2^31, no Math.sin/sqrt/sort/random). The cage turns with pool's SIN table.
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here). Broke (no chips)
// = "OUT OF CHIPS / MORE TOMORROW" until the bank's daily top-up.
// Input: held buttons (edges found here); { auto: true } = the computer bets (demo: 1-3 chips on each of 1-3
// faces, now and then LO or HI).
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
const LO = 6, HI = 7, NB = 8, CAP = 20;
const ORD = [LO, 0, 1, 2, 3, 4, 5, HI];                   // the boxes left to right (Left/Right walk this)
const MULT = [0, 1, 2, 10];                               // a face bet's winnings per chip for 0-3 matching dice
// the flip: the cage turns 180 degrees in ROT ticks; die k falls from tick T1 + DLY[k], FALL ticks to the bottom,
// then bounces; the result shows at SETTLE
const ROT = 36, T1 = 23, FALL = 14, SETTLE = 62, TCYC = 90;
const DLY = [6, 3, 0];
const CX = 32, CY = 25, TCY = 36;                         // the cage's pivot (the waist) on the table / the title
const RX = [-11, -3, 5], RY = 8;                          // dice at rest: top-left relative to the pivot

const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

// ==== DICE ART (the casino's shared dice look: copied from craps_core.js) =========================================
// Two sizes: sz 0 = big, a 12x12 die (pips 2x2 on a 3x3 grid at 2/5/8), sz 1 = small, a 7x7 die (pips 1x1 at
// 1/3/5). A face is a lit body with the corners cut and dark pips, so it reads on a dark felt. drawDie(b, x, y,
// face, sz) draws face 1-6 with its top-left at x, y. drawTumble(b, x, y, k, sz) draws tumbling frame k (0-2: the
// die turned about 22, 45 and 67 degrees, a few pips showing); only its lit pixels are set. (Craps's dieFrame /
// hop throw the dice across a felt; the cage has its own fall below, cageDie.)
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
// ==== end of dice art =============================================================================================

// ---- the cage's turn (pool's quarter SIN table, 4096 = a full turn, 16384 = 1.0) -----------------------------------
const SIN = [0,25,50,75,101,126,151,176,201,226,251,276,302,327,352,377,402,427,452,477,503,528,553,578,603,628,653,678,704,729,754,779,804,829,854,879,904,929,955,980,1005,1030,1055,1080,1105,1130,1155,1180,1205,1230,1255,1280,1306,1331,1356,1381,1406,1431,1456,1481,1506,1531,1556,1581,1606,1631,1656,1681,1706,1731,1756,1781,1806,1831,1856,1881,1906,1931,1956,1981,2006,2031,2055,2080,2105,2130,2155,2180,2205,2230,2255,2280,2305,2329,2354,2379,2404,2429,2454,2479,2503,2528,2553,2578,2603,2628,2652,2677,2702,2727,2752,2776,2801,2826,2851,2875,2900,2925,2949,2974,2999,3024,3048,3073,3098,3122,3147,3172,3196,3221,3246,3270,3295,3320,3344,3369,3393,3418,3442,3467,3492,3516,3541,3565,3590,3614,3639,3663,3688,3712,3737,3761,3786,3810,3835,3859,3883,3908,3932,3957,3981,4005,4030,4054,4078,4103,4127,4151,4176,4200,4224,4249,4273,4297,4321,4346,4370,4394,4418,4442,4467,4491,4515,4539,4563,4587,4612,4636,4660,4684,4708,4732,4756,4780,4804,4828,4852,4876,4900,4924,4948,4972,4996,5020,5044,5068,5092,5115,5139,5163,5187,5211,5235,5259,5282,5306,5330,5354,5377,5401,5425,5449,5472,5496,5520,5543,5567,5591,5614,5638,5661,5685,5708,5732,5756,5779,5803,5826,5850,5873,5897,5920,5943,5967,5990,6014,6037,6060,6084,6107,6130,6154,6177,6200,6223,6247,6270,6293,6316,6339,6363,6386,6409,6432,6455,6478,6501,6524,6547,6570,6593,6616,6639,6662,6685,6708,6731,6754,6777,6800,6823,6846,6868,6891,6914,6937,6960,6982,7005,7028,7050,7073,7096,7118,7141,7164,7186,7209,7231,7254,7276,7299,7321,7344,7366,7389,7411,7434,7456,7478,7501,7523,7545,7568,7590,7612,7635,7657,7679,7701,7723,7746,7768,7790,7812,7834,7856,7878,7900,7922,7944,7966,7988,8010,8032,8054,8076,8098,8119,8141,8163,8185,8207,8228,8250,8272,8293,8315,8337,8358,8380,8401,8423,8445,8466,8488,8509,8531,8552,8573,8595,8616,8638,8659,8680,8702,8723,8744,8765,8787,8808,8829,8850,8871,8892,8914,8935,8956,8977,8998,9019,9040,9061,9082,9102,9123,9144,9165,9186,9207,9227,9248,9269,9290,9310,9331,9352,9372,9393,9413,9434,9455,9475,9496,9516,9537,9557,9577,9598,9618,9638,9659,9679,9699,9720,9740,9760,9780,9800,9820,9841,9861,9881,9901,9921,9941,9961,9981,10001,10020,10040,10060,10080,10100,10120,10139,10159,10179,10198,10218,10238,10257,10277,10296,10316,10336,10355,10374,10394,10413,10433,10452,10471,10491,10510,10529,10549,10568,10587,10606,10625,10644,10663,10683,10702,10721,10740,10759,10778,10796,10815,10834,10853,10872,10891,10909,10928,10947,10966,10984,11003,11021,11040,11059,11077,11096,11114,11133,11151,11169,11188,11206,11224,11243,11261,11279,11297,11316,11334,11352,11370,11388,11406,11424,11442,11460,11478,11496,11514,11532,11550,11567,11585,11603,11621,11638,11656,11674,11691,11709,11727,11744,11762,11779,11797,11814,11831,11849,11866,11883,11901,11918,11935,11952,11970,11987,12004,12021,12038,12055,12072,12089,12106,12123,12140,12157,12173,12190,12207,12224,12240,12257,12274,12290,12307,12324,12340,12357,12373,12390,12406,12423,12439,12455,12472,12488,12504,12520,12537,12553,12569,12585,12601,12617,12633,12649,12665,12681,12697,12713,12729,12744,12760,12776,12792,12807,12823,12839,12854,12870,12885,12901,12916,12932,12947,12963,12978,12993,13008,13024,13039,13054,13069,13085,13100,13115,13130,13145,13160,13175,13190,13205,13219,13234,13249,13264,13279,13293,13308,13323,13337,13352,13366,13381,13395,13410,13424,13439,13453,13467,13482,13496,13510,13524,13538,13553,13567,13581,13595,13609,13623,13637,13651,13665,13678,13692,13706,13720,13733,13747,13761,13774,13788,13802,13815,13829,13842,13856,13869,13882,13896,13909,13922,13935,13949,13962,13975,13988,14001,14014,14027,14040,14053,14066,14079,14092,14104,14117,14130,14143,14155,14168,14181,14193,14206,14218,14231,14243,14256,14268,14280,14293,14305,14317,14329,14341,14354,14366,14378,14390,14402,14414,14426,14438,14449,14461,14473,14485,14497,14508,14520,14531,14543,14555,14566,14578,14589,14601,14612,14623,14635,14646,14657,14668,14680,14691,14702,14713,14724,14735,14746,14757,14768,14779,14789,14800,14811,14822,14832,14843,14854,14864,14875,14885,14896,14906,14917,14927,14937,14948,14958,14968,14978,14989,14999,15009,15019,15029,15039,15049,15059,15069,15078,15088,15098,15108,15118,15127,15137,15146,15156,15166,15175,15184,15194,15203,15213,15222,15231,15240,15250,15259,15268,15277,15286,15295,15304,15313,15322,15331,15340,15349,15357,15366,15375,15383,15392,15401,15409,15418,15426,15435,15443,15451,15460,15468,15476,15485,15493,15501,15509,15517,15525,15533,15541,15549,15557,15565,15573,15581,15588,15596,15604,15611,15619,15627,15634,15642,15649,15656,15664,15671,15679,15686,15693,15700,15707,15715,15722,15729,15736,15743,15750,15757,15763,15770,15777,15784,15791,15797,15804,15810,15817,15824,15830,15837,15843,15849,15856,15862,15868,15875,15881,15887,15893,15899,15905,15911,15917,15923,15929,15935,15941,15946,15952,15958,15964,15969,15975,15980,15986,15991,15997,16002,16008,16013,16018,16024,16029,16034,16039,16044,16049,16054,16059,16064,16069,16074,16079,16084,16088,16093,16098,16103,16107,16112,16116,16121,16125,16130,16134,16138,16143,16147,16151,16156,16160,16164,16168,16172,16176,16180,16184,16188,16192,16195,16199,16203,16207,16210,16214,16218,16221,16225,16228,16232,16235,16238,16242,16245,16248,16251,16255,16258,16261,16264,16267,16270,16273,16276,16279,16281,16284,16287,16290,16292,16295,16298,16300,16303,16305,16308,16310,16312,16315,16317,16319,16321,16324,16326,16328,16330,16332,16334,16336,16338,16340,16341,16343,16345,16347,16348,16350,16352,16353,16355,16356,16358,16359,16360,16362,16363,16364,16365,16367,16368,16369,16370,16371,16372,16373,16374,16375,16375,16376,16377,16378,16378,16379,16380,16380,16381,16381,16382,16382,16382,16383,16383,16383,16384,16384,16384,16384,16384,16384];
function sin(a) {
  a &= 4095;
  return a < 1024 ? SIN[a] : a < 2048 ? SIN[2048 - a] : a < 3072 ? -SIN[a - 2048] : -SIN[4096 - a];
}
const cos = a => sin(a + 1024);
function angle(u) {                                       // the cage's angle u ticks into the flip: eased 0 -> 2048
  if (u <= 0) return 0;
  if (u >= ROT) return 2048;
  return div(2048 * u * u * (3 * ROT - 2 * u), ROT * ROT * ROT);
}
const rotX = (x, y, c, s) => (x * c - y * s + 8192) >> 14;   // a point of the cage turned (c, s = cos, sin)
const rotY = (x, y, c, s) => (x * s + y * c + 8192) >> 14;
// the cage in its own frame (pivot at 0, 0; y down): a polyline per row, x, y pairs; dotted rows are the back wires
const CAGE = [
  [19, -15, 13, -14, 0, -13, -13, -14, -19, -15, -13, -16, 0, -17, 13, -16, 19, -15],   // top hoop
  [19, 15, 13, 16, 0, 17, -13, 16, -19, 15, -13, 14, 0, 13, 13, 14, 19, 15],             // bottom hoop
  [-19, -15, -4, 0, -19, 15], [19, -15, 4, 0, 19, 15],                                   // the sides
  [-5, -1, 5, -1], [-5, 1, 5, 1] ];                                                      // the waist band
const WIRES = [[-10, -14, -2, 0, -10, 14], [10, -14, 2, 0, 10, 14], [0, -13, 0, 13]];   // dotted
function cage(b, cx, cy, a) {
  const c = cos(a), s = sin(a);
  for (let w = 0; w < 2; w++) {
    const set = w === 0 ? WIRES : CAGE;
    for (let r = 0; r < set.length; r++) {
      const p = set[r];
      let ax = cx + rotX(p[0], p[1], c, s), ay = cy + rotY(p[0], p[1], c, s);
      for (let i = 2; i + 1 < p.length; i += 2) {
        const bx = cx + rotX(p[i], p[i + 1], c, s), by = cy + rotY(p[i], p[i + 1], c, s);
        line(b, ax, ay, bx, by, w === 0); ax = bx; ay = by;
      }
    }
  }
}
// die k, u ticks into a flip, from face pf (before) to face nf (the result): [x, y, frame] with frame 1-6 a face,
// -1..-3 a tumbling frame. Held in the old bottom while the cage turns, then falls through the waist and bounces.
function cageDie(k, u, pf, nf, cx, cy) {
  const st = T1 + DLY[k], lx = RX[k] + 3, ly = RY + 3;
  if (u < st) {
    const a = angle(u), c = cos(a), s = sin(a), q = ((a + 128) >> 8) & 3;
    return [cx + rotX(lx, ly, c, s) - 3, cy + rotY(lx, ly, c, s) - 3, q === 0 ? pf : -q];
  }
  const v = u - st;
  if (v < FALL) {
    const a = angle(st), c = cos(a), s = sin(a);
    const sx = cx + rotX(lx, ly, c, s), sy = cy + rotY(lx, ly, c, s), ex = cx + lx, ey = cy + ly;
    const f = div(256 * v * v, FALL * FALL), g0 = (256 - f) * (256 - f), g1 = 2 * f * (256 - f), g2 = f * f;
    const x = div(g0 * sx + g1 * cx + g2 * ex, 65536), y = div(g0 * sy + g1 * cy + g2 * ey, 65536), q = v >> 1;
    return [x - 3, y - 3, (q & 1) === 1 ? -1 - ((div(q, 2) + k) % 3) : FLICK[(div(q, 2) + 3 * k) % 6]];
  }
  const w = v - FALL;
  let h = 0;
  if (w < 8) h = div(4 * w * (8 - w), 16);
  else if (w < 14) h = div(4 * (w - 8) * (14 - w), 36);
  const q = w >> 1;
  return [cx + RX[k], cy + RY - h, w >= 8 ? nf : (q & 1) === 1 ? -1 - ((div(q, 2) + k) % 3) : FLICK[(div(q, 2) + 3 * k) % 6]];
}
function drawCage(b, u, pf, nf, cx, cy) {                 // the cage and its dice, u ticks into a flip
  cage(b, cx, cy, angle(u) & 2047);
  for (let k = 0; k < 3; k++) {
    const d = cageDie(k, u, pf[k], nf[k], cx, cy);
    if (d[2] > 0) drawDie(b, d[0], d[1], d[2], 1); else drawTumble(b, d[0], d[1], -1 - d[2], 1);
  }
}

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, holdT: 0, msg: "", msgT: 0, auto: false,
    st: Array(NB).fill(0), rst: Array(NB).fill(0), oc: Array(NB).fill(0), cnt: Array(6).fill(0),
    d: [5, 1, 3], pd: [5, 1, 3], sel: 1, net: 0, call: "", bestPay: 0,
    dT: Array(NB).fill(0), dk: 0, dPlan: false, dClr: false,
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
function blockAdd(g, i) {                                 // why a chip can't go on bet i ("" = it can)
  if ((i === LO && g.st[HI] > 0) || (i === HI && g.st[LO] > 0)) return "LO OR HI";
  if (g.st[i] >= CAP) return "TABLE MAX 20";
  if (total(g) + 1 > g.bank.chips) return "NOT ENOUGH CHIPS";
  return "";
}
function addChip(g, i) { const w = blockAdd(g, i); if (w !== "") say(g, w); else g.st[i]++; }
function takeChip(g, i) { if (g.st[i] > 0) g.st[i]--; }
function clearBets(g) { for (let i = 0; i < NB; i++) g.st[i] = 0; }
function toBet(g) {                                       // back to the table: bets cut to the stash
  let run = 0;
  for (let p = 0; p < NB; p++) {
    const i = ORD[p], n = Math.min(g.st[i], g.bank.chips - run);
    g.st[i] = n; run += n;
  }
  setPhase(g, g.bank.chips < 1 ? "broke" : "bet");
  g.dPlan = false; g.dClr = false; g.dk = 0;
}
function flip(g) {
  if (total(g) === 0) { say(g, "PLACE A BET"); return; }
  g.bank.chips -= total(g);
  for (let k = 0; k < 3; k++) { g.pd[k] = g.d[k]; g.d[k] = die(g); }   // the result, before the cage moves
  for (let i = 0; i < NB; i++) g.rst[i] = g.st[i];
  setPhase(g, "flip");
}
function settle(g) {                                      // pay out; note each bet's outcome for the result screen
  const s = g.d[0] + g.d[1] + g.d[2], trip = g.d[0] === g.d[1] && g.d[1] === g.d[2];
  let paid = 0, net = 0;
  for (let f = 0; f < 6; f++) g.cnt[f] = 0;
  for (let k = 0; k < 3; k++) g.cnt[g.d[k] - 1]++;
  for (let i = 0; i < NB; i++) {
    const st = g.st[i];
    g.oc[i] = 0;                                          // 0 no bet, 1 win, 2 lose
    if (st === 0) continue;
    let ret = 0;
    if (i < 6) { if (g.cnt[i] > 0) ret = st * (1 + MULT[g.cnt[i]]); }
    else if (!trip && (i === LO ? s <= 10 : s >= 11)) ret = 2 * st;
    g.oc[i] = ret > 0 ? 1 : 2;
    paid += ret; net += ret - st;
  }
  g.bank.chips += paid; g.net = net;
  if (paid > g.bestPay) g.bestPay = paid;
  g.call = net > 0 ? "WON " + net : net < 0 ? "LOST " + (0 - net) : "EVEN";
  setPhase(g, "res");
}
function act(g, aUp, aDown, aLeft, aRight, aA, aB) {      // one betting move (from the pad or the demo)
  if (aLeft) g.sel = (g.sel + NB - 1) % NB;
  if (aRight) g.sel = (g.sel + 1) % NB;
  if (aUp) addChip(g, ORD[g.sel]);
  if (aDown) takeChip(g, ORD[g.sel]);
  if (aB) clearBets(g);
  if (aA) flip(g);
}
function plan(g) {                                        // the demo's targets for this flip: 1-3 faces, 1-3 chips
  for (let i = 0; i < NB; i++) g.dT[i] = 0;
  const n = 1 + rnd(g) % 3;
  for (let j = 0; j < n; j++) {
    let f = rnd(g) % 6;
    while (g.dT[f] > 0) f = (f + 1) % 6;
    g.dT[f] = 1 + rnd(g) % 3;
  }
  if (rnd(g) % 4 === 0) g.dT[rnd(g) % 2 === 0 ? LO : HI] = 1 + rnd(g) % 3;
  g.dPlan = true;
}
function demoMove(g) {                                    // one press: clear, then walk to each box and chip it
  let u = false, d = false, l = false, r = false, a = false, b = false;
  if (!g.dClr) { g.dClr = true; b = true; }
  else {
    while (g.dk < NB) {
      const i = ORD[g.dk];
      if ((g.st[i] < g.dT[i] && blockAdd(g, i) === "") || g.st[i] > g.dT[i]) break;
      g.dk++;
    }
    if (g.dk < NB) {
      if (g.sel < g.dk) r = true;
      else if (g.sel > g.dk) l = true;
      else if (g.st[ORD[g.dk]] < g.dT[ORD[g.dk]]) u = true;
      else d = true;
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
    case "flip":
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
function rect(b, x, y, w, h) {
  for (let i = 0; i < w; i++) { px(b, x + i, y, 1); px(b, x + i, y + h - 1, 1); }
  for (let j = 0; j < h; j++) { px(b, x, y + j, 1); px(b, x + w - 1, y + j, 1); }
}
function line(b, x0, y0, x1, y1, dots) {                  // Bresenham; dots: every other pixel
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, n = 0;
  for (;;) {
    if (!dots || (n & 1) === 0) px(b, x0, y0, 1);
    n++;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
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
const mid = (b, cx, y, s, v) => text(b, cx - ((s.length * 4 - 1) >> 1), y, s, v);   // centred on column cx
function boxed(b, y, s) {
  const w = s.length * 4 + 3, x = 32 - (w >> 1);
  fill(b, x, y, w, 9, 0); rect(b, x, y, w, 9); text(b, x + 2, y + 2, s, 1);
}
function topBar(g, b) {                                   // the stash, and the total bet or the dice's sum
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if ((CHIP[r] >> (4 - q)) & 1) px(b, 1 + q, 1 + r, 1);
  text(b, 8, 1, "" + g.bank.chips, 1);
  if (g.phase === "res") {
    const s = g.d[0] + g.d[1] + g.d[2];
    right(b, 64, 1, g.d[0] === g.d[1] && g.d[1] === g.d[2] ? "TRIPLE" : "SUM " + s, 1);
  } else right(b, 64, 1, "BET " + total(g), 1);
}
function sideBox(g, b, i, res) {                          // LO (left) / HI (right) beside the cage
  const x = i === LO ? 0 : 50, cx = x + 7, on = !res && ORD[g.sel] === i, win = res && g.oc[i] === 1, v = on || win ? 0 : 1;
  rect(b, x, 13, 14, 22);
  if (on || win) fill(b, x + 1, 14, 12, 20, 1);
  mid(b, cx, 15, i === LO ? "LO" : "HI", v);
  mid(b, cx, 21, i === LO ? "10-" : "11+", v);
  const st = res ? g.rst[i] : g.st[i];
  if (st > 0 || on) mid(b, cx, 28, "" + st, v);
  if (res && g.oc[i] === 2) { line(b, x + 2, 28, x + 11, 32, false); line(b, x + 2, 32, x + 11, 28, false); }
}
function faceBox(g, b, f, res) {                          // the face boxes 1-6 under the cage
  const x = 2 + 10 * f, cx = x + 5, on = !res && ORD[g.sel] === f, win = res && g.oc[f] === 1;
  rect(b, x, 42, 11, 16);
  if (on || win) { fill(b, x + 1, 43, 9, 14, 1); fill(b, x + 1, 43, 9, 9, 0); }
  drawDie(b, x + 2, 44, f + 1, 1);
  const v = on || win ? 0 : 1;
  if (res && g.cnt[f] > 0) {                              // one dot per die showing this face
    const n = g.cnt[f], x0 = cx - div(3 * n - 1, 2);
    for (let k = 0; k < n; k++) fill(b, x0 + 3 * k, 53, 2, 2, v);
  } else {
    const st = res ? g.rst[f] : g.st[f];
    if (st > 0 || on) mid(b, cx, 52, "" + st, v);
    if (res && g.oc[f] === 2) { line(b, x + 1, 52, x + 9, 56, false); line(b, x + 1, 56, x + 9, 52, false); }
  }
}
function table(g, b, res) {
  topBar(g, b);
  sideBox(g, b, LO, res); sideBox(g, b, HI, res);
  for (let f = 0; f < 6; f++) faceBox(g, b, f, res);
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    const c = div(g.t, TCYC), u = g.t % TCYC, pf = [0, 0, 0], nf = [0, 0, 0];
    for (let k = 0; k < 3; k++) { pf[k] = FLICK[(c + 5 + 2 * k) % 6]; nf[k] = FLICK[(c + 2 * k) % 6]; }
    drawCage(b, u, pf, nf, CX, TCY);
    big(b, 13, 1, "CHUCK", 1);
    centre(b, 12, "A-LUCK");
    if (g.phase === "broke") { boxed(b, 2, "OUT OF CHIPS"); if ((g.t >> 5) & 1) boxed(b, 53, "MORE TOMORROW"); return b; }
    if (g.msgT > 0) boxed(b, 2, g.msg);
    if ((g.t >> 4) & 1) boxed(b, 53, "A: START");
    return b;
  }
  if (g.phase === "flip") { drawCage(b, g.pt, g.pd, g.d, CX, CY); return b; }   // the cage alone, full screen
  const res = g.phase === "res";
  drawCage(b, SETTLE, g.d, g.d, CX, CY);
  table(g, b, res);
  if (res) centre(b, 59, g.pt > 40 && ((g.t >> 4) & 1) === 1 ? "A: NEXT" : g.call);
  else if (g.msgT > 0) centre(b, 59, g.msg);
  else if ((g.t >> 4) & 1) centre(b, 59, "A:FLIP B:CLEAR");
  return b;
}
