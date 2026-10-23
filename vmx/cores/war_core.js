// CASINO WAR for the VMX's 64x64 1-bit screen: high card wins, and a tie means war. Our own art and code; the cards,
// suit glyphs and flip are VIDEO POKER's so the casino reads as one family.
// Rules: a 6-deck shoe (312 cards, Fisher-Yates on the seeded RNG), reshuffled between rounds once the cut card
// (234 cards dealt, 75%) has come out. Ranks 2 low .. A high; suits don't matter.
// Bet 1-20 chips, plus an optional TIE side bet of 0-10 (bet + tie never more than the stash). One card to the player,
// one to the dealer. Higher card wins the main bet 1:1 (2x returned), lower loses it. The TIE bet pays 10:1 (11x
// returned) when those first two cards tie, whatever happens next.
// On a tie: GO TO WAR (raise as much again as the bet; offered only if the stash can cover it) or SURRENDER (half the
// bet back, rounded down: the house keeps the odd chip, so a 5-chip bet gets 2 back and a 1-chip bet gets nothing).
// At war three cards are burned (shown face down), then one card each: the player's card equal or higher wins the
// raise 1:1 and the bet is pushed (returned), so 3x the bet comes back; lower loses both.
// House edge, exact for the 6-deck shoe (P(first tie) = 23/311): going to war on every tie, 142853/4965115 = 2.877%
// of the original bet (return 97.12%); surrendering every tie costs 3.70% (more with odd bets). TIE bet at 10:1:
// 11 * 23/311 - 1 = -58/311, a house edge of 18.65%. The burn cards are unseen, so they don't change these odds.
// The cards come straight from the shuffled shoe; the flip animations never change them.
// Controls: on the bet screen Left/Right set the bet, Up/Down the tie bet, A deals. At a tie A goes to war, B
// surrenders (A surrenders too when the stash can't cover the raise). After a round A goes back to the bet screen.
// Demo player: a random bet within its stash (up to 20), a small tie bet (1-3) one round in three, always goes to war
// when it can.
// Everything is integer maths (div() for /, no floats, no sort) so the VMX's C# port in vmx-firmware/games/war plays
// exactly the same; keep it that way.
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here). Bet + tie are taken
// at the deal, the raise when war is declared, winnings paid stake-included. Out of chips = "OUT OF CHIPS / MORE
// TOMORROW" until the bank's daily top-up.
// Input: held buttons (edges found here); { auto: true } = the demo player.
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const FONTCH = "ABCDEFGHIJKLMNOPQRSTUVWXY0123456789:!-<>+/^? ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "001001001101010", "101101110101101", "100100100100111",
  "101111111101101", "110101101101101", "010101101101010", "110101110100100", "010101101110011", "110101110101101",
  "011100010001110", "111010010010010", "101101101101111", "101101101101010", "101101111111101", "101101010101101",
  "101101010010010",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "001010100010001", "100010001010100", "000010111010000", "001001010100100", "010111000111010",
  "111001010000010", "000000000000000" ];
const SUIT = [                                            // 7x7, bit 6 = left: spade, heart, diamond, club
  [8, 28, 62, 127, 127, 42, 28],
  [54, 73, 65, 65, 34, 20, 8],
  [8, 20, 34, 65, 34, 20, 8],
  [28, 28, 107, 127, 107, 8, 28] ];
const CHIP = [14, 21, 27, 21, 14];                        // 5x5 chip icon
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SHOE = 312, CUT = 234;                              // 6 decks; reshuffle once 75% has been dealt
const DY = 8, PY = 37, CX = 14, WX = 51;                  // dealer / player card rows, first card x, war card x
const FP = 6, FD = 14;                                    // deal: the player's card flips, then the dealer's
const RES = ["YOU WIN", "YOU LOSE", "SURRENDER", "WAR WON", "TIE WINS WAR", "WAR LOST"];
const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, bet: 5, tie: 0, raise: 0, shoe: Array(SHOE).fill(0), pos: 0,
    pc: 0, dc: 0, wp: 0, wd: 0, war: false, tieHit: false, res: 0, paid: 0, staked: 0, best: 0, wars: 0, rounds: 0,
    tb: 5, tt: 0, msg: "", msgT: 0, auto: false, pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  shuffle(g);
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m) { g.msg = m; g.msgT = 90; }
function shuffle(g) {
  for (let i = 0; i < SHOE; i++) g.shoe[i] = i;
  for (let i = SHOE - 1; i > 0; i--) { const j = rnd(g) % (i + 1), tt = g.shoe[i]; g.shoe[i] = g.shoe[j]; g.shoe[j] = tt; }
  g.pos = 0;
}
const next = g => g.shoe[g.pos++];
const rankOf = c => c % 13;
function toBet(g) {
  const c = g.bank.chips;
  if (c < 1) { setPhase(g, "broke"); return; }
  if (g.pos >= CUT) { shuffle(g); say(g, "SHUFFLING"); }
  g.bet = Math.max(1, Math.min(g.bet, Math.min(20, c)));
  g.tie = Math.min(g.tie, c - g.bet);
  setPhase(g, "bet");
  if (g.auto) {
    g.tb = 1 + rnd(g) % Math.min(20, c); g.tt = 0;
    if (rnd(g) % 3 === 0 && c - g.tb > 0) g.tt = 1 + rnd(g) % Math.min(3, c - g.tb);
  }
}

// ---- the round ---------------------------------------------------------------------------------------------------
function deal(g) {
  g.bank.chips -= g.bet + g.tie;
  g.staked = g.bet + g.tie; g.paid = 0; g.raise = 0; g.war = false;
  g.pc = next(g); g.dc = next(g);
  g.tieHit = rankOf(g.pc) === rankOf(g.dc);
  setPhase(g, "deal");
}
function pay(g, n) { g.bank.chips += n; g.paid += n; }
function afterDeal(g) {
  if (g.tie > 0) { if (g.tieHit) pay(g, g.tie * 11); setPhase(g, "tiebet"); }
  else judge(g);
}
function finish(g, res) {
  g.res = res; g.rounds++;
  if (g.paid > g.best) g.best = g.paid;
  setPhase(g, "result");
}
function judge(g) {
  const p = rankOf(g.pc), d = rankOf(g.dc);
  if (p > d) { pay(g, g.bet * 2); finish(g, 0); }
  else if (p < d) finish(g, 1);
  else setPhase(g, "choose");
}
function goWar(g) {
  g.bank.chips -= g.bet; g.raise = g.bet; g.staked += g.bet; g.war = true;
  g.pos += 3;                                             // the burn cards
  g.wp = next(g); g.wd = next(g);
  setPhase(g, "war");
}
function surrender(g) { pay(g, g.bet >> 1); finish(g, 2); }
function warEnd(g) {
  const p = rankOf(g.wp), d = rankOf(g.wd);
  if (p >= d) { pay(g, g.bet * 3); g.wars++; finish(g, p > d ? 3 : 4); }
  else finish(g, 5);
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
        if (g.pt % 4 === 0) {
          if (g.bet < g.tb) g.bet++; else if (g.bet > g.tb) g.bet--;
          else if (g.tie < g.tt) g.tie++; else if (g.tie > g.tt) g.tie--;
        }
        if (g.pt > 45 && g.bet === g.tb && g.tie === g.tt) deal(g);
      } else {
        if (eRight) { g.bet = Math.min(Math.min(20, c), g.bet + 1); g.tie = Math.min(g.tie, c - g.bet); }
        if (eLeft) g.bet = Math.max(1, g.bet - 1);
        if (eUp) g.tie = Math.min(Math.min(10, c - g.bet), g.tie + 1);
        if (eDown) g.tie = Math.max(0, g.tie - 1);
        if (eA) deal(g);
      }
      break;
    }
    case "deal":
      if (g.pt > FD + 10) afterDeal(g);
      break;
    case "tiebet":
      if (g.pt > 36) judge(g);
      break;
    case "choose": {
      const can = g.bank.chips >= g.bet;
      if (auto) { if (g.pt > 30) { if (can) goWar(g); else surrender(g); } }
      else if (eA && can) goWar(g);
      else if (eB || eA) surrender(g);
      break;
    }
    case "war":
      if (g.pt > 44) warEnd(g);
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
const centre = (b, y, s, v = 1) => text(b, 32 - ((s.length * 4 - 1) >> 1), y, s, v);
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
  sprite(b, x + 3, y + 10, SUIT[div(c, 13) % 4], 7, 0);
}
function flipCard(g, b, x, y, c, at) {                    // face down until tick `at`, then VIDEO POKER's 4-frame turn
  const f = g.pt - at;
  if (f < 0) card(b, x, y, c, false, 12);
  else if (f < 2) card(b, x, y, c, false, f === 0 ? 8 : 4);
  else if (f < 4) card(b, x, y, c, true, f === 2 ? 4 : 8);
  else card(b, x, y, c, true, 12);
}
function drawTop(g, b) {
  sprite(b, 1, 1, CHIP, 5, 1); text(b, 8, 1, "" + g.bank.chips);
  let s = "BET " + g.bet;
  if (g.raise > 0) s += "+" + g.raise;
  else if (g.tie > 0 && (g.phase === "deal" || g.phase === "tiebet")) s += " T" + g.tie;
  right(b, 1, s);
}
function drawBet(g, b) {                                  // the bet screen: bet, tie bet, odds, shoe, stash
  text(b, 2, 4, "BET"); big(b, 20, 2, "" + g.bet); right(b, 4, "1:1");
  text(b, 2, 18, "TIE"); big(b, 20, 16, "" + g.tie); right(b, 18, "10:1");
  centre(b, 30, g.msgT > 0 ? g.msg : "HIGH CARD WINS");
  centre(b, 38, "<> BET   ^ TIE");
  centre(b, 46, "SHOE " + (SHOE - g.pos));
  fill(b, 0, 55, 64, 1, 1);
  sprite(b, 1, 58, CHIP, 5, 1); text(b, 8, 58, "" + g.bank.chips);
  if (!g.auto && (g.t >> 4) & 1) right(b, 58, "A: DEAL");
}
function banner(b, y, s, inv) {                           // a centred line; inv = lit bar with dark text
  if (inv) { const w = s.length * 4 + 3; fill(b, 32 - (w >> 1), y - 1, w, 7, 1); }
  centre(b, y, s, inv ? 0 : 1);
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    big(b, 8, 2, "CASINO"); big(b, 21, 14, "WAR");
    if (g.phase === "broke") {
      centre(b, 32, "OUT OF CHIPS"); if ((g.t >> 5) & 1) centre(b, 40, "MORE TOMORROW");
      sprite(b, 23, 52, CHIP, 5, 1); text(b, 30, 52, "0");
      return b;
    }
    card(b, 18, 27, 12, true, 12); card(b, 34, 27, 24, true, 12);   // ace of spades vs king of hearts
    centre(b, 49, g.msgT > 0 ? g.msg : "HIGH CARD WINS");
    if ((g.t >> 4) & 1) centre(b, 57, "A: START");
    return b;
  }
  if (g.phase === "bet") { drawBet(g, b); return b; }
  drawTop(g, b);
  text(b, 1, DY + 1, "DLR"); text(b, 1, PY + 1, "YOU");
  if (g.phase === "deal") { flipCard(g, b, CX, PY, g.pc, FP); flipCard(g, b, CX, DY, g.dc, FD); }
  else { card(b, CX, PY, g.pc, true, 12); card(b, CX, DY, g.dc, true, 12); }
  if (g.phase === "war") {
    for (let i = 0; i < 3; i++) if (g.pt >= 4 + i * 5) card(b, 28 + i * 4, 22, 0, false, 12);
    if (g.pt >= 20) { flipCard(g, b, WX, PY, g.wp, 24); flipCard(g, b, WX, DY, g.wd, 32); }
    banner(b, 58, "WAR!", ((g.pt >> 2) & 1) === 0);
  } else if (g.war) { card(b, WX, PY, g.wp, true, 12); card(b, WX, DY, g.wd, true, 12); }

  if (g.phase === "tiebet") {
    if (g.pt > 20 || ((g.pt >> 2) & 1) === 0) banner(b, 30, g.tieHit ? "TIE BET PAYS " + g.tie * 11 : "TIE BET LOST", g.tieHit);
  } else if (g.phase === "choose") {
    const can = g.bank.chips >= g.bet;
    banner(b, 30, can ? "TIE! GO TO WAR?" : "NEED " + g.bet + " FOR WAR", false);
    centre(b, 58, can ? "A WAR  B SURR" : "A: SURRENDER");
  } else if (g.phase === "result") {
    const won = g.res === 0 || g.res === 3 || g.res === 4;
    if (g.pt > 30 || ((g.pt >> 2) & 1) === 0) banner(b, 30, RES[g.res], won);
    const d = g.res === 2 ? "BACK " + g.paid : g.paid > 0 ? "PAID " + g.paid : "LOST " + g.staked;
    if (g.auto || g.pt <= 40 || ((g.t >> 4) & 1) === 0) centre(b, 58, d);
    else centre(b, 58, "A: NEXT");
  }
  return b;
}
