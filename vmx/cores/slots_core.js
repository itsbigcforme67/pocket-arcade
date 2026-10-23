// SLOTS for the VMX's 64x64 1-bit screen: a 3-reel, 1-line mechanical-style slot machine. Our own art and code
// (generic symbols: cherry, lemon, bell, BAR, double bar, seven and the VMX chip; no real machine's layout).
// VMX CASINO's fast, risky table. Bet 1-3 chips a spin (Up/Down, never more than the stash), A pulls the lever.
// The reels stop left to right; A while they spin stops the next reel early, but the result was drawn when the
// lever was pulled (one rnd() per reel: a uniformly random stop on its 24-stop strip), so stopping early only
// shortens the wait - it never changes the odds. B shows the pay table (two pages).
// Reel strips (24 stops each; what you see is what is weighted, like a real reel):
//   reel 1: 6 blank, 4 cherry, 4 lemon, 4 bell, 3 BAR, 1 double bar, 1 seven, 1 chip
//   reel 2: 6 blank, 3 cherry, 4 lemon, 4 bell, 3 BAR, 2 double bar, 1 seven, 1 chip
//   reel 3: 6 blank, 2 cherry, 5 lemon, 4 bell, 3 BAR, 2 double bar, 1 seven, 1 chip
// Pays on the middle line, per chip bet, stake included (a "2" gives back twice what you bet):
//   chip chip chip 800 (3000 flat at a 3-chip bet: the jackpot, 1 in 13824)   seven x3 150
//   double bar x3 80   BAR x3 40   cherry x3 30   bell x3 20   lemon x3 15   any 3 bars mixed 10
//   cherry cherry on reels 1-2: 10   cherry on reel 1: 2
// Exact figures from all 13824 stop combinations (tools: payOf() and STRIPS are exported for checking):
//   hit rate 18.45% (1 in 5.42 spins pays something); return 93.40% at 1-2 chips (house edge 6.60%),
//   94.85% at 3 chips (house edge 5.15%: the bigger jackpot).
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here); the stake leaves the
// bank when the lever is pulled, a win comes back stake included. Broke (no chips) = OUT OF CHIPS until tomorrow.
// Integer maths only, so the VMX's C# port (vmx-firmware/games/slots/Slots.cs) plays exactly the same.
// Input: held buttons (edges found here); { auto: true } = the demo player. Pure logic + drawing, seeded, 30 Hz.

export const W = 64, H = 64;
const N = 24, P = 13, L = N * P;                          // stops per reel, pixel pitch of a stop, strip length
export const STRIPS = [
  [7, 1, 2, 0, 3, 1, 4, 2, 0, 6, 3, 1, 0, 2, 4, 3, 0, 5, 1, 2, 0, 3, 4, 0],
  [7, 2, 0, 4, 1, 3, 0, 5, 2, 3, 0, 6, 4, 1, 0, 2, 3, 5, 0, 4, 1, 2, 3, 0],
  [7, 3, 0, 2, 4, 0, 2, 1, 3, 0, 5, 2, 4, 0, 3, 2, 6, 0, 4, 5, 1, 3, 2, 0] ];
// 0 blank, 1 cherry, 2 lemon, 3 bell, 4 BAR, 5 double bar, 6 seven, 7 chip (jackpot)
const TRIPLE = [0, 30, 15, 20, 40, 80, 150, 800];
const ART = [
  [ "...........", "...........", "...........", "...........", "...........", "...........", "...........", "...........", "...........", "...........", "..........." ],
  [ ".......##..", ".....##.#..", "....#...#..", "...#....#..", "..#.....#..", ".###...###.", "#.###.#.###", "#####.#####", "#####.#####", ".###...###.", "..........." ],
  [ "...........", "....####...", "..#######..", ".##.######.", "#.#########", "###########", "#########.#", ".#########.", "..#######..", "...####....", "..........." ],
  [ ".....#.....", "....###....", "...#####...", "..##.####..", "..##.####..", "..#######..", ".#########.", ".#########.", "###########", "....###....", "..........." ],
  [ "...........", "...........", "###########", "..###.##..#", ".#.#.#.#.#.", "..##...#..#", ".#.#.#.#.#.", "..##.#.#.#.", "###########", "...........", "..........." ],
  [ "...........", ".#########.", "###########", "###########", ".#########.", "...........", ".#########.", "###########", "###########", ".#########.", "..........." ],
  [ "###########", "###########", "#.......##.", ".......##..", "......##...", ".....###...", "....###....", "....###....", "...###.....", "...###.....", "...###....." ],
  [ "...#####...", ".#########.", ".##.###.##.", "###..#..###", "####...####", "#####.#####", "####...####", "###..#..###", ".##.###.##.", ".#########.", "...#####..." ] ];
const FONTCH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:!-<>+/ ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "001001001101010", "101101110101101", "100100100100111",
  "101111111101101", "110101101101101", "010101101101010", "110101110100100", "010101101110011", "110101110101101",
  "011100010001110", "111010010010010", "101101101101111", "101101101101010", "101101111111101", "101101010101101",
  "101101010010010", "111001010100111",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "001010100010001", "100010001010100", "000010111010000", "001001010100100", "000000000000000" ];
const RX = [6, 20, 34];                                   // reel columns (13 wide), window x 5..47
const WY0 = 10, WY1 = 42, MID = 21;                       // window rows, top of the middle-line symbol

const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function payOf(a, b, c, bet) {                     // what a line pays back, stake included
  if (a === b && b === c && a !== 0) return a === 7 && bet === 3 ? 3000 : TRIPLE[a] * bet;
  if ((a === 4 || a === 5) && (b === 4 || b === 5) && (c === 4 || c === 5)) return 10 * bet;
  if (a === 1 && b === 1) return 10 * bet;
  if (a === 1) return 2 * bet;
  return 0;
}

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, page: 0, bet: 1,
    pos: [0, 0, 0], mode: [0, 0, 0], stop: [0, 0, 0], at: [0, 0, 0], win: 0, winT: 0, big: 0, lt: -1, spins: 0,
    msg: "", msgT: 0, dBet: 1, dStop: 0, dPay: -1,
    pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  for (let i = 0; i < 3; i++) { g.stop[i] = rnd(g) % N; g.pos[i] = g.stop[i] * P; }
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function say(g, m) { g.msg = m; g.msgT = 90; }
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function toBet(g) {
  if (g.bank.chips < 1) { setPhase(g, "broke"); return; }
  g.bet = Math.max(1, Math.min(g.bet, g.bank.chips, 3)); setPhase(g, "bet");
}
function pull(g) {                                        // the stake goes in and the result is drawn, here and now
  g.bank.chips -= g.bet; g.spins++;
  for (let i = 0; i < 3; i++) { g.stop[i] = rnd(g) % N; g.mode[i] = 1; g.at[i] = 22 + i * 9; }
  g.win = 0; g.winT = 0; g.big = 0; g.lt = 0; setPhase(g, "spin");
}
function land(g, i) {                                     // a spinning reel jumps (in the blur) 5 stops short, slows in
  g.mode[i] = 2; g.pos[i] = (g.stop[i] * P - 5 * P + L) % L;
}

export function step(g, h) {
  g.t++; g.pt++; if (g.msgT > 0) g.msgT--; if (g.winT > 0) g.winT--;
  if (g.lt >= 0) { g.lt++; if (g.lt > 14) g.lt = -1; }
  const auto = !!h.auto;
  const up = !auto && !!h.up, down = !auto && !!h.down, a = !auto && !!h.a, b = !auto && !!h.b;
  let eUp = up && !g.pUp, eDown = down && !g.pDown, eA = a && !g.pA, eB = b && !g.pB;
  g.pUp = up; g.pDown = down; g.pA = a; g.pB = b; g.pLeft = !auto && !!h.left; g.pRight = !auto && !!h.right;

  if (auto) {                                             // the demo player: random bets within its stash
    if (g.page > 0) { if (g.pt % 45 === 0) eB = true; }
    else if (g.phase === "bet") {
      if (g.pt === 12) {
        g.dBet = 1 + rnd(g) % Math.min(3, g.bank.chips);
        if (g.spins % 12 === 3 && g.dPay !== g.spins) { g.dPay = g.spins; g.page = 1; g.pt = 0; return; }
      }
      if (g.pt > 12 && g.pt % 6 === 0) { if (g.bet < g.dBet) eUp = true; else if (g.bet > g.dBet) eDown = true; else if (g.pt > 30 && g.winT === 0) eA = true; }
    } else if (g.phase === "spin") {
      if (g.pt === 1) g.dStop = rnd(g) % 3;               // 0: let them run; else tap A to stop them early
      if (g.dStop > 0 && g.pt > 8 && g.pt % (4 + g.dStop * 3) === 0) eA = true;
    }
  }

  if (g.page > 0) {                                       // the pay table: B next page, A back, Up/Down the bet
    if (eB) g.page = g.page === 2 ? 0 : 2;
    if (eA) g.page = 0;
    if (g.phase === "bet") {
      if (eUp) g.bet = Math.min(g.bet + 1, Math.min(3, g.bank.chips));
      if (eDown) g.bet = Math.max(1, g.bet - 1);
    }
    if (g.page === 0) g.pt = 0;
    return;
  }

  switch (g.phase) {
    case "title":
      if (eA || (auto && g.pt > 40)) toBet(g);
      else if (eB) g.page = 1;
      break;
    case "bet":
      if (eUp) g.bet = Math.min(g.bet + 1, Math.min(3, g.bank.chips));
      if (eDown) g.bet = Math.max(1, g.bet - 1);
      if (eA) pull(g);
      else if (eB) g.page = 1;
      break;
    case "spin": {
      if (eA && g.pt > 4) {                               // stop the next reel now (the result is already set)
        for (let i = 0; i < 3; i++) if (g.mode[i] === 1) { if (i === 0 || g.mode[i - 1] !== 1) land(g, i); break; }
      }
      let all = true;
      for (let i = 0; i < 3; i++) {
        if (g.mode[i] === 1) {
          g.pos[i] = (g.pos[i] + 9) % L;
          if (g.pt >= g.at[i] && (i === 0 || g.mode[i - 1] !== 1)) land(g, i);
        } else if (g.mode[i] === 2) {
          const d = (g.stop[i] * P - g.pos[i] + L) % L, v = Math.max(1, Math.min(9, div(d + 2, 3)));
          g.pos[i] = (g.pos[i] + Math.min(d, v)) % L;
          if (g.pos[i] === g.stop[i] * P) g.mode[i] = 0;
        }
        if (g.mode[i] !== 0) all = false;
      }
      if (all) {
        const s0 = STRIPS[0][g.stop[0]], s1 = STRIPS[1][g.stop[1]], s2 = STRIPS[2][g.stop[2]];
        g.win = payOf(s0, s1, s2, g.bet);
        if (g.win > 0) {
          g.bank.chips += g.win;
          g.big = s0 === s1 && s1 === s2 && s0 >= 6 ? 2 : g.win >= 20 * g.bet ? 1 : 0;
          g.winT = g.big === 2 ? 120 : g.big === 1 ? 75 : 40;
          if (s0 === 7 && s1 === 7 && s2 === 7) say(g, "JACKPOT!"); else if (g.big === 2) say(g, "BIG WIN!");
        }
        toBet(g);
      }
      break;
    }
  }
}
export function demo(g) { return { auto: true }; }

// ---- drawing -----------------------------------------------------------------------------------------------------
function px(b, x, y, v) { if (x >= 0 && x < 64 && y >= 0 && y < 64) b[y * 64 + x] = v; }
function fill(b, x, y, w, h, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(b, i, j, v); }
function box(b, x, y, w, h) { fill(b, x, y, w, 1, 1); fill(b, x, y + h - 1, w, 1, 1); fill(b, x, y, 1, h, 1); fill(b, x + w - 1, y, 1, h, 1); }
function text(b, x, y, s, v) {
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
const tw = s => s.length * 4 - 1;
const centre = (b, y, s) => text(b, 32 - (tw(s) >> 1), y, s, 1);
function sym(b, k, x, y, y0, y1, inv) {                   // an 11x11 symbol, rows clipped to y0..y1 (inv: dark)
  const a = ART[k];
  for (let r = 0; r < 11; r++) {
    const yy = y + r; if (yy < y0 || yy > y1) continue;
    for (let q = 0; q < 11; q++) if (a[r][q] === "#") px(b, x + q, yy, inv ? 0 : 1);
  }
}
function drawReels(g, b) {
  box(b, 3, 7, 47, 38); box(b, 5, 9, 43, 35);             // cabinet + window
  const chase = g.winT > 0 ? (g.t >> 1) % 3 : -1;         // the lights round the window
  for (let n = 0, x = 4, y = 8; n < 160; n++) {
    if (chase < 0 ? n % 4 === 0 : n % 3 === chase) px(b, x, y, 1);
    if (y === 8 && x < 48) x++; else if (x === 48 && y < 44) y++; else if (y === 44 && x > 4) x--; else y--;
  }
  fill(b, 19, 10, 1, 33, 1); fill(b, 33, 10, 1, 33, 1);   // reel dividers
  const flash = g.winT > 0 && g.phase === "bet" && ((g.t >> 2) & 1) === 1;
  for (let i = 0; i < 3; i++) {
    const base = div(g.pos[i], P), frac = g.pos[i] % P;
    for (let k = -2; k <= 2; k++) {
      const s = ((base + k) % N + N) % N, y = MID + frac - k * P;
      const onLine = k === 0 && frac === 0 && flash;
      if (onLine) fill(b, RX[i], MID - 1, 13, 13, 1);
      sym(b, STRIPS[i][s], RX[i] + 1, y, WY0, WY1, onLine);
    }
  }
  // the payline: arrows outside the window and ticks on the dividers
  for (let d = 0; d < 3; d++) { fill(b, 2 - d, 26 - d, 1, d * 2 + 1, 1); fill(b, 50 + d, 26 - d, 1, d * 2 + 1, 1); }
  px(b, 19, 26, 0); px(b, 33, 26, 0);
}
function drawLever(g, b) {
  let off = 0;                                            // the knob comes down and springs back
  if (g.lt >= 0) off = g.lt < 6 ? g.lt * 4 : Math.max(0, 24 - (g.lt - 6) * 3);
  fill(b, 55, 34, 7, 11, 1); fill(b, 56, 35, 5, 9, 0); fill(b, 57, 38, 3, 3, 1);   // the housing and pivot
  const ky = 6 + off;
  fill(b, 58, ky + 4, 1, 33 - ky, 1);
  fill(b, 57, ky, 3, 5, 1); fill(b, 56, ky + 1, 5, 3, 1); px(b, 57, ky + 1, 0);
}
function drawPays(g, b) {
  const p2 = g.page === 2, bet = g.phase === "bet" ? g.bet : 1;
  const rows = p2 ? [[3, 3, 3], [2, 2, 2], [4, 5, 4], [1, 1, 0], [1, 0, 0]] : [[7, 7, 7], [6, 6, 6], [5, 5, 5], [4, 4, 4], [1, 1, 1]];
  const pays = p2 ? [20, 15, 10, 10, 2] : [800, 150, 80, 40, 30];
  text(b, 1, 1, "PAYS " + (p2 ? "2" : "1"), 1);
  const hd = "BET " + bet; text(b, 64 - tw(hd), 1, hd, 1);
  fill(b, 0, 7, 64, 1, 1);
  for (let r = 0; r < 5; r++) {
    const y = 9 + r * 11;
    for (let c = 0; c < 3; c++) {
      if (rows[r][c] === 0) { fill(b, 2 + c * 12 + 3, y + 5, 5, 1, 1); continue; }   // any symbol
      sym(b, rows[r][c], 1 + c * 12, y, 0, 63, false);
    }
    if (r === 2 && p2) text(b, 38, y + 3, "ANY", 1);
    const v = !p2 && r === 0 && bet === 3 ? 3000 : pays[r] * bet, s = "" + v;
    text(b, 64 - tw(s), y + 3, s, 1);
  }
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.page > 0) { drawPays(g, b); return b; }
  if (g.phase === "title") {
    big(b, 13, 3, "SLOTS");
    for (let i = 0; i < 3; i++) sym(b, [6, 7, 6][i], 13 + i * 14, 20, 0, 63, false);
    box(b, 11, 18, 43, 15);
    centre(b, 38, g.msgT > 0 ? g.msg : "1 TO 3 CHIPS");
    centre(b, 46, "B: PAYS");
    if ((g.t >> 4) & 1) centre(b, 56, "A: START");
    return b;
  }
  drawReels(g, b); drawLever(g, b);
  text(b, 1, 1, "CHIPS " + g.bank.chips, 1);
  text(b, 1, 48, "BET " + g.bet, 1);
  if (g.win > 0 && g.phase === "bet") {
    const s = "WIN " + g.win, x = 64 - tw(s) - 1;
    if (g.winT > 0 && ((g.t >> 2) & 1) === 1) { fill(b, x - 2, 46, tw(s) + 4, 9, 1); text(b, x, 48, s, 0); }
    else text(b, x, 48, s, 1);
  }
  let hint = "";
  if (g.msgT > 0) hint = g.msg;
  else if (g.phase === "spin") hint = (g.t >> 3) & 1 ? "A: STOP" : "";
  else if (g.phase === "bet") { const k = (g.t >> 5) % 3; hint = k === 0 ? "A: SPIN" : k === 1 ? "UP DOWN: BET" : "B: PAYS"; }
  if (hint) centre(b, 57, hint);
  if (g.phase === "broke") {
    fill(b, 6, 18, 41, 17, 0); box(b, 6, 18, 41, 17);
    text(b, 26 - (tw("OUT OF") >> 1), 21, "OUT OF", 1); text(b, 26 - (tw("CHIPS") >> 1), 28, "CHIPS", 1);
    fill(b, 0, 56, 64, 7, 0); if ((g.t >> 5) & 1) centre(b, 57, "MORE TOMORROW"); else centre(b, 57, "COME BACK");
  }
  if (g.big === 2 && g.winT > 90 && ((g.t >> 2) & 1) === 1) for (let i = 0; i < 4096; i++) b[i] ^= 1;   // jackpot flash
  return b;
}
