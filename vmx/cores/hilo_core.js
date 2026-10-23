// HI-LO for the VMX's 64x64 1-bit screen: call the next card higher or lower and climb the ladder. Our own art and
// code; the cards and suit glyphs are VIDEO POKER's, so the casino looks like one family.
// Rules: one 52-card deck, ranks 2 (low) .. A (high); suits never matter. The deck is not reshuffled every round: it
// runs down, and is reshuffled (Fisher-Yates on the seeded RNG, "SHUFFLE" shows) at the start of a round when fewer
// than 12 cards are left, so a whole ladder (the first card + 10 calls) always fits and nothing reshuffles mid-ladder.
// A round: stake 1-10 chips (Left/Right, never more than the stash), A deals the first card face up and takes the
// stake. Then call the next card: Up = HIGHER, Down = LOWER. The same rank loses the call.
// Odds: card-aware and fair but for a fixed 3% cut. From the cards actually left in the deck (left), wins = how many
// are strictly higher (or lower); the call pays x floor(97 * left / wins) / 100 (hundredths, integer maths), shown
// for both calls before you call. A call with no winning card is shut ("--"); if neither call can win, the pot is
// collected for you. The pot starts at the stake (kept in hundredths of a chip) and is multiplied by the call's
// multiplier (rounded down to the hundredth) on a right call; a wrong call loses the pot (and so the stake).
// After any right call, B COLLECTS: the pot, rounded down to whole chips, is paid into the stash (stake included)
// and the round ends. After 10 right calls, or at a 9999-chip pot (capped there), it is collected automatically.
// Return: every single call returns at most 97% of the pot in expectation (wins/left x floor(97 left/wins)/100 <= 0.97;
// the flooring to hundredths takes off at most another 0.01 x wins/left of the pot). A round of k calls therefore
// returns about 0.97^k of the stake (k = 1: 97%, house edge 3%; k = 3: 91.3%), less the rounding down to whole chips
// at collect (under 1 chip; it hurts small stakes most: a 1-chip stake needs a pot of 2.00 to win anything).
// A x0.97 call (every card left wins) is honest but shrinks the pot; collecting is better.
// Controls: Left/Right stake, A deal; Up = higher, Down = lower, B = collect; A after a round = next round.
// Demo player: random stake 1-10 (within its stash); takes the call with more winning cards (higher on a tie);
// collects once the better call's chance drops under 60%, or after its target of 3-5 right calls (drawn at the deal)
// if the collect would win at least a chip.
// Everything is integer maths (div() for /, no floats, no sort) so the VMX's C# port in vmx-firmware/games/hilo
// plays exactly the same; keep it that way.
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here); the stake is taken at
// the deal and the collect paid back into it. Out of chips = "OUT OF CHIPS / MORE TOMORROW" until the daily top-up.
// Input: held buttons (edges found here); { auto: true } = the demo player.
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const FONTCH = "ABCDEFGHIJKLMNOPQRSTUVWXY0123456789:!-<>+/^.* ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "001001001101010", "101101110101101", "100100100100111",
  "101111111101101", "110101101101101", "010101101101010", "110101110100100", "010101101110011", "110101110101101",
  "011100010001110", "111010010010010", "101101101101111", "101101101101010", "101101111111101", "101101010101101",
  "101101010010010",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "001010100010001", "100010001010100", "000010111010000", "001001010100100", "010111000111010",
  "000000000000010", "000101010101000",
  "000000000000000" ];
const SUIT = [                                            // 7x7, bit 6 = left: spade, heart, diamond, club (poker's)
  [8, 28, 62, 127, 127, 42, 28],
  [54, 73, 65, 65, 34, 20, 8],
  [8, 20, 34, 65, 34, 20, 8],
  [28, 28, 107, 127, 107, 8, 28] ];
const CHIP = [14, 21, 27, 21, 14];                        // 5x5 chip icon
const UPA = [8, 28, 62, 127], DNA = [127, 62, 28, 8];     // 7x4 arrows
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const CY = 8, LX = 1, RX = 23;                            // the big cards' top edge, current card x, next card x
const MAXPOT = 999900, MAXCALLS = 10;
const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, stake: 5, deck: Array(52).fill(0), pos: 52,
    cur: 0, nxt: 0, pick: 0, pot: 0, streak: 0, hiW: 0, loW: 0, left: 0, mHi: 0, mLo: 0, drawn: Array(11).fill(0), nd: 0,
    win: 0, tie: false, target: 5, wantWins: 3, msg: "", msgT: 0, auto: false,
    pUp: false, pDown: false, pLeft: false, pRight: false, pA: false, pB: false };
  shuffle(g);
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus, 90);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function say(g, m, n) { g.msg = m; g.msgT = n; }
export function fmt(p) { const c = p % 100; return div(p, 100) + "." + (c < 10 ? "0" : "") + c; }
const mult = (g, w) => w > 0 ? div(97 * g.left, w) : 0;
function toBet(g) {
  if (g.bank.chips < 1) { setPhase(g, "broke"); return; }
  g.stake = Math.max(1, Math.min(g.stake, Math.min(10, g.bank.chips)));
  setPhase(g, "bet");
  if (g.auto) g.target = Math.min(1 + rnd(g) % 10, g.bank.chips);
}
function shuffle(g) {
  for (let i = 0; i < 52; i++) g.deck[i] = i;
  for (let i = 51; i > 0; i--) { const j = rnd(g) % (i + 1), tt = g.deck[i]; g.deck[i] = g.deck[j]; g.deck[j] = tt; }
  g.pos = 0;
}
function deal(g) {
  if (52 - g.pos < 12) { shuffle(g); say(g, "SHUFFLE", 40); }
  g.bank.chips -= g.stake;
  g.cur = g.deck[g.pos++]; g.drawn[0] = g.cur; g.nd = 1;
  g.pot = g.stake * 100; g.streak = 0; g.win = 0; g.tie = false; g.pick = 0;
  if (g.auto) g.wantWins = 3 + rnd(g) % 3;
  setPhase(g, "deal");
}
function odds(g) {                                        // count the deck that is left against the current card
  const cr = g.cur % 13; g.hiW = 0; g.loW = 0; g.left = 52 - g.pos;
  for (let i = g.pos; i < 52; i++) { const r = g.deck[i] % 13; if (r > cr) g.hiW++; else if (r < cr) g.loW++; }
  g.mHi = mult(g, g.hiW); g.mLo = mult(g, g.loW);
}
function toCall(g) {
  odds(g);
  if (g.hiW === 0 && g.loW === 0) { collect(g); return; }
  setPhase(g, "call");
}
function call(g, p) { g.pick = p; g.nxt = g.deck[g.pos++]; setPhase(g, "reveal"); }
function collect(g) { g.win = div(g.pot, 100); g.bank.chips += g.win; setPhase(g, "won"); }
function judge(g) {
  const r = g.nxt % 13, cr = g.cur % 13;
  const ok = g.pick === 1 ? r > cr : r < cr;
  g.drawn[g.nd++] = g.nxt;
  if (!ok) { g.tie = r === cr; setPhase(g, "lost"); return; }
  const m = g.pick === 1 ? g.mHi : g.mLo;
  g.pot = div(g.pot, 100) * m + div((g.pot % 100) * m, 100);
  if (g.pot > MAXPOT) g.pot = MAXPOT;
  g.streak++;
  setPhase(g, "right");
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
      const top = Math.min(10, g.bank.chips);
      if (auto) {
        if (g.pt % 5 === 0) { if (g.stake < g.target) g.stake++; else if (g.stake > g.target) g.stake--; }
        if (g.pt > 45 && g.stake === g.target) deal(g);
      } else {
        if (eRight) g.stake = Math.min(top, g.stake + 1);
        if (eLeft) g.stake = Math.max(1, g.stake - 1);
        if (eA) deal(g);
      }
      break;
    }
    case "deal":
      if (g.pt > 10) toCall(g);
      break;
    case "call":
      if (auto) {
        if (g.pt === 24) {
          const best = Math.max(g.hiW, g.loW);
          if (g.streak > 0 && (best * 5 < g.left * 3 || (g.streak >= g.wantWins && div(g.pot, 100) > g.stake))) collect(g);
          else call(g, g.hiW >= g.loW ? 1 : 2);
        }
      } else {
        if (eUp && g.hiW > 0) call(g, 1);
        else if (eDown && g.loW > 0) call(g, 2);
        else if (eB && g.streak > 0) collect(g);
      }
      break;
    case "reveal":
      if (g.pt > 14) judge(g);
      break;
    case "right":
      if (g.pt > 20) {
        g.cur = g.nxt;
        if (g.streak >= MAXCALLS || g.pot >= MAXPOT) collect(g); else toCall(g);
      }
      break;
    case "won": case "lost":
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
function box(b, x, y, w, h) { fill(b, x, y, w, 1, 1); fill(b, x, y + h - 1, w, 1, 1); fill(b, x, y, 1, h, 1); fill(b, x + w - 1, y, 1, h, 1); }
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
const tw = s => s.length * 4 - 1;
const centre = (b, y, s) => text(b, 32 - (tw(s) >> 1), y, s);
const right = (b, y, s) => text(b, 64 - s.length * 4, y, s);
function sprite(b, x, y, rows, w, v) {
  for (let r = 0; r < rows.length; r++) for (let q = 0; q < w; q++) if ((rows[r] >> (w - 1 - q)) & 1) px(b, x + q, y + r, v);
}
function sprite2(b, x, y, rows, w, v) {                   // at double size
  for (let r = 0; r < rows.length; r++) for (let q = 0; q < w; q++) if ((rows[r] >> (w - 1 - q)) & 1) fill(b, x + q * 2, y + r * 2, 2, 2, v);
}
function back(b, x0, y, w, h) {                           // poker's back: a dark ring, then a diamond lattice
  fill(b, x0 + 1, y + 1, w - 2, h - 2, 0);
  for (let j = 2; j < h - 2; j++) {
    for (let i = (4 - j % 4) % 4; i < w - 2; i += 4) if (i >= 2) px(b, x0 + i, y + j, 1);
    for (let i = j % 4; i < w - 2; i += 4) if (i >= 2) px(b, x0 + i, y + j, 1);
  }
}
function bigCard(b, x, y, c, face, w) {                   // 20 x 30; w < 20 = mid-flip (narrowed, plain)
  const x0 = x + ((20 - w) >> 1);
  fill(b, x0, y + 1, w, 28, 1); fill(b, x0 + 1, y, w - 2, 1, 1); fill(b, x0 + 1, y + 29, w - 2, 1, 1);
  if (!face) { back(b, x0, y, w, 30); return; }
  if (w < 20) return;
  const r = c % 13;
  if (r === 8) { big(b, x + 2, y + 2, "1", 0); big(b, x + 10, y + 2, "0", 0); } else big(b, x + 2, y + 2, RANKS[r], 0);
  sprite2(b, x + 3, y + 14, SUIT[div(c, 13)], 7, 0);
}
function miniCard(b, x, y, c) {                           // 7 x 7 in the strip: rank only
  fill(b, x, y + 1, 7, 5, 1); fill(b, x + 1, y, 5, 1, 1); fill(b, x + 1, y + 6, 5, 1, 1);
  const r = c % 13;
  if (r === 8) { fill(b, x + 1, y + 1, 1, 5, 0); text(b, x + 3, y + 1, "0", 0); } else text(b, x + 2, y + 1, RANKS[r], 0);
}
function flipCard(b, x, c, f) {                           // f ticks into a flip: back narrows, face widens
  if (f < 2) bigCard(b, x, CY, c, false, 14);
  else if (f < 4) bigCard(b, x, CY, c, false, 6);
  else if (f < 6) bigCard(b, x, CY, c, true, 6);
  else if (f < 8) bigCard(b, x, CY, c, true, 14);
  else bigCard(b, x, CY, c, true, 20);
}
function drawCalls(g, b) {                                // the right column: arrows, HI / LO and the multipliers
  const show = g.phase === "call" || g.phase === "reveal" || g.phase === "right" || g.phase === "lost";
  for (let k = 0; k < 2; k++) {
    const y = CY + k * 15, lit = (g.phase === "reveal" || g.phase === "right" || g.phase === "lost") && g.pick === k + 1;
    if (lit) fill(b, 44, y - 1, 20, 14, 1);
    sprite(b, 46, y + 1, k === 0 ? UPA : DNA, 7, lit ? 0 : 1);
    text(b, 55, y, k === 0 ? "HI" : "LO", lit ? 0 : 1);
    if (!show) continue;
    const m = k === 0 ? g.mHi : g.mLo;
    let s = "--";
    if (m > 0) s = m < 1000 ? "*" + fmt(m) : fmt(m);
    text(b, 65 - s.length * 4, y + 7, s, lit ? 0 : 1);
  }
}
function drawStrip(g, b) {
  const n0 = g.nd > 8 ? g.nd - 8 : 0;
  for (let i = n0; i < g.nd; i++) miniCard(b, (i - n0) * 8, 48, g.drawn[i]);
}
function msgBox(b, l1, l2) {
  fill(b, 0, 38, 64, 19, 0); box(b, 1, 39, 62, 18); box(b, 3, 41, 58, 14);
  centre(b, 43, l1); centre(b, 49, l2);
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  if (g.phase === "title" || g.phase === "broke") {
    big(b, 12, 2, "HI-LO");
    bigCard(b, 9, 15, 44, true, 20);                      // a 7 of clubs, the arrows, a card face down
    sprite(b, 29, 21, UPA, 7, 1); sprite(b, 29, 33, DNA, 7, 1);
    bigCard(b, 37, 15, 0, false, 20);
    if (g.phase === "broke") {
      fill(b, 0, 46, 64, 18, 0);
      centre(b, 48, "OUT OF CHIPS"); if ((g.t >> 5) & 1) centre(b, 56, "MORE TOMORROW");
      return b;
    }
    centre(b, 48, g.msgT > 0 ? g.msg : "HIGHER OR LOWER");
    if ((g.t >> 4) & 1) centre(b, 57, "A: START");
    return b;
  }
  sprite(b, 1, 1, CHIP, 5, 1); text(b, 8, 1, "" + g.bank.chips);
  if (g.phase === "bet") right(b, 1, "DECK " + (52 - g.pos));
  else right(b, 1, "STREAK " + g.streak);

  // the cards
  if (g.phase === "bet") { bigCard(b, LX, CY, 0, false, 20); bigCard(b, RX, CY, 0, false, 20); }
  else if (g.phase === "deal") { flipCard(b, LX, g.cur, g.pt - 1); bigCard(b, RX, CY, 0, false, 20); }
  else if (g.phase === "reveal") { bigCard(b, LX, CY, g.cur, true, 20); flipCard(b, RX, g.nxt, g.pt - 1); }
  else if (g.phase === "right") {
    bigCard(b, LX, CY, g.cur, true, 20);
    if (g.pt > 12) { bigCard(b, RX, CY, 0, false, 20); bigCard(b, RX - div(22 * (g.pt - 12), 8), CY, g.nxt, true, 20); }
    else bigCard(b, RX, CY, g.nxt, true, 20);
  } else if (g.phase === "lost") { bigCard(b, LX, CY, g.cur, true, 20); bigCard(b, RX, CY, g.nxt, true, 20); }
  else { bigCard(b, LX, CY, g.cur, true, 20); bigCard(b, RX, CY, 0, false, 20); }
  drawCalls(g, b);

  // pot / stake line, the strip, the hint
  if (g.phase === "bet") {
    text(b, 1, 40, "STAKE"); const s = "" + g.stake;
    text(b, 24, 40, "<"); text(b, 30 + (s.length === 1 ? 2 : 0), 40, s); text(b, 40, 40, ">");
  } else text(b, 1, 40, "POT " + fmt(g.pot));
  drawStrip(g, b);
  let hint = "";
  if (g.msgT > 0 && g.phase !== "won" && g.phase !== "lost") hint = g.msg;
  else if (g.phase === "bet") hint = (g.t >> 4) & 1 ? "A: DEAL" : "< > STAKE";
  else if (g.phase === "call") hint = g.streak > 0 && ((g.t >> 5) & 1) ? "B: COLLECT " + div(g.pot, 100) : "UP OR DOWN";
  else if (g.phase === "right") hint = g.pick === 1 ? "HIGHER!" : "LOWER!";
  else if ((g.phase === "won" || g.phase === "lost") && !g.auto && ((g.t >> 4) & 1)) hint = "A: NEXT";
  if (hint) centre(b, 58, hint);
  if (g.phase === "won") msgBox(b, g.streak >= MAXCALLS || g.pot >= MAXPOT ? "TOP OF LADDER" : "COLLECTED", "+" + g.win + " CHIPS");
  else if (g.phase === "lost") msgBox(b, g.tie ? "SAME RANK" : "WRONG", "LOST " + g.stake);
  return b;
}
