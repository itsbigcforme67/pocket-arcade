// ROULETTE for the VMX's 64x64 1-bit screen: a European single-zero wheel. Our own art and code.
// The wheel: 37 pockets, 0-36 in the real European wheel order, red/black as on a real wheel (0 is neither).
// Bets (chips from VMX CASINO's shared bank, 1 chip steps, at most 50 on each bet, the total never over the stash):
//   RED, BLACK, ODD, EVEN, 1-18, 19-36 pay 1:1; 1ST 12, 2ND 12, 3RD 12 (the dozens) pay 2:1; ON n (a straight-up
//   bet on one number 0-36, chosen on the PICK row) pays 35:1. 0 loses every outside bet.
// Odds: the number comes from the RNG, each of the 37 pockets exactly 1 in 37 (rejection sampling, no modulo bias),
// drawn before the wheel turns; the animation is then fitted to land on it. Every bet returns 36/37 of its stake on
// average: house edge 1/37 = 2.7%, return to player 97.3%. A win pays the stake back plus the winnings.
// Controls: betting - Up/Down choose a bet, Left/Right take a chip off / put a chip on (held = repeat; on the PICK
// row they choose the number), A spins, B clears all bets. Bets stay on for the next spin (cut down if the stash
// can't cover them). After the spin: A goes back to the table.
// Everything is integer (angles 0..4095, sines x 16384) so the C# port in vmx-firmware/games/roulette plays exactly
// the same; keep it that way (div() for /, every product under 2^31, no Math.sin/sqrt/sort/random).
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here). Broke (no chips) =
// "OUT OF CHIPS / MORE TOMORROW" until the bank's daily top-up.
// Input: held buttons (edges found here); { auto: true } = the computer bets (demo).
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const SIN = [0,25,50,75,101,126,151,176,201,226,251,276,302,327,352,377,402,427,452,477,503,528,553,578,603,628,653,678,704,729,754,779,804,829,854,879,904,929,955,980,1005,1030,1055,1080,1105,1130,1155,1180,1205,1230,1255,1280,1306,1331,1356,1381,1406,1431,1456,1481,1506,1531,1556,1581,1606,1631,1656,1681,1706,1731,1756,1781,1806,1831,1856,1881,1906,1931,1956,1981,2006,2031,2055,2080,2105,2130,2155,2180,2205,2230,2255,2280,2305,2329,2354,2379,2404,2429,2454,2479,2503,2528,2553,2578,2603,2628,2652,2677,2702,2727,2752,2776,2801,2826,2851,2875,2900,2925,2949,2974,2999,3024,3048,3073,3098,3122,3147,3172,3196,3221,3246,3270,3295,3320,3344,3369,3393,3418,3442,3467,3492,3516,3541,3565,3590,3614,3639,3663,3688,3712,3737,3761,3786,3810,3835,3859,3883,3908,3932,3957,3981,4005,4030,4054,4078,4103,4127,4151,4176,4200,4224,4249,4273,4297,4321,4346,4370,4394,4418,4442,4467,4491,4515,4539,4563,4587,4612,4636,4660,4684,4708,4732,4756,4780,4804,4828,4852,4876,4900,4924,4948,4972,4996,5020,5044,5068,5092,5115,5139,5163,5187,5211,5235,5259,5282,5306,5330,5354,5377,5401,5425,5449,5472,5496,5520,5543,5567,5591,5614,5638,5661,5685,5708,5732,5756,5779,5803,5826,5850,5873,5897,5920,5943,5967,5990,6014,6037,6060,6084,6107,6130,6154,6177,6200,6223,6247,6270,6293,6316,6339,6363,6386,6409,6432,6455,6478,6501,6524,6547,6570,6593,6616,6639,6662,6685,6708,6731,6754,6777,6800,6823,6846,6868,6891,6914,6937,6960,6982,7005,7028,7050,7073,7096,7118,7141,7164,7186,7209,7231,7254,7276,7299,7321,7344,7366,7389,7411,7434,7456,7478,7501,7523,7545,7568,7590,7612,7635,7657,7679,7701,7723,7746,7768,7790,7812,7834,7856,7878,7900,7922,7944,7966,7988,8010,8032,8054,8076,8098,8119,8141,8163,8185,8207,8228,8250,8272,8293,8315,8337,8358,8380,8401,8423,8445,8466,8488,8509,8531,8552,8573,8595,8616,8638,8659,8680,8702,8723,8744,8765,8787,8808,8829,8850,8871,8892,8914,8935,8956,8977,8998,9019,9040,9061,9082,9102,9123,9144,9165,9186,9207,9227,9248,9269,9290,9310,9331,9352,9372,9393,9413,9434,9455,9475,9496,9516,9537,9557,9577,9598,9618,9638,9659,9679,9699,9720,9740,9760,9780,9800,9820,9841,9861,9881,9901,9921,9941,9961,9981,10001,10020,10040,10060,10080,10100,10120,10139,10159,10179,10198,10218,10238,10257,10277,10296,10316,10336,10355,10374,10394,10413,10433,10452,10471,10491,10510,10529,10549,10568,10587,10606,10625,10644,10663,10683,10702,10721,10740,10759,10778,10796,10815,10834,10853,10872,10891,10909,10928,10947,10966,10984,11003,11021,11040,11059,11077,11096,11114,11133,11151,11169,11188,11206,11224,11243,11261,11279,11297,11316,11334,11352,11370,11388,11406,11424,11442,11460,11478,11496,11514,11532,11550,11567,11585,11603,11621,11638,11656,11674,11691,11709,11727,11744,11762,11779,11797,11814,11831,11849,11866,11883,11901,11918,11935,11952,11970,11987,12004,12021,12038,12055,12072,12089,12106,12123,12140,12157,12173,12190,12207,12224,12240,12257,12274,12290,12307,12324,12340,12357,12373,12390,12406,12423,12439,12455,12472,12488,12504,12520,12537,12553,12569,12585,12601,12617,12633,12649,12665,12681,12697,12713,12729,12744,12760,12776,12792,12807,12823,12839,12854,12870,12885,12901,12916,12932,12947,12963,12978,12993,13008,13024,13039,13054,13069,13085,13100,13115,13130,13145,13160,13175,13190,13205,13219,13234,13249,13264,13279,13293,13308,13323,13337,13352,13366,13381,13395,13410,13424,13439,13453,13467,13482,13496,13510,13524,13538,13553,13567,13581,13595,13609,13623,13637,13651,13665,13678,13692,13706,13720,13733,13747,13761,13774,13788,13802,13815,13829,13842,13856,13869,13882,13896,13909,13922,13935,13949,13962,13975,13988,14001,14014,14027,14040,14053,14066,14079,14092,14104,14117,14130,14143,14155,14168,14181,14193,14206,14218,14231,14243,14256,14268,14280,14293,14305,14317,14329,14341,14354,14366,14378,14390,14402,14414,14426,14438,14449,14461,14473,14485,14497,14508,14520,14531,14543,14555,14566,14578,14589,14601,14612,14623,14635,14646,14657,14668,14680,14691,14702,14713,14724,14735,14746,14757,14768,14779,14789,14800,14811,14822,14832,14843,14854,14864,14875,14885,14896,14906,14917,14927,14937,14948,14958,14968,14978,14989,14999,15009,15019,15029,15039,15049,15059,15069,15078,15088,15098,15108,15118,15127,15137,15146,15156,15166,15175,15184,15194,15203,15213,15222,15231,15240,15250,15259,15268,15277,15286,15295,15304,15313,15322,15331,15340,15349,15357,15366,15375,15383,15392,15401,15409,15418,15426,15435,15443,15451,15460,15468,15476,15485,15493,15501,15509,15517,15525,15533,15541,15549,15557,15565,15573,15581,15588,15596,15604,15611,15619,15627,15634,15642,15649,15656,15664,15671,15679,15686,15693,15700,15707,15715,15722,15729,15736,15743,15750,15757,15763,15770,15777,15784,15791,15797,15804,15810,15817,15824,15830,15837,15843,15849,15856,15862,15868,15875,15881,15887,15893,15899,15905,15911,15917,15923,15929,15935,15941,15946,15952,15958,15964,15969,15975,15980,15986,15991,15997,16002,16008,16013,16018,16024,16029,16034,16039,16044,16049,16054,16059,16064,16069,16074,16079,16084,16088,16093,16098,16103,16107,16112,16116,16121,16125,16130,16134,16138,16143,16147,16151,16156,16160,16164,16168,16172,16176,16180,16184,16188,16192,16195,16199,16203,16207,16210,16214,16218,16221,16225,16228,16232,16235,16238,16242,16245,16248,16251,16255,16258,16261,16264,16267,16270,16273,16276,16279,16281,16284,16287,16290,16292,16295,16298,16300,16303,16305,16308,16310,16312,16315,16317,16319,16321,16324,16326,16328,16330,16332,16334,16336,16338,16340,16341,16343,16345,16347,16348,16350,16352,16353,16355,16356,16358,16359,16360,16362,16363,16364,16365,16367,16368,16369,16370,16371,16372,16373,16374,16375,16375,16376,16377,16378,16378,16379,16380,16380,16381,16381,16382,16382,16382,16383,16383,16383,16384,16384,16384,16384,16384,16384];
const FONTCH = "ABCDEFGHIKLMNOPRSTUVWXYZ0123456789:!-<>+ ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "101101110101101", "100100100100111", "101111111101101",
  "110101101101101", "010101101101010", "110101110100100", "110101110101101", "011100010001110", "111010010010010",
  "101101101101111", "101101101101010", "101101111111101", "101101010101101", "101101010010010", "111001010100111",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "001010100010001", "100010001010100", "000010111010000", "000000000000000" ];
const DISC = [14, 31, 31, 31, 14];                        // 5x5 ball shadow rows, bit 4 = left
const CHIP = [14, 31, 27, 31, 14];                        // the chip icon
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22,
  18, 29, 7, 28, 12, 35, 3, 26];
const REDS = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1];
const NAMES = ["RED", "BLACK", "ODD", "EVEN", "1-18", "19-36", "1ST 12", "2ND 12", "3RD 12", "PICK", "ON"];
const PAY = [1, 1, 1, 1, 1, 1, 2, 2, 2, 0, 35];
const NB = 11, PICKROW = 9, ONROW = 10, CAP = 50, VIS = 6;
const T = 150, DROP = 24, LAND = 75;                      // ball ticks round the track, of which dropping; result hold

const div = (a, b) => Math.trunc(a / b);                  // C#'s int division
const abs = a => a < 0 ? -a : a;
function isqrt(n) {
  if (n <= 0) return 0;
  let r = 0, b = 1 << 30;
  while (b > n) b >>= 2;
  while (b !== 0) { if (n >= r + b) { n -= r + b; r = (r >> 1) + b; } else r >>= 1; b >>= 2; }
  return r;
}
function sin(a) {
  a &= 4095;
  return a < 1024 ? SIN[a] : a < 2048 ? SIN[2048 - a] : a < 3072 ? -SIN[a - 2048] : -SIN[4096 - a];
}
const cos = a => sin(a + 1024);
function asinq(s) {                                       // 0..16384 -> 0..1024, the nearest table step
  let lo = 0, hi = 1024;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SIN[m] <= s) lo = m; else hi = m; }
  return s - SIN[lo] <= SIN[hi] - s ? lo : hi;
}
function atan2(y, x) {                                    // angle of (x, y), 0..4095, y down
  const ax = abs(x), ay = abs(y), l = isqrt(x * x + y * y);
  if (l === 0) return 0;
  const a = ay <= ax ? asinq(div(ay * 16384, l)) : 1024 - asinq(div(ax * 16384, l));
  return x >= 0 ? (y >= 0 ? a : (4096 - a) & 4095) : (y >= 0 ? 2048 - a : 2048 + a);
}

// the wheel's pixels, worked out once: lit rings, and the pocket ring with each pixel's angle (+4096 = outer band)
const POS = Array(37).fill(0), ringP = [], ringA = [], statP = [];
for (let i = 0; i < 37; i++) POS[WHEEL[i]] = i;
for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
  const dx = 2 * x - 63, dy = 2 * y - 63, d2 = dx * dx + dy * dy;   // doubled units from the centre (31.5, 31.5)
  if ((d2 >= 1296 && d2 < 1521) || (d2 >= 2401 && d2 < 2601) || (d2 >= 3249 && d2 < 3481)) statP.push(y * 64 + x);
  else if (d2 >= 1521 && d2 < 2401) { ringP.push(y * 64 + x); ringA.push(atan2(dy, dx) + (d2 >= 2116 ? 4096 : 0)); }
}

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, holdT: 0, msg: "", msgT: 0, auto: false,
    st: Array(NB).fill(0), sel: 0, pick: 17, hist: [], staked: 0, won: 0, res: 0, wa: 0, wv: 0, relEnd: 0, drel: 0,
    rel: 0, br: 27, pr: [], dRow: [0, 0], dAmt: [0, 0], dN: 0, dk: 0, dPick: 0, dClr: false,
    pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 50; }
function total(g) { let s = 0; for (let i = 0; i < NB; i++) s += g.st[i]; return s; }
function wins(r, n) {                                     // does bet row r win on number n
  if (r === ONROW) return false;                          // (checked against the pick by the caller)
  if (n === 0) return false;
  if (r === 0) return REDS[n] === 1;
  if (r === 1) return REDS[n] === 0;
  if (r === 2) return (n & 1) === 1;
  if (r === 3) return (n & 1) === 0;
  if (r === 4) return n <= 18;
  if (r === 5) return n >= 19;
  return div(n - 1, 12) === r - 6;
}
function toBet(g) {                                       // back to the table: last bets stay, cut to the stash
  let run = 0;
  for (let i = 0; i < NB; i++) { g.st[i] = Math.min(g.st[i], g.bank.chips - run); run += g.st[i]; }
  setPhase(g, g.bank.chips < 1 ? "broke" : "bet");
  g.dClr = false; g.dk = 0; g.dN = 0;
}
function spin(g) {
  const tot = total(g);
  if (tot === 0) { say(g, "PLACE A BET"); return; }
  g.bank.chips -= tot; g.staked = tot;
  let r = rnd(g);
  while (r >= 65527) r = rnd(g);                          // 65527 = 37 x 1771: every pocket equally likely
  g.res = r % 37;
  const b0 = rnd(g) & 4095;                               // where the ball is launched
  g.relEnd = div(POS[g.res] * 4096 + 2048, 37);           // the middle of the drawn number's pocket, on the wheel
  g.drel = ((b0 - g.wa - g.relEnd) & 4095) + 3 * 4096;    // 3-4 turns against the wheel, ending there exactly
  g.wv = 800; g.rel = g.relEnd + g.drel; g.br = 27;
  setPhase(g, "spin");
}
function settle(g) {                                      // pay out; list the bets for the result screen
  let won = 0; g.pr = [];
  for (let i = 0; i < NB; i++) if (g.st[i] > 0) {
    g.pr.push(i);
    if (i === ONROW ? g.res === g.pick : wins(i, g.res)) won += g.st[i] * (PAY[i] + 1);
  }
  g.won = won;
  if (won > 0) g.bank.chips += won;
  setPhase(g, "pay");
}
function act(g, aUp, aDown, aLeft, aRight, aA, aB) {      // one betting move (from the pad or the demo)
  if (aUp) g.sel = (g.sel + NB - 1) % NB;
  if (aDown) g.sel = (g.sel + 1) % NB;
  if (g.sel === PICKROW) {
    if (aLeft) g.pick = (g.pick + 36) % 37;
    if (aRight) g.pick = (g.pick + 1) % 37;
  } else {
    if (aLeft && g.st[g.sel] > 0) g.st[g.sel]--;
    if (aRight && g.st[g.sel] < CAP && total(g) < g.bank.chips) g.st[g.sel]++;
  }
  if (aB) { for (let i = 0; i < NB; i++) g.st[i] = 0; }
  if (aA) spin(g);
}
function plan(g) {                                        // the demo's bets for this spin
  const c = g.bank.chips;
  g.dPick = g.pick;
  if (c < 10) { g.dN = 1; g.dRow[0] = rnd(g) % 2; g.dAmt[0] = c; return; }
  g.dN = 2;
  g.dRow[0] = rnd(g) % 6; g.dAmt[0] = 2 + rnd(g) % 7;
  const k = rnd(g) % 3;
  if (k === 0) { g.dRow[1] = 6 + rnd(g) % 3; g.dAmt[1] = 1 + rnd(g) % 4; }
  else if (k === 1) { g.dRow[1] = ONROW; g.dPick = rnd(g) % 37; g.dAmt[1] = 1 + rnd(g) % 2; }
  else { g.dRow[1] = (g.dRow[0] + 2 + rnd(g) % 4) % 6; g.dAmt[1] = 2 + rnd(g) % 5; }
}
function demoMove(g) {                                    // one press: clear, then walk to each bet and chip it up
  let u = false, d = false, l = false, r = false, a = false, b = false;
  if (!g.dClr) { g.dClr = true; if (total(g) > 0) b = true; }
  else if (g.dk < g.dN) {
    const tr = g.dRow[g.dk];
    const want = tr === ONROW && g.pick !== g.dPick ? PICKROW : tr;
    if (g.sel < want) d = true;
    else if (g.sel > want) u = true;
    else if (want === PICKROW) { if ((g.dPick - g.pick + 37) % 37 <= 18) r = true; else l = true; }
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
      g.wa = (g.wa + 6) & 4095;
      if (eA || (auto && g.pt > 40)) toBet(g);
      break;
    case "bet":
      if (auto) {
        if (g.dN === 0) plan(g);
        if (g.pt > 12 && g.pt % 4 === 0) demoMove(g);
      } else act(g, eUp || (up && rep), eDown || (down && rep), eLeft || (left && rep), eRight || (right && rep), eA, eB);
      break;
    case "spin": {
      g.wa = (g.wa + (g.wv >> 4)) & 4095; if (g.wv > 0) g.wv -= 2;
      const s = T - g.pt;                                 // ticks left: the ball eases in to the pocket
      g.rel = g.relEnd + div(g.drel * s * s, T * T);
      g.br = s >= DROP ? 27 : 21 + div(6 * s, DROP) + (s > 3 && ((s >> 2) & 1) === 1 ? 1 : 0);
      if (s <= 0) {
        g.hist.unshift(g.res); if (g.hist.length > 5) g.hist.pop();
        setPhase(g, "land");
      }
      break;
    }
    case "land":
      g.wa = (g.wa + (g.wv >> 4)) & 4095; if (g.wv > 0) g.wv -= 2;
      if (g.pt >= LAND) settle(g);
      break;
    case "pay":
      if ((eA && g.pt > 15) || (auto && g.pt > 90) || g.pt > 600) toBet(g);
      break;
    case "broke":
      g.wa = (g.wa + 2) & 4095;
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
function boxed(b, y, s) {                                 // a message box over the wheel
  const w = s.length * 4 + 3, x = 32 - (w >> 1);
  fill(b, x, y, w, 9, 0); rect(b, x, y, w, 9, false); text(b, x + 2, y + 2, s, 1);
}
function line(b, x0, y0, x1, y1) {
  const dx = abs(x1 - x0), dy = -abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    px(b, x0, y0, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
const polX = (r, a) => (8064 + ((r * cos(a)) >> 6) + 128) >> 8;   // polar (px, angle) -> screen, centre 31.5
const polY = (r, a) => (8064 + ((r * sin(a)) >> 6) + 128) >> 8;

function drawWheel(g, b, hub) {                           // hub: 1 spokes, 0 empty (the result goes there)
  for (let i = 0; i < statP.length; i++) b[statP[i]] = 1;
  for (let i = 0; i < ringP.length; i++) {
    const p = ringP[i], av = ringA[i], a = ((av & 4095) - g.wa) & 4095, q = a * 37, pk = q >> 12, fr = q & 4095;
    let v;
    if (fr < 560) v = 0;                                  // the frets between pockets
    else if (pk === 0) v = av >= 4096 ? 1 : 0;            // 0: hollow, capped
    else if (REDS[WHEEL[pk]] === 1) v = ((p + (p >> 6)) & 1) === 0 ? 1 : 0;   // red: dithered
    else v = 1;                                           // black: solid
    b[p] = v;
  }
  if (hub) {
    for (let k = 0; k < 4; k++) { const an = g.wa + k * 1024; line(b, polX(4, an), polY(4, an), polX(13, an), polY(13, an)); }
    rect(b, 30, 30, 4, 4, false);
  }
}
function drawBall(g, b) {
  const a = g.wa + g.rel, x = polX(g.br, a), y = polY(g.br, a);
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if ((DISC[r] >> (4 - q)) & 1) px(b, x - 2 + q, y - 2 + r, 0);
  fill(b, x - 1, y - 1, 3, 3, 1);
}
function strip(g, b) {                                    // the last results: black boxed solid, red hollow, 0 bare
  if (g.hist.length === 0) { centre(b, 1, "PLACE BETS"); return; }
  for (let k = 0; k < g.hist.length; k++) {
    const n = g.hist[k], x = 2 + k * 12, s = "" + n, tx = x + 2 + ((7 - (s.length * 4 - 1)) >> 1);
    if (n === 0) text(b, tx, 1, s, 1);
    else if (REDS[n] === 1) { rect(b, x, 0, 11, 7, false); text(b, tx, 1, s, 1); }
    else { fill(b, x, 0, 11, 7, 1); text(b, tx, 1, s, 0); }
  }
}
function stash(g, b, y) {
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if ((CHIP[r] >> (4 - q)) & 1) px(b, 1 + q, y + r, 1);
  text(b, 8, y, "" + g.bank.chips, 1);
}
function drawBets(g, b) {
  strip(g, b);
  const top = Math.max(0, Math.min(g.sel - 2, NB - VIS));
  for (let i = 0; i < VIS; i++) {
    const r = top + i, y = 8 + i * 7, on = r === g.sel, v = on ? 0 : 1;
    if (on) fill(b, 0, y, 64, 7, 1);
    text(b, 2, y + 1, r === ONROW ? "ON " + g.pick : NAMES[r], v);
    if (r === PICKROW) right(b, 64, y + 1, "<" + g.pick + ">", v);
    else {
      text(b, 30, y + 1, PAY[r] + ":1", v);
      if (on) right(b, 64, y + 1, "<" + g.st[r] + ">", v);
      else if (g.st[r] > 0) right(b, 60, y + 1, "" + g.st[r], v);
    }
  }
  const th = div(42 * VIS, NB), ty = 8 + div(42 * top, NB);   // scroll bar
  for (let j = 0; j < th; j++) px(b, 63, ty + j, div(ty + j - 8, 7) + top === g.sel ? 0 : 1);
  fill(b, 0, 51, 64, 1, 1);
  stash(g, b, 53);
  right(b, 64, 53, "BET " + total(g), 1);
  if (g.msgT > 0) centre(b, 59, g.msg);
  else if ((g.t >> 4) & 1) centre(b, 59, "A:SPIN B:CLEAR");
}
function drawPay(g, b) {
  strip(g, b);
  const n = g.res, s = "" + n, w = s.length * 8 - 2, tx = 1 + ((18 - w) >> 1);
  if (n === 0) { rect(b, 1, 8, 18, 13, true); big(b, tx, 10, s, 1); }
  else if (REDS[n] === 1) { rect(b, 1, 8, 18, 13, false); big(b, tx, 10, s, 1); }
  else { fill(b, 1, 8, 18, 13, 1); big(b, tx, 10, s, 0); }
  text(b, 22, 9, n === 0 ? "ZERO" : REDS[n] === 1 ? "RED" : "BLACK", 1);
  if (n > 0) text(b, 22, 16, ((n & 1) === 1 ? "ODD " : "EVEN ") + (n <= 18 ? "1-18" : "19-36"), 1);
  const pages = div(g.pr.length + 3, 4), pg = pages > 1 ? div(g.pt, 60) % pages : 0;
  for (let i = 0; i < 4; i++) {
    const k = pg * 4 + i;
    if (k >= g.pr.length) break;
    const r = g.pr[k], y = 22 + i * 7, win = r === ONROW ? n === g.pick : wins(r, n), v = win ? 0 : 1;
    if (win) fill(b, 0, y, 64, 7, 1);
    text(b, 2, y + 1, r === ONROW ? "ON " + g.pick : NAMES[r], v);
    right(b, 41, y + 1, "" + g.st[r], v);
    right(b, 64, y + 1, win ? "+" + g.st[r] * PAY[r] : "-" + g.st[r], v);
  }
  fill(b, 0, 51, 64, 1, 1);
  stash(g, b, 53);
  const net = g.won - g.staked;
  right(b, 64, 53, net > 0 ? "WON " + net : net < 0 ? "LOST " + (0 - net) : "EVEN", 1);
  if ((g.t >> 4) & 1) centre(b, 59, "A: NEXT");
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    drawWheel(g, b, 0);
    boxed(b, 28, "ROULETTE");
    if (g.phase === "broke") { boxed(b, 2, "OUT OF CHIPS"); if ((g.t >> 5) & 1) boxed(b, 53, "MORE TOMORROW"); return b; }
    if (g.msgT > 0) boxed(b, 2, g.msg);
    if ((g.t >> 4) & 1) boxed(b, 53, "A: START");
    return b;
  }
  if (g.phase === "bet") { drawBets(g, b); return b; }
  if (g.phase === "pay") { drawPay(g, b); return b; }
  const done = g.phase === "land" && g.pt > 8;            // spin / land: the wheel; the number in the hub once down
  drawWheel(g, b, done ? 0 : 1);
  drawBall(g, b);
  if (done) {
    const n = g.res, s = "" + n;
    big(b, 32 - ((s.length * 8 - 2) >> 1), 22, s, 1);
    centre(b, 35, n === 0 ? "ZERO" : REDS[n] === 1 ? "RED" : "BLACK");
  }
  return b;
}
