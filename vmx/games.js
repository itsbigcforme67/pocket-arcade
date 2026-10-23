// The VMX's games: one adapter per core (cores/, copied from microgames by tools/vmx-sync.sh). The cores don't share
// one API, so each adapter turns the VMX's buttons into what its core wants, as that game's own page in
// microgames/ui/games/ does. Every tick (30 Hz) the shell passes:
//   held   {up, down, left, right, a, b}  buttons down now (a tap shorter than a tick still counts once)
//   edges  the same, true only on the tick a button went down
//   tap    the next queued press (Zork: fast taps queue up instead of merging)
//   demo   true while the computer plays
// An adapter has: id, name (card text, lines of 6 or fewer), art(s) (a 24x24 pictogram on a 1-bit Surf),
// load() (the core module), start(mod, seed, demo), tick(g, inp), draw(g) (a 64x64 Uint8Array, 1 = lit),
// usesB (false: B goes back to the menu), record(g, rec) (keeps the best score in rec, the saved object; true when
// it changed), score(rec) (up to 3 lines of 7 or fewer for SAVES) and title (the full name).
// needsCart: the player opens the cartridge from their own file (Star Raiders: the cart is Atari's, never shipped).

const wld = rec => ["WON " + (rec.w || 0), "LOST " + (rec.l || 0), "DRAWN " + (rec.d || 0)];
const seedNow = () => Date.now() % 100000;

// keeps the best of a number in rec.best; returns true when it changed (the shell saves then)
function best(rec, v) { if (v > (rec.best || 0)) { rec.best = v; return true; } return false; }
// checkers / reversi: count a finished game once, from the core's own message
function tally(g, rec) {
  const over = g.over > 0, was = g._over; g._over = over;
  if (!over || was) return false;
  const k = g.msg === "YOU WIN!" ? "w" : g.msg === "YOU LOSE" ? "l" : "d";
  rec[k] = (rec[k] || 0) + 1; return true;
}

export const GAMES = [
  {
    id: "blox", name: ["BLOX"], usesB: false,
    load: () => import("./cores/blox_core.js"),
    start: (m, seed) => m.newGame(seed),
    tick(g, { edges: e, demo }) { this.m.step(g, demo ? this.m.demo(g) : { left: e.left, right: e.right, a: e.a }); },
    record: (g, rec) => best(rec, g.score),
    art(s) { for (let c = 0; c < 4; c++) for (let r = 0; r <= c % 3; r++) s.fill(1 + c * 6, 19 - r * 4, 5, 3);
      s.fill(8, 9, 8, 2); s.fill(9, 6, 6, 2); s.rect(8, 1, 6, 4); s.px(10, 2); s.px(11, 3); s.line(0, 23, 23, 23); },
  },
  {
    id: "blobs", name: ["BLOBS"], usesB: true,
    load: () => import("./cores/blobs_core.js"),
    start: (m, seed) => m.newGame(seed),
    // the page: A turns left, B and Up turn right, Down held drops faster
    tick(g, { held: h, edges: e, demo }) {
      this.m.step(g, demo ? this.m.demo(g) : { left: e.left, right: e.right, rotL: e.a, rotR: e.b || e.up, down: h.down }); },
    record: (g, rec) => best(rec, g.score),
    art(s) { s.disc(8, 4, 3); s.disc(8, 11, 3); s.ring(4, 19, 3); s.ring(11, 19, 3); s.disc(18, 19, 3); s.disc(18, 12, 3);
      s.disc(18, 12, 1, 0); s.line(0, 23, 23, 23); },
  },
  {
    id: "intercept", name: ["INTER", "CEPT"], usesB: false,
    load: () => import("./cores/intercept_core.js"),
    start: (m, seed) => m.newGame(seed),
    // the D-pad steers the crosshair, A fires from the nearest base with ammo
    tick(g, { held: h, edges: e, demo }) {
      this.m.step(g, demo ? this.m.demo(g)
        : { dx: (h.right ? 1 : 0) - (h.left ? 1 : 0), dy: (h.down ? 1 : 0) - (h.up ? 1 : 0), fire: e.a ? "auto" : null }); },
    record: (g, rec) => best(rec, g.score),
    art(s) { s.line(2, 0, 9, 13); s.line(21, 0, 15, 10); s.line(12, 0, 12, 7); s.ring(12, 11, 4); s.px(12, 11);
      s.fill(0, 21, 24, 3); s.fill(3, 18, 3, 3); s.fill(10, 17, 4, 4); s.fill(18, 18, 3, 3); },
  },
  {
    id: "invasion", name: ["INVA", "SION"], usesB: false,
    load: () => import("./cores/invasion_core.js"),
    start: (m, seed) => m.newGame(seed),
    tick(g, { held: h, demo }) { this.m.step(g, demo ? this.m.demo(g) : h); },          // this core takes held buttons
    record: (g, rec) => best(rec, g.score),
    art(s) { ["..#..#..", ".######.", "##.##.##", "########", ".#....#."].forEach((row, y) =>
        [...row].forEach((c, x) => { if (c === "#") s.fill(4 + x * 2, 2 + y * 2, 2, 2); }));
      s.fill(12, 13, 1, 3); s.fill(11, 19, 3, 1); s.fill(9, 20, 7, 3); },
  },
  {
    id: "blackjack", name: ["BLACK", "JACK"], usesB: true,
    load: () => import("./cores/blackjack_core.js"),
    start: (m, seed) => Object.assign(m.newGame(seed), { title: true, titleT: 0 }),
    // its title screen waits for A (the demo skips it); then A hits, B stands, Up doubles, left/right bet
    tick(g, { edges: e, demo }) {
      if (g.title) { g.titleT++; if (e.a || demo) g.title = false; return; }
      this.m.step(g, demo ? this.m.demo(g) : e); },
    draw(g) { return g.title ? this.m.drawTitle(g.titleT) : this.m.draw(g); },
    record: (g, rec) => best(rec, g.bait),
    art(s) { s.fill(1, 4, 12, 17, 0); s.rrect(1, 4, 12, 17); s.text(3, 6, "A");
      s.fill(9, 2, 12, 17, 0); s.rrect(9, 2, 12, 17); s.text(11, 4, "J"); s.line(17, 9, 17, 15); s.ring(15, 15, 2); s.px(13, 14); },
  },
  {
    id: "checkers", name: ["CHECK", "ERS"], usesB: true,
    load: () => import("./cores/checkers_core.js"),
    start: (m, seed) => m.newGame(seed),
    tick(g, { edges: e, demo }) { this.m.step(g, demo ? {} : e, demo ? [1, 2] : [2]); },   // demo: the CPU plays both
    record: tally, score: wld,
    art(s) { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) s.fill(x * 6, y * 6, 6, 6);
      s.fill(13, 1, 4, 4, 0); s.disc(15, 3, 2, 0); s.ring(15, 3, 2); s.disc(3, 9, 2, 0); s.ring(3, 9, 2);
      s.fill(7, 13, 4, 4, 0); s.disc(9, 15, 2); s.fill(19, 19, 4, 4, 0); s.disc(21, 21, 2); },
  },
  {
    id: "reversi", name: ["REVER", "SI"], usesB: false,
    load: () => import("./cores/reversi_core.js"),
    start: (m, seed) => m.newGame(seed),
    tick(g, { edges: e, demo }) { this.m.step(g, demo ? {} : e, demo ? [1, 2] : [2]); },
    record: tally, score: wld,
    art(s) { s.rect(0, 0, 24, 24); s.line(12, 0, 12, 23); s.line(0, 12, 23, 12);
      s.disc(6, 6, 4); s.ring(18, 6, 4); s.ring(6, 18, 4); s.disc(18, 18, 4); },
  },
  {
    id: "junction", name: ["JUNC", "TION"], usesB: false,
    load: () => import("./cores/junction_core.js"),
    start: (m, seed) => m.newGame(seed),
    tick(g, { held: h, demo }) { this.m.step(g, demo ? this.m.demo(g) : h); },          // held: the turn is the direction held
    record: (g, rec) => best(rec, g.best),
    score: rec => ["BEST", (rec.best || 0) + "M"],
    art(s) { s.line(8, 0, 8, 8); s.line(15, 0, 15, 8); s.line(0, 8, 8, 8); s.line(15, 8, 23, 8);
      s.line(0, 15, 8, 15); s.line(15, 15, 23, 15); s.line(8, 15, 8, 23); s.line(15, 15, 15, 23);
      s.fill(11, 2, 2, 2); s.fill(11, 5, 2, 2); s.px(11, 17); s.px(12, 18); s.px(11, 19);
      s.fill(2, 11, 2, 2); s.fill(19, 11, 2, 2); },
  },
  {
    id: "pool", name: ["9-", "BALL"], title: "9-BALL", usesB: true,
    load: () => import("./cores/pool_core.js"),
    start: (m, seed) => m.newGame(seed),
    tick(g, { held: h, demo }) { this.m.step(g, demo ? this.m.demo(g) : h); },          // held: A is held for power
    record(g, rec) {                                                                    // a rack won or lost, once
      const over = g.phase === "over", was = g._over; g._over = over;
      if (!over || was || g.auto) return false;
      const k = g.msg === "YOU WIN" ? "w" : "l"; rec[k] = (rec[k] || 0) + 1; return true; },
    score: rec => ["WON " + (rec.w || 0), "LOST " + (rec.l || 0)],
    art(s) { s.ring(12, 4, 3); s.px(12, 4); s.ring(8, 10, 3); s.ring(16, 10, 3); s.ring(4, 16, 3); s.ring(12, 16, 3);
      s.ring(20, 16, 3); s.line(0, 22, 22, 22); s.line(23, 23, 23, 23); },
  },
  {
    id: "tricky", name: ["TRICKY", "WICKS"], title: "TRICKY WICKS", usesB: true,
    load: () => import("./cores/tricky_core.js"),
    start(m, seed, demo) { const g = m.newGame(seed & 0xFFFF); if (demo) m.aiInit(g, g.seed); return g; },
    // the rules run at 60 Hz, as on the original: two steps a tick, the presses on the first. A and B turn the
    // piece (swapped as on its page: the pad's A turns left), Up drops it.
    tick(g, { held: h, edges: e, demo }) {
      for (let i = 0; i < 2; i++) {
        if (demo) this.m.step(g, {}, this.m.ai(g));
        else this.m.step(g, { ...h, a: h.b, b: h.a }, i ? {} : { ...e, a: e.b, b: e.a });
      } },
    record: (g, rec) => best(rec, g.rd("score")),
    art(s) { s.fill(2, 4, 3, 3); s.fill(1, 7, 5, 4); s.px(3, 2); s.px(2, 1); s.line(6, 9, 13, 9); s.line(13, 9, 13, 16);
      s.line(13, 16, 15, 16); s.disc(19, 16, 4); s.fill(18, 10, 2, 3); s.px(21, 9); },
  },
  {
    id: "zork", name: ["ZORK I"], title: "ZORK I", usesB: true,
    load: async function () {
      const [m, r] = await Promise.all([import("./cores/zork_core.js"), fetch("cores/zork1.z3")]);
      if (!r.ok) throw new Error("no story file");
      this.story = new Uint8Array(await r.arrayBuffer()); return m;
    },
    start(m, seed) {
      const g = m.newGame(seed, this.story);
      try { const sv = JSON.parse(localStorage.getItem("vmx-zork-save")); if (sv) g.vm.saved = { ...sv, mem: Uint8Array.from(sv.mem) }; } catch {}
      g._saved = g.vm.saved; g.hold = {};
      return g;
    },
    // up/down auto-repeat while held; fast taps queue up (the page's logic)
    tick(g, { held: h, edges: e, tap, demo }) {
      const inp = { ...e };
      for (const k of ["up", "down"]) { g.hold[k] = h[k] ? (g.hold[k] || 0) + 1 : 0; if (g.hold[k] > 12 && g.hold[k] % 3 === 0) inp[k] = true; }
      if (tap) inp[tap] = true;
      this.m.step(g, demo ? this.m.demo(g) : inp);
    },
    // its SAVE command snapshots the game; that snapshot is the VMX save
    record(g, rec) {
      if (!g.vm.saved || g.vm.saved === g._saved) return false;
      g._saved = g.vm.saved;
      try { localStorage.setItem("vmx-zork-save", JSON.stringify({ ...g._saved, mem: [...g._saved.mem] })); } catch {}
      rec.saved = new Date().toISOString().slice(5, 10); return true;
    },
    erase() { try { localStorage.removeItem("vmx-zork-save"); } catch {} },
    score: rec => rec.saved ? ["SAVED", rec.saved.replace("-", "/")] : ["NO SAVE"],
    art(s) { s.rect(4, 6, 14, 9); s.fill(5, 7, 12, 1); s.line(11, 15, 11, 23); s.line(18, 6, 18, 2); s.fill(19, 2, 3, 2);
      s.line(0, 23, 23, 23); },
  },
  {
    id: "starraiders", name: ["STAR", "RAIDER"], title: "STAR RAIDERS", usesB: true, needsCart: true,
    load: () => import("./cores/starraiders_core.js"),
    start(m, seed) { return this.cart ? m.newGame(seed, this.cart) : null; },
    tick(g, { held: h, demo }) { this.m.step(g, demo ? this.m.pilot(g) : h); },        // B is its command menu
    record: () => false,
    erase() { this.cart = null; try { localStorage.removeItem("vmx-starraiders-cart"); } catch {} },
    score: () => ["OPENS", "YOUR", "CART"],
    art(s) { [[2, 3], [20, 2], [5, 18], [21, 19], [16, 7], [3, 11]].forEach(([x, y]) => s.px(x, y));
      s.line(12, 4, 12, 9); s.line(12, 15, 12, 20); s.line(4, 12, 9, 12); s.line(15, 12, 20, 12); s.ring(12, 12, 2); },
  },
];

for (const a of GAMES) {
  a.draw ||= function (g) { return this.m.draw(g); };
  a.score ||= rec => ["BEST", String(rec.best || 0)];
  a.title ||= a.name.join("");
}
export { seedNow };
