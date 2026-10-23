// BACCARAT for the VMX's 64x64 1-bit screen: Punto Banco from an 8-deck shoe, a VMX CASINO table. Our own art and
// code; the cards are VIDEO POKER's (12x20, 3x5 rank + 7x7 suit, the same flip) so the casino reads as one family.
// Rules: 8 decks (416 cards) shuffled with Fisher-Yates on the seeded RNG; between hands, once fewer than 14 cards are
// left (the cut card), the shoe is reshuffled ("NEW SHOE"). A = 1, 2-9 face value, 10/J/Q/K = 0; a hand is worth its
// sum mod 10. PLAYER and BANKER get two cards each (P, B, P, B). A natural (8 or 9 on either side) stands both hands.
// Otherwise PLAYER draws on 0-5 and stands on 6-7; then BANKER: if PLAYER stood, BANKER draws on 0-5; if PLAYER drew
// a third card worth p3, BANKER draws on 0-2, on 3 unless p3 = 8, on 4 if p3 is 2-7, on 5 if p3 is 4-7, on 6 if p3 is
// 6-7, and stands on 7. Higher total wins; equal is a tie.
// Bets: 0-20 chips each on PLAYER, BANKER and TIE, any combination, at least 1 in all, total never over the stash.
//   PLAYER pays 1:1. BANKER pays 1:1 less a 5% commission. TIE pays 8:1. PLAYER and BANKER bets push on a tie.
//   Commission: 5% of the stake is charged on every winning BANKER bet, in whole chips rounded UP; the part of a chip
//   overpaid is kept as credit (g.credit, in hundredths) toward later commissions in this sitting, and lost when the
//   game is left - so the house keeps the fractions and never charges less than 5%. (Rounding up each hand without
//   the credit would charge a 1-chip bet 100% commission.)
// House edge, 8 decks, exact (enumerated over every deal; P(player) 0.446247, P(banker) 0.458597, P(tie) 0.095156):
//   PLAYER 1.2351%, BANKER 1.0579% (in the long run; slightly more if you leave with credit unspent), TIE 14.3596%.
// The cards come straight from the shoe; the deal animation never changes them.
// Controls: Up/Down choose the PLAYER / BANKER / TIE row, Left/Right lower / raise its stake (hold to repeat), A deals,
// B clears every stake. After a hand A goes back to the bets, which stay on (cut down if the stash shrank).
// Demo player: bets BANKER (half the time) or PLAYER with 1-10 chips, and 1 in 6 hands adds a 1-2 chip TIE bet.
// Everything is integer maths (div() for /, no floats, no sort) so the VMX's C# port in vmx-firmware/games/baccarat
// plays exactly the same; keep it that way.
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here); the stakes are taken
// when the cards are dealt and the returns paid when the hand is judged. Out of chips = "OUT OF CHIPS / MORE
// TOMORROW" until the bank's daily top-up.
// Input: held buttons (edges found here); { auto: true } = the demo player.
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const FONTCH = "ABCDEFGHIJKLMNOPQRSTUVWXY0123456789:!-<>+/^. ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "001001001101010", "101101110101101", "100100100100111",
  "101111111101101", "110101101101101", "010101101101010", "110101110100100", "010101101110011", "110101110101101",
  "011100010001110", "111010010010010", "101101101101111", "101101101101010", "101101111111101", "101101010101101",
  "101101010010010",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "001010100010001", "100010001010100", "000010111010000", "001001010100100", "010111000111010",
  "000000000000010", "000000000000000" ];
const SUIT = [                                            // 7x7, bit 6 = left: spade, heart, diamond, club
  [8, 28, 62, 127, 127, 42, 28],
  [54, 73, 65, 65, 34, 20, 8],
  [8, 20, 34, 65, 34, 20, 8],
  [28, 28, 107, 127, 107, 8, 28] ];
const CHIP = [14, 21, 27, 21, 14];                        // 5x5 chip icon
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SIDES = ["PLAYER", "BANKER", "TIE"], ODDS = ["1:1", ".95", "8:1"], LET = ["P", "B", "T"];
const NCARDS = 416, CUT = 14, MAXBET = 20, ROADN = 12;
const PY = 7, BY = 29;                                    // the PLAYER and BANKER card rows' top edges
const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, shoe: Array(NCARDS).fill(0), pos: 0,
    stake: [0, 5, 0], tgt: [0, 0, 0], cur: 1, hand: Array(6).fill(0), at: Array(6).fill(-1), endT: 0,
    ptot: 0, btot: 0, winner: 0, net: [0, 0, 0], win: 0, best: 0, credit: 0, road: Array(ROADN).fill(0), nroad: 0,
    last: "", hands: 0, msg: "", msgT: 0, auto: false, hL: 0, hR: 0,
    pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  shuffle(g);
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 90; }
export function value(c) { const r = c % 13; return r < 8 ? r + 2 : r === 12 ? 1 : 0; }
function shuffle(g) {
  for (let i = 0; i < NCARDS; i++) g.shoe[i] = i % 52;
  for (let i = NCARDS - 1; i > 0; i--) { const j = rnd(g) % (i + 1), tt = g.shoe[i]; g.shoe[i] = g.shoe[j]; g.shoe[j] = tt; }
  g.pos = 0;
}
const total = g => g.stake[0] + g.stake[1] + g.stake[2];
function toBet(g) {
  if (g.bank.chips < 1) { setPhase(g, "broke"); return; }
  if (NCARDS - g.pos < CUT) { shuffle(g); say(g, "NEW SHOE"); }
  for (let k = 2; k >= 0; k--) {                          // the bets stay on, cut down (TIE first) to fit the stash
    const over = total(g) - g.bank.chips;
    if (over > 0) g.stake[k] -= Math.min(over, g.stake[k]);
  }
  setPhase(g, "bet");
  if (g.auto) {
    const main = rnd(g) % 2 === 0 ? 1 : 0;
    g.tgt[0] = 0; g.tgt[1] = 0; g.tgt[2] = 0;
    g.tgt[main] = Math.min(1 + rnd(g) % 10, g.bank.chips);
    if (rnd(g) % 6 === 0) g.tgt[2] = Math.min(1 + rnd(g) % 2, g.bank.chips - g.tgt[main]);
  }
}
// BANKER's third-card rule: b = its two-card total, p3 = the value of PLAYER's third card, or -1 if PLAYER stood.
export function bankerDraws(b, p3) {
  if (p3 < 0) return b <= 5;
  if (b <= 2) return true;
  if (b === 3) return p3 !== 8;
  if (b === 4) return p3 >= 2 && p3 <= 7;
  if (b === 5) return p3 >= 4 && p3 <= 7;
  if (b === 6) return p3 >= 6 && p3 <= 7;
  return false;
}

// ---- the game ----------------------------------------------------------------------------------------------------
// hand[0..2] = PLAYER's cards, hand[3..5] = BANKER's; at[i] = the tick (of this phase) card i is laid face down, or -1.
function deal(g) {
  g.bank.chips -= total(g);
  for (let i = 0; i < 6; i++) g.at[i] = -1;
  g.hand[0] = g.shoe[g.pos++]; g.hand[3] = g.shoe[g.pos++]; g.hand[1] = g.shoe[g.pos++]; g.hand[4] = g.shoe[g.pos++];
  g.at[0] = 4; g.at[3] = 19; g.at[1] = 34; g.at[4] = 49;
  let p = (value(g.hand[0]) + value(g.hand[1])) % 10, b = (value(g.hand[3]) + value(g.hand[4])) % 10, tEnd = 49;
  if (p < 8 && b < 8) {
    let p3 = -1;
    if (p <= 5) { g.hand[2] = g.shoe[g.pos++]; p3 = value(g.hand[2]); p = (p + p3) % 10; tEnd += 24; g.at[2] = tEnd; }
    if (bankerDraws(b, p3)) { g.hand[5] = g.shoe[g.pos++]; b = (b + value(g.hand[5])) % 10; tEnd += p3 < 0 ? 24 : 15; g.at[5] = tEnd; }
  }
  g.ptot = p; g.btot = b; g.endT = tEnd + 16;
  g.winner = p > b ? 0 : b > p ? 1 : 2;
  setPhase(g, "deal");
}
function judge(g) {
  const s = g.stake, w = g.winner;
  let back = 0;
  for (let k = 0; k < 3; k++) g.net[k] = -s[k];
  if (w === 2) { g.net[0] = 0; g.net[1] = 0; g.net[2] = 8 * s[2]; back = s[0] + s[1] + 9 * s[2]; }
  else if (w === 0) { g.net[0] = s[0]; back = 2 * s[0]; }
  else if (s[1] > 0) {
    const need = 5 * s[1]; let comm = 0;                  // 5% in hundredths, against the prepaid credit
    if (need <= g.credit) g.credit -= need;
    else { comm = div(need - g.credit + 99, 100); g.credit += comm * 100 - need; }
    g.net[1] = s[1] - comm; back = 2 * s[1] - comm;
  }
  g.win = back; g.bank.chips += back; g.hands++;
  if (g.nroad === ROADN) { for (let i = 1; i < ROADN; i++) g.road[i - 1] = g.road[i]; g.nroad--; }
  g.road[g.nroad++] = w;
  g.last = resultText(g);
  if (back > g.best) g.best = back;
  setPhase(g, "result");
}
function resultText(g) {
  const hi = g.winner === 1 ? g.btot : g.ptot, lo = g.winner === 1 ? g.ptot : g.btot;
  if (g.winner === 2) return "TIE " + hi + "-" + lo;
  return SIDES[g.winner] + " WINS " + hi + "-" + lo;
}
function netText(g, push) {                               // each bet's win / loss: "P-5 B+4 T-1", "P PUSH T+8"
  let s = "";
  for (let k = 0; k < 3; k++) {
    if (g.stake[k] === 0) continue;
    if (s.length > 0) s += " ";
    if (push && g.net[k] === 0) s += LET[k] + " PUSH";
    else s += LET[k] + (g.net[k] >= 0 ? "+" : "") + g.net[k];
  }
  if (push && s.length > 16) return netText(g, false);
  return s;
}
function betText(g) {                                     // the stakes on the table: "BET P5 T1"
  let s = "BET";
  for (let k = 0; k < 3; k++) if (g.stake[k] > 0) s += " " + LET[k] + g.stake[k];
  return s;
}
function adjust(g, d) {
  const k = g.cur;
  if (d > 0) { if (g.stake[k] < MAXBET && total(g) < g.bank.chips) g.stake[k]++; }
  else if (g.stake[k] > 0) g.stake[k]--;
}

export function step(g, h) {
  g.t++; g.pt++; if (g.msgT > 0) g.msgT--;
  const auto = !!h.auto;
  const up = !auto && !!h.up, down = !auto && !!h.down, left = !auto && !!h.left, right = !auto && !!h.right,
    a = !auto && !!h.a, b = !auto && !!h.b;
  const eUp = up && !g.pUp, eDown = down && !g.pDown, eA = a && !g.pA, eB = b && !g.pB;
  g.hL = left ? g.hL + 1 : 0; g.hR = right ? g.hR + 1 : 0;
  const rL = g.hL === 1 || (g.hL > 12 && g.hL % 3 === 0), rR = g.hR === 1 || (g.hR > 12 && g.hR % 3 === 0);
  g.pUp = up; g.pDown = down; g.pLeft = left; g.pRight = right; g.pA = a; g.pB = b;
  g.auto = auto;

  switch (g.phase) {
    case "title":
      if (eA || (auto && g.pt > 40)) toBet(g);
      break;
    case "bet":
      if (auto) {
        if (g.pt % 4 === 0) {
          let want = -1;
          for (let k = 0; k < 3 && want < 0; k++) if (g.stake[k] > g.tgt[k]) want = k;
          for (let k = 0; k < 3 && want < 0; k++) if (g.stake[k] < g.tgt[k]) want = k;
          if (want < 0) { if (g.pt > 30) deal(g); }
          else if (g.cur !== want) g.cur += g.cur < want ? 1 : -1;
          else adjust(g, g.stake[want] < g.tgt[want] ? 1 : -1);
        }
      } else {
        if (eUp) g.cur = (g.cur + 2) % 3;
        if (eDown) g.cur = (g.cur + 1) % 3;
        if (rL) adjust(g, -1);
        if (rR) adjust(g, 1);
        if (eB) { g.stake[0] = 0; g.stake[1] = 0; g.stake[2] = 0; }
        if (eA) { if (total(g) > 0) deal(g); else say(g, "PLACE A BET"); }
      }
      break;
    case "deal":
      if (g.pt >= g.endT) judge(g);
      break;
    case "result":
      if ((eA && g.pt > 10) || (auto && g.pt > 75)) toBet(g);
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
function big(b, x, y, s, v = 1) {
  for (let n = 0; n < s.length; n++) {
    let f = FONTCH.indexOf(s[n]); if (f < 0) f = FONTCH.length - 1;
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (FONT[f][r * 3 + q] === "1") fill(b, x + q * 2, y + r * 2, 2, 2, v);
    x += 8;
  }
}
const centre = (b, y, s) => text(b, 32 - ((s.length * 4 - 1) >> 1), y, s);
const right = (b, y, s) => text(b, 64 - s.length * 4, y, s);
function sprite(b, x, y, rows, w, v) {
  for (let r = 0; r < rows.length; r++) for (let q = 0; q < w; q++) if ((rows[r] >> (w - 1 - q)) & 1) px(b, x + q, y + r, v);
}
function card(b, x, y, c, face, w) {                      // VIDEO POKER's card: 12 x 20; w < 12 = mid-flip (narrowed, plain)
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
function drawSide(g, b, side, y) {                        // three card slots, the side's name and its running total
  let tot = 0, shown = 0;
  for (let i = 0; i < 3; i++) {
    const k = side * 3 + i;
    if (g.at[k] < 0) continue;
    let f = g.pt - g.at[k];
    if (g.phase !== "deal") f = 99;
    if (f < 0) continue;
    let face = f >= 8, w = 12;
    if (f === 6 || f === 9) w = 8; else if (f === 7 || f === 8) w = 4;
    card(b, i * 13, y, g.hand[k], face, w);
    if (face) { tot += value(g.hand[k]); shown++; }
  }
  const lit = g.phase === "result" && (g.winner === side || g.winner === 2);
  if (lit) fill(b, 40, y, 24, 7, 1);
  text(b, 41, y + 1, SIDES[side], lit ? 0 : 1);
  if (shown > 0) big(b, 49, y + 9, "" + tot % 10);
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    big(b, 0, 2, "BACCARAT");
    card(b, 6, 15, 7, true, 12); card(b, 19, 15, 24, true, 12);       // 9 of spades + K of hearts: a natural
    card(b, 33, 15, 44, true, 12); card(b, 46, 15, 32, true, 12);     // 7 of clubs + 8 of diamonds
    if (g.phase === "broke") {
      centre(b, 40, "OUT OF CHIPS"); if ((g.t >> 5) & 1) centre(b, 48, "MORE TOMORROW");
      sprite(b, 23, 57, CHIP, 5, 1); text(b, 30, 57, "0");
      return b;
    }
    centre(b, 38, "PUNTO BANCO");
    centre(b, 46, g.msgT > 0 ? g.msg : "8 DECK SHOE");
    if ((g.t >> 4) & 1) centre(b, 56, "A: START");
    return b;
  }
  sprite(b, 1, 1, CHIP, 5, 1); text(b, 8, 1, "" + g.bank.chips);
  right(b, 1, g.phase === "result" && !g.auto && (g.t >> 4) & 1 ? "A: NEXT" : "BET " + total(g));
  if (g.phase === "bet") {
    for (let k = 0; k < 3; k++) {
      const y = 9 + k * 9, lit = k === g.cur, s = "" + g.stake[k];
      if (lit) fill(b, 0, y, 64, 9, 1);
      text(b, 2, y + 2, SIDES[k], lit ? 0 : 1); text(b, 29, y + 2, ODDS[k], lit ? 0 : 1);
      text(b, 55 - s.length * 2, y + 2, s, lit ? 0 : 1);
      if (lit) { text(b, 44, y + 2, "<", 0); text(b, 60, y + 2, ">", 0); }
    }
    for (let i = 0; i < g.nroad; i++) {                   // the road: the last results, newest on the right
      const x = 64 - (g.nroad - i) * 5, w = g.road[i];
      if (w === 2) { fill(b, x - 1, 38, 5, 7, 1); text(b, x, 39, "T", 0); } else text(b, x, 39, LET[w]);
    }
    centre(b, 47, g.msgT > 0 ? g.msg : g.last);
    for (let x = 0; x < 64; x++) px(b, x, 54);
    centre(b, 58, (g.t >> 5) & 1 ? "A DEAL  B CLEAR" : "^ PICK  <> BET");
    return b;
  }
  drawSide(g, b, 0, PY);
  drawSide(g, b, 1, BY);
  if (g.phase === "deal") centre(b, 52, betText(g));
  else {
    if (g.pt > 24 || ((g.pt >> 2) & 1) === 0) centre(b, 51, g.last);
    centre(b, 58, netText(g, true));
  }
  return b;
}
