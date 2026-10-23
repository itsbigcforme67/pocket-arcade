// 3 CARD POKER for the VMX's 64x64 1-bit screen: a VMX CASINO table. Our own art and code (cards as VIDEO POKER).
// Rules (standard Three Card Poker): one 52-card deck, shuffled fresh every hand (Fisher-Yates on the seeded RNG).
// Bet an ANTE (1-10) and an optional PAIR PLUS (0-10); both are taken when the cards are dealt. You get 3 cards face
// up, the dealer 3 face down. Then PLAY (a Play bet equal to the ante; only if the stash covers it) or FOLD (the ante
// is lost; Pair Plus still settles). The dealer qualifies with queen-high or better. Not qualified: ante pays 1:1,
// play pushes. Qualified: the better hand wins (ante and play 1:1 each), dealer better = both lost, a tie pushes.
// ANTE BONUS on the ante when you play, whatever the dealer has: straight flush 5:1, three of a kind 4:1, straight 1:1.
// PAIR PLUS on your 3 cards alone: straight flush 40:1, three of a kind 30:1, straight 6:1, flush 4:1, pair 1:1.
// Hand ranks: straight flush > three of a kind > straight > flush > pair > high card; A-2-3 is the lowest straight.
// House edge (enumerated over all 22100 x 18424 deals): ante + play 3.37% of the ante with the Q-6-4 rule (play
// Q-6-4 or better, fold worse; 2.01% of the total staked); pair plus 2.32%. (With flush 3:1 pair plus would be 7.28%.)
// The cards come straight from the shuffled deck; the flip animations never change them.
// Controls: Left/Right set the ante, Up/Down the pair plus (never more than the stash), A deals. Then A plays, B
// folds. After a hand, A goes back to the bet screen (the pay tables, the last hand's row lit).
// Demo player: plays Q-6-4 or better (when it can afford the Play bet), folds worse; bets a pair plus 1 time in 3.
// Everything is integer maths (div() for /, no floats, no sort) so the VMX's C# port in vmx-firmware/games/threecard
// plays exactly the same; keep it that way.
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here); ante + pair plus are
// taken at the deal, the Play bet when you play, everything won (stakes included) paid when the hand is judged.
// Out of chips = "OUT OF CHIPS / MORE TOMORROW" until the bank's daily top-up.
// Input: held buttons (edges found here); { auto: true } = the demo player.
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const FONTCH = "ABCDEFGHIJKLMNOPQRSTUVWXY0123456789:!-<>+/^' ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "001001001101010", "101101110101101", "100100100100111",
  "101111111101101", "110101101101101", "010101101101010", "110101110100100", "010101101110011", "110101110101101",
  "011100010001110", "111010010010010", "101101101101111", "101101101101010", "101101111111101", "101101010101101",
  "101101010010010",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "001010100010001", "100010001010100", "000010111010000", "001001010100100", "010111000111010",
  "010010000000000", "000000000000000" ];
const SUIT = [                                            // 7x7, bit 6 = left: spade, heart, diamond, club
  [8, 28, 62, 127, 127, 42, 28],
  [54, 73, 65, 65, 34, 20, 8],
  [8, 20, 34, 65, 34, 20, 8],
  [28, 28, 107, 127, 107, 8, 28] ];
const CHIP = [14, 21, 27, 21, 14];                        // 5x5 chip icon
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const HIGHN = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "JACK", "QUEEN", "KING", "ACE"];
const PAIRN = ["TWOS", "THREES", "FOURS", "FIVES", "SIXES", "SEVENS", "EIGHTS", "NINES", "TENS", "JACKS", "QUEENS",
  "KINGS", "ACES"];
const CATN = ["", "", "FLUSH", "STRAIGHT", "THREE OF A KIND", "STRAIGHT FLUSH"];
const PPAY = [0, 1, 4, 6, 30, 40];                        // pair plus, to 1, by category
const ABON = [0, 0, 0, 1, 4, 5];                          // ante bonus, to 1, by category
const ROWS = ["STRFL", "TRIPS", "STR", "FLUSH", "PAIR"];  // the pay tables, category 5 down to 1
const QUAL = 10 * 169, Q64 = 10 * 169 + 4 * 13 + 2;       // queen high; Q-6-4
const DY = -2, PY = 47, LX = 41;                          // dealer cards' top, player cards' top (both bleed off the edge), the right column
const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, ante: 5, pp: 0, play: 0, deck: Array(52).fill(0),
    cards: Array(6).fill(0), flip: Array(6).fill(-1), ps: 0, ds: 0, fold: false, qual: false, outcome: 0,
    rA: 0, rP: 0, rPP: 0, bonus: 0, win: 0, net: 0, last: 0, hands: 0, tA: 5, tP: 0, msg: "", msgT: 0, auto: false,
    pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 90; }
function clampPP(g) { g.pp = Math.max(0, Math.min(g.pp, Math.min(10, g.bank.chips - g.ante))); }
function toBet(g) {
  const c = g.bank.chips;
  if (c < 1) { setPhase(g, "broke"); return; }
  g.ante = Math.max(1, Math.min(g.ante, Math.min(10, c))); clampPP(g);
  setPhase(g, "bet");
  if (g.auto) {
    g.tA = 1 + rnd(g) % 10; g.tP = 0; if (rnd(g) % 3 === 0) g.tP = 1 + rnd(g) % 5;
    g.tA = Math.min(g.tA, Math.min(10, c)); g.tP = Math.max(0, Math.min(g.tP, Math.min(10, c - g.tA)));
  }
}

// ---- judging -----------------------------------------------------------------------------------------------------
// score(): one number that orders 3-card hands: category * 2197 + up to three ranks (base 13). Categories: 0 high
// card, 1 pair, 2 flush, 3 straight, 4 three of a kind, 5 straight flush. Cards are 0..51: rank c % 13 (0 = 2 ..
// 12 = ace), suit c / 13. A-2-3 counts as 3-high.
export function score(c0, c1, c2) {
  let a = c0 % 13, b = c1 % 13, c = c2 % 13, t;
  if (a < b) { t = a; a = b; b = t; }
  if (b < c) { t = b; b = c; c = t; }
  if (a < b) { t = a; a = b; b = t; }
  const fl = div(c0, 13) === div(c1, 13) && div(c1, 13) === div(c2, 13);
  const wheel = a === 12 && b === 1 && c === 0;
  const st = (a === b + 1 && b === c + 1) || wheel, top = wheel ? 1 : a;
  if (st && fl) return 5 * 2197 + top * 169;
  if (a === c) return 4 * 2197 + a * 169;
  if (st) return 3 * 2197 + top * 169;
  if (fl) return 2 * 2197 + a * 169 + b * 13 + c;
  if (a === b) return 2197 + a * 169 + c * 13;
  if (b === c) return 2197 + b * 169 + a * 13;
  return a * 169 + b * 13 + c;
}
export function handName(s) {
  const cat = div(s, 2197), r = div(s % 2197, 169);
  if (cat === 0) return HIGHN[r] + " HIGH";
  if (cat === 1) return "PAIR OF " + PAIRN[r];
  return CATN[cat];
}

// ---- the game ----------------------------------------------------------------------------------------------------
function deal(g) {
  g.bank.chips -= g.ante + g.pp;
  for (let i = 0; i < 52; i++) g.deck[i] = i;
  for (let i = 51; i > 0; i--) { const j = rnd(g) % (i + 1), tt = g.deck[i]; g.deck[i] = g.deck[j]; g.deck[j] = tt; }
  for (let i = 0; i < 6; i++) { g.cards[i] = g.deck[i]; g.flip[i] = i < 3 ? 2 + i * 4 : -1; }   // 0-2 you, 3-5 dealer
  g.ps = score(g.cards[0], g.cards[1], g.cards[2]); g.ds = score(g.cards[3], g.cards[4], g.cards[5]);
  g.play = 0; g.fold = false; g.win = 0; g.net = 0; g.rA = 0; g.rP = 0; g.rPP = 0; g.bonus = 0;
  setPhase(g, "deal");
}
function decide(g, play) {
  if (play) { g.play = g.ante; g.bank.chips -= g.play; } else g.fold = true;
  for (let i = 0; i < 6; i++) g.flip[i] = i < 3 ? -1 : 2 + (i - 3) * 4;
  setPhase(g, "reveal");
}
function judge(g) {
  const cat = div(g.ps, 2197);
  g.qual = g.ds >= QUAL;
  if (g.pp > 0 && cat >= 1) g.rPP = g.pp * (PPAY[cat] + 1);
  if (g.fold) g.outcome = 0;
  else {
    g.bonus = g.ante * ABON[cat];
    if (!g.qual) { g.outcome = 4; g.rA = g.ante * 2; g.rP = g.play; }
    else if (g.ps > g.ds) { g.outcome = 1; g.rA = g.ante * 2; g.rP = g.play * 2; }
    else if (g.ps === g.ds) { g.outcome = 3; g.rA = g.ante; g.rP = g.play; }
    else g.outcome = 2;
    g.rA += g.bonus;
  }
  g.win = g.rA + g.rP + g.rPP; g.net = g.win - g.ante - g.play - g.pp;
  g.bank.chips += g.win; g.hands++; g.last = cat;
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
      const c = g.bank.chips;
      if (auto) {
        if (g.pt % 6 === 0) {
          if (g.ante < g.tA) g.ante++; else if (g.ante > g.tA) g.ante--;
          else if (g.pp < g.tP) g.pp++; else if (g.pp > g.tP) g.pp--;
          clampPP(g);
        }
        if (g.pt > 45 && g.ante === g.tA && g.pp === g.tP) deal(g);
      } else {
        if (eRight) g.ante = Math.min(Math.min(10, c), g.ante + 1);
        if (eLeft) g.ante = Math.max(1, g.ante - 1);
        clampPP(g);
        if (eUp) g.pp = Math.min(Math.min(10, c - g.ante), g.pp + 1);
        if (eDown) g.pp = Math.max(0, g.pp - 1);
        if (eA) deal(g);
      }
      break;
    }
    case "deal":
      if (g.pt > 16) setPhase(g, "decide");
      break;
    case "decide": {
      const can = g.bank.chips >= g.ante;
      if (auto) { if (g.pt > 30) decide(g, can && g.ps >= Q64); }
      else if (eA && can) decide(g, true);
      else if (eB) decide(g, false);
      break;
    }
    case "reveal":
      if (g.pt > 18) judge(g);
      break;
    case "result":
      if ((eA && g.pt > 10) || (auto && g.pt > 100)) toBet(g);
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
  const anim = g.phase === "deal" || g.phase === "reveal";
  for (let i = 0; i < 6; i++) {
    const x = 1 + (i % 3) * 13, y = i < 3 ? PY : DY;
    let face = i < 3 || g.phase === "reveal" || g.phase === "result", w = 12;
    if (anim && g.flip[i] >= 0) {
      const f = g.pt - g.flip[i];
      if (f < 0) face = false;
      else if (f < 2) { face = false; w = f === 0 ? 8 : 4; }
      else if (f < 4) w = f === 2 ? 4 : 8;
    }
    card(b, x, y, g.cards[i], face, w);
  }
}
function stash(b, x, y, c) {                              // chip icon + count, or just the count when it's long
  const s = "" + c;
  if (s.length > 4) text(b, 64 - s.length * 4, y, s);
  else { sprite(b, x, y, CHIP, 5, 1); text(b, x + 7, y, s); }
}
const signed = v => (v > 0 ? "+" : "") + v;
function betRow(b, y, label, val) { text(b, LX, y, label); right(b, y, val); }
function drawBets(g, b) {                                 // the right column beside your cards
  const res = g.phase === "result";
  betRow(b, 47, "AN", res ? signed(g.rA - g.ante) : "" + g.ante);
  if (g.fold) text(b, LX, 53, "FOLD");
  else if (g.play > 0) betRow(b, 53, "PL", res ? signed(g.rP - g.play) : "" + g.play);
  if (g.pp > 0) betRow(b, 59, "PP", res ? signed(g.rPP - g.pp) : "" + g.pp);
}
function box(b, s1, s2) {                                 // the message box between the hands: one or two lines, dark on lit
  fill(b, 0, 25, 64, 15, 1);
  if (s2 === "") text(b, 32 - ((s1.length * 4 - 1) >> 1), 30, s1, 0);
  else { text(b, 32 - ((s1.length * 4 - 1) >> 1), 27, s1, 0); text(b, 32 - ((s2.length * 4 - 1) >> 1), 33, s2, 0); }
}
function drawTable(g, b) {                                // the bet screen: pay tables, bets, stash
  text(b, 22, 1, "PAIR+"); text(b, 44, 1, "BONUS");
  const litK = g.last > 0 ? 5 - g.last : -1;
  for (let k = 0; k < 5; k++) {
    const cat = 5 - k, y = 8 + k * 6, lit = k === litK;
    if (lit) fill(b, 0, y - 1, 64, 7, 1);
    text(b, 1, y, ROWS[k], lit ? 0 : 1);
    const p = "" + PPAY[cat]; text(b, 42 - p.length * 4, y, p, lit ? 0 : 1);
    const q = ABON[cat] > 0 ? "" + ABON[cat] : "-"; text(b, 64 - q.length * 4, y, q, lit ? 0 : 1);
  }
  fill(b, 0, 38, 64, 1, 1);
  text(b, 1, 41, "<> ANTE"); right(b, 41, "" + g.ante);
  text(b, 1, 47, "^ PAIR+"); right(b, 47, "" + g.pp);
  fill(b, 0, 54, 64, 1, 1);
  stash(b, 1, 58, g.bank.chips);
  if ((g.t >> 4) & 1) right(b, 58, "A: DEAL");
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    big(b, 8, 2, "3 CARD"); big(b, 13, 14, "POKER");
    for (let s = 0; s < 4; s++) sprite(b, 9 + s * 13, 27, SUIT[s], 7, 1);
    if (g.phase === "broke") {
      centre(b, 40, "OUT OF CHIPS"); if ((g.t >> 5) & 1) centre(b, 48, "MORE TOMORROW");
      sprite(b, 23, 57, CHIP, 5, 1); text(b, 30, 57, "" + g.bank.chips);
      return b;
    }
    centre(b, 38, "ANTE + PAIR PLUS");
    centre(b, 46, g.msgT > 0 ? g.msg : "PLAY OR FOLD");
    if ((g.t >> 4) & 1) centre(b, 56, "A: START");
    return b;
  }
  if (g.phase === "bet") { drawTable(g, b); return b; }
  drawCards(g, b);
  stash(b, LX, 1, g.bank.chips);
  text(b, LX, 12, "DEALER");
  drawBets(g, b);
  if (g.phase !== "deal") centre(b, 41, handName(g.ps));
  if (g.phase === "decide") {
    if (g.bank.chips >= g.ante) box(b, "A: PLAY " + g.ante, "B: FOLD");
    else box(b, "NO CHIPS TO PLAY", (g.t >> 4) & 1 ? "B: FOLD" : " ");
  } else if (g.phase === "reveal") box(b, g.fold ? "YOU FOLD" : "YOU PLAY " + g.play, "");
  else if (g.phase === "result") {
    centre(b, 19, handName(g.ds));
    if (g.pt < 50) {
      if (g.outcome === 0) box(b, "YOU FOLD", "ANTE LOST");
      else if (g.outcome === 4) box(b, "DEALER DOESN'T", "QUALIFY");
      else box(b, "DEALER QUALIFIES", ((g.pt >> 2) & 1) === 0 || g.pt > 20 ? (g.outcome === 1 ? "YOU WIN" : g.outcome === 2 ? "DEALER WINS" : "PUSH") : " ");
    } else {
      const hint = !g.auto && ((g.t >> 4) & 1) === 1;
      box(b, g.net > 0 ? "WIN " + g.net : g.net < 0 ? "LOSE " + (-g.net) : "EVEN", hint ? "A: NEXT" : g.bonus > 0 ? "ANTE BONUS " + g.bonus : " ");
    }
  }
  return b;
}
