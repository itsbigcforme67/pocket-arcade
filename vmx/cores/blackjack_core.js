// BLACKJACK AND HOOKERS: blackjack with a fishing theme for the VMX's 64x64 1-bit screen (owner's title; the
// hookers are fishing hooks). Written from scratch. Rules: 4-deck shoe (reshuffled at 3/4 used), dealer stands on
// all 17s, blackjack pays 3:2, double on the first two cards; no split / insurance (yet). You bet bait; the suits
// are fish, hooks, shells and worms. Left/right set the bet and A deals; then A hits, B stands, Up doubles.
// Pure logic + drawing into a 64x64 bit buffer, seeded, 30 Hz ticks.

export const W = 64, H = 64;
const FONT = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",D:"110101101101110",E:"111100110100111",F:"111100110100100",
  G:"011100101101011",H:"101101111101101",I:"111010010010111",J:"001001001101010",K:"101101110101101",L:"100100100100111",
  M:"101111111101101",N:"110101101101101",O:"010101101101010",P:"110101110100100",Q:"010101101110011",R:"110101110101101",
  S:"011100010001110",T:"111010010010010",U:"101101101101111",V:"101101101101010",W:"101101111111101",X:"101101010101101",
  Y:"101101010010010",Z:"111001010100111","0":"111101101101111","1":"010110010010111","2":"110001010100111",
  "3":"110001010001110","4":"101101111001001","5":"111100110001110","6":"011100111101111","7":"111001010010010",
  "8":"111101111101111","9":"111101111001110"," ":"000000000000000","!":"010010010000010","&":"010101010101011",
  "-":"000000111000000","+":"000010111010000",":":"000010000010000","/":"001001010100100","?":"110001010000010"
};
const SUITS = [                                       // 5x5: fish, hook, shell, worm
  [".....", ".##.#", "#.###", ".##.#", "....."],     // fish: body, eye, forked tail
  ["..#..", "..#..", "#.#..", "#.#..", ".##.."],
  ["..#..", ".###.", "#.#.#", "#####", ".#.#."],
  ["##...", ".#...", ".##..", "..#.#", "..###"],
];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function newGame(seed = 1) {
  const g = { rnd: rng(seed), t: 0, bait: 100, bet: 10, shoe: [], phase: "bet", dealer: [], player: [], msg: "",
              msgT: 0, wait: 0, hands: 0, fish: [] };
  shuffle(g); return g;
}
function shuffle(g) {
  g.shoe = []; for (let d = 0; d < 4; d++) for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) g.shoe.push({ r, s });
  for (let i = g.shoe.length - 1; i > 0; i--) { const j = Math.floor(g.rnd() * (i + 1)); [g.shoe[i], g.shoe[j]] = [g.shoe[j], g.shoe[i]]; }
}
export function total(hand) {
  let t = 0, aces = 0;
  for (const c of hand) { if (c.hidden) continue; t += c.r === 0 ? 11 : Math.min(10, c.r + 1); if (c.r === 0) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 };
}
function deal(g, hand, hidden = false) { if (g.shoe.length < 52) shuffle(g); hand.push({ ...g.shoe.pop(), hidden, age: 0 }); }
function settle(g, msg, win) {                        // win: payout multiple of the bet back on top of the stake
  g.bait += Math.round(g.bet * win); g.msg = msg; g.msgT = 75; g.phase = "done"; g.wait = 75; g.hands++;
}

export function step(g, inp) {                        // inp: edge presses left/right/a/b/up
  g.t++;
  for (const c of [...g.dealer, ...g.player]) c.age++;
  if (g.msgT) g.msgT--;
  if (g.rnd() < 0.01 && g.fish.length < 2) g.fish.push({ x: g.rnd() < 0.5 ? -6 : 70, y: 27 + Math.floor(g.rnd() * 3), d: 0 });
  for (const f of g.fish) f.x += f.x < 32 ? 0.4 : -0.4;
  g.fish = g.fish.filter(f => f.x > -8 && f.x < 72 && Math.abs(f.x - 32) < 40);
  if (g.wait > 0) { g.wait--; if (g.wait) return; }
  if (g.phase === "bet") {
    if (inp.left) g.bet = Math.max(5, g.bet - 5);
    if (inp.right) g.bet = Math.min(Math.min(50, g.bait), g.bet + 5);
    if (inp.a) {
      g.bet = Math.min(g.bet, g.bait); g.bait -= g.bet;
      g.dealer = []; g.player = []; deal(g, g.player); deal(g, g.dealer); deal(g, g.player); deal(g, g.dealer, true);
      g.phase = "deal"; g.wait = 20;
    }
  } else if (g.phase === "deal") {
    const p = total(g.player).t, d = total(g.dealer.map(c => ({ ...c, hidden: false }))).t;
    if (p === 21 || d === 21) {
      g.dealer[1].hidden = false;
      if (p === 21 && d === 21) settle(g, "SLACK LINE", 1);
      else if (p === 21) settle(g, "BIG ONE!", 2.5);
      else settle(g, "SHARK BITE", 0);
    } else g.phase = "play";
  } else if (g.phase === "play") {
    if (inp.a) { deal(g, g.player); g.wait = 8; if (total(g.player).t > 21) { g.dealer[1].hidden = false; settle(g, "SNAGGED!", 0); } }
    else if (inp.up && g.player.length === 2 && g.bait >= g.bet) {
      g.bait -= g.bet; g.bet *= 2; deal(g, g.player); g.wait = 10;
      if (total(g.player).t > 21) { g.dealer[1].hidden = false; settle(g, "SNAGGED!", 0); } else g.phase = "dealer";
    } else if (inp.b) { g.phase = "dealer"; }
    if (g.phase === "dealer") { g.dealer[1].hidden = false; g.wait = 18; }
  } else if (g.phase === "dealer") {
    const d = total(g.dealer).t;
    if (d < 17) { deal(g, g.dealer); g.wait = 18; return; }
    const p = total(g.player).t;
    if (d > 21) settle(g, "IT GOT AWAY", 2);
    else if (p > d) settle(g, "NICE CATCH!", 2);
    else if (p === d) settle(g, "SLACK LINE", 1);
    else settle(g, "THROWN BACK", 0);
  } else if (g.phase === "done") {
    if (g.bet > 10 && g.bait > 0) g.bet = Math.max(10, Math.floor(g.bet / 2 / 5) * 5);   // doubled bets drop back
    if (g.bait <= 0) { g.bait = 100; g.msg = "FRESH BAIT"; g.msgT = 60; }
    g.bet = Math.min(g.bet, g.bait); g.phase = "bet";
  }
}

// ---- drawing ------------------------------------------------------------------------------------------------
function px(b, x, y, v = 1) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = v; }
function text(b, x, y, s, v = 1) { for (const ch of s) { const f = FONT[ch] || FONT[" "]; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "1") px(b, x + q, y + r, v); x += 4; } }
const tw = s => s.length * 4 - 1;
function card(b, x, y, c) {                           // 11 x 14, lit face with a dark rank + suit; backs: waves
  for (let j = 0; j < 14; j++) for (let i = 0; i < 11; i++) {
    const corner = (i === 0 || i === 10) && (j === 0 || j === 13);
    if (corner) continue;
    if (c.hidden) px(b, x + i, y + j, (i === 0 || i === 10 || j === 0 || j === 13) ? 1 : ((i + (j % 4 < 2 ? 0 : 2)) % 4 === 0 || j % 4 === 3 ? 1 : 0));
    else px(b, x + i, y + j, 1);
  }
  if (c.hidden) return;
  const r = RANKS[c.r];
  if (r === "10") { text(b, x + 1, y + 1, "1", 0); text(b, x + 4, y + 1, "0", 0); } else text(b, x + 1, y + 1, r, 0);
  SUITS[c.s].forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === "#") px(b, x + 5 + i, y + 7 + j, 0); });
}
function hand(b, cards, y) {
  const step = cards.length > 4 ? 7 : 12;
  cards.forEach((c, i) => {
    const k = Math.min(1, c.age / 6), tx = 2 + i * step;   // slides in from the shoe (top right)
    card(b, 60 + (tx - 60) * k, -14 + (y + 14) * k, c);
  });
}
const HOOK = ["..#", "..#", "..#", "#.#", "#.#", ".#."];

export function draw(g, b = new Uint8Array(W * H)) {
  b.fill(0);
  // water through the middle, with the odd fish
  for (let x = 0; x < W; x++) { const y = 25 + Math.round(Math.sin((x + g.t * 0.3) / 4)); px(b, x, y); if ((x + (g.t >> 2)) % 7 === 0) px(b, x, y + 4); }
  for (const f of g.fish) { const l = f.x < 32; for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, -1], [1, 1], [l ? -1 : 3, -1], [l ? -1 : 3, 1]]) px(b, f.x + dx, f.y + dy); }
  hand(b, g.dealer, 3);
  hand(b, g.player, 33);
  // totals
  if (g.dealer.length) { const d = total(g.dealer).t; text(b, 52, 4, String(d).padStart(2, " ")); }
  if (g.player.length) { const p = total(g.player); text(b, 52, 34, String(p.t).padStart(2, " ")); }
  // bottom bar: bait and bet (a hook dangling over the bet)
  for (let x = 0; x < W; x++) px(b, x, 51);
  text(b, 1, 53, "BAIT " + String(g.bait).padStart(3, " "));                       // bait | hook + bet
  HOOK.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === "#") px(b, 45 + i, 52 + j); });
  text(b, 51, 53, String(g.bet).padStart(3, " ").slice(-3));
  const hint = g.phase === "bet" ? ((g.t >> 4) & 1 ? "A: CAST" : "< BET >") : g.phase === "play" ? "A HIT B STAY" : "";
  if (hint) text(b, (W - tw(hint)) >> 1, 59, hint);
  if (g.msgT) {                                       // the call-out, boxed over the water
    const w = tw(g.msg) + 4, x = (W - w) >> 1;
    for (let y = 20; y < 31; y++) for (let i = 0; i < w; i++) px(b, x + i, y, y === 20 || y === 30 || i === 0 || i === w - 1 ? 1 : 0);
    text(b, x + 2, 23, g.msg);
  }
  return b;
}

// ---- title card ---------------------------------------------------------------------------------------------
export function drawTitle(t, b = new Uint8Array(W * H)) {
  b.fill(0);
  text(b, (W - tw("BLACKJACK")) >> 1, 8, "BLACKJACK");
  text(b, (W - tw("& HOOKERS")) >> 1, 16, "& HOOKERS");
  for (let j = 0; j < 14; j++) px(b, 32, 24 + j);                                   // line + hook
  HOOK.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === "#") px(b, 30 + i, 38 + j); });
  for (let x = 0; x < W; x++) px(b, x, 46 + Math.round(Math.sin((x + t * 0.3) / 4)));
  SUITS.forEach((suit, k) => suit.forEach((row, j) => {                            // the 4 suits under the water
    for (let i = 0; i < 5; i++) if (row[i] === "#") px(b, 10 + k * 13 + i, 50 + j);     // (owner)
  }));
  if ((t >> 4) & 1) text(b, (W - tw("PRESS A")) >> 1, 57, "PRESS A");
  return b;
}

// ---- demo player: basic strategy (simplified: no split) ---------------------------------------------------------
export function demo(g) {
  const want = { left: false, right: false, a: false, b: false, up: false };
  if (g.wait || g.t % 12) return want;
  if (g.phase === "bet") { const target = [10, 10, 15, 20, 25][Math.floor(g.rnd() * 5)]; if (g.bet < target) want.right = true; else want.a = true; return want; }
  if (g.phase !== "play") return want;
  const p = total(g.player), up = Math.min(10, g.dealer[0].r === 0 ? 11 : g.dealer[0].r + 1);
  if (g.player.length === 2 && (p.t === 11 || (p.t === 10 && up <= 9)) && g.bait >= g.bet) { want.up = true; return want; }
  const hit = p.soft ? p.t <= 17 : p.t <= 11 || (p.t <= 16 && up >= 7) || (p.t === 12 && up <= 3);
  if (hit) want.a = true; else want.b = true;
  return want;
}
