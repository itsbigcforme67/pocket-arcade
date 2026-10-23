// KENO for the VMX's 64x64 1-bit screen. Our own art and code.
// The ticket: numbers 1-80 as a 10 x 8 grid (a real keno ticket's rows of ten: row r, column c is r*10+c+1). Mark 1 to
// 10 spots, bet 1-10 chips (from VMX CASINO's shared bank, never more than the stash), PLAY: 20 of the 80 numbers are
// drawn without replacement (a partial Fisher-Yates shuffle on the seeded RNG, every pick rejection-sampled so each
// number is exactly equally likely) BEFORE the balls come out; the animation only shows them one by one.
// Pays: PAY[spots][hits] x bet, stake included (1 = the bet back). This table is far more generous than a real keno
// lounge (~75% return) because VMX CASINO is a casino of slow, careful builders. Exact returns (hypergeometric:
// P(k hits of n) = C(n,k) C(80-n,20-k) / C(80,20), worked out in Python with fractions):
//   spots  return   pays on   pays (catch:x)                                      top prize odds
//     1    75.0%    25.0%     1:3                                                 1 in 4
//     2    92.1%    44.0%     1:1 2:9                                             1 in 17
//     3    94.4%    15.3%     2:2 3:48                                            1 in 72
//     4    94.8%    25.9%     2:2 3:5 4:100                                       1 in 326
//     5    95.0%    36.7%     2:1 3:3 4:14 5:400                                  1 in 1,551
//     6    94.2%    16.2%     3:3 4:5 5:70 6:1500                                 1 in 7,753
//     7    93.3%    23.7%     3:2 4:3 5:20 6:180 7:5000                           1 in 40,979
//     8    92.2%    31.7%     3:1 4:2 5:10 6:80 7:800 8:10000                     1 in 230,115
//     9    93.1%    39.9%     3:1 4:1 5:5 6:30 7:250 8:2500 9:10000               1 in 1,380,688
//    10    94.0%    25.8%     0:2 4:1 5:2 6:25 7:110 8:800 9:4000 10:10000        1 in 8,911,711
// ("pays on" counts a 1x push as paying.) 2-10 spots return 92.1-95.0% (house edge 5-8%). One spot can't: with whole
// multiples it is 3x (75%) or 4x (100%, no edge at all), so it stays at 3x and the pay table says RETURN 75.0%.
// Every table's return is shown on its pay table screen. The bet doesn't change the return.
// Controls: the ticket - D-pad moves the cursor (held = repeat; it runs on through the rows), A marks/unmarks, B opens
// the menu: PLAY, BET <1-10>, QUICK <n> (A: a random ticket of n spots), CLEAR, PAYS (the pay table: Left/Right other
// spot counts, A/B back). The draw: A speeds it up. After it: A plays the same ticket and bet again (REPEAT), B goes back
// to the ticket. Broke (no chips) = "OUT OF CHIPS / MORE TOMORROW" until the bank's daily top-up.
// Everything is integer so the C# port in vmx-firmware/games/keno plays exactly the same (div() for /, no
// Math.random/sort). newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here).
// Input: held buttons (edges found here); { auto: true } = the computer plays (demo: quick-picks 4-8 spots, bets 1-5).
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const FONTCH = "ABCDEFGHIKLMNOPQRSTUVWXYZ0123456789:!-<>+ ./%";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "101101110101101", "100100100100111", "101111111101101",
  "110101101101101", "010101101101010", "110101110100100", "010101101110011", "110101110101101", "011100010001110",
  "111010010010010", "101101101101111", "101101101101010", "101101111111101", "101101010101101", "101101010010010",
  "111001010100111", "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001",
  "111100110001110", "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000",
  "010010010000010", "000000111000000", "001010100010001", "100010001010100", "000010111010000", "000000000000000",
  "000000000000010", "001001010100100", "101001010100101" ];
const CHIP = [14, 31, 27, 31, 14];                        // the chip icon
const PAY = [[0], [0, 3], [0, 1, 9], [0, 0, 2, 48], [0, 0, 2, 5, 100], [0, 0, 1, 3, 14, 400], [0, 0, 0, 3, 5, 70, 1500],
  [0, 0, 0, 2, 3, 20, 180, 5000], [0, 0, 0, 1, 2, 10, 80, 800, 10000], [0, 0, 0, 1, 1, 5, 30, 250, 2500, 10000],
  [2, 0, 0, 0, 1, 2, 25, 110, 800, 4000, 10000]];
const RET = [0, 750, 921, 944, 948, 950, 942, 933, 922, 931, 940];   // return per mille (tenths of a percent)
const MENU = ["PLAY", "BET", "QUICK", "CLEAR", "PAYS"];
const NM = 5, MAXSPOT = 10, MAXBET = 10, BALLS = 20;
const BT = 15, LT = 7, FBT = 4, FLT = 2, HOLD = 20;       // ticks a ball (normal / fast), when it lights; end hold
const GX = 2, GY = 8;                                     // the grid's first cell: 6 x 5 pitch, 5 x 4 inside

const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, holdT: 0, msg: "", msgT: 0, auto: false,
    mk: Array(80).fill(0), nmk: 0, cur: 0, bet: 1, qn: 5, msel: 0, ptn: 5, dr: Array(BALLS).fill(0),
    pool: Array(80).fill(0), lit: 0, bn: 0, bt: 0, fast: false, hits: 0, won: 0,
    dN: 0, dk: 0, dw: 0, dQ: 0, dBet: 0, dPays: false,
    pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function below(g, m) {                                    // 0..m-1, all equally likely (no modulo bias)
  const lim = 65536 - 65536 % m;
  let r = rnd(g);
  while (r >= lim) r = rnd(g);
  return r % m;
}
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 50; }
function shuffle(g, n) {                                  // the first n of a fresh shuffle of 0..79 -> g.pool[0..n-1]
  for (let i = 0; i < 80; i++) g.pool[i] = i;
  for (let i = 0; i < n; i++) {
    const j = i + below(g, 80 - i), s = g.pool[i];
    g.pool[i] = g.pool[j]; g.pool[j] = s;
  }
}
function toMark(g) {                                      // back to the ticket: the bet cut to the stash
  if (g.bet > g.bank.chips) g.bet = g.bank.chips;
  if (g.bet < 1) g.bet = 1;
  setPhase(g, g.bank.chips < 1 ? "broke" : "mark");
  g.dN = 0;
}
function play(g) {
  if (g.nmk === 0) { say(g, "MARK SPOTS"); setPhase(g, "mark"); return; }
  if (g.bank.chips < 1) { setPhase(g, "broke"); return; }
  if (g.bet > g.bank.chips) g.bet = g.bank.chips;
  g.bank.chips -= g.bet;
  shuffle(g, BALLS);
  for (let i = 0; i < BALLS; i++) g.dr[i] = g.pool[i];
  g.lit = 0; g.bn = 0; g.bt = 0; g.hits = 0; g.won = 0; g.fast = false;
  setPhase(g, "draw");
}
function quick(g) {
  shuffle(g, g.qn);
  for (let i = 0; i < 80; i++) g.mk[i] = 0;
  for (let i = 0; i < g.qn; i++) g.mk[g.pool[i]] = 1;
  g.nmk = g.qn;
}
function settle(g) {
  g.won = PAY[g.nmk][g.hits] * g.bet;
  if (g.won > 0) g.bank.chips += g.won;
  setPhase(g, "pay");
}
function maxBet(g) { return g.bank.chips < MAXBET ? g.bank.chips : MAXBET; }
function act(g, aUp, aDown, aLeft, aRight, aA, aB) {      // one move on the ticket / menu / pay table
  if (g.phase === "mark") {
    if (aUp) g.cur = (g.cur + 70) % 80;
    if (aDown) g.cur = (g.cur + 10) % 80;
    if (aLeft) g.cur = (g.cur + 79) % 80;
    if (aRight) g.cur = (g.cur + 1) % 80;
    if (aA) {
      if (g.mk[g.cur] === 1) { g.mk[g.cur] = 0; g.nmk--; }
      else if (g.nmk < MAXSPOT) { g.mk[g.cur] = 1; g.nmk++; }
      else say(g, "10 SPOTS MAX");
    }
    if (aB) { setPhase(g, "menu"); g.msel = 0; }
  } else if (g.phase === "menu") {
    if (aUp) g.msel = (g.msel + NM - 1) % NM;
    if (aDown) g.msel = (g.msel + 1) % NM;
    if (g.msel === 1) {
      if (aLeft && g.bet > 1) g.bet--;
      if (aRight && g.bet < maxBet(g)) g.bet++;
    } else if (g.msel === 2) {
      if (aLeft && g.qn > 1) g.qn--;
      if (aRight && g.qn < MAXSPOT) g.qn++;
    }
    if (aA) {
      if (g.msel === 0) play(g);
      else if (g.msel === 2) { quick(g); setPhase(g, "mark"); }
      else if (g.msel === 3) { for (let i = 0; i < 80; i++) g.mk[i] = 0; g.nmk = 0; setPhase(g, "mark"); }
      else if (g.msel === 4) { g.ptn = g.nmk > 0 ? g.nmk : g.qn; setPhase(g, "paytab"); }
    } else if (aB) setPhase(g, "mark");
  } else if (g.phase === "paytab") {
    if (aLeft && g.ptn > 1) g.ptn--;
    if (aRight && g.ptn < MAXSPOT) g.ptn++;
    if (aA || aB) setPhase(g, "menu");
  }
}
function plan(g) {                                        // the demo's next ticket
  g.dQ = 4 + below(g, 5);
  g.dBet = 1 + below(g, 5);
  if (g.dBet > g.bank.chips) g.dBet = g.bank.chips;
  g.dPays = below(g, 3) === 0;
  g.dN = 1; g.dk = 0; g.dw = 0;
}
function demoMove(g) {                                    // one press: set the bet, quick-pick, maybe look, play
  let u = false, d = false, l = false, r = false, a = false, b = false;
  const ph = g.phase;
  if (g.dk === 0 || g.dk === 1) {
    const row = g.dk + 1, have = g.dk === 0 ? g.bet : g.qn, want = g.dk === 0 ? g.dBet : g.dQ;
    if (ph === "mark") b = true;
    else if (g.msel < row) d = true;
    else if (g.msel > row) u = true;
    else if (have < want) r = true;
    else if (have > want) l = true;
    else if (g.dk === 0) g.dk = 1;
    else { a = true; g.dk = g.dPays ? 2 : 4; g.dw = 0; }
  } else if (g.dk === 2) {
    if (ph === "mark") { g.dw++; if (g.dw > 4) b = true; }
    else if (ph === "menu") { if (g.msel < 4) d = true; else a = true; }
    else { g.dw++; if (g.dw > 16) { b = true; g.dk = 3; } }
  } else if (g.dk === 4) {
    g.dw++; if (g.dw > 4) { b = true; g.dk = 3; }
  } else {
    if (ph === "mark") b = true;
    else if (g.msel > 0) u = true;
    else a = true;
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
      if (eA || (auto && g.pt > 40)) toMark(g);
      break;
    case "mark": case "menu": case "paytab":
      if (auto) {
        if (g.dN === 0) plan(g);
        if (g.t % 5 === 0) demoMove(g);
      } else act(g, eUp || (up && rep), eDown || (down && rep), eLeft || (left && rep), eRight || (right && rep), eA, eB);
      break;
    case "draw": {
      if (eA) g.fast = true;
      const bt = g.fast ? FBT : BT, lt = g.fast ? FLT : LT;
      g.bt++;
      if (g.lit === g.bn && g.bt >= lt) {                 // ball bn (shown big since tick 1) lights on the grid
        if (g.mk[g.dr[g.bn]] === 1) g.hits++;
        g.lit++;
      }
      if (g.lit >= BALLS) { if (g.bt >= bt + HOLD) settle(g); }
      else if (g.lit > g.bn && g.bt >= bt) { g.bn++; g.bt = 0; }
      break;
    }
    case "pay":
      if (auto) { if (g.pt > 75) { if (below(g, 3) === 0) toMark(g); else play(g); } }
      else if (eA && g.pt > 10) { toMark(g); if (g.phase === "mark") play(g); }
      else if ((eB && g.pt > 10) || g.pt > 900) toMark(g);
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
function boxed(b, y, s) {                                 // a message box
  const w = s.length * 4 + 3, x = 32 - (w >> 1);
  fill(b, x, y, w, 9, 0); rect(b, x, y, w, 9); text(b, x + 2, y + 2, s, 1);
}
function stash(g, b, x, y) {
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if ((CHIP[r] >> (4 - q)) & 1) px(b, x + q, y + r, 1);
  text(b, x + 7, y, "" + g.bank.chips, 1);
}
function ball(b, n) {                                     // the big number box, bottom left (n < 0: empty)
  rect(b, 0, 50, 20, 14);
  if (n < 0) return;
  const s = "" + n;
  big(b, 10 - ((s.length * 8 - 2) >> 1), 52, s, 1);
}
// one grid cell: 0 empty, 1 marked, 2 drawn, 3 hit (marked and drawn)
function cell(b, i, k) {
  const x = GX + (i % 10) * 6, y = GY + div(i, 10) * 5;
  if (k === 3) { fill(b, x - 1, y - 1, 7, 6, 1); px(b, x + 2, y + 1, 0); px(b, x + 2, y + 2, 0); }
  else if (k === 1) fill(b, x, y, 5, 4, 1);
  else if (k === 2) rect(b, x, y, 5, 4);
  else px(b, x + 2, y + 2, 1);
}
function grid(g, b, shown) {                              // the ticket, with the first `shown` balls lit
  rect(b, 0, 6, 64, 43);
  const lit = new Uint8Array(80);
  for (let i = 0; i < shown; i++) lit[g.dr[i]] = 1;
  const fresh = g.phase === "draw" && g.lit > g.bn && g.bt < LT + 8 && ((g.t >> 1) & 1) === 1 ? g.dr[g.bn] : -1;
  for (let i = 0; i < 80; i++) if (i !== fresh) cell(b, i, g.mk[i] + 2 * lit[i]);
  if (fresh >= 0) cell(b, fresh, g.mk[fresh]);           // the newest ball blinks as it lands
}
function topBar(g, b) {
  text(b, 0, 0, g.nmk + (g.nmk === 1 ? " SPOT" : " SPOTS"), 1);
  right(b, 64, 0, "BET " + g.bet, 1);
}
function drawTicket(g, b) {
  topBar(g, b);
  grid(g, b, 0);
  if (g.phase === "mark") {                               // the cursor: a frame, the inside blinking
    const x = GX + (g.cur % 10) * 6, y = GY + div(g.cur, 10) * 5;
    rect(b, x - 1, y - 1, 7, 6);
    if ((g.t >> 3) & 1) { fill(b, x, y, 5, 4, 1 - g.mk[g.cur]); }
  }
  ball(b, g.cur + 1);
  stash(g, b, 23, 51);
  text(b, 23, 58, (g.t >> 5) & 1 ? "B:MENU" : "A:MARK", 1);
  if (g.phase === "menu") {
    fill(b, 9, 9, 46, 38, 0); rect(b, 9, 9, 46, 38);
    for (let i = 0; i < NM; i++) {
      const y = 11 + i * 7, on = i === g.msel, v = on ? 0 : 1;
      if (on) fill(b, 10, y, 44, 7, 1);
      text(b, 12, y + 1, MENU[i], v);
      if (i === 1 || i === 2) {
        const n = "" + (i === 1 ? g.bet : g.qn);
        right(b, 53, y + 1, on ? "<" + n + ">" : n, v);
      }
    }
  }
  if (g.msgT > 0) boxed(b, 23, g.msg);
}
function drawPaytab(g, b) {
  const n = g.ptn;
  centre(b, 0, n + (n === 1 ? " SPOT" : " SPOTS") + " BET " + g.bet);
  if (n > 1) text(b, 0, 0, "<", 1);
  if (n < MAXSPOT) text(b, 61, 0, ">", 1);
  fill(b, 0, 6, 64, 1, 1);
  let y = 8;
  for (let k = n; k >= 0; k--) if (PAY[n][k] > 0) {
    text(b, 2, y, "HIT " + k, 1);
    right(b, 63, y, "" + PAY[n][k] * g.bet, 1);
    y += 6;
  }
  fill(b, 0, 56, 64, 1, 1);
  centre(b, 58, "RETURN " + div(RET[n], 10) + "." + RET[n] % 10 + "%");
}
function drawDraw(g, b) {
  topBar(g, b);
  grid(g, b, g.lit);
  let n = -1;                                             // the ball in the box: the one coming out, then the last
  if (g.bt >= 1 || g.lit > g.bn) n = g.dr[g.bn] + 1;
  ball(b, n);
  text(b, 23, 51, "HITS " + g.hits, 1);
  text(b, 23, 58, "BALL " + (g.bn + 1), 1);
}
function drawPay(g, b) {
  stash(g, b, 0, 0);
  right(b, 64, 0, g.won > 0 ? "WIN " + g.won : "NO WIN", 1);
  grid(g, b, BALLS);
  centre(b, 50, "CAUGHT " + g.hits + " OF " + g.nmk);
  if ((g.t >> 4) & 1) centre(b, 57, "A:AGAIN B:NEW");
  if (g.won > 0 && g.pt < 45) boxed(b, 23, "WIN " + g.won);
}
function titleGrid(g, b) {                                // a ticket that plays itself (no RNG)
  rect(b, 0, 6, 64, 43);
  for (let i = 0; i < 80; i++) {
    const m = (i * 13) % 17 === 3 ? 1 : 0, d = (i * 7 + (g.t >> 2)) % 9 === 0 ? 2 : 0;
    cell(b, i, m + d);
  }
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    titleGrid(g, b);
    fill(b, 13, 19, 38, 16, 0); rect(b, 13, 19, 38, 16); rect(b, 15, 21, 34, 12);
    big(b, 17, 22, "KENO", 1);
    if (g.phase === "broke") { boxed(b, 0, "OUT OF CHIPS"); if ((g.t >> 5) & 1) centre(b, 53, "MORE TOMORROW"); return b; }
    if (g.msgT > 0) boxed(b, 0, g.msg);
    else centre(b, 0, "20 BALLS OF 80");
    if ((g.t >> 4) & 1) centre(b, 53, "A: START");
    return b;
  }
  if (g.phase === "paytab") { drawPaytab(g, b); return b; }
  if (g.phase === "draw") { drawDraw(g, b); return b; }
  if (g.phase === "pay") { drawPay(g, b); return b; }
  drawTicket(g, b);
  return b;
}
