// VIDEO POKER for the VMX's 64x64 1-bit screen: Jacks or Better, the casino's slow, careful chip builder. Our own
// art and code.
// Rules: one 52-card deck, shuffled fresh every hand (Fisher-Yates on the seeded RNG). Bet 1-5 chips, get 5 cards,
// hold any of them, draw once to replace the rest; the final hand is paid from the "full pay" 9/6 table, per chip bet,
// total returned including the stake: royal flush 250 (4000 for a 5-chip bet, as real machines pay 800 a chip at max
// bet), straight flush 50, four of a kind 25, full house 9, flush 6, straight 4, three of a kind 3, two pair 2, a pair
// of jacks or better 1 (the stake back). House edge: this is the classic 9/6 table, which returns 99.54% with perfect
// play at max bet (house edge 0.46%); about 98.4% at bets under 5 (the smaller royal), and less with weaker holds.
// The cards come straight from the shuffled deck; the flip animation never changes them.
// Controls: Up/Down set the bet (1-5, never more than the stash), A deals. Left/Right move the cursor along the
// cards, A holds / un-holds the card under it (HLD shows above held cards), B draws. After a hand, A goes back to the
// bet screen (the pay table, with the last winning row lit).
// Demo player: a simplified Jacks-or-Better strategy (see plan()).
// Everything is integer maths (div() for /, no floats, no sort) so the VMX's C# port in vmx-firmware/games/poker
// plays exactly the same; keep it that way.
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here); the stake is taken
// when the cards are dealt and the payout paid when the hand is judged. Out of chips = "OUT OF CHIPS / MORE TOMORROW"
// until the bank's daily top-up.
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
  [8, 28, 62, 127, 127, 42, 28],                          // spade: filled
  [54, 73, 65, 65, 34, 20, 8],                            // heart: outline
  [8, 20, 34, 65, 34, 20, 8],                             // diamond: outline
  [28, 28, 107, 127, 107, 8, 28] ];                       // club: filled
const CHIP = [14, 21, 27, 21, 14];                        // 5x5 chip icon
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const PAY = [0, 1, 2, 3, 4, 6, 9, 25, 50, 250];
const NAMES = ["", "JACKS OR BETTER", "TWO PAIR", "THREE OF A KIND", "STRAIGHT", "FLUSH", "FULL HOUSE",
  "FOUR OF A KIND", "STRAIGHT FLUSH", "ROYAL FLUSH"];
const ROWS = ["ROYAL FLUSH", "STR FLUSH", "4 OF A KIND", "FULL HOUSE", "FLUSH", "STRAIGHT", "3 OF A KIND",
  "TWO PAIR", "J OR BETTER"];                             // the pay table, rank 9 down to 1
const CY = 22;                                            // the cards' top edge
const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, bet: 5, deck: Array(52).fill(0), hand: Array(5).fill(0),
    held: Array(5).fill(false), flip: Array(5).fill(-1), next: 5, nflip: 0, cur: 0, plan: 0, target: 5, rank: 0, win: 0, last: 0,
    hands: 0, msg: "", msgT: 0, auto: false, pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 90; }
function toBet(g) {
  if (g.bank.chips < 1) { setPhase(g, "broke"); return; }
  g.bet = Math.max(1, Math.min(g.bet, Math.min(5, g.bank.chips)));
  setPhase(g, "bet");
  if (g.auto) { g.target = 5; if (rnd(g) % 4 === 0) g.target = 1 + rnd(g) % 4; g.target = Math.min(g.target, g.bank.chips); }
}
export function payOf(rank, bet) { return rank === 9 && bet === 5 ? 4000 : PAY[rank] * bet; }

// ---- judging -----------------------------------------------------------------------------------------------------
// rank 0 nothing, 1 jacks or better, 2 two pair, 3 trips, 4 straight, 5 flush, 6 full house, 7 quads, 8 straight
// flush, 9 royal flush. Cards are 0..51: rank c % 13 (0 = 2 .. 12 = ace), suit c / 13.
export function evaluate(h) {
  const cnt = Array(13).fill(0); let mask = 0, flush = true;
  for (let i = 0; i < 5; i++) { const r = h[i] % 13; cnt[r]++; mask |= 1 << r; if (div(h[i], 13) !== div(h[0], 13)) flush = false; }
  let pairs = 0, trips = 0, quads = 0, high = false;
  for (let r = 0; r < 13; r++) {
    if (cnt[r] === 2) { pairs++; if (r >= 9) high = true; }
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

// ---- the demo player's holds -------------------------------------------------------------------------------------
// In order: a made full house or better; 4 to a royal flush; a made straight / flush / trips / two pair; 4 to a
// straight flush; a high pair; 4 to a flush; a low pair; 4 to an open-ended straight; 2 high cards (J-A; suited if
// possible, else the two lowest); 1 high card; else draw five. Returns a 5-bit mask of cards to hold.
function four(g, kind) {                                  // the first 4-card subset of kind 0 royal, 1 SF, 2 flush, 3 open straight
  for (let skip = 4; skip >= 0; skip--) {
    let mask = 0, suitOk = true, s0 = -1, lo = 99, hi = -1, loA = 99, hiA = -1, royal = true;
    for (let i = 0; i < 5; i++) {
      if (i === skip) continue;
      const r = g.hand[i] % 13, s = div(g.hand[i], 13);
      if (s0 < 0) s0 = s; else if (s !== s0) suitOk = false;
      if ((mask >> r) & 1) mask |= 8192; mask |= 1 << r;
      if (r < 8) royal = false;
      if (r < lo) lo = r; if (r > hi) hi = r;
      const ra = r === 12 ? -1 : r; if (ra < loA) loA = ra; if (ra > hiA) hiA = ra;
    }
    const distinct = (mask & 8192) === 0;
    let ok = false;
    if (kind === 0) ok = suitOk && royal;
    else if (kind === 1) ok = suitOk && distinct && (hi - lo <= 4 || hiA - loA <= 4);
    else if (kind === 2) ok = suitOk;
    else ok = distinct && hi - lo === 3 && hi <= 11;
    if (ok) return 31 & ~(1 << skip);
  }
  return 0;
}
function keepRanks(g, cnt, n, minR) {                     // hold every card whose rank appears n times (rank >= minR)
  let m = 0;
  for (let i = 0; i < 5; i++) { const r = g.hand[i] % 13; if (cnt[r] === n && r >= minR) m |= 1 << i; }
  return m;
}
export function plan(g) {
  const rank = evaluate(g.hand);
  if (rank >= 6) return 31;
  let m = four(g, 0); if (m) return m;
  if (rank === 4 || rank === 5) return 31;
  const cnt = Array(13).fill(0);
  for (let i = 0; i < 5; i++) cnt[g.hand[i] % 13]++;
  if (rank === 3) return keepRanks(g, cnt, 3, 0);
  if (rank === 2) return keepRanks(g, cnt, 2, 0);
  m = four(g, 1); if (m) return m;
  if (rank === 1) return keepRanks(g, cnt, 2, 9);
  m = four(g, 2); if (m) return m;
  m = keepRanks(g, cnt, 2, 0); if (m) return m;
  m = four(g, 3); if (m) return m;
  let a = -1, b = -1;                                     // high cards: a suited two first
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    if (a < 0 && g.hand[i] % 13 >= 9 && g.hand[j] % 13 >= 9 && div(g.hand[i], 13) === div(g.hand[j], 13)) { a = i; b = j; }
  }
  if (a >= 0) return (1 << a) | (1 << b);
  for (let k = 0; k < 2; k++) {                           // else the lowest two
    let best = -1;
    for (let i = 0; i < 5; i++) {
      const r = g.hand[i] % 13;
      if (r >= 9 && i !== a && (best < 0 || r < g.hand[best] % 13)) best = i;
    }
    if (best < 0) break;
    if (a < 0) a = best; else b = best;
  }
  m = 0; if (a >= 0) m |= 1 << a; if (b >= 0) m |= 1 << b;
  return m;
}

// ---- the game ----------------------------------------------------------------------------------------------------
function deal(g) {
  g.bank.chips -= g.bet;
  for (let i = 0; i < 52; i++) g.deck[i] = i;
  for (let i = 51; i > 0; i--) { const j = rnd(g) % (i + 1), tt = g.deck[i]; g.deck[i] = g.deck[j]; g.deck[j] = tt; }
  for (let i = 0; i < 5; i++) { g.hand[i] = g.deck[i]; g.held[i] = false; g.flip[i] = 2 + i * 4; }
  g.next = 5; g.cur = 0; g.win = 0; g.rank = evaluate(g.hand);
  setPhase(g, "deal");
}
function draw5(g) {
  let k = 0;
  for (let i = 0; i < 5; i++) {
    if (g.held[i]) g.flip[i] = -1;
    else { g.hand[i] = g.deck[g.next++]; g.flip[i] = 2 + k * 4; k++; }
  }
  g.nflip = k;
  setPhase(g, "draw");
}
function judge(g) {
  g.rank = evaluate(g.hand); g.win = payOf(g.rank, g.bet); g.bank.chips += g.win; g.hands++;
  if (g.rank > 0) g.last = g.rank;
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
  g.auto = auto;

  switch (g.phase) {
    case "title":
      if (eA || (auto && g.pt > 40)) toBet(g);
      break;
    case "bet": {
      const top = Math.min(5, g.bank.chips);
      if (auto) {
        if (g.pt % 6 === 0) { if (g.bet < g.target) g.bet++; else if (g.bet > g.target) g.bet--; }
        if (g.pt > 45 && g.bet === g.target) deal(g);
      } else {
        if (eUp) g.bet = Math.min(top, g.bet + 1);
        if (eDown) g.bet = Math.max(1, g.bet - 1);
        if (eA) deal(g);
      }
      break;
    }
    case "deal":
      if (g.pt > 22) setPhase(g, "hold");
      break;
    case "hold":
      if (auto) {
        if (g.pt === 1) g.plan = plan(g);
        if (g.pt % 7 === 0) {
          const want = ((g.plan >> g.cur) & 1) === 1;
          if (g.held[g.cur] !== want) g.held[g.cur] = want;
          else if (g.cur < 4) g.cur++;
          else draw5(g);
        }
      } else {
        if (eLeft) g.cur = (g.cur + 4) % 5;
        if (eRight) g.cur = (g.cur + 1) % 5;
        if (eA) g.held[g.cur] = !g.held[g.cur];
        else if (eB) draw5(g);
      }
      break;
    case "draw":
      if (g.pt > 6 + g.nflip * 4) judge(g);
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
  const anim = g.phase === "deal" || g.phase === "draw";
  for (let i = 0; i < 5; i++) {
    const x = i * 13; let face = true, w = 12;
    if (anim && g.flip[i] >= 0) {
      const f = g.pt - g.flip[i];
      if (f < 0) face = false;
      else if (f < 2) { face = false; w = f === 0 ? 8 : 4; }
      else if (f < 4) w = f === 2 ? 4 : 8;
    }
    card(b, x, CY, g.hand[i], face, w);
    if (g.held[i] && g.phase !== "deal") text(b, x + 1, CY - 7, "HLD");
  }
}
function drawTop(g, b) {
  sprite(b, 1, 1, CHIP, 5, 1); text(b, 8, 1, "" + g.bank.chips);
  right(b, 1, "BET " + g.bet);
}
function drawTable(g, b) {                                // the bet screen: pay table for this bet, stash, bet
  const litK = g.last > 0 ? 9 - g.last : -1;               // the last winning row, lit with a pixel of margin
  for (let k = 0; k < 9; k++) {
    const rank = 9 - k, y = 1 + k * 6 + (k === litK ? 1 : litK >= 0 && k > litK ? 2 : 0), s = "" + payOf(rank, g.bet), lit = k === litK;
    if (lit) fill(b, 0, y - 1, 64, 7, 1);
    text(b, 1, y, ROWS[k], lit ? 0 : 1); text(b, 64 - s.length * 4, y, s, lit ? 0 : 1);
  }
  for (let x = 0; x < 64; x++) px(b, x, 57);
  sprite(b, 1, 59, CHIP, 5, 1); text(b, 8, 59, "" + g.bank.chips);
  right(b, 59, (g.t >> 4) & 1 ? "A: DEAL" : "^BET " + g.bet);
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    big(b, 13, 2, "VIDEO"); big(b, 13, 14, "POKER");
    for (let s = 0; s < 4; s++) sprite(b, 9 + s * 13, 27, SUIT[s], 7, 1);
    if (g.phase === "broke") {
      centre(b, 40, "OUT OF CHIPS"); if ((g.t >> 5) & 1) centre(b, 48, "MORE TOMORROW");
      sprite(b, 23, 57, CHIP, 5, 1); text(b, 30, 57, "0");
      return b;
    }
    centre(b, 38, "JACKS OR BETTER");
    centre(b, 46, g.msgT > 0 ? g.msg : "9/6 FULL PAY");
    if ((g.t >> 4) & 1) centre(b, 56, "A: START");
    return b;
  }
  if (g.phase === "bet") { drawTable(g, b); return b; }
  drawTop(g, b);
  drawCards(g, b);
  if (g.phase === "hold") {
    const x = g.cur * 13;
    fill(b, x + 5, CY + 22, 2, 1, 1); fill(b, x + 4, CY + 23, 4, 1, 1); fill(b, x + 3, CY + 24, 6, 1, 1);
    if (g.rank > 0) centre(b, 8, NAMES[g.rank]);
    centre(b, 58, "A HOLD  B DRAW");
  } else if (g.phase === "result") {
    if (g.rank > 0) {
      if (g.pt > 30 || ((g.pt >> 2) & 1) === 0) centre(b, 8, NAMES[g.rank]);
      centre(b, 49, "WIN " + g.win);
    } else centre(b, 49, "NO WIN");
    if (!g.auto && (g.t >> 4) & 1) centre(b, 58, "A: NEXT");
  }
  return b;
}
