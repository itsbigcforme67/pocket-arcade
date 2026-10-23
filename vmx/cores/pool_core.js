// POOL for the VMX's 64x64 1-bit screen: 9-ball against the computer. Our own art and code.
// Nine balls racked in a diamond, 1 at the front, 9 in the middle. Hit the lowest ball on the table first; any ball
// down on a good shot and you go again; sink the 9 on a good shot (straight in or off another ball) to win the rack.
// Fouls (cue ball down, missing the lowest ball, hitting nothing) give the other player the cue ball in hand
// anywhere; a 9 sunk on a foul comes back to the foot spot. Racks are tallied, the break alternates.
// Controls: overhead view - Left/Right turn the cue (faster when held), Up/Down nudge it, A goes down to the cue.
// Down at the cue: a low 3D wireframe view along the shot - Left/Right fine aim, Up/Down top/back spin, hold A to
// draw the cue back (power), let go to shoot, B back up. Ball in hand: D-pad moves the cue ball, A sets it down.
// Everything is integer fixed point (1 px = 256 units, angles 0..4095, sines x 16384) so the VMX's C# port in
// vmx-firmware/games/pool plays exactly the same; keep it that way (div() for /, >> for scaled products, every
// product under 2^31, no Math.sin/sqrt/sort).
// Input: held buttons (edges found here); { auto: true } = the computer plays your side (demo).
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const U = 256, R = 576, D2 = 1152, D2SQ = 1152 * 1152;   // ball radius 2.25 px
const X0 = 5 * U, X1 = 59 * U, Y0 = 21 * U, Y1 = 48 * U, CXU = 32 * U, CYU = (Y0 + Y1) >> 1;   // the felt
const MC = 896, MS = 640, CR2 = 768 * 768;                // corner / side pocket mouths, capture radius 3 px
const PX = [X0 - U, CXU, X1 + U, X0 - U, CXU, X1 + U], PY = [Y0 - U, Y0 - 384, Y0 - U, Y1 + U, Y1 + 384, Y1 + U];
const HEAD = X0 + 13 * U + 128, FOOT = X0 + 33 * U + 128;  // head string (break from behind it), rack apex
const FR = 11, VMAX = 1264;                                // rolling friction per tick, hardest shot
const CB = 4096, CHT = 2048, FOC = 80, HZ = 10, NEAR = 512, CZ = 800;   // the low camera: back, height, focal, horizon
const SIN = [0,25,50,75,101,126,151,176,201,226,251,276,302,327,352,377,402,427,452,477,503,528,553,578,603,628,653,678,704,729,754,779,804,829,854,879,904,929,955,980,1005,1030,1055,1080,1105,1130,1155,1180,1205,1230,1255,1280,1306,1331,1356,1381,1406,1431,1456,1481,1506,1531,1556,1581,1606,1631,1656,1681,1706,1731,1756,1781,1806,1831,1856,1881,1906,1931,1956,1981,2006,2031,2055,2080,2105,2130,2155,2180,2205,2230,2255,2280,2305,2329,2354,2379,2404,2429,2454,2479,2503,2528,2553,2578,2603,2628,2652,2677,2702,2727,2752,2776,2801,2826,2851,2875,2900,2925,2949,2974,2999,3024,3048,3073,3098,3122,3147,3172,3196,3221,3246,3270,3295,3320,3344,3369,3393,3418,3442,3467,3492,3516,3541,3565,3590,3614,3639,3663,3688,3712,3737,3761,3786,3810,3835,3859,3883,3908,3932,3957,3981,4005,4030,4054,4078,4103,4127,4151,4176,4200,4224,4249,4273,4297,4321,4346,4370,4394,4418,4442,4467,4491,4515,4539,4563,4587,4612,4636,4660,4684,4708,4732,4756,4780,4804,4828,4852,4876,4900,4924,4948,4972,4996,5020,5044,5068,5092,5115,5139,5163,5187,5211,5235,5259,5282,5306,5330,5354,5377,5401,5425,5449,5472,5496,5520,5543,5567,5591,5614,5638,5661,5685,5708,5732,5756,5779,5803,5826,5850,5873,5897,5920,5943,5967,5990,6014,6037,6060,6084,6107,6130,6154,6177,6200,6223,6247,6270,6293,6316,6339,6363,6386,6409,6432,6455,6478,6501,6524,6547,6570,6593,6616,6639,6662,6685,6708,6731,6754,6777,6800,6823,6846,6868,6891,6914,6937,6960,6982,7005,7028,7050,7073,7096,7118,7141,7164,7186,7209,7231,7254,7276,7299,7321,7344,7366,7389,7411,7434,7456,7478,7501,7523,7545,7568,7590,7612,7635,7657,7679,7701,7723,7746,7768,7790,7812,7834,7856,7878,7900,7922,7944,7966,7988,8010,8032,8054,8076,8098,8119,8141,8163,8185,8207,8228,8250,8272,8293,8315,8337,8358,8380,8401,8423,8445,8466,8488,8509,8531,8552,8573,8595,8616,8638,8659,8680,8702,8723,8744,8765,8787,8808,8829,8850,8871,8892,8914,8935,8956,8977,8998,9019,9040,9061,9082,9102,9123,9144,9165,9186,9207,9227,9248,9269,9290,9310,9331,9352,9372,9393,9413,9434,9455,9475,9496,9516,9537,9557,9577,9598,9618,9638,9659,9679,9699,9720,9740,9760,9780,9800,9820,9841,9861,9881,9901,9921,9941,9961,9981,10001,10020,10040,10060,10080,10100,10120,10139,10159,10179,10198,10218,10238,10257,10277,10296,10316,10336,10355,10374,10394,10413,10433,10452,10471,10491,10510,10529,10549,10568,10587,10606,10625,10644,10663,10683,10702,10721,10740,10759,10778,10796,10815,10834,10853,10872,10891,10909,10928,10947,10966,10984,11003,11021,11040,11059,11077,11096,11114,11133,11151,11169,11188,11206,11224,11243,11261,11279,11297,11316,11334,11352,11370,11388,11406,11424,11442,11460,11478,11496,11514,11532,11550,11567,11585,11603,11621,11638,11656,11674,11691,11709,11727,11744,11762,11779,11797,11814,11831,11849,11866,11883,11901,11918,11935,11952,11970,11987,12004,12021,12038,12055,12072,12089,12106,12123,12140,12157,12173,12190,12207,12224,12240,12257,12274,12290,12307,12324,12340,12357,12373,12390,12406,12423,12439,12455,12472,12488,12504,12520,12537,12553,12569,12585,12601,12617,12633,12649,12665,12681,12697,12713,12729,12744,12760,12776,12792,12807,12823,12839,12854,12870,12885,12901,12916,12932,12947,12963,12978,12993,13008,13024,13039,13054,13069,13085,13100,13115,13130,13145,13160,13175,13190,13205,13219,13234,13249,13264,13279,13293,13308,13323,13337,13352,13366,13381,13395,13410,13424,13439,13453,13467,13482,13496,13510,13524,13538,13553,13567,13581,13595,13609,13623,13637,13651,13665,13678,13692,13706,13720,13733,13747,13761,13774,13788,13802,13815,13829,13842,13856,13869,13882,13896,13909,13922,13935,13949,13962,13975,13988,14001,14014,14027,14040,14053,14066,14079,14092,14104,14117,14130,14143,14155,14168,14181,14193,14206,14218,14231,14243,14256,14268,14280,14293,14305,14317,14329,14341,14354,14366,14378,14390,14402,14414,14426,14438,14449,14461,14473,14485,14497,14508,14520,14531,14543,14555,14566,14578,14589,14601,14612,14623,14635,14646,14657,14668,14680,14691,14702,14713,14724,14735,14746,14757,14768,14779,14789,14800,14811,14822,14832,14843,14854,14864,14875,14885,14896,14906,14917,14927,14937,14948,14958,14968,14978,14989,14999,15009,15019,15029,15039,15049,15059,15069,15078,15088,15098,15108,15118,15127,15137,15146,15156,15166,15175,15184,15194,15203,15213,15222,15231,15240,15250,15259,15268,15277,15286,15295,15304,15313,15322,15331,15340,15349,15357,15366,15375,15383,15392,15401,15409,15418,15426,15435,15443,15451,15460,15468,15476,15485,15493,15501,15509,15517,15525,15533,15541,15549,15557,15565,15573,15581,15588,15596,15604,15611,15619,15627,15634,15642,15649,15656,15664,15671,15679,15686,15693,15700,15707,15715,15722,15729,15736,15743,15750,15757,15763,15770,15777,15784,15791,15797,15804,15810,15817,15824,15830,15837,15843,15849,15856,15862,15868,15875,15881,15887,15893,15899,15905,15911,15917,15923,15929,15935,15941,15946,15952,15958,15964,15969,15975,15980,15986,15991,15997,16002,16008,16013,16018,16024,16029,16034,16039,16044,16049,16054,16059,16064,16069,16074,16079,16084,16088,16093,16098,16103,16107,16112,16116,16121,16125,16130,16134,16138,16143,16147,16151,16156,16160,16164,16168,16172,16176,16180,16184,16188,16192,16195,16199,16203,16207,16210,16214,16218,16221,16225,16228,16232,16235,16238,16242,16245,16248,16251,16255,16258,16261,16264,16267,16270,16273,16276,16279,16281,16284,16287,16290,16292,16295,16298,16300,16303,16305,16308,16310,16312,16315,16317,16319,16321,16324,16326,16328,16330,16332,16334,16336,16338,16340,16341,16343,16345,16347,16348,16350,16352,16353,16355,16356,16358,16359,16360,16362,16363,16364,16365,16367,16368,16369,16370,16371,16372,16373,16374,16375,16375,16376,16377,16378,16378,16379,16380,16380,16381,16381,16382,16382,16382,16383,16383,16383,16384,16384,16384,16384,16384,16384];
const FONTCH = "ABCDEFGHIKLMNOPRSTUVWY0123456789:!- ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "101101110101101", "100100100100111", "101111111101101",
  "110101101101101", "010101101101010", "110101110100100", "110101110101101", "011100010001110", "111010010010010",
  "101101101101111", "101101101101010", "101101111111101", "101101010010010",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "000000000000000" ];
const DISC = [14, 31, 31, 31, 14];                        // 5x5 ball sprite rows, bit 4 = left

const div = (a, b) => Math.trunc(a / b);                  // C#'s int division
const abs = a => a < 0 ? -a : a;
export function isqrt(n) {
  if (n <= 0) return 0;
  let r = 0, b = 1 << 30;
  while (b > n) b >>= 2;
  while (b !== 0) { if (n >= r + b) { n -= r + b; r = (r >> 1) + b; } else r >>= 1; b >>= 2; }
  return r;
}
export function sin(a) {
  a &= 4095;
  return a < 1024 ? SIN[a] : a < 2048 ? SIN[2048 - a] : a < 3072 ? -SIN[a - 2048] : -SIN[4096 - a];
}
export const cos = a => sin(a + 1024);
function asinq(s) {                                       // 0..16384 -> 0..1024, the nearest table step
  let lo = 0, hi = 1024;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SIN[m] <= s) lo = m; else hi = m; }
  return s - SIN[lo] <= SIN[hi] - s ? lo : hi;
}
export function atan2(y, x) {                             // angle of (x, y), 0..4095, y down
  const ax = abs(x), ay = abs(y), l = isqrt(x * x + y * y);
  if (l === 0) return 0;
  const a = ay <= ax ? asinq(div(ay * 16384, l)) : 1024 - asinq(div(ax * 16384, l));
  return x >= 0 ? (y >= 0 ? a : (4096 - a) & 4095) : (y >= 0 ? 2048 - a : 2048 + a);
}

export function newGame(seed = 1) {
  const g = { rs: seed >>> 0, t: 0, phase: "title", pt: 0, cur: 0, score: [0, 0], breaker: 0, inHand: false,
    kitchen: false, aim: 0, spin: 0, pow: 0, needRel: false, holdT: 0, gap: 0, vShot: 0, spinAdd: 0,
    bx: Array(10).fill(0), by: Array(10).fill(0), vx: Array(10).fill(0), vy: Array(10).fill(0), on: Array(10).fill(0),
    low0: 0, fc: 0, potm: 0, msg: "", msgT: 0, auto: false,
    pAng: 0, pPow: 0, pX: 0, pY: 0, trS: 0, trHit: -1,
    pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }

// ---- the table ---------------------------------------------------------------------------------------------------
function lowest(g) { for (let k = 1; k <= 9; k++) if (g.on[k]) return k; return 0; }
function freeAt(g, x, y, skip) {
  for (let k = 0; k <= 9; k++) if (k !== skip && g.on[k]) { const dx = g.bx[k] - x, dy = g.by[k] - y; if (dx * dx + dy * dy < D2SQ) return false; }
  return true;
}
function spot(g, k, x, y) {                               // put ball k at (x, y) or the first free place behind it
  while (!freeAt(g, x, y, k) && x < X1 - R) x += U;
  g.bx[k] = x; g.by[k] = y; g.vx[k] = 0; g.vy[k] = 0; g.on[k] = 1;
}
function newRack(g, breaker) {
  const order = [2, 3, 4, 5, 6, 7, 8];
  for (let i = 6; i > 0; i--) { const j = rnd(g) % (i + 1), tt = order[i]; order[i] = order[j]; order[j] = tt; }
  const rows = [1, 2, 3, 2, 1]; let n = 0, o = 0;
  for (let r = 0; r < 5; r++) for (let i = 0; i < rows[r]; i++) {
    const k = n === 0 ? 1 : n === 4 ? 9 : order[o++];
    g.bx[k] = FOOT + r * 1000 + (rnd(g) & 3); g.by[k] = CYU + (i * 2 - (rows[r] - 1)) * 578 + (rnd(g) & 3);
    g.vx[k] = 0; g.vy[k] = 0; g.on[k] = 1; n++;
  }
  g.bx[0] = HEAD; g.by[0] = CYU; g.vx[0] = 0; g.vy[0] = 0; g.on[0] = 1;
  g.breaker = breaker; g.cur = breaker; g.inHand = true; g.kitchen = true; g.spin = 0;
  setPhase(g, "place"); say(g, "BREAK");
}
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 50; }

// ---- physics -----------------------------------------------------------------------------------------------------
function sink(g, k) { g.on[k] = 0; g.vx[k] = 0; g.vy[k] = 0; g.potm |= 1 << k; }
function walls(g, k) {
  const x = g.bx[k], y = g.by[k];
  const sideY = y < Y0 + MC || y > Y1 - MC, sideX = x < X0 + MC || x > X1 - MC || abs(x - CXU) < MS;
  const lb = sideY ? X0 - U : X0 + R, rb = sideY ? X1 + U : X1 - R, tb = sideX ? Y0 - U : Y0 + R, bb = sideX ? Y1 + U : Y1 - R;
  if (x < lb) { g.bx[k] = 2 * lb - x; g.vx[k] = div(-g.vx[k] * 3, 4); g.vy[k] = div(g.vy[k] * 15, 16); }
  else if (x > rb) { g.bx[k] = 2 * rb - x; g.vx[k] = div(-g.vx[k] * 3, 4); g.vy[k] = div(g.vy[k] * 15, 16); }
  if (y < tb) { g.by[k] = 2 * tb - y; g.vy[k] = div(-g.vy[k] * 3, 4); g.vx[k] = div(g.vx[k] * 15, 16); }
  else if (y > bb) { g.by[k] = 2 * bb - y; g.vy[k] = div(-g.vy[k] * 3, 4); g.vx[k] = div(g.vx[k] * 15, 16); }
}
function pockets(g, k) {
  const x = g.bx[k], y = g.by[k];
  if (x < X0 || x > X1 || y < Y0 || y > Y1) { sink(g, k); return; }   // past the cushion line = over a pocket
  for (let p = 0; p < 6; p++) { const dx = x - PX[p], dy = y - PY[p]; if (dx * dx + dy * dy < CR2) { sink(g, k); return; } }
}
function collide(g, i, j) {
  let dx = g.bx[j] - g.bx[i], dy = g.by[j] - g.by[i];
  const dd = dx * dx + dy * dy;
  if (dd >= D2SQ) return;
  let d = isqrt(dd); if (d === 0) { d = 1; dx = 1; dy = 0; }
  const vn = div((g.vx[i] - g.vx[j]) * dx + (g.vy[i] - g.vy[j]) * dy, d);
  if (vn > 0) {
    const p = div(vn * 31, 32), ix = div(p * dx, d), iy = div(p * dy, d);
    g.vx[i] -= ix; g.vy[i] -= iy; g.vx[j] += ix; g.vy[j] += iy;
    if (i === 0 && g.fc === 0) {                          // the cue ball's first contact: rules, then spin
      g.fc = j;
      g.vx[0] += (cos(g.aim) * g.spinAdd) >> 14; g.vy[0] += (sin(g.aim) * g.spinAdd) >> 14;
    }
  }
  const ov = D2 - d, sx = div(ov * dx, d * 2), sy = div(ov * dy, d * 2);
  g.bx[i] -= sx; g.by[i] -= sy; g.bx[j] += sx; g.by[j] += sy;
}
function physics(g) {
  let mv = 0;
  for (let k = 0; k <= 9; k++) if (g.on[k]) mv = Math.max(mv, abs(g.vx[k]), abs(g.vy[k]));
  if (mv === 0) return false;
  const n = 1 + div(mv, 320);
  for (let s = 0; s < n; s++) {
    for (let k = 0; k <= 9; k++) if (g.on[k]) { g.bx[k] += div(g.vx[k], n); g.by[k] += div(g.vy[k], n); walls(g, k); }
    for (let i = 0; i < 9; i++) if (g.on[i]) for (let j = i + 1; j <= 9; j++) if (g.on[j]) collide(g, i, j);
    for (let k = 0; k <= 9; k++) if (g.on[k]) pockets(g, k);
  }
  for (let k = 0; k <= 9; k++) if (g.on[k]) {
    const sp = isqrt(g.vx[k] * g.vx[k] + g.vy[k] * g.vy[k]);
    if (sp <= FR) { g.vx[k] = 0; g.vy[k] = 0; }
    else { g.vx[k] = div(g.vx[k] * (sp - FR), sp); g.vy[k] = div(g.vy[k] * (sp - FR), sp); }
  }
  return true;
}
// where the cue ball first touches something along the aim: g.trS = distance, g.trHit = ball (-1: a cushion)
function trace(g) {
  const c = cos(g.aim), s = sin(g.aim), cx = g.bx[0], cy = g.by[0];
  let best = 1 << 30, hit = -1;
  for (let k = 1; k <= 9; k++) if (g.on[k]) {
    const rx = g.bx[k] - cx, ry = g.by[k] - cy, proj = (rx * c + ry * s) >> 14;
    if (proj <= 0) continue;
    const perp = (ry * c - rx * s) >> 14;
    if (abs(perp) >= D2) continue;
    const d = proj - isqrt(D2SQ - perp * perp);
    if (d < best) { best = d; hit = k; }
  }
  let w = best;
  if (c > 0) w = Math.min(w, div((X1 - R - cx) * 16384, c)); else if (c < 0) w = Math.min(w, div((X0 + R - cx) * 16384, c));
  if (s > 0) w = Math.min(w, div((Y1 - R - cy) * 16384, s)); else if (s < 0) w = Math.min(w, div((Y0 + R - cy) * 16384, s));
  if (w < best) { best = w; hit = -1; }
  g.trS = Math.max(0, best); g.trHit = hit;
}

// ---- the computer player -----------------------------------------------------------------------------------------
function clear(g, ax, ay, bx, by, s1, s2) {               // no ball (but s1, s2) within a ball width of the segment
  const ux = bx - ax, uy = by - ay, l2 = ux * ux + uy * uy, l = isqrt(l2);
  for (let k = 0; k <= 9; k++) if (g.on[k] && k !== s1 && k !== s2) {
    const rx = g.bx[k] - ax, ry = g.by[k] - ay, t = rx * ux + ry * uy;
    if (t <= 0) { if (rx * rx + ry * ry < D2SQ) return false; }
    else if (t >= l2) { const qx = g.bx[k] - bx, qy = g.by[k] - by; if (qx * qx + qy * qy < D2SQ) return false; }
    else if (abs(rx * uy - ry * ux) < D2 * l) return false;
  }
  return true;
}
// the best pot from the cue ball at (cx, cy): sets pAng / pPow, returns its score (0: none)
function plan(g, cx, cy) {
  const t = lowest(g); let best = 0;
  for (let p = 0; p < 6; p++) {
    const tx = PX[p] - g.bx[t], ty = PY[p] - g.by[t], dt = isqrt(tx * tx + ty * ty);
    if (dt < 64) continue;
    if (p === 1 || p === 4) { if (abs(ty) * 3 < abs(tx) * 2) continue; }
    const gx = g.bx[t] - div(tx * D2, dt), gy = g.by[t] - div(ty * D2, dt);
    if (gx < X0 + R - 64 || gx > X1 - R + 64 || gy < Y0 + R - 64 || gy > Y1 - R + 64) continue;
    const ax = gx - cx, ay = gy - cy, dc = isqrt(ax * ax + ay * ay);
    if (dc < 64) continue;
    const cs = div(ax * tx + ay * ty, div(dc * dt, 1024) + 1);
    if (cs < 250) continue;
    if (!clear(g, cx, cy, gx, gy, 0, t) || !clear(g, g.bx[t], g.by[t], PX[p], PY[p], t, 0)) continue;
    const sc = div(cs * 4096, dc + dt * 2 + 2048) + 1;
    if (sc > best) {
      best = sc; g.pAng = atan2(ay, ax);
      const st = isqrt(2 * FR * (dt + 4096)), vi = div(st * 1056, cs), v0 = Math.min(VMAX, isqrt(vi * vi + 2 * FR * dc));
      g.pPow = Math.max(8, Math.min(100, div(v0 - 64 + 11, 12)));
    }
  }
  return best;
}
function aimAI(g) {
  const t = lowest(g), cx = g.bx[0], cy = g.by[0], err = g.cur === 1 ? 6 : 3;
  if (g.kitchen) { g.pAng = atan2(g.by[t] - cy, g.bx[t] - cx); g.pPow = 100; }
  else if (plan(g, cx, cy) === 0) {                     // no pot: find any line that meets the lowest ball first
    const a0 = atan2(g.by[t] - cy, g.bx[t] - cx), keep = g.aim; g.pAng = a0; g.pPow = 40;
    for (let d = 0; d <= 320; d += 8) {
      g.aim = (a0 + d) & 4095; trace(g); if (g.trHit === t) { g.pAng = g.aim; break; }
      g.aim = (a0 - d) & 4095; trace(g); if (g.trHit === t) { g.pAng = g.aim; break; }
    }
    g.aim = keep;
  }
  g.pAng = (g.pAng + rnd(g) % (err * 2 + 1) - err) & 4095;
  g.pPow = Math.max(4, Math.min(100, g.pPow + rnd(g) % 9 - 4));
}
function placeAI(g) {                                     // ball in hand: straight behind a pottable lowest ball
  const t = lowest(g); let best = 0;
  g.pX = HEAD; g.pY = CYU + (rnd(g) % 7 - 3) * 192;
  if (g.kitchen) return;
  for (let p = 0; p < 6; p++) for (let k = 1; k <= 3; k++) {
    const tx = PX[p] - g.bx[t], ty = PY[p] - g.by[t], dt = isqrt(tx * tx + ty * ty);
    if (dt < 64) continue;
    const back = D2 + k * 1280, x = g.bx[t] - div(tx * back, dt), y = g.by[t] - div(ty * back, dt);
    if (x < X0 + R || x > X1 - R || y < Y0 + R || y > Y1 - R || !freeAt(g, x, y, 0)) continue;
    const sc = plan(g, x, y);
    if (sc > best) { best = sc; g.pX = x; g.pY = y; }
  }
  if (best === 0) { g.pX = HEAD; g.pY = CYU; while (!freeAt(g, g.pX, g.pY, 0) && g.pX < X1 - R) g.pX += U; }
}

// ---- the game ----------------------------------------------------------------------------------------------------
function strike(g) {
  g.vShot = 64 + g.pow * 12; g.spinAdd = div(g.spin * g.vShot, 5);
  g.gap = g.pow * 8; setPhase(g, "strike");
}
function startTurn(g) {
  if (g.inHand) setPhase(g, "place");
  else { const t = lowest(g); g.aim = atan2(g.by[t] - g.by[0], g.bx[t] - g.bx[0]); setPhase(g, "aim"); }
  g.spin = 0; g.pow = 0;
}
function judge(g) {
  const scratch = !g.on[0], foul = scratch || g.fc !== g.low0, nine = (g.potm >> 9) & 1, was = g.cur;
  if (nine && !foul) {
    g.score[g.cur]++; say(g, g.cur === 0 ? "YOU WIN" : "CPU WINS"); setPhase(g, "over"); return;
  }
  if (nine) spot(g, 9, FOOT, CYU);
  if (foul) {
    say(g, scratch ? "SCRATCH" : g.fc === 0 ? "NO HIT" : "FOUL");
    g.cur = 1 - g.cur; g.inHand = true; g.kitchen = false;
    if (scratch) spot(g, 0, HEAD, CYU);
  } else if (g.potm === 0) { g.cur = 1 - g.cur; say(g, g.cur === 0 ? "YOUR SHOT" : "CPU SHOT"); }
  else say(g, was === 0 ? "GO AGAIN" : "CPU AGAIN");
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
  if (up || down || left || right) g.holdT++; else g.holdT = 0;
  g.auto = auto;
  const ai = auto || g.cur === 1;

  switch (g.phase) {
    case "title":
      if (eA || (auto && g.pt > 40)) { g.score[0] = 0; g.score[1] = 0; newRack(g, 0); }
      break;
    case "over":
      if ((eA && g.pt > 20) || ((auto || g.cur === 1) && g.pt > 120) || g.pt > 300) newRack(g, 1 - g.breaker);
      break;
    case "result":
      physics(g);
      if (g.pt > 36) startTurn(g);
      break;
    case "place": {
      const xmax = g.kitchen ? HEAD : X1 - R;
      if (ai) {
        if (g.pt === 1) placeAI(g);
        const dx = g.pX - g.bx[0], dy = g.pY - g.by[0];
        g.bx[0] += Math.max(-256, Math.min(256, dx)); g.by[0] += Math.max(-256, Math.min(256, dy));
        if (dx === 0 && dy === 0 && g.pt > 15 && freeAt(g, g.bx[0], g.by[0], 0)) { g.inHand = false; startTurn(g); }
        else if (g.pt > 200) { g.pX = HEAD; g.pY = CYU; }
      } else {
        const sp = g.holdT < 6 ? 64 : 256;
        if (left) g.bx[0] -= sp; if (right) g.bx[0] += sp; if (up) g.by[0] -= sp; if (down) g.by[0] += sp;
        g.bx[0] = Math.max(X0 + R, Math.min(xmax, g.bx[0])); g.by[0] = Math.max(Y0 + R, Math.min(Y1 - R, g.by[0]));
        if (eA && freeAt(g, g.bx[0], g.by[0], 0)) { g.inHand = false; startTurn(g); }
      }
      break;
    }
    case "aim":
      if (ai) {
        if (g.pt === 1) aimAI(g);
        const d = ((g.pAng - g.aim + 2048) & 4095) - 2048;
        g.aim = (g.aim + Math.max(-40, Math.min(40, d))) & 4095;
        if (d === 0 && g.pt > 40) { setPhase(g, "view"); g.needRel = false; g.pow = 0; }
      } else {
        const turn = g.holdT < 6 ? 2 : g.holdT < 20 ? 6 : 20, nudge = eUp || eDown || g.holdT > 10 ? 1 : 0;
        if (left) g.aim -= eLeft ? 2 : turn; if (right) g.aim += eRight ? 2 : turn;
        if (up) g.aim -= nudge; if (down) g.aim += nudge;
        g.aim &= 4095;
        if (eA) { setPhase(g, "view"); g.needRel = true; g.pow = 0; }
      }
      break;
    case "view":
      if (ai) {
        if (g.pt > 12) { if (g.pow < g.pPow) g.pow = Math.min(g.pPow, g.pow + 2); else if (g.pt > 22 + div(g.pPow, 2)) strike(g); }
      } else {
        const fine = g.holdT > 8 ? 1 : 0;
        if (left) g.aim -= eLeft ? 1 : fine; if (right) g.aim += eRight ? 1 : fine;
        g.aim &= 4095;
        if (eUp) g.spin = Math.min(2, g.spin + 1); if (eDown) g.spin = Math.max(-2, g.spin - 1);
        if (eB) { setPhase(g, "aim"); g.pow = 0; break; }
        if (g.needRel) { if (!a) g.needRel = false; }
        else if (a) g.pow = Math.min(100, g.pow + 2);
        else if (g.pow > 0) { if (g.pow >= 4) strike(g); else g.pow = 0; }
      }
      break;
    case "strike":
      g.gap = Math.max(0, g.gap - 64 - div(g.gap, 3));
      if (g.gap === 0) {
        g.low0 = lowest(g); g.fc = 0; g.potm = 0;
        g.vx[0] = (cos(g.aim) * g.vShot) >> 14; g.vy[0] = (sin(g.aim) * g.vShot) >> 14;
        setPhase(g, "roll");
      }
      break;
    case "roll":
      if (!physics(g)) judge(g);
      break;
  }
}
export function demo(g) { return { auto: true }; }

// ---- drawing -----------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { if (x >= 0 && x < 64 && y >= 0 && y < 64) b[y * 64 + x] = v; }
function fill(b, x, y, w, h, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(b, i, j, v); }
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
function line(b, x0, y0, x1, y1, dots) {                  // dots: 0 solid, n: every n-th pixel
  const dx = abs(x1 - x0), dy = -abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, n = 0;
  for (;;) {
    if (dots === 0 || n % dots === 0) px(b, x0, y0);
    n++;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
function clipLine(b, x0, y0, x1, y1, dots) {              // Cohen-Sutherland to the screen, then draw
  for (let it = 0; it < 6; it++) {
    const c0 = (x0 < 0 ? 1 : x0 > 63 ? 2 : 0) | (y0 < 0 ? 4 : y0 > 63 ? 8 : 0);
    const c1 = (x1 < 0 ? 1 : x1 > 63 ? 2 : 0) | (y1 < 0 ? 4 : y1 > 63 ? 8 : 0);
    if ((c0 | c1) === 0) { line(b, x0, y0, x1, y1, dots); return; }
    if ((c0 & c1) !== 0) return;
    const c = c0 !== 0 ? c0 : c1; let x, y;
    if (c & 8) { x = x0 + div((x1 - x0) * (63 - y0), y1 - y0); y = 63; }
    else if (c & 4) { x = x0 + div((x1 - x0) * (0 - y0), y1 - y0); y = 0; }
    else if (c & 2) { y = y0 + div((y1 - y0) * (63 - x0), x1 - x0); x = 63; }
    else { y = y0 + div((y1 - y0) * (0 - x0), x1 - x0); x = 0; }
    if (c === c0) { x0 = x; y0 = y; } else { x1 = x; y1 = y; }
  }
}
function circle(b, cx, cy, r, v, dots) {
  const rr = r * r + r;
  for (let d = -r; d <= r; d++) {
    const w = isqrt(rr - d * d);
    if (dots === 0 || ((d + r) & 1) === 0) { px(b, cx - w, cy + d, v); px(b, cx + w, cy + d, v); px(b, cx + d, cy - w, v); px(b, cx + d, cy + w, v); }
  }
}
function disc(b, cx, cy, r, v) {
  const rr = r * r + r;
  for (let d = -r; d <= r; d++) { const w = isqrt(rr - d * d); for (let x = cx - w; x <= cx + w; x++) px(b, x, cy + d, v); }
}
function ball2(b, k, x, y, solid, dot) {                  // the 5x5 overhead ball
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if ((DISC[r] >> (4 - q)) & 1) px(b, x - 2 + q, y - 2 + r, solid || r === 0 || r === 4 || q === 0 || q === 4 ? 1 : 0);
  if (dot) px(b, x, y, 1);
}

function drawTable(g, b) {
  fill(b, 2, 18, 60, 33, 1);                              // rails
  fill(b, X0 >> 8, Y0 >> 8, (X1 - X0) >> 8, (Y1 - Y0) >> 8, 0);
  for (let p = 0; p < 6; p++) disc(b, PX[p] >> 8, PY[p] >> 8, 2, 0);
  for (let k = 1; k < 8; k++) if (k !== 4) { const x = 5 + div(k * 54, 8); px(b, x, 19, 0); px(b, x, 49, 0); }
  for (let k = 1; k < 4; k++) { const y = 21 + div(k * 27, 4); px(b, 3, y, 0); px(b, 60, y, 0); }
}
function drawHud(g, b) {
  text(b, 1, 1, "YOU " + g.score[0]); const s = "CPU " + g.score[1]; text(b, 64 - s.length * 4, 1, s);
  if (g.phase !== "over") { if (g.cur === 0) line(b, 1, 7, 11, 7, 0); else line(b, 64 - s.length * 4, 7, 62, 7, 0); }
  const low = lowest(g);
  for (let k = 1; k <= 9; k++) if (g.on[k]) {
    const x = 14 + k * 4 - 4;
    if (k === low && g.phase !== "roll") { fill(b, x - 1, 9, 5, 7, 1); text(b, x, 10, "" + k, 0); } else text(b, x, 10, "" + k);
  }
}
function drawOverhead(g, b) {
  drawTable(g, b); drawHud(g, b);
  const low = lowest(g), blink = ((g.t >> 3) & 1) === 1;
  const aiming = g.phase === "aim" || g.phase === "place";
  for (let k = 1; k <= 9; k++) if (g.on[k]) ball2(b, k, g.bx[k] >> 8, g.by[k] >> 8, k === low && aiming && blink, k === 9);
  if (g.on[0] && !(g.phase === "place" && blink)) ball2(b, 0, g.bx[0] >> 8, g.by[0] >> 8, true, false);
  if (g.phase === "aim") {
    trace(g);
    const c = cos(g.aim), s = sin(g.aim), cx = g.bx[0], cy = g.by[0];
    for (let d = R + 512; d < g.trS; d += 512) px(b, (cx + ((c * d) >> 14)) >> 8, (cy + ((s * d) >> 14)) >> 8);
    const gx = cx + ((c * g.trS) >> 14), gy = cy + ((s * g.trS) >> 14);
    circle(b, gx >> 8, gy >> 8, 2, 1, 2);
    if (g.trHit > 0) {
      const nx = g.bx[g.trHit] - gx, ny = g.by[g.trHit] - gy, l = isqrt(nx * nx + ny * ny) + 1;
      for (let d = 3; d <= 8; d++) px(b, (g.bx[g.trHit] + div(nx * d * 256, l)) >> 8, (g.by[g.trHit] + div(ny * d * 256, l)) >> 8);
    }
    for (let d = R + 512; d < R + 18 * U; d += 128) px(b, (cx - ((c * d) >> 14)) >> 8, (cy - ((s * d) >> 14)) >> 8);
  }
  let m = g.msgT > 0 ? g.msg : "";
  if (g.phase === "place" && !g.msgT) m = g.cur === 1 && !g.auto ? "CPU BALL IN HAND" : "BALL IN HAND";
  if (m) centre(b, 56, m);
  if (g.phase === "over") {
    fill(b, 10, 27, 44, 15, 0); line(b, 10, 27, 53, 27, 0); line(b, 10, 41, 53, 41, 0); line(b, 10, 27, 10, 41, 0); line(b, 53, 27, 53, 41, 0);
    centre(b, 32, g.msg);
  }
}

// ---- the low 3D view along the cue ---------------------------------------------------------------------------------
let camX = 0, camY = 0, camC = 0, camS = 0;
function line3c(b, f1, r1, z1, f2, r2, z2, dots) {        // camera space: forward, right, height
  if (f1 < NEAR && f2 < NEAR) return;
  if (f1 < NEAR) { r1 += div((r2 - r1) * (NEAR - f1), f2 - f1); z1 += div((z2 - z1) * (NEAR - f1), f2 - f1); f1 = NEAR; }
  else if (f2 < NEAR) { r2 += div((r1 - r2) * (NEAR - f2), f1 - f2); z2 += div((z1 - z2) * (NEAR - f2), f1 - f2); f2 = NEAR; }
  clipLine(b, 32 + div(r1 * FOC, f1), HZ + div((CHT - z1) * FOC, f1), 32 + div(r2 * FOC, f2), HZ + div((CHT - z2) * FOC, f2), dots);
}
const camF = (x, y) => ((x - camX) * camC + (y - camY) * camS) >> 14;
const camR = (x, y) => ((y - camY) * camC - (x - camX) * camS) >> 14;
function line3(b, x1, y1, z1, x2, y2, z2) { line3c(b, camF(x1, y1), camR(x1, y1), z1, camF(x2, y2), camR(x2, y2), z2, 0); }
function cushion(b, x1, y1, x2, y2, ox, oy) {             // one stretch of cushion between two pockets
  line3(b, x1, y1, 0, x2, y2, 0); line3(b, x1, y1, CZ, x2, y2, CZ);
  line3(b, x1 + ox, y1 + oy, CZ, x2 + ox, y2 + oy, CZ);
  line3(b, x1, y1, 0, x1, y1, CZ); line3(b, x2, y2, 0, x2, y2, CZ);
  line3(b, x1, y1, CZ, x1 + ox, y1 + oy, CZ); line3(b, x2, y2, CZ, x2 + ox, y2 + oy, CZ);
}
function draw3d(g, b) {
  camC = cos(g.aim); camS = sin(g.aim);
  camX = g.bx[0] - ((camC * CB) >> 14); camY = g.by[0] - ((camS * CB) >> 14);
  const RO = 768;
  cushion(b, X0 + MC, Y0, CXU - MS, Y0, 0, -RO); cushion(b, CXU + MS, Y0, X1 - MC, Y0, 0, -RO);
  cushion(b, X0 + MC, Y1, CXU - MS, Y1, 0, RO); cushion(b, CXU + MS, Y1, X1 - MC, Y1, 0, RO);
  cushion(b, X0, Y0 + MC, X0, Y1 - MC, -RO, 0); cushion(b, X1, Y0 + MC, X1, Y1 - MC, RO, 0);
  for (let p = 0; p < 6; p++) {                           // pocket rims: 8-sided rings on the felt
    for (let k = 0; k < 8; k++) {
      const a1 = k * 512, a2 = (k + 1) * 512;
      line3(b, PX[p] + ((cos(a1) * 704) >> 14), PY[p] + ((sin(a1) * 704) >> 14), 0, PX[p] + ((cos(a2) * 704) >> 14), PY[p] + ((sin(a2) * 704) >> 14), 0);
    }
  }
  trace(g);
  const low = lowest(g);
  const ord = [], fs = [];                                // balls far to near
  for (let k = 1; k <= 9; k++) if (g.on[k]) {
    const f = camF(g.bx[k], g.by[k]);
    if (f < NEAR + R) continue;
    let i = ord.length; ord.push(k); fs.push(f);
    while (i > 0 && fs[i - 1] < f) { ord[i] = ord[i - 1]; fs[i] = fs[i - 1]; i--; }
    ord[i] = k; fs[i] = f;
  }
  for (let d = R + 768; d < g.trS; d += 768) { const f = CB + d; px(b, 32, HZ + div(CHT * FOC, f)); }   // aim line
  for (let n = 0; n < ord.length; n++) {
    const k = ord[n], f = fs[n], r = camR(g.bx[k], g.by[k]);
    const sx = 32 + div(r * FOC, f), sy = HZ + div((CHT - R) * FOC, f), pr = div(R * FOC, f);
    if (pr < 1) { px(b, sx, sy); continue; }
    disc(b, sx, sy, pr, 0); circle(b, sx, sy, pr, 1, 0);
    if (k === low) { for (let y = -pr + 1; y < pr; y++) for (let x = -pr + 1; x < pr; x++) if (((x + y) & 1) === 0 && x * x + y * y < pr * pr - pr) px(b, sx + x, sy + y); }
    if (k === 9) { if (pr >= 3) circle(b, sx, sy, pr >> 1, 1, 0); else px(b, sx, sy); }
  }
  if (g.trS > 0) { const f = CB + g.trS; circle(b, 32, HZ + div((CHT - R) * FOC, f), div(R * FOC, f), 1, 2); }   // ghost ball
  // the cue ball (wireframe), then the cue coming in from below
  const cr = div(R * FOC, CB), cy = HZ + div((CHT - R) * FOC, CB);
  circle(b, 32, cy, cr, 1, 0);                            // see-through, so the shot shows
  const zt = R + div(g.spin * R, 3), ft = CB - R - 128 - (g.phase === "view" ? g.pow * 8 : g.gap);
  px(b, 32, cy - div(g.spin * cr, 3));
  line3c(b, ft, -90, zt, ft - 15360, -300, zt + 1600, 0); line3c(b, ft, 90, zt, ft - 15360, 300, zt + 1600, 0);
  line3c(b, ft, -90, zt, ft, 90, zt, 0);
  // power (left) and spin (top right)
  fill(b, 0, 20, 5, 44, 0); line(b, 0, 20, 4, 20, 0); line(b, 0, 20, 0, 63, 0); line(b, 4, 20, 4, 63, 0);
  if (g.pow > 0) fill(b, 1, 63 - div(g.pow * 42, 100), 3, div(g.pow * 42, 100), 1);
  disc(b, 58, 6, 4, 0); circle(b, 58, 6, 4, 1, 0); px(b, 58, 6 - g.spin * 2);
  text(b, 1, 1, g.cur === 0 ? (g.auto ? "DEMO" : "YOU") : "CPU");
  fill(b, 19, 0, 5, 7, 1); text(b, 20, 1, "" + low, 0);
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title") {
    big(b, 8, 4, "9-BALL");
    const rows = [1, 2, 3, 2, 1];
    for (let r = 0; r < 5; r++) for (let i = 0; i < rows[r]; i++) ball2(b, 0, 26 + r * 4, 30 + (i * 2 - (rows[r] - 1)) * 3, false, r === 2 && i === 1);
    ball2(b, 0, 10, 30, true, false); line(b, 0, 30, 6, 30, 0);
    centre(b, 46, "YOU VS CPU");
    if ((g.t >> 4) & 1) centre(b, 56, "A: START");
    return b;
  }
  if (g.phase === "view" || g.phase === "strike") draw3d(g, b); else drawOverhead(g, b);
  return b;
}
