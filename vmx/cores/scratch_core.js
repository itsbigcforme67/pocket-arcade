// SCRATCH CARDS for the VMX's 64x64 1-bit screen: instant lottery tickets you scratch with a coin. Our own art and
// code (generic tickets, no real lottery's names or layouts). A VMX CASINO table.
// The shop: Left/Right picks the ticket, Up/Down its price (1, 2 or 5 chips, never more than the stash), A buys,
// B shows the prize table (prizes, odds and the return). The ticket: the D-pad moves the coin (faster when held), hold
// A to scratch the latex off (a 6x6 brush on a grid of 2x2-pixel cells), B = REVEAL ALL. A spot that is half
// scratched flakes off by itself; when every spot is showing (or after REVEAL ALL) the result is announced and paid.
// Then A buys the same ticket again, B goes back to the shop.
// Two tickets (amounts are x the ticket price; a prize is what you receive - the price was taken when you bought):
//   MATCH 3: a 3x3 grid of amounts (1 2 5 10 20 50 100 500); three of the same amount wins that amount.
//   LUCKY 7: six spots, each a number with an amount under it; every 7 wins the amount under it (up to three 7s).
// The outcome is drawn when the ticket is bought (one rnd() 0..65535 against the weights below, out of 65536), then the
// hidden symbols are laid out to show exactly that result: a MATCH 3 loser never has any amount three times, a winner
// has its amount exactly three times and every other amount at most twice; LUCKY 7 shows a 7 only on winning spots.
// Scratching only uncovers what was already decided.
//   MATCH 3  prize  1      2     5     10    20    50    100    500        (x price)
//            weight 14000  6000  2100  1000  330   66    26     3          (/65536)
//            odds   1:4.7  1:11  1:31  1:66  1:199 1:993 1:2521 1:21845
//            return 60500/65536 = 92.32% (house edge 7.68%), wins on 23525/65536 = 35.9% of tickets.
//   LUCKY 7  prize  1      2     3     5     10    20    50    100    500  (x price; e.g. 20 = one 7 on 20, two on 10,
//            weight 12000  5000  2500  1900  900   300   70    30     2     or a 10 and two 5s)
//            return 61500/65536 = 93.84% (house edge 6.16%), wins on 22702/65536 = 34.6% of tickets.
// The price doesn't change the return (every prize scales with it). Real scratch tickets return ~60-70%; VMX CASINO's
// are kinder. Top prize: 500 x 5 = 2500 chips.
// VMX CASINO: newGame(seed, bank): bank = { chips, bonus } (the VMX's chip bank, mutated here): the price leaves the
// bank when the ticket is bought, the prize comes back when it is revealed. Broke (no chips) = OUT OF CHIPS until
// tomorrow's top-up. Integer maths only, so the VMX's C# port (vmx-firmware/games/scratch/Scratch.cs) plays exactly
// the same. Input: held buttons (edges found here); { auto: true } = the demo player. Pure logic + drawing, 30 Hz.

export const W = 64, H = 64;
const FONTCH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:!-<>+/%. ";
const FONT = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111", "111100110100100",
  "011100101101011", "101101111101101", "111010010010111", "001001001101010", "101101110101101", "100100100100111",
  "101111111101101", "110101101101101", "010101101101010", "110101110100100", "010101101110011", "110101110101101",
  "011100010001110", "111010010010010", "101101101101111", "101101101101010", "101101111111101", "101101010101101",
  "101101010010010", "111001010100111",
  "111101101101111", "010110010010111", "110001010100111", "110001010001110", "101101111001001", "111100110001110",
  "011100111101111", "111001010010010", "111101111101111", "111101111001110", "000010000010000", "010010010000010",
  "000000111000000", "001010100010001", "100010001010100", "000010111010000", "001001010100100", "101001010100101",
  "000000000000010", "000000000000000" ];
const SEVEN = [ "###########", "###########", "#.......##.", ".......##..", "......##...", ".....###...", "....###....",
  "....###....", "...###.....", "...###.....", "...###....." ];
export const PRICES = [1, 2, 5];
export const AM = [1, 2, 5, 10, 20, 50, 100, 500];                  // the amounts on the tickets (x price)
export const M3W = [14000, 6000, 2100, 1000, 330, 66, 26, 3];      // MATCH 3: weight of winning AM[i] (/65536)
export const L7T = [1, 2, 3, 5, 10, 20, 50, 100, 500];             // LUCKY 7: the prize tiers (x price)
export const L7W = [12000, 5000, 2500, 1900, 900, 300, 70, 30, 2];
export const L7C = [                                               // ... and the 7s that show each (AM indexes)
  [[0]], [[1], [0, 0]], [[1, 0], [0, 0, 0]], [[2], [1, 1, 0]], [[3], [2, 2]], [[4], [3, 3], [3, 2, 2]],
  [[5], [4, 4, 3]], [[6], [5, 5]], [[7]] ];
const NAME = ["MATCH 3", "LUCKY 7"], TAG = ["3 ALIKE WINS", "ANY 7 WINS"];
const PM = 0x7FFFFFFE;                                    // panel columns 1..30 of the 32-cell scratch rows
const R0 = 4, R1 = 24;                                    // panel rows (cells of 2x2 px): pixels x 2..61, y 8..49
const UB = 1, DB = 2, LB = 4, RB = 8, AB = 16, BB = 32;   // button bits (as the VMX's Buttons)
const POP = []; for (let i = 0; i < 256; i++) { let n = 0; for (let v = i; v; v >>= 1) n += v & 1; POP.push(n); }

const div = (a, b) => Math.trunc(a / b);                  // C#'s int division

export function newGame(seed = 1, bank = { chips: 100, bonus: 0 }) {
  const g = { bank, rs: seed >>> 0, t: 0, phase: "title", pt: 0, msg: "", msgT: 0,
    kind: 0, pi: 0, price: 1, tier: -1, prize: 0, best: 0, tickets: 0, nsym: 9,
    val: Array(9).fill(0), amt: Array(9).fill(0), rev: Array(9).fill(0), mask: Array(32).fill(0),
    cx: 12, cy: 14, mv: 0, armed: 0, wipe: 0, scr: 0, prev: 0,
    dKind: 0, dPi: 0, dShow: 0, dSeen: -1, dDir: 1, dTy: 14, dRev: -1, dNext: 0 };
  if (bank.bonus > 0) say(g, "DAILY CHIPS +" + bank.bonus);
  return g;
}
function rnd(g) { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs >>> 16; }
function say(g, m) { g.msg = m; g.msgT = 90; }
function setPhase(g, p) { g.phase = p; g.pt = 0; }
function maxPi(g) { let j = 2; while (j > 0 && PRICES[j] > g.bank.chips) j--; return j; }
function toShop(g) {
  if (g.bank.chips < 1) { setPhase(g, "broke"); return; }
  g.pi = Math.min(g.pi, maxPi(g)); setPhase(g, "shop");
}
export function spotX(g, i) { return 2 + (i % 3) * 20; }
export function spotY(g, i) { return 8 + div(i, 3) * (g.kind === 0 ? 14 : 22); }

function buy(g) {                                         // the price goes in and the ticket's result is drawn now
  g.price = PRICES[g.pi]; g.bank.chips -= g.price; g.tickets++;
  const r = rnd(g); let acc = 0; g.tier = -1;
  if (g.kind === 0) {
    for (let i = 0; i < 8; i++) { acc += M3W[i]; if (r < acc) { g.tier = i; break; } }
    g.prize = g.tier >= 0 ? AM[g.tier] * g.price : 0; g.nsym = 9;
    const cnt = Array(8).fill(0); let s = 0;
    if (g.tier >= 0) { g.val[0] = g.val[1] = g.val[2] = g.tier; cnt[g.tier] = 3; s = 3; }
    for (let i = s; i < 9; i++) {                         // the rest: never the prize amount, any other at most twice
      let v; do { v = rnd(g) % 8; } while (v === g.tier || cnt[v] >= 2);
      g.val[i] = v; cnt[v]++;
    }
    for (let i = 8; i > 0; i--) { const j = rnd(g) % (i + 1), x = g.val[i]; g.val[i] = g.val[j]; g.val[j] = x; }
  } else {
    for (let i = 0; i < 9; i++) { acc += L7W[i]; if (r < acc) { g.tier = i; break; } }
    g.prize = g.tier >= 0 ? L7T[g.tier] * g.price : 0; g.nsym = 6;
    let comp = null; if (g.tier >= 0) comp = L7C[g.tier][rnd(g) % L7C[g.tier].length];
    const n = comp ? comp.length : 0;
    for (let i = 0; i < 6; i++) {
      if (i < n) { g.val[i] = 7; g.amt[i] = comp[i]; }
      else { let d = 1 + rnd(g) % 8; if (d >= 7) d++; g.val[i] = d; g.amt[i] = rnd(g) % 8; }   // any number but 7
    }
    for (let i = 5; i > 0; i--) {
      const j = rnd(g) % (i + 1); let x = g.val[i]; g.val[i] = g.val[j]; g.val[j] = x;
      x = g.amt[i]; g.amt[i] = g.amt[j]; g.amt[j] = x;
    }
  }
  for (let i = 0; i < 32; i++) g.mask[i] = 0;
  for (let i = 0; i < 9; i++) g.rev[i] = 0;
  g.cx = 12; g.cy = 14; g.mv = 0; g.armed = 0; g.scr = 0;
  setPhase(g, "scratch");
}
export function shownPrize(g) {                           // what the laid-out ticket shows (for checking buy())
  if (g.kind === 0) {
    const cnt = Array(8).fill(0); for (let i = 0; i < 9; i++) cnt[g.val[i]]++;
    let p = 0, n = 0; for (let v = 0; v < 8; v++) if (cnt[v] >= 3) { p = AM[v] * g.price; n++; }
    return n > 1 ? -1 : p;
  }
  let p = 0; for (let i = 0; i < 6; i++) if (g.val[i] === 7) p += AM[g.amt[i]] * g.price;
  return p;
}
function keyR0(g, i) { const y = spotY(g, i) >> 1; return g.kind === 0 ? y + 2 : y + 1; }
function keyR1(g, i) { const y = spotY(g, i) >> 1; return g.kind === 0 ? y + 4 : y + 9; }
function checkSpots(g) {                                  // a half-scratched spot flakes off; all showing = the result
  let all = 1;
  for (let i = 0; i < g.nsym; i++) {
    if (g.rev[i] === 0) {
      const c0 = (spotX(g, i) >> 1) + 1, r0 = keyR0(g, i), r1 = keyR1(g, i);
      let n = 0; for (let r = r0; r <= r1; r++) n += POP[(g.mask[r] >> c0) & 255];
      if (n * 2 >= (r1 - r0 + 1) * 8) { g.rev[i] = 1; for (let r = r0; r <= r1; r++) g.mask[r] |= 255 << c0; }
    }
    if (g.rev[i] === 0) all = 0;
  }
  if (all) finish(g);
}
function finish(g) {
  for (let i = 0; i < 9; i++) g.rev[i] = 1;
  if (g.prize > 0) { g.bank.chips += g.prize; if (g.prize > g.best) g.best = g.prize; }
  setPhase(g, "result");
}
function brush(g) {
  const c = g.cx >> 1, r = g.cy >> 1, add = (7 << (c - 1)) & PM; let ch = 0;
  for (let y = r - 1; y <= r + 1; y++) {
    if (y < R0 || y > R1) continue;
    if ((g.mask[y] | add) !== g.mask[y]) { g.mask[y] |= add; ch = 1; }
  }
  return ch;
}

function demoHeld(g) {                                    // the demo player, as held buttons
  let k = 0;
  switch (g.phase) {
    case "shop":
      if (g.pt === 10) { g.dKind = rnd(g) % 2; g.dPi = rnd(g) % 3; g.dShow = 0; if (g.tickets % 6 === 2 && g.dSeen !== g.tickets) { g.dShow = 1; g.dSeen = g.tickets; } }
      if (g.pt > 10 && g.pt % 6 === 0) {
        if (g.kind !== g.dKind) k = RB;
        else if (g.pi < g.dPi && g.pi < maxPi(g)) k = UB;
        else if (g.pi > g.dPi) k = DB;
        else if (g.dShow) { g.dShow = 0; k = BB; }
        else if (g.pt > 30) k = AB;
      }
      break;
    case "prizes": if (g.pt === 75) k = BB; break;
    case "scratch":
      if (g.pt === 1) { g.dDir = 1; g.dTy = g.cy; const q = rnd(g) % 4; g.dRev = q === 0 ? 20 + rnd(g) % 120 : -1; }
      if (g.pt === g.dRev) { k = BB; break; }
      if (g.pt > 6) {                                     // sweep the panel in rows, coin down, scratching all the way
        k = AB;
        if (g.cy < g.dTy) k |= DB;
        else if (g.cy > g.dTy + 1) k |= UB;
        else if (g.dDir > 0) { if (g.cx < 59) k |= RB; else { g.dDir = -1; g.dTy = g.cy + 5 > 47 ? 10 : g.cy + 5; } }
        else { if (g.cx > 4) k |= LB; else { g.dDir = 1; g.dTy = g.cy + 5 > 47 ? 10 : g.cy + 5; } }
      }
      break;
    case "result":
      if (g.pt === 1) g.dNext = rnd(g) % 3;
      if (g.pt === 70) k = g.dNext === 0 ? BB : AB;
      break;
  }
  return k;
}

export function step(g, h) {
  g.t++; g.pt++; if (g.msgT > 0) g.msgT--;
  const k = h.auto ? demoHeld(g)
    : (h.up ? UB : 0) | (h.down ? DB : 0) | (h.left ? LB : 0) | (h.right ? RB : 0) | (h.a ? AB : 0) | (h.b ? BB : 0);
  const e = k & ~g.prev; g.prev = k;
  switch (g.phase) {
    case "title":
      if ((e & AB) || (h.auto && g.pt > 40)) toShop(g);
      break;
    case "shop":
      if (e & (LB | RB)) g.kind ^= 1;
      if (e & UB) g.pi = Math.min(g.pi + 1, maxPi(g));
      if (e & DB) g.pi = Math.max(0, g.pi - 1);
      if (e & AB) buy(g);
      else if (e & BB) setPhase(g, "prizes");
      break;
    case "prizes":
      if (e & (AB | BB)) setPhase(g, "shop");
      break;
    case "scratch": {
      if (e & BB) { g.wipe = R0; setPhase(g, "reveal"); break; }
      const dx = (k & RB ? 1 : 0) - (k & LB ? 1 : 0), dy = (k & DB ? 1 : 0) - (k & UB ? 1 : 0);
      if (k & (UB | DB | LB | RB)) g.mv++; else g.mv = 0;
      const sp = g.mv > 8 ? 2 : 1;
      g.cx = Math.max(2, Math.min(61, g.cx + dx * sp)); g.cy = Math.max(8, Math.min(49, g.cy + dy * sp));
      g.scr = 0;
      if (!(k & AB)) g.armed = 1;
      else if (g.armed && brush(g)) { g.scr = 1; checkSpots(g); }
      break;
    }
    case "reveal":                                        // REVEAL ALL: the latex comes off two rows a tick
      g.mask[g.wipe] = PM; g.mask[g.wipe + 1] = PM; g.wipe += 2;
      if (g.wipe > R1) finish(g);
      break;
    case "result":
      if (e & AB) { if (g.bank.chips >= g.price) buy(g); else toShop(g); }
      else if (e & BB) toShop(g);
      break;
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
function big(b, x, y, s, v) {
  for (let n = 0; n < s.length; n++) {
    let f = FONTCH.indexOf(s[n]); if (f < 0) f = FONTCH.length - 1;
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (FONT[f][r * 3 + q] === "1") fill(b, x + q * 2, y + r * 2, 2, 2, v);
    x += 8;
  }
}
const tw = s => s.length * 4 - 1;
const centre = (b, y, s) => text(b, 32 - (tw(s) >> 1), y, s, 1);
function seven(b, x, y, v) {
  for (let r = 0; r < 11; r++) for (let q = 0; q < 11; q++) if (SEVEN[r][q] === "#") px(b, x + q, y + r, v);
}
function latex(b, x, y, w, h) {                           // the scratch-off coating: lit on even rows, dark on odd
  for (let j = y; j < y + h; j++) fill(b, x, j, w, 1, (j & 1) === 0 ? 1 : 0);
}
function coin(b, x, y) {
  fill(b, x - 1, y - 3, 3, 1, 0); fill(b, x - 2, y - 2, 5, 1, 0); fill(b, x - 3, y - 1, 7, 3, 0);
  fill(b, x - 2, y + 2, 5, 1, 0); fill(b, x - 1, y + 3, 3, 1, 0);
  fill(b, x - 1, y - 2, 3, 1, 1); fill(b, x - 2, y - 1, 5, 3, 1); fill(b, x - 1, y + 2, 3, 1, 1);
  px(b, x, y, 0);
}
function drawSpots(g, b) {
  const blink = g.phase === "result" && g.tier >= 0 && ((g.t >> 2) & 1) === 1;
  for (let i = 0; i < g.nsym; i++) {
    const x0 = spotX(g, i), y0 = spotY(g, i);
    if (g.kind === 0) {
      const s = "" + AM[g.val[i]] * g.price, hi = blink && g.val[i] === g.tier;
      if (hi) fill(b, x0 + 2, y0 + 4, 16, 7, 1);
      text(b, x0 + 10 - (tw(s) >> 1), y0 + 5, s, hi ? 0 : 1);
    } else {
      const s = "" + AM[g.amt[i]] * g.price, hi = blink && g.val[i] === 7;
      if (hi) fill(b, x0 + 2, y0 + 1, 16, 19, 1);
      if (g.val[i] === 7) seven(b, x0 + 5, y0 + 2, hi ? 0 : 1); else big(b, x0 + 7, y0 + 2, "" + g.val[i], 1);
      text(b, x0 + 10 - (tw(s) >> 1), y0 + 14, s, hi ? 0 : 1);
    }
  }
}
function drawCoating(g, b) {
  for (let r = R0; r <= R1; r++) {
    const m = g.mask[r];
    if (m === PM) continue;
    if (m === 0) { fill(b, 2, r * 2, 60, 1, 1); fill(b, 2, r * 2 + 1, 60, 1, 0); continue; }
    let c = 1;
    while (c <= 30) {
      if ((m >> c) & 1) { c++; continue; }
      const c0 = c; while (c <= 30 && ((m >> c) & 1) === 0) c++;
      fill(b, c0 * 2, r * 2, (c - c0) * 2, 1, 1); fill(b, c0 * 2, r * 2 + 1, (c - c0) * 2, 1, 0);
    }
  }
}
function drawTicket(g, b) {
  fill(b, 0, 0, 64, 7, 1); text(b, 2, 1, NAME[g.kind], 0);
  const ps = g.price + (g.price === 1 ? " CHIP" : " CHIPS"); text(b, 62 - tw(ps), 1, ps, 0);
  box(b, 1, 7, 62, 44);
  drawSpots(g, b); drawCoating(g, b);
  if (g.phase === "scratch") coin(b, g.cx, g.cy + (g.scr && (g.t & 1) ? 1 : 0));
  if (g.phase === "result") {
    if (g.prize > 0) {
      const s = "WIN " + g.prize;
      if (g.pt < 90 && ((g.t >> 2) & 1) === 1) { fill(b, 30 - (tw(s) >> 1), 51, tw(s) + 4, 7, 1); text(b, 32 - (tw(s) >> 1), 52, s, 0); }
      else centre(b, 52, s);
    } else centre(b, 52, "NO WIN");
    const k = (g.t >> 5) % 3;
    centre(b, 58, g.msgT > 0 ? g.msg : k === 0 ? "A: AGAIN" : k === 1 ? "B: SHOP" : "CHIPS " + g.bank.chips);
    if (g.prize >= 50 * g.price && g.pt < 24 && ((g.t >> 2) & 1) === 1) for (let i = 0; i < 4096; i++) b[i] ^= 1;
  } else {
    centre(b, 52, "CHIPS " + g.bank.chips);
    centre(b, 58, g.msgT > 0 ? g.msg : ((g.t >> 5) & 1) === 0 ? "A: SCRATCH" : "B: REVEAL ALL");
  }
}
function drawShop(g, b) {
  text(b, 1, 1, "CHIPS " + g.bank.chips, 1); text(b, 63 - tw("SHOP"), 1, "SHOP", 1);
  box(b, 2, 8, 60, 36);
  text(b, 5, 11, "<", 1); text(b, 56, 11, ">", 1); centre(b, 11, NAME[g.kind]);
  if (g.kind === 0) {
    for (let i = 0; i < 3; i++) box(b, 10 + i * 16, 18, 13, 9);
    text(b, 13, 20, "20", 1); latex(b, 27, 19, 11, 7); text(b, 45, 20, "20", 1);
  } else {
    box(b, 11, 17, 13, 13); latex(b, 12, 18, 11, 11); seven(b, 27, 18, 1); box(b, 40, 17, 13, 13); latex(b, 41, 18, 11, 11);
  }
  centre(b, 31, TAG[g.kind]);
  centre(b, 37, "TOP " + 500 * PRICES[g.pi]);
  text(b, 2, 47, "PRICE", 1);
  for (let j = 0; j < 3; j++) {
    const x = 30 + j * 12, s = "" + PRICES[j];
    if (j === g.pi) { fill(b, x - 2, 45, 7, 9, 1); text(b, x, 47, s, 0); }
    else { text(b, x, 47, s, 1); if (PRICES[j] > g.bank.chips) fill(b, x - 1, 49, 5, 1, 1); }
  }
  const k = (g.t >> 5) % 4;
  centre(b, 57, g.msgT > 0 ? g.msg : k === 0 ? "A: BUY" : k === 1 ? "< >: TICKET" : k === 2 ? "UP DOWN: PRICE" : "B: PRIZES");
  if (g.phase === "broke") {
    fill(b, 8, 17, 48, 19, 0); box(b, 8, 17, 48, 19);
    centre(b, 21, "OUT OF"); centre(b, 28, "CHIPS");
    fill(b, 0, 55, 64, 9, 0); centre(b, 57, ((g.t >> 5) & 1) === 1 ? "MORE TOMORROW" : "COME BACK");
  }
}
function drawPrizes(g, b) {
  fill(b, 0, 0, 64, 7, 1); text(b, 1, 1, NAME[g.kind], 0);
  const n = g.kind === 0 ? 8 : 9; let sum = 0;
  for (let i = 0; i < n; i++) sum += g.kind === 0 ? AM[i] * M3W[i] : L7T[i] * L7W[i];
  const rt = div(sum * 1000 + 32768, 65536), rs = div(rt, 10) + "." + rt % 10 + "%";
  text(b, 63 - tw(rs), 1, rs, 0);
  const pr = PRICES[g.pi];
  for (let i = 0; i < n; i++) {
    const j = n - 1 - i, w = g.kind === 0 ? M3W[j] : L7W[j], m = g.kind === 0 ? AM[j] : L7T[j], y = 9 + i * 6;
    text(b, 2, y, "" + m * pr, 1);
    const os = "1 IN " + div(65536 + (w >> 1), w); text(b, 63 - tw(os), y, os, 1);
  }
}
function drawTitle(g, b) {
  big(b, 4, 3, "SCRATCH", 1);
  box(b, 10, 17, 44, 22);
  seven(b, 14, 22, 1);
  latex(b, 28, 19, 24, 18);
  fill(b, 30, 24, 13, 9, 0); text(b, 33, 26, "50", 1);
  coin(b, 46, 30);
  centre(b, 43, g.msgT > 0 ? g.msg : "1 2 OR 5 CHIPS");
  if ((g.t >> 4) & 1) centre(b, 55, "A: START");
}

export function draw(g) {
  const b = new Uint8Array(W * H);
  switch (g.phase) {
    case "title": drawTitle(g, b); break;
    case "shop": case "broke": drawShop(g, b); break;
    case "prizes": drawPrizes(g, b); break;
    default: drawTicket(g, b);
  }
  return b;
}
