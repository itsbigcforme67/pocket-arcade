// The VMX's games. Every game but Star Raiders is the device's own GAME.VXP (vxp() below), run by the VMX runtime in
// WebAssembly, so it plays exactly as on the VMX; Star Raiders is a JS core (cores/, copied from microgames by
// tools/vmx-sync.sh) with its own adapter. Every tick (30 Hz) the shell passes:
//   held   {up, down, left, right, a, b}  buttons down now (a tap shorter than a tick still counts once)
//   edges  the same, true only on the tick a button went down
//   demo   true while the computer plays
// An adapter has: id, name (card text, lines of 6 or fewer), art(s) (a 24x24 pictogram on a 1-bit Surf),
// load() (the core module), start(mod, seed, demo), tick(g, inp), draw(g) (a 64x64 Uint8Array, 1 = lit),
// usesB (false: B goes back to the menu), record(g, rec) (keeps the best score in rec, the saved object; true when
// it changed), score(rec) (up to 3 lines of 7 or fewer for SAVES) and title (the full name).
// needsCart: the player opens the cartridge from their own file (Star Raiders: the cart is Atari's, never shipped).
// casino: a VMX CASINO game; start() also gets the shared chip bank { chips, bonus } (vmx.js keeps it, as the
// firmware's core/game_vx.c does; vmx-world/docs/CASINO.md).

const wld = rec => ["WON " + (rec.w || 0), "LOST " + (rec.l || 0), "DRAWN " + (rec.d || 0)];
const seedNow = () => Date.now() % 100000;

// keeps the best of a number in rec.best; returns true when it changed (the shell saves then)
function best(rec, v) { if (v > (rec.best || 0)) { rec.best = v; return true; } return false; }
// a 24x24 card picture from rows of "#" and "." (the same art as the game's card.txt in vmx-firmware)
const rowsArt = rows => s => rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === "#") s.px(x, y); });

// checkers / reversi keep their won/lost/drawn in their own save (3 little-endian int32) and report it after each
// finished game: Scores.Report(wins, wins, lost, drawn), as core/game_vx.c record_ takes a wld game's fields
function wldRecord(g, rec) {
  if (!g.reports) return false; g.reports = 0;
  [rec.w, rec.l, rec.d] = g.f; return true;
}
// ... and the simulator's own counts from before these games ran as device builds become that save, once
const wldSave = rec => {
  if (!rec || !(rec.w || rec.l || rec.d)) return null;
  const b = new Uint8Array(12), v = new DataView(b.buffer);
  [rec.w, rec.l, rec.d].forEach((n, i) => v.setInt32(4 * i, n || 0, true)); return b;
};
// the simulator's saved records (vmx.js "vmx-saves"), read here only to carry old saves over
const oldRec = id => { try { return JSON.parse(localStorage.getItem("vmx-saves"))?.[id]; } catch { return null; } };

// Zork I: the JS core's SAVE snapshot (vmx-zork-save, JSON) in the device's layout (ZMachine.cs Snapshot: "Z3", pc,
// dynamic memory size, stack depth, frames, all big-endian; memory, stack words, then each frame's pc, stack depth,
// store variable (0xFFFF none), locals). The device game takes it from its save at start, as the JS page did.
function zorkSave() {
  let sv; try { sv = JSON.parse(localStorage.getItem("vmx-zork-save")); } catch { return null; }
  if (!sv?.mem || !sv.frames?.length) return null;
  // the whole save slot (16 + memory + 1 KB), as the device writes it: a shorter save is copied into a new slot,
  // which the heap has no room for
  const n = Math.max(16 + sv.mem.length + 1024, 12 + sv.mem.length + 2 * sv.stack.length + sv.frames.reduce((t, f) => t + 9 + 2 * f.locals.length, 0));
  const b = new Uint8Array(n), v = new DataView(b.buffer); let o = 12;
  b[0] = 90; b[1] = 51; v.setUint32(2, sv.pc); v.setUint16(6, sv.mem.length); v.setUint16(8, sv.stack.length);
  v.setUint16(10, sv.frames.length); b.set(sv.mem, 12); o += sv.mem.length;
  for (const w of sv.stack) { v.setUint16(o, w & 0xFFFF); o += 2; }
  for (const f of sv.frames) {
    v.setUint32(o, f.pc); v.setUint16(o + 4, f.sp); v.setUint16(o + 6, f.store < 0 ? 0xFFFF : f.store); b[o + 8] = f.locals.length; o += 9;
    for (const w of f.locals) { v.setUint16(o, w & 0xFFFF); o += 2; }
  }
  return b;
}

// a game built for the VMX itself (a GAME.VXP from vmx-firmware/build/games, copied by tools/vmx-sync.sh): the VMX
// runtime runs it, compiled to WebAssembly (cores/vxrt.wasm + vxrt.js), so it plays exactly as on the device
// (vmx-firmware tools/parity/wasm_check.sh checks the screens). Its save is the game's own bytes (vmx-g<id>); the
// files the Xbox would put in its save folder (Storage.ReadData; FOLD ROOMS' made levels, LEVELS.BIN) are
// vmx-g<id>-<NAME>, base64; its best score is what it reports (Microsoft.Vmx.Scores). a.tone is set by vmx.js.
// An entry may give its own record(g, rec) (g.reports: Scores.Report calls since the last record, g.f: the last
// report's three fields; g.saved: Storage.Save calls) and migrate() (the save to start from when the game has none
// yet: the simulator's records from before it ran the device build).
const VXBIT = { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32 };
const vxBits = o => Object.keys(VXBIT).reduce((m, k) => o[k] ? m | VXBIT[k] : m, 0);
let vxRt;                                                  // the compiled runtime, shared by every VXP game
const b64in = v => v ? Uint8Array.from(atob(v), c => c.charCodeAt(0)) : null;
function vxp(file, a) {
  const key = () => "vmx-g" + a.vxId.toString(16).padStart(8, "0");   // vxId: the game.ini id (core/game_vx.c's key)
  const toB64 = d => { let b = ""; for (const v of d) b += String.fromCharCode(v); return btoa(b); };
  return Object.assign({
    async load() {
      const [m, r] = await Promise.all([import("./cores/vxrt.js"), fetch("cores/" + file)]);
      if (!r.ok) throw new Error("no " + file);
      this.bytes = new Uint8Array(await r.arrayBuffer());
      if (m.readVxp(this.bytes)?.id !== this.vxId) throw new Error(file + " is not this VMX game");
      this.rt = await (vxRt ||= m.vxRuntime(fetch("cores/vxrt.wasm")));
      return m;
    },
    start(m, seed, demo, bank) {
      const g = { best: 0, changed: false, reports: 0, f: [0, 0, 0], saved: 0 };
      try {
        const m0 = !localStorage.getItem(key()) && this.migrate?.();
        if (m0) localStorage.setItem(key(), toB64(m0));
      } catch {}
      g.vm = m.vxGame(this.rt, this.bytes, {
        tone: (hz, ms, vol) => this.tone?.(hz, ms, vol),
        report(s, f1, f2, f3) { g.reports++; g.f = [f1, f2, f3]; if (s > g.best) { g.best = s; g.changed = true; } },
        load(id) {                                     // 0: this game's own save (others' saves aren't kept here)
          if (id !== 0) return null;
          try { return b64in(localStorage.getItem(key())); } catch { return null; }
        },
        data(name) { try { return b64in(localStorage.getItem(key() + "-" + name)); } catch { return null; } },
        save(d) { if (demo) return; g.saved++; try { localStorage.setItem(key(), toB64(d)); } catch {} },
        chips(op, n) {                                 // as core/game_vx.c h_chips, on the shell's bank object
          if (!bank) return 0;
          if (op === 0) return bank.chips;
          if (op === 3) return bank.bonus || 0;
          if (op === 1) { if (n > bank.chips) return 0; bank.chips -= n; return 1; }
          if (op === 2) bank.chips += Math.min(n, 0x3FFFFFFF - bank.chips);
          return 0;
        },
      });
      g.vm.start(seed, demo);
      this.usesB = g.vm.usesB();                       // a game error: B goes back, as on the VMX
      return g;
    },
    tick(g, { held: h, edges: e }) { if (g.vm.tick(vxBits(h), vxBits(e))) this.usesB = false; },
    draw: g => g.vm.draw(),
  }, a, {
    record: a.record || ((g, rec) => { if (!g.changed) return false; g.changed = false; return best(rec, g.best); }),
    erase() { try { localStorage.removeItem(key()); } catch {} a.erase?.(); },
  });
}

// FOLD ROOMS' levels made in FOLD BUILDER: its DATA\LEVELS.BIN (vxp's data("LEVELS.BIN")), packed as vmx-firmware
// games/fold/levels.py does: u16 count, count + 1 u32 offsets from the start of the file, the level texts as they are.
// On the VMX, VMX World packs it on the Xbox; here vmx.js packs the .fold files the player picks. What fits is the
// game's FoldRooms.FitsVmx (microgames/fold core/vmxfit.h): World leaves a level off when it doesn't, and so do we.
export const FOLD_LEVELS = "vmx-g56581010-LEVELS.BIN", FOLD_PACK = 65536;
export const foldSquares = t => t.split("\n").filter(l => /^[ \t\r]*square/.test(l)).length;
export const foldFits = (t, n) => 1100 * foldSquares(t) + 2 * n <= 64000;
export function foldPack(texts) {                      // texts: Uint8Arrays
  const off = [2 + 4 * (texts.length + 1)];
  for (const t of texts) off.push(off.at(-1) + t.length);
  const b = new Uint8Array(off.at(-1)), v = new DataView(b.buffer);
  v.setUint16(0, texts.length, true); off.forEach((o, i) => v.setUint32(2 + 4 * i, o, true));
  texts.forEach((t, i) => b.set(t, off[i]));
  return b;
}
export function foldUnpack(b) {                        // the texts, or null when b isn't a LEVELS.BIN
  if (!b || b.length < 6) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.length), n = v.getUint16(0, true), out = [];
  if (b.length < 2 + 4 * (n + 1) || v.getUint32(2, true) !== 2 + 4 * (n + 1)) return null;
  for (let i = 0; i < n; i++) {
    const a = v.getUint32(2 + 4 * i, true), e = v.getUint32(6 + 4 * i, true);
    if (e < a || e > b.length) return null;
    out.push(b.slice(a, e));
  }
  return out;
}

export const GAMES = [
  vxp("BLOX.VXP", {
    id: "blox", vxId: 0x56581001, name: ["BLOX"], title: "BLOX",
    art(s) { for (let c = 0; c < 4; c++) for (let r = 0; r <= c % 3; r++) s.fill(1 + c * 6, 19 - r * 4, 5, 3);
      s.fill(8, 9, 8, 2); s.fill(9, 6, 6, 2); s.rect(8, 1, 6, 4); s.px(10, 2); s.px(11, 3); s.line(0, 23, 23, 23); },
  }),
  vxp("BLOBS.VXP", {
    id: "blobs", vxId: 0x56581002, name: ["BLOBS"], title: "BLOBS",
    art(s) { s.disc(8, 4, 3); s.disc(8, 11, 3); s.ring(4, 19, 3); s.ring(11, 19, 3); s.disc(18, 19, 3); s.disc(18, 12, 3);
      s.disc(18, 12, 1, 0); s.line(0, 23, 23, 23); },
  }),
  vxp("INTERCEP.VXP", {
    id: "intercept", vxId: 0x56581003, name: ["INTER", "CEPT"], title: "INTERCEPT",
    art(s) { s.line(2, 0, 9, 13); s.line(21, 0, 15, 10); s.line(12, 0, 12, 7); s.ring(12, 11, 4); s.px(12, 11);
      s.fill(0, 21, 24, 3); s.fill(3, 18, 3, 3); s.fill(10, 17, 4, 4); s.fill(18, 18, 3, 3); },
  }),
  vxp("INVASION.VXP", {
    id: "invasion", vxId: 0x56581004, name: ["INVA", "SION"], title: "INVASION",
    art(s) { ["..#..#..", ".######.", "##.##.##", "########", ".#....#."].forEach((row, y) =>
        [...row].forEach((c, x) => { if (c === "#") s.fill(4 + x * 2, 2 + y * 2, 2, 2); }));
      s.fill(12, 13, 1, 3); s.fill(11, 19, 3, 1); s.fill(9, 20, 7, 3); },
  }),
  vxp("BLACKJAC.VXP", {
    id: "blackjack", vxId: 0x56581005, name: ["BLACK", "JACK"], title: "BLACKJACK", casino: true,
    art(s) { s.fill(1, 4, 12, 17, 0); s.rrect(1, 4, 12, 17); s.text(3, 6, "A");
      s.fill(9, 2, 12, 17, 0); s.rrect(9, 2, 12, 17); s.text(11, 4, "J"); s.line(17, 9, 17, 15); s.ring(15, 15, 2); s.px(13, 14); },
  }),
  vxp("CHECKERS.VXP", {
    id: "checkers", vxId: 0x56581006, name: ["CHECK", "ERS"], title: "CHECKERS",
    record: wldRecord, score: wld, migrate: () => wldSave(oldRec("checkers")),
    art(s) { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) s.fill(x * 6, y * 6, 6, 6);
      s.fill(13, 1, 4, 4, 0); s.disc(15, 3, 2, 0); s.ring(15, 3, 2); s.disc(3, 9, 2, 0); s.ring(3, 9, 2);
      s.fill(7, 13, 4, 4, 0); s.disc(9, 15, 2); s.fill(19, 19, 4, 4, 0); s.disc(21, 21, 2); },
  }),
  vxp("REVERSI.VXP", {
    id: "reversi", vxId: 0x56581007, name: ["REVER", "SI"], title: "REVERSI",
    record: wldRecord, score: wld, migrate: () => wldSave(oldRec("reversi")),
    art(s) { s.rect(0, 0, 24, 24); s.line(12, 0, 12, 23); s.line(0, 12, 23, 12);
      s.disc(6, 6, 4); s.ring(18, 6, 4); s.ring(6, 18, 4); s.disc(18, 18, 4); },
  }),
  vxp("JUNCTION.VXP", {
    id: "junction", vxId: 0x56581008, name: ["JUNC", "TION"], title: "JUNCTION",
    score: rec => ["BEST", (rec.best || 0) + "M"],
    art(s) { s.line(8, 0, 8, 8); s.line(15, 0, 15, 8); s.line(0, 8, 8, 8); s.line(15, 8, 23, 8);
      s.line(0, 15, 8, 15); s.line(15, 15, 23, 15); s.line(8, 15, 8, 23); s.line(15, 15, 15, 23);
      s.fill(11, 2, 2, 2); s.fill(11, 5, 2, 2); s.px(11, 17); s.px(12, 18); s.px(11, 19);
      s.fill(2, 11, 2, 2); s.fill(19, 11, 2, 2); },
  }),
  vxp("FOLDROOM.VXP", {
    id: "foldrooms", vxId: 0x56581010, name: ["FOLD", "ROOMS"], title: "FOLD ROOMS", usesB: true,
    score: rec => ["CLEARED", String(rec.best || 0)],
    art: rowsArt([".........#############..", ".......##..........###..", ".....##..........##..#..",
      "...##############....#..", "...#..........#......#..", "...#..........#......#..", "...#..........#......#..",
      "...#...####...#......#..", "...#...####...#......#..", "...#...####...#......#..", "...#...####...#......#..",
      "...#..........#......#..", "...#..........#......#..", "...#..........#....##...", "...############..##.....",
      "...............##.......", "........................", "............#####.......", "........#...#...#.......",
      ".......#....#...#.......", "........#...#...#.......", "............#####.......", "........................",
      "########################"]),
  }),
  vxp("9BALL.VXP", {
    id: "pool", vxId: 0x56581009, name: ["9-", "BALL"], title: "9-BALL", casino: true,
    // racks won and lost: it reports its match score (you, you, CPU) once at the end of each rack, from 0 each match;
    // one more for the CPU, or a new match's 0-1, is a rack lost
    record(g, rec) {
      if (!g.reports) return false; g.reports = 0;
      const [w, l] = g.f, [w0, l0] = g.last || [0, 0]; g.last = [w, l];
      const lost = w === w0 && l === l0 + 1 || w === 0 && l === 1;
      if (lost) rec.l = (rec.l || 0) + 1; else rec.w = (rec.w || 0) + 1; return true; },
    score: rec => ["WON " + (rec.w || 0), "LOST " + (rec.l || 0)],
    art(s) { s.ring(12, 4, 3); s.px(12, 4); s.ring(8, 10, 3); s.ring(16, 10, 3); s.ring(4, 16, 3); s.ring(12, 16, 3);
      s.ring(20, 16, 3); s.line(0, 22, 22, 22); s.line(23, 23, 23, 23); },
  }),
  vxp("VIDEOPOK.VXP", {
    id: "poker", vxId: 0x5658100A, name: ["VIDEO", "POKER"], title: "VIDEO POKER", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", "........................", "..###########...........", ".#...........#..........", ".#.#.#.....###########..", ".#.#.#....#...........#.", ".#.##.....#..#........#.", ".#.#.#....#.#.#.......#.", ".#.#.#....#.###.......#.", ".#........#.#.#.......#.", ".#........#.#.#.......#.", ".#........#...........#.", ".#...#....#...........#.", ".#..###...#...##.##...#.", ".#.#####..#..#..#..#..#.", ".#.#####..#..#.....#..#.", ".#.#.#.#..#..#.....#..#.", ".#...#....#...#...#...#.", ".#..###...#....#.#....#.", ".#........#.....#.....#.", "..#########...........#.", "..........#...........#.", "...........###########..", "........................"]),
  }),
  vxp("ROULETTE.VXP", {
    id: "roulette", vxId: 0x5658100B, name: ["ROU-", "LETTE"], title: "ROULETTE", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt([".........######.........", "......###......###......", ".....#......###...#.....", "....#..#....####...#....", "...#.####...###.....#...", "..#..####...###...##.#..", ".#....#########..###..#.", ".#.....##......######.#.", ".#.#...#...##...####..#.", "#.#####....##....#.....#", "#.#####....##....#.....#", "#.#####.###..###.#.....#", "#.....#.###..###.#####.#", "#.....#....##....#####.#", "#.....#....##....#####.#", ".#..####...##...#.#.#.#.", ".#.######......#####..#.", ".#..###..##########...#.", "..#.##...###...####..#..", "...#.....###...####.#...", "....#...####....#..#....", ".....#...###......#.....", "......###......###......", ".........######........."]),
  }),
  vxp("SLOTS.VXP", {
    id: "slots", vxId: 0x5658100C, name: ["SLOTS"], title: "SLOTS", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", ".######################.", ".#....................#.", ".#.######.####.######.#.", ".#.######.#..#.######.#.", ".#.....##.####.....##.#.", ".#....##..#..#....##..#.", ".#...##...#..#...##...#.", ".#...##...####...##...#.", ".#....................#.", ".######################.", "........................", "..........######......##", ".........########....#..", "........###.##.###...#..", "........####..####...#..", "........#####.####...#..", "........####..####...#..", "........###.##.###.###..", ".........########..#.#..", "..........######...###..", "........................", ".######################.", "........................"]),
  }),
  vxp("HILO.VXP", {
    id: "hilo", vxId: 0x5658100D, name: ["HI-LO"], title: "HI-LO", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", "..........#.............", ".........###............", "........#####...........", ".......#######..........", "........................", ".#########...#########..", "#.........#.#.........#.", "#.##......#.#.#.#.#.#.#.", "#.#.#.....#.#..#.#.#..#.", "#.##......#.#.#.#.#.#.#.", "#.#.......#.#..#.#.#..#.", "#.#.......#.#.#.#.#.#.#.", "#....#....#.#..#.#.#..#.", "#...###...#.#.#.#.#.#.#.", "#..#####..#.#..#.#.#..#.", "#..#.#.#..#.#.#.#.#.#.#.", "#....#....#.#..#.#.#..#.", "#...###...#.#.........#.", ".#########...#########..", "........................", ".......#######..........", "........#####...........", ".........###............"]),
  }),
  vxp("CASINOWA.VXP", {
    id: "war", vxId: 0x5658100E, name: ["CASINO", "WAR"], title: "CASINO WAR", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", "..##########............", ".#..........#...........", ".#..#.......#...........", ".#.#.#......#...........", ".#.###......#...........", ".#.#.#......##########..", ".#.#.#.....#..........#.", ".#.........#.#.#......#.", ".#....#....#.#.#......#.", ".#...###...#.##.......#.", ".#..#####..#.#.#......#.", ".#.#######.#.#.#......#.", ".#.#######.#..........#.", ".#..#.#.#..#...##.##..#.", ".#...###...#..#..#..#.#.", ".#.........#..#.....#.#.", "..##########..#.....#.#.", "...........#...#...#..#.", "...........#....#.#...#.", "...........#.....#....#.", "...........#..........#.", "............##########..", "........................"]),
  }),
  vxp("REDDOG.VXP", {
    id: "reddog", vxId: 0x56581012, name: ["RED", "DOG"], title: "RED DOG", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", "........................", ".......##########.......", ".######.#.#.#.#.######..", "#......##.#.#.#.#.....#.", "#.###..#.#.#.#.##.#.#.#.", "#.#....##.#.#.#.#.#.#.#.", "#.##...#.#.#.#.##.###.#.", "#...#..##.#.#.#.#...#.#.", "#.##...#.#.#.#.##...#.#.", "#......##.#.#.#.#.....#.", "#...#..#.#.#.#.##..#..#.", "#..###.##.#.#.#.#.###.#.", "#.######.#.#.#.##.###.#.", "#.#.#.###.#.#.#.#..#..#.", "#...#..#.#.#.#.##.....#.", "#..###.##.#.#.#.#.....#.", "#......#.#.#.#.##.....#.", "#......##.#.#.#.#.....#.", ".######.#.#.#.#.######..", ".......##########.......", "........................", "........................", "........................"]),
  }),
  vxp("BACCARAT.VXP", {
    id: "baccarat", vxId: 0x5658100F, name: ["BACCA", "RAT"], title: "BACCARAT", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", "........................", "..##########............", ".#..........#...........", ".#.###......#...........", ".#.#.#..##########......", ".#.###.#..........#.....", ".#...#.#.###......#.....", ".#.###.#.#.#......#.....", ".#.....#.###......#.....", ".#.....#.#.#......#.....", ".#.....#.###......#.....", ".#..#..#..........#.....", ".#.###.#....#.....#.....", ".#.#####...###....#.....", ".#.###.#..#####...#.....", ".#..#..#.#######..#.....", ".#.###.#.#######..#.....", ".#.....#..#.#.#...#.....", "..######....#.....#.....", ".......#...###....#.....", ".......#..........#.....", "........##########......", "........................"]),
  }),
  vxp("KENO.VXP", {
    id: "keno", vxId: 0x56581017, name: ["KENO"], title: "KENO", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["####################....", "#..................#....", "#.##.##.#..##.#..#.#....", "#.##.#.....##......#....", "#..................#....", "#.#..#..##.#..##.#.#....", "#.......##....#....#....", "#..................#....", "#.##.##.#..#..#..#.#....", "#.#..##............#....", "#..................#....", "#.#..#..##.##.#######...", "#.......#..####.....##..", "#...........##.......##.", "#.##.#..#..##.........##", "#.##.......#....###....#", "#..........#....#.#....#", "############....###....#", "...........#....#.#....#", "...........#....###....#", "...........##.........##", "............##.......##.", ".............##.....##..", "..............#######..."]),
  }),
  vxp("3CARDPOK.VXP", {
    id: "threecard", vxId: 0x56581011, name: ["3 CARD", "POKER"], title: "3 CARD POKER", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", "........................", "..#######...............", ".#.......#..............", ".#.###...#..............", ".#...#..#######.........", ".#..##.#.......#........", ".#...#.#.###...#........", ".#.###.#...#..#######...", ".#.....#..##.#.......#..", ".#.....#...#.#.###...#..", ".#.....#.###.#...#...#..", ".#.....#.....#..##...#..", ".#.....#..#.##...#...#..", ".#.....#.#####.###...#..", ".#.....#.#####.......#..", "..######..####...#...#..", ".......#...#.#..###..#..", ".......#.....#.#####.#..", "........######.#####.#..", ".............#...#...#..", ".............#.......#..", "..............#######...", "........................"]),
  }),
  vxp("CRAPS.VXP", {
    id: "craps", vxId: 0x56581014, name: ["CRAPS"], title: "CRAPS", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", "..............##........", "..............#####.....", ".............########...", ".............#..#######.", "............##..#######.", "............##########..", "............##########..", "...........#######..##..", "..............####..#...", "..##########..#######...", ".############..#####....", ".##..####..##.....##....", ".##..####..##...........", ".############...........", ".#####..#####...........", ".#####..#####...........", ".############...........", ".##..####..##...........", ".##..####..##...........", ".############...........", "..##########............", "........................", "#.#.#.#.#.#.#.#.#.#.#.#."]),
  }),
  vxp("SCRATCH.VXP", {
    id: "scratch", vxId: 0x56581019, name: ["LUCKY", "TICKET"], title: "SCRATCH", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", ".######################.", ".#....................#.", ".#.######.....#######.#.", ".#.######.......####..#.", ".#.....##......###....#.", ".#....##.....###......#.", ".#...##.....###.......#.", ".#...##.....##........#.", ".#....................#.", ".#.##################.#.", ".#....................#.", ".#.######.......####..#.", ".#............##....#.#.", ".#.######....#.####..#..", ".#...........#.#####.#..", ".#.######....#.#####.#..", ".#............#.###.#.#.", ".#.######......#...#..#.", ".#....................#.", ".######################.", "........................", "........................", "........................"]),
  }),
  vxp("BIGSIX.VXP", {
    id: "bigsix", vxId: 0x56581018, name: ["BIG", "SIX"], title: "BIG SIX", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt([".........######.........", "..........####..........", "...........##...........", "........########........", "......###......###......", ".....##.#......####.....", "....##..##....######....", "...##....#....#######...", "...#.....##..########...", "..##......#..#########..", "..####....############..", ".##...###.########...##.", ".##.....##....##.....##.", ".##......#....#......##.", ".##.....##....##.....##.", ".##...########.###...##.", "..############....####..", "..#########..#......##..", "...########..##.....#...", "...#######....#....##...", "....######....##..##....", ".....####......#.##.....", "......###......###......", "........########........"]),
  }),
  vxp("LETITRID.VXP", {
    id: "letitride", vxId: 0x56581013, name: ["LET IT", "RIDE"], title: "LET IT RIDE", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", ".##########.............", "#..........#............", "#..#.......#............", "#.#.#......#....#####...", "#.###......#...#.....#..", "#.#.#......#..#..###..#.", "#.#.#......#..#.#...#.#.", "#....#.....#..#..###..#.", "#...###....#...#.....#..", "#..#####...#....#####...", "#..#####...#............", "#..#.#.#...#....#####...", "#....#.....#...#.....#..", "#...###....#..#..###..#.", "#..........#..#.#...#.#.", "#..........#..#..###..#.", "#..........#...#.....#..", ".##########.....#####...", "................#####...", "...............#.....#..", "..............#..###..#.", "..............#.#...#.#.", "...............#######.."]),
  }),
  vxp("FROGRACE.VXP", {
    id: "frogs", vxId: 0x5658101A, name: ["FROG", "RACE"], title: "FROG RACE", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", "........................", "....................####", "....................##.#", "....................#.#.", "....................##.#", "....................#.#.", "....................####", ".......####..####...#...", ".......#.##..#.##...#...", ".....############...#...", ".....############...#...", "...################.#...", "...################.#...", ".##################.#...", ".##################.#...", "...####......####...#...", "...####......####...#...", "######################..", ".###########.########...", "........................", "..##.....##.....##......", "........................", ".....##......##.....##.."]),
  }),
  vxp("SICBO.VXP", {
    id: "sicbo", vxId: 0x56581015, name: ["SIC", "BO"], title: "SIC BO", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["...........##...........", "..........####..........", "...........##...........", ".......##########.......", ".....##############.....", "....##.#############....", "...##.###############...", "...##.###############...", "..##.#################..", "..####################..", ".#....................#.", ".######################.", "........................", "........................", "..#####...#####...#####.", ".#.###.#.#.###.#.#.#.#.#", ".#######.#######.#######", ".#######.###.###.#######", ".#######.#######.#######", ".#.###.#.#.###.#.#.#.#.#", "..#####...#####...#####.", "........................", "#.#.#.#.#.#.#.#.#.#.#.#.", "........................"]),
  }),
  vxp("CHUCKALU.VXP", {
    id: "chuckaluck", vxId: 0x56581016, name: ["CHUCK", "A-LUCK"], title: "CHUCK-A-LUCK", casino: true,
    score: rec => ["BIG WIN", String(rec.best || 0)],
    art: rowsArt(["........................", "..####################..", ".######################.", "..#....#........#....#..", "...#.......###......#...", "....#...#.#####....#....", ".....#....##.##...#.....", "......#...#####..#......", ".......#...###..#.......", "........#...............", ".........#....#.........", ".........######.........", ".........######.........", ".........#....#.........", "........................", ".......###....###.......", "......#.###..#.#.#......", "......#####..##.##......", "....#.###.#..#.#.#.#....", "...#...###....###...#...", "..#..................#..", ".######################.", "..####################..", "#.#.#.#.#.#.#.#.#.#.#.#."]),
  }),
  vxp("TRICKYWI.VXP", {
    id: "tricky", vxId: 0x56588001, name: ["TRICKY", "WICKS"], title: "TRICKY WICKS",
    art(s) { s.fill(2, 4, 3, 3); s.fill(1, 7, 5, 4); s.px(3, 2); s.px(2, 1); s.line(6, 9, 13, 9); s.line(13, 9, 13, 16);
      s.line(13, 16, 15, 16); s.disc(19, 16, 4); s.fill(18, 10, 2, 3); s.px(21, 9); },
  }),
  vxp("ZORKI.VXP", {
    id: "zork", vxId: 0x56588002, name: ["ZORK I"], title: "ZORK I",
    // its SAVE command writes the game's save; SAVES shows the day. The JS core's old save is carried over (zorkSave).
    record(g, rec) { if (!g.saved) return false; g.saved = 0; rec.saved = new Date().toISOString().slice(5, 10); return true; },
    migrate: zorkSave,
    erase() { try { localStorage.removeItem("vmx-zork-save"); } catch {} },
    score: rec => rec.saved ? ["SAVED", rec.saved.replace("-", "/")] : ["NO SAVE"],
    art(s) { s.rect(4, 6, 14, 9); s.fill(5, 7, 12, 1); s.line(11, 15, 11, 23); s.line(18, 6, 18, 2); s.fill(19, 2, 3, 2);
      s.line(0, 23, 23, 23); },
  }),
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
