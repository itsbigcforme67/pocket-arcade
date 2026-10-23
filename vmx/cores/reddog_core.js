// RED DOG (acey-deucey) for the VMX's 64x64 1-bit screen: a VMX CASINO card table. Our own art and code.
// Rules (standard casino Red Dog): a 6-deck shoe (312 cards, Fisher-Yates on the seeded RNG), reshuffled between
// hands once fewer than 78 cards are left. Ranks 2 low .. A high; suits don't matter. Bet 1-20 chips; two cards are
// dealt face up.
//  - Consecutive ranks (7-8): push, the stake comes back.
//  - A pair: a third card is dealt; three of a kind pays 11:1, anything else is a push.
//  - Otherwise the SPREAD (ranks strictly between) is shown with its payout: spread 1 pays 5:1, 2 pays 4:1, 3 pays
//    2:1, 4-11 pays 1:1. The player may RAISE (add a second stake equal to the bet, only if the stash covers it) or
//    CALL; the third card then wins at the spread's payout if its rank is strictly between, else the stake is lost.
// House edge with 6 decks (exact enumeration, fresh shoe, per initial bet): 2.80% when raising on spread 7 or more
// (the best play; it is what the demo does), 7.97% never raising. Checked by a small script (Fractions, 24 cards
// of each rank dealt without replacement).
// Payouts are totals returned including the stake: win at n:1 returns (n + 1) x the (possibly raised) bet.
// The cards come straight from the shuffled shoe; the flip animation never changes them.
// Controls: Left/Right bet -1/+1, Up/Down +5/-5 (1-20, never more than the stash), A deals. On a spread:
// Up = RAISE, A = CALL. After a hand, A goes back to the bet screen (the pay table).
// Demo player: random bets within its stash; raises on spread 7 or more when the stash covers it.
// Everything is integer maths (no floats, no sort) so the VMX's C# port in vmx-firmware/games/reddog plays exactly
// the same; keep it that way.
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here); the stake is taken
// when the cards are dealt (and again on a raise) and the payout paid when the hand is judged. Out of chips =
// "OUT OF CHIPS / MORE TOMORROW" until the bank's daily top-up.
// Input: held buttons (edges found here); { auto: true } = the demo player.
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const FONTCH = "ABCDEFGHIJKLMNOPQRSTUVWXY0123456789:!-<>+/^ ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "001001001101010", "101101110101101", "100100100100111",
  "101111111101101", "110101101101101", "010101101101010", "110101110100100", "010101101110011", "110101110101101",
  "011100010001110", "111010010010010", "101101101101111", "101101101101010", "101101111111101", "101101010101101",
  "101101010010010",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "001010100010001", "100010001010100", "000010111010000", "001001010100100", "010111000111010",
  "000000000000000" ];
const SUIT = [                                            // 7x7, bit 6 = left: spade, heart, diamond, club
  [8, 28, 62, 127, 127, 42, 28],
  [54, 73, 65, 65, 34, 20, 8],
  [8, 20, 34, 65, 34, 20, 8],
  [28, 28, 107, 127, 107, 8, 28] ];
const CHIP = [14, 21, 27, 21, 14];                        // 5x5 chip icon
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const ODDS = ["", "5:1", "4:1", "2:1", "1:1"];            // by spread 1, 2, 3, 4+
const ROWS = ["SPREAD 1", "SPREAD 2", "SPREAD 3", "SPREAD 4-11", "PAIR TRIPS", "CONSECUTIVE"];
const RODDS = ["5:1", "4:1", "2:1", "1:1", "11:1", "PUSH"];
const SHOE = 312, CUT = 234;                              // reshuffle once fewer than 78 cards are left
const CY = 10;                                            // the cards' top edge
const CX = [10, 42, 26];                                  // first card, second card, the third slot between them
const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, bet: 5, shoe: Array(SHOE).fill(0), pos: SHOE,
    c: [0, 0, 0], flip: [-1, -1, -1], has3: false, spread: 0, raised: false, res: 0, win: 0, best: 0, last: -1,
    fresh: false, target: 5, msg: "", msgT: 0, auto: false,
    pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 90; }
function toBet(g) {
  if (g.bank.chips < 1) { setPhase(g, "broke"); return; }
  const top = Math.min(20, g.bank.chips);
  g.bet = Math.max(1, Math.min(g.bet, top));
  setPhase(g, "bet");
  if (g.auto) g.target = 1 + rnd(g) % top;
}
export const oddsOf = s => s >= 4 ? 1 : s === 3 ? 2 : s === 2 ? 4 : 5;   // spread 1..11 -> n of n:1

// ---- the game ----------------------------------------------------------------------------------------------------
// Cards are 0..51 (rank c % 13: 0 = 2 .. 12 = ace; suit c / 13); the shoe holds six of each.
// res: 1 consecutive (push), 2 pair no trips (push), 3 trips (11:1), 4 in between (win), 5 outside (lose).
function deal(g) {
  g.bank.chips -= g.bet;
  g.fresh = false;
  if (g.pos > CUT) {
    for (let i = 0; i < SHOE; i++) g.shoe[i] = i % 52;
    for (let i = SHOE - 1; i > 0; i--) { const j = rnd(g) % (i + 1), tt = g.shoe[i]; g.shoe[i] = g.shoe[j]; g.shoe[j] = tt; }
    g.pos = 0; g.fresh = true;
  }
  g.c[0] = g.shoe[g.pos++]; g.c[1] = g.shoe[g.pos++]; g.c[2] = 0;
  g.flip[0] = 2; g.flip[1] = 8; g.flip[2] = -1; g.has3 = false;
  g.raised = false; g.res = 0; g.win = 0;
  const a = g.c[0] % 13, b = g.c[1] % 13;
  g.spread = a > b ? a - b - 1 : b - a - 1;               // -1 = a pair, 0 = consecutive
  setPhase(g, "deal");
}
function third(g, p) {                                    // turn up the third card ("pair" or "third" phase)
  g.c[2] = g.shoe[g.pos++]; g.has3 = true; g.flip[2] = 6;
  setPhase(g, p);
}
function judge(g) {
  const a = g.c[0] % 13, b = g.c[1] % 13, r = g.c[2] % 13;
  if (g.spread === 0) { g.res = 1; g.win = g.bet; }
  else if (g.spread < 0) {
    if (r === a) { g.res = 3; g.win = g.bet * 12; } else { g.res = 2; g.win = g.bet; }
  } else {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    if (r > lo && r < hi) { g.res = 4; g.win = g.bet * (oddsOf(g.spread) + 1); } else { g.res = 5; g.win = 0; }
  }
  g.bank.chips += g.win;
  if ((g.res === 3 || g.res === 4) && g.win > g.best) g.best = g.win;
  g.last = g.res === 1 ? 5 : g.res === 2 ? -1 : g.res === 3 ? 4 : g.res === 4 ? Math.min(g.spread, 4) - 1 : -1;
  setPhase(g, "result");
}

export function step(g, h) {
  g.t++; g.pt++; if (g.msgT > 0) g.msgT--;
  const auto = !!h.auto;
  const up = !auto && !!h.up, down = !auto && !!h.down, left = !auto && !!h.left, right = !auto && !!h.right,
    a = !auto && !!h.a, b = !auto && !!h.b;
  const eUp = up && !g.pUp, eDown = down && !g.pDown, eLeft = left && !g.pLeft, eRight = right && !g.pRight,
    eA = a && !g.pA;
  g.pUp = up; g.pDown = down; g.pLeft = left; g.pRight = right; g.pA = a; g.pB = b;
  g.auto = auto;

  switch (g.phase) {
    case "title":
      if (eA || (auto && g.pt > 40)) toBet(g);
      break;
    case "bet": {
      const top = Math.min(20, g.bank.chips);
      if (auto) {
        if (g.pt % 3 === 0) { if (g.bet < g.target) g.bet++; else if (g.bet > g.target) g.bet--; }
        if (g.pt > 45 && g.bet === g.target) deal(g);
      } else {
        if (eRight) g.bet = Math.min(top, g.bet + 1);
        if (eLeft) g.bet = Math.max(1, g.bet - 1);
        if (eUp) g.bet = Math.min(top, g.bet + 5);
        if (eDown) g.bet = Math.max(1, g.bet - 5);
        if (eA) deal(g);
      }
      break;
    }
    case "deal":
      if (g.pt > 16) {
        if (g.spread === 0) judge(g);
        else if (g.spread < 0) third(g, "pair");
        else setPhase(g, "spread");
      }
      break;
    case "spread": {
      const can = g.bank.chips >= g.bet;
      if (auto) {
        if (g.pt > 40) {
          if (g.spread >= 7 && can) { g.bank.chips -= g.bet; g.bet *= 2; g.raised = true; }
          third(g, "third");
        }
      } else if (eUp && can) { g.bank.chips -= g.bet; g.bet *= 2; g.raised = true; third(g, "third"); }
      else if (eA) third(g, "third");
      break;
    }
    case "pair":
      if (g.pt > 30) judge(g);
      break;
    case "third":
      if (g.pt > 22) judge(g);
      break;
    case "result":
      if ((eA && g.pt > 10) || (auto && g.pt > 75)) {
        if (g.raised) g.bet = g.bet >> 1;                  // back to the bet before the raise
        toBet(g);
      }
      break;
    case "broke":
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
const bigCentre = (b, y, s) => big(b, 32 - ((s.length * 8 - 2) >> 1), y, s);
const right = (b, y, s) => text(b, 64 - s.length * 4, y, s);
function sprite(b, x, y, rows, w, v) {
  for (let r = 0; r < rows.length; r++) for (let q = 0; q < w; q++) if ((rows[r] >> (w - 1 - q)) & 1) px(b, x + q, y + r, v);
}
function card(b, x, y, c, face, w) {                      // 12 x 20; w < 12 = mid-flip (narrowed, plain)
  const x0 = x + ((12 - w) >> 1);
  fill(b, x0, y + 1, w, 18, 1); fill(b, x0 + 1, y, w - 2, 1, 1); fill(b, x0 + 1, y + 19, w - 2, 1, 1);
  if (!face) {
    fill(b, x0 + 1, y + 1, w - 2, 18, 0);
    for (let j = 2; j < 18; j++) for (let i = 2; i < w - 2; i++) if ((i + j) % 4 === 0 || (i - j + 40) % 4 === 0) px(b, x0 + i, y + j, 1);
  }
  if (!face || w < 12) return;
  const r = c % 13;
  if (r === 8) { text(b, x + 1, y + 2, "1", 0); text(b, x + 5, y + 2, "0", 0); } else text(b, x + 2, y + 2, RANKS[r], 0);
  sprite(b, x + 3, y + 10, SUIT[div(c, 13)], 7, 0);
}
function drawCards(g, b) {
  for (let i = 0; i < 3; i++) {
    let face = true, w = 12;
    const anim = i < 2 ? g.phase === "deal" : g.phase === "pair" || g.phase === "third";
    if (i === 2 && !g.has3) face = false;
    else if (anim) {
      const f = g.pt - g.flip[i];
      if (f < 0) face = false;
      else if (f < 2) { face = false; w = f === 0 ? 8 : 4; }
      else if (f < 4) w = f === 2 ? 4 : 8;
    }
    card(b, CX[i], CY, g.c[i], face, w);
  }
}
function drawTop(g, b) {
  sprite(b, 1, 1, CHIP, 5, 1); text(b, 8, 1, "" + g.bank.chips);
  right(b, 1, (g.raised ? "RAISED " : "BET ") + g.bet);
}
function drawTable(g, b) {                                // the bet screen: the pay table, stash, bet
  for (let k = 0; k < 6; k++) {
    const lit = k === g.last, y = 1 + k * 6 + (lit ? 1 : g.last >= 0 && k > g.last ? 2 : 0);   // the lit row gets a margin
    if (lit) fill(b, 0, y - 1, 64, 7, 1);
    text(b, 1, y, ROWS[k], lit ? 0 : 1); text(b, 64 - RODDS[k].length * 4, y, RODDS[k], lit ? 0 : 1);
  }
  for (let x = 0; x < 64; x++) px(b, x, 39);
  text(b, 1, 45, "BET");
  const s = "" + g.bet;
  big(b, 40 - ((s.length * 8 - 2) >> 1), 42, s);
  text(b, 24, 45, "<"); text(b, 53, 45, ">");
  sprite(b, 1, 58, CHIP, 5, 1); text(b, 8, 58, "" + g.bank.chips);
  if ((g.t >> 4) & 1) right(b, 58, "A: DEAL");
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    bigCentre(b, 2, "RED DOG");
    card(b, 10, 16, 3, true, 12); card(b, 26, 16, 0, false, 12); card(b, 42, 16, 37, true, 12);   // 5, back, K
    if (g.phase === "broke") {
      centre(b, 41, "OUT OF CHIPS"); if ((g.t >> 5) & 1) centre(b, 49, "MORE TOMORROW");
      sprite(b, 26, 57, CHIP, 5, 1); text(b, 33, 57, "0");
      return b;
    }
    centre(b, 40, "ACEY-DEUCEY");
    centre(b, 48, g.msgT > 0 ? g.msg : "6 DECK SHOE");
    if ((g.t >> 4) & 1) centre(b, 57, "A: START");
    return b;
  }
  if (g.phase === "bet") { drawTable(g, b); return b; }
  drawTop(g, b);
  drawCards(g, b);
  const p = g.phase;
  if (p === "deal") {
    if (g.fresh) centre(b, 36, "NEW SHOE");
  } else if (p === "spread" || p === "third") {
    centre(b, 34, "SPREAD " + g.spread + " PAYS");
    bigCentre(b, 41, ODDS[Math.min(g.spread, 4)]);
    if (p === "spread" && !g.auto) centre(b, 57, g.bank.chips >= g.bet ? "^ RAISE  A CALL" : "A: CALL");
  } else if (p === "pair") {
    centre(b, 34, "PAIR: TRIPS PAY");
    bigCentre(b, 41, "11:1");
  } else if (p === "result") {
    const label = ["", "CONSECUTIVE", "NO TRIPS", "THREE OF A KIND", "IN BETWEEN", "OUTSIDE"][g.res];
    centre(b, 34, label);
    const big3 = g.res === 1 || g.res === 2 ? "PUSH" : g.res === 5 ? "LOSE" : "WIN " + g.win;
    if (g.res < 3 || g.res === 5 || g.pt > 30 || ((g.pt >> 2) & 1) === 0) bigCentre(b, 41, big3);
    if (!g.auto && (g.t >> 4) & 1) centre(b, 57, "A: NEXT");
  }
  return b;
}
