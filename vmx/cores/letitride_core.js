// LET IT RIDE for the VMX's 64x64 1-bit screen: a VMX CASINO card table. Our own art and code.
// Rules (standard Let It Ride): one 52-card deck, shuffled fresh every hand (Fisher-Yates on the seeded RNG). The
// player puts up THREE equal bets (1-10 chips each; the three together never more than the stash) and gets 3 cards;
// 2 community cards are dealt face down. After seeing the 3 cards the player may PULL BACK bet 1 (it comes back) or
// LET IT RIDE; the first community card is turned; the player may pull back bet 2 or let it ride (bet 3 always
// stays); the second community card is turned and the 5-card hand is paid on every bet still up:
//   royal flush 1000:1, straight flush 200:1, four of a kind 50:1, full house 11:1, flush 8:1, straight 5:1,
//   three of a kind 3:1, two pair 2:1, a pair of tens or better 1:1; anything else loses the bets still up.
// No payout cap (real casinos cap the total; this table doesn't: a royal on 3 x 10 chips pays 30030).
// House edge with the best pull-back play: 3.51% of one bet per hand (3.5057%), i.e. 1.17% of the three bets put
// up, or 2.86% of the chips actually left riding (the "element of risk"). The demo's strategy (ride() below) is
// exactly that best play. Verified by microgames/tools/letitride_odds.py (every 3-, 4- and 5-card hand enumerated).
// Payouts are totals returned including the stake: a riding bet that wins at n:1 returns (n + 1) x the bet. The
// cards come straight from the shuffled deck; the flip animation never changes them.
// Controls: Left/Right set the bet (1-10 a circle), A deals. At each decision B = PULL BACK, A = LET IT RIDE.
// After a hand, A goes back to the bet screen (the pay table, with the last winning row lit).
// Demo player (the best play): bet 1 rides on a paying hand (tens or better, trips), three to a royal, three suited
// in a row (not 2-3-4 or A-2-3), three to a straight flush with one gap and a high card (10-A; an ace played low
// doesn't count) or with two gaps and two high cards; bet 2 rides on a paying hand, four to a flush, or four to an
// outside straight with a high card (without one it is an exact tie, EV 0, so pulling back loses nothing).
// Everything is integer maths (div() for /, no floats, no sort) so the VMX's C# port in vmx-firmware/games/letitride
// plays exactly the same; keep it that way.
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here); all three bets are
// taken when the cards are dealt, a pulled bet is paid back at once, and the winnings paid when the hand is judged.
// Out of chips (under 3) = "OUT OF CHIPS / MORE TOMORROW" until the bank's daily top-up.
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
const MULT = [0, 1, 2, 3, 5, 8, 11, 50, 200, 1000];       // n:1 by rank
const NAMES = ["", "TENS OR BETTER", "TWO PAIR", "THREE OF A KIND", "STRAIGHT", "FLUSH", "FULL HOUSE",
  "FOUR OF A KIND", "STRAIGHT FLUSH", "ROYAL FLUSH"];
const ROWS = ["ROYAL", "STR FLUSH", "4 OF A KIND", "FULL HOUSE", "FLUSH", "STRAIGHT", "3 OF A KIND",
  "TWO PAIR", "PAIR 10-A"];                           // the pay table, rank 9 down to 1
const ODDS = ["1000:1", "200:1", "50:1", "11:1", "8:1", "5:1", "3:1", "2:1", "1:1"];
const CY = 7;                                             // the cards' top edge
const RY = 29;                                            // the first bet row
const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, bet: 5, deck: Array(52).fill(0), hand: Array(5).fill(0),
    flip: Array(5).fill(-1), face: Array(5).fill(false), up: Array(3).fill(true), rank: 0, win: 0, best: 0, last: 0,
    hands: 0, target: 5, msg: "", msgT: 0, auto: false, pLeft: false, pRight: false, pA: false, pB: false };
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 90; }
function toBet(g) {
  if (g.bank.chips < 3) { setPhase(g, "broke"); return; }
  const top = Math.min(10, div(g.bank.chips, 3));
  g.bet = Math.max(1, Math.min(g.bet, top));
  setPhase(g, "bet");
  if (g.auto) { g.target = 1 + rnd(g) % 10; if (rnd(g) % 3 === 0) g.target = 5; g.target = Math.min(g.target, top); }
}

// ---- judging -----------------------------------------------------------------------------------------------------
// rank 0 nothing, 1 tens or better, 2 two pair, 3 trips, 4 straight, 5 flush, 6 full house, 7 quads, 8 straight
// flush, 9 royal flush. Cards are 0..51: rank c % 13 (0 = 2 .. 12 = ace), suit c / 13.
export function evaluate(h) {
  const cnt = Array(13).fill(0); let mask = 0, flush = true;
  for (let i = 0; i < 5; i++) { const r = h[i] % 13; cnt[r]++; mask |= 1 << r; if (div(h[i], 13) !== div(h[0], 13)) flush = false; }
  let pairs = 0, trips = 0, quads = 0, high = false;
  for (let r = 0; r < 13; r++) {
    if (cnt[r] === 2) { pairs++; if (r >= 8) high = true; }
    else if (cnt[r] === 3) trips++;
    else if (cnt[r] === 4) quads++;
  }
  let low = 0; while (((mask >> low) & 1) === 0) low++;
  const straight = (mask >> low) === 31 || mask === 4111;   // 4111: A-2-3-4-5
  if (straight && flush) return mask === 7936 ? 9 : 8;      // 7936: 10-J-Q-K-A
  if (quads) return 7;
  if (trips && pairs) return 6;
  if (flush) return 5;
  if (straight) return 4;
  if (trips) return 3;
  if (pairs === 2) return 2;
  return high ? 1 : 0;
}

// ---- the demo player: let it ride with the first n cards (3 or 4)? ------------------------------------------------
export function ride(h, n) {
  const cnt = Array(13).fill(0); let mask = 0, suited = true, high = 0, lo = 99, hi = -1, loA = 99, hiA = -1;
  for (let i = 0; i < n; i++) {
    const r = h[i] % 13; cnt[r]++; mask |= 1 << r;
    if (div(h[i], 13) !== div(h[0], 13)) suited = false;
    if (r >= 8) high++;
    if (r < lo) lo = r; if (r > hi) hi = r;
    const ra = r === 12 ? -1 : r; if (ra < loA) loA = ra; if (ra > hiA) hiA = ra;
  }
  let pairs = 0;
  for (let r = 0; r < 13; r++) {
    if (cnt[r] >= 3) return true;                         // trips (or quads): paid already
    if (cnt[r] === 2) { if (r >= 8) return true; pairs++; }
  }
  if (pairs >= 2) return true;                            // two pair
  if (pairs > 0) return false;                            // a low pair alone
  const span = Math.min(hi - lo, hiA - loA);
  if (n === 3) {
    if (!suited) return false;
    if (high === 3) return true;                          // three to a royal
    if (hiA - loA < hi - lo) high--;                      // an ace played low (A-2-4) isn't a high card here
    if (span === 2) return mask !== 7 && mask !== 4099;   // suited in a row, but not 2-3-4 (7) or A-2-3 (4099)
    if (span === 3) return high >= 1;
    if (span === 4) return high >= 2;
    return false;
  }
  if (suited) return true;                                // four to a flush
  return hi - lo === 3 && hi <= 11 && high >= 1;          // four to an outside straight with a high card
}

// ---- the game ----------------------------------------------------------------------------------------------------
function deal(g) {
  g.bank.chips -= g.bet * 3;
  for (let i = 0; i < 52; i++) g.deck[i] = i;
  for (let i = 51; i > 0; i--) { const j = rnd(g) % (i + 1), tt = g.deck[i]; g.deck[i] = g.deck[j]; g.deck[j] = tt; }
  for (let i = 0; i < 5; i++) { g.hand[i] = g.deck[i]; g.flip[i] = i < 3 ? 2 + i * 4 : -1; g.face[i] = i < 3; }
  for (let i = 0; i < 3; i++) g.up[i] = true;
  g.win = 0; g.rank = 0;
  setPhase(g, "deal");
}
function decide(g, k, rideIt) {                           // bet k (0 or 1): ride, or pull it back; then turn a card
  if (!rideIt) { g.up[k] = false; g.bank.chips += g.bet; }
  for (let i = 0; i < 5; i++) g.flip[i] = -1;
  g.flip[3 + k] = 2; g.face[3 + k] = true;
  setPhase(g, k === 0 ? "turn1" : "turn2");
}
function judge(g) {
  g.rank = evaluate(g.hand); g.win = 0; g.hands++;
  if (g.rank > 0) {
    for (let i = 0; i < 3; i++) if (g.up[i]) g.win += g.bet * (MULT[g.rank] + 1);
    g.bank.chips += g.win; g.last = g.rank;
  }
  if (g.win > g.best) g.best = g.win;
  setPhase(g, "result");
}

export function step(g, h) {
  g.t++; g.pt++; if (g.msgT > 0) g.msgT--;
  const auto = !!h.auto;
  const left = !auto && !!h.left, right = !auto && !!h.right, a = !auto && !!h.a, b = !auto && !!h.b;
  const eLeft = left && !g.pLeft, eRight = right && !g.pRight, eA = a && !g.pA, eB = b && !g.pB;
  g.pLeft = left; g.pRight = right; g.pA = a; g.pB = b;
  g.auto = auto;

  switch (g.phase) {
    case "title":
      if (eA || (auto && g.pt > 40)) toBet(g);
      break;
    case "bet": {
      const top = Math.min(10, div(g.bank.chips, 3));
      if (auto) {
        if (g.pt % 5 === 0) { if (g.bet < g.target) g.bet++; else if (g.bet > g.target) g.bet--; }
        if (g.pt > 45 && g.bet === g.target) deal(g);
      } else {
        if (eRight) g.bet = Math.min(top, g.bet + 1);
        if (eLeft) g.bet = Math.max(1, g.bet - 1);
        if (eA) deal(g);
      }
      break;
    }
    case "deal":
      if (g.pt > 16) setPhase(g, "d1");
      break;
    case "d1":
    case "d2": {
      const k = g.phase === "d1" ? 0 : 1;
      if (auto) { if (g.pt > 30) decide(g, k, ride(g.hand, 3 + k)); }
      else if (eB) decide(g, k, false);
      else if (eA) decide(g, k, true);
      break;
    }
    case "turn1":
      if (g.pt > 8) setPhase(g, "d2");
      break;
    case "turn2":
      if (g.pt > 8) judge(g);
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
function big(b, x, y, s) {
  for (let n = 0; n < s.length; n++) {
    let f = FONTCH.indexOf(s[n]); if (f < 0) f = FONTCH.length - 1;
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (FONT[f][r * 3 + q] === "1") fill(b, x + q * 2, y + r * 2, 2, 2, 1);
    x += 8;
  }
}
const centre = (b, y, s) => text(b, 32 - ((s.length * 4 - 1) >> 1), y, s);
const right = (b, y, s) => text(b, 64 - s.length * 4, y, s);
function sprite(b, x, y, rows, w, v) {
  for (let r = 0; r < rows.length; r++) for (let q = 0; q < w; q++) if ((rows[r] >> (w - 1 - q)) & 1) px(b, x + q, y + r, v);
}
function card(b, x, y, c, face, w) {                      // 12 x 20; w < 12 = mid-flip (narrowed, plain)
  const x0 = x + ((12 - w) >> 1);
  fill(b, x0, y + 1, w, 18, 1); fill(b, x0 + 1, y, w - 2, 1, 1); fill(b, x0 + 1, y + 19, w - 2, 1, 1);   // rounded corners
  if (!face) {                                            // the back: a dark ring, then a diamond lattice
    fill(b, x0 + 1, y + 1, w - 2, 18, 0);
    for (let j = 2; j < 18; j++) for (let i = 2; i < w - 2; i++) if ((i + j) % 4 === 0 || (i - j + 40) % 4 === 0) px(b, x0 + i, y + j, 1);
  }
  if (!face || w < 12) return;
  const r = c % 13;
  if (r === 8) { text(b, x + 1, y + 2, "1", 0); text(b, x + 5, y + 2, "0", 0); } else text(b, x + 2, y + 2, RANKS[r], 0);
  sprite(b, x + 3, y + 10, SUIT[div(c, 13)], 7, 0);
}
function drawCards(g, b) {
  const anim = g.phase === "deal" || g.phase === "turn1" || g.phase === "turn2";
  for (let i = 0; i < 5; i++) {
    const x = i * 13; let face = g.face[i], w = 12;
    if (face && anim && g.flip[i] >= 0) {
      const f = g.pt - g.flip[i];
      if (f < 0) face = false;
      else if (f < 2) { face = false; w = f === 0 ? 8 : 4; }
      else if (f < 4) w = f === 2 ? 4 : 8;
    }
    card(b, x, CY, g.hand[i], face, w);
  }
}
function drawRows(g, b) {                                 // the three bets: number, chips, state
  const k = g.phase === "d1" ? 0 : g.phase === "d2" ? 1 : -1, res = g.phase === "result";
  for (let i = 0; i < 3; i++) {
    const y = RY + i * 8;
    if (i === k && (g.t >> 3) & 1) text(b, 0, y + 1, ">");
    fill(b, 4, y, 7, 7, 1); text(b, 6, y + 1, "" + (i + 1), 0);
    sprite(b, 13, y + 1, CHIP, 5, 1); text(b, 20, y + 1, "" + g.bet);
    let s = g.up[i] ? "UP" : "PULLED";
    if (i === k) s = (g.t >> 3) & 1 ? "UP" : "";
    else if (res && g.up[i]) s = g.rank > 0 ? "WIN " + g.bet * (MULT[g.rank] + 1) : "LOST";
    right(b, y + 1, s);
  }
}
function drawTable(g, b) {                                // the bet screen: pay table, stash, bet
  const litK = g.last > 0 ? 9 - g.last : -1;               // the last winning row, lit with a pixel of margin
  for (let k = 0; k < 9; k++) {
    const y = 1 + k * 6 + (k === litK ? 1 : litK >= 0 && k > litK ? 2 : 0), lit = k === litK;
    if (lit) fill(b, 0, y - 1, 64, 7, 1);
    text(b, 1, y, ROWS[k], lit ? 0 : 1); text(b, 64 - ODDS[k].length * 4, y, ODDS[k], lit ? 0 : 1);
  }
  for (let x = 0; x < 64; x++) px(b, x, 57);
  sprite(b, 1, 59, CHIP, 5, 1); text(b, 8, 59, "" + g.bank.chips);
  right(b, 59, (g.t >> 4) & 1 ? "A: DEAL" : "<3X" + g.bet + ">");
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    big(b, 9, 2, "LET IT"); big(b, 17, 14, "RIDE");
    for (let s = 0; s < 4; s++) sprite(b, 9 + s * 13, 27, SUIT[s], 7, 1);
    if (g.phase === "broke") {
      centre(b, 40, "OUT OF CHIPS"); if ((g.t >> 5) & 1) centre(b, 48, "MORE TOMORROW");
      sprite(b, 23, 57, CHIP, 5, 1); text(b, 30, 57, "" + g.bank.chips);
      return b;
    }
    centre(b, 38, "THREE BETS");
    centre(b, 46, g.msgT > 0 ? g.msg : "PULL TWO BACK");
    if ((g.t >> 4) & 1) centre(b, 56, "A: START");
    return b;
  }
  if (g.phase === "bet") { drawTable(g, b); return b; }
  sprite(b, 1, 1, CHIP, 5, 1); text(b, 8, 1, "" + g.bank.chips);
  right(b, 1, "3X" + g.bet);
  drawCards(g, b);
  drawRows(g, b);
  if (g.phase === "d1" || g.phase === "d2") {
    centre(b, 53, "B PULL BACK"); centre(b, 59, "A LET IT RIDE");
  } else if (g.phase === "result") {
    if (g.rank > 0) {
      if (g.pt > 30 || ((g.pt >> 2) & 1) === 0) centre(b, 53, NAMES[g.rank]);
      if (!g.auto && g.pt > 30 && (g.t >> 4) & 1) centre(b, 59, "A: NEXT"); else centre(b, 59, "WIN " + g.win);
    } else {
      centre(b, 53, "NO WIN");
      if (!g.auto && (g.t >> 4) & 1) centre(b, 59, "A: NEXT");
    }
  }
  return b;
}
