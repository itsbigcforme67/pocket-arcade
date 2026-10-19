// A bare Atari 800 for STAR RAIDERS: our 6502 + just the hardware the cartridge touches (per Lorenz Wiest's
// reverse-engineered source, github.com/lwiest/StarRaiders). No Atari OS: the cart boots straight into its own code
// (header option $80), so a 32-byte stub stands in for the OS's NMI/IRQ dispatch. Not emulated: ANTIC/GTIA
// drawing (we draw the game's state ourselves) and POKEY sound (the writes are kept for a beeper later).
// Emulated: RAM, the 8 KB cart, joystick + trigger + START/SELECT, keyboard IRQ, RANDOM, VCOUNT/WSYNC, the DLI and VBI
// timing from the game's own display list, and the player/missile collision registers (the game's hit detection).
import { CPU6502 } from "./cpu6502.js";

const LINES = 262, VBI_LINE = 248, CYC_LINE = 104;   // NTSC; cycles per line left after ANTIC's DMA (approx.)
const STUB = [0x2c, 0x0f, 0xd4, 0x10, 0x03, 0x6c, 0x00, 0x02,   // FF00 BIT NMIST / BPL vbi / JMP (VDSLST)
  0x48, 0x8a, 0x48, 0x98, 0x48, 0x6c, 0x22, 0x02,               // FF08 PHA TXA PHA TYA PHA / JMP (VVBLKI)
  0x6c, 0x16, 0x02];                                           // FF10 JMP (VIMIRQ)
// Atari keyboard codes (KBCODE) for the game's keys
export const KEYS = { "0": 0x32, "1": 0x1f, "2": 0x1e, "3": 0x1a, "4": 0x18, "5": 0x1d, "6": 0x1b, "7": 0x33, "8": 0x35,
  "9": 0x30, F: 0x38, A: 0x3f, G: 0x3d, L: 0x00, H: 0x39, T: 0x2d, S: 0x3e, M: 0x25, P: 0x0a, C: 0x12 };

export class StarRaidersMachine {
  constructor(cart, seed = 1) {
    if (cart.length !== 8192) throw new Error("expected the 8 KB STAR RAIDERS cartridge");
    this.mem = new Uint8Array(65536);
    this.mem.set(cart, 0xa000);
    this.mem.set(STUB, 0xff00);
    this.mem[0xfffa] = 0x00; this.mem[0xfffb] = 0xff;           // NMI
    this.mem[0xfffc] = cart[0x1ffe]; this.mem[0xfffd] = cart[0x1fff]; // RESET -> the cart's init address
    this.mem[0xfffe] = 0x10; this.mem[0xffff] = 0xff;           // IRQ
    this.gtia = new Uint8Array(32); this.antic = new Uint8Array(16); this.pokey = new Uint8Array(16);
    this.nmist = 0; this.line = 0; this.lineCyc = 0; this.wsync = false; this.frame = 0;
    this.joy = 0x0f; this.trig = 1; this.consol = 7; this.kbcode = 0; this.irqPending = false;
    this.coll = null; this.rnd = seed >>> 0 || 1;
    this.cpu = new CPU6502(a => this.read(a), (a, v) => this.write(a, v));
    this.cpu.reset();
  }
  read(a) {
    if (a < 0xd000 || a >= 0xd800) return this.mem[a];
    const hi = a & 0xff00, r = a & 0x1f;
    if (hi === 0xd000) {
      if (r >= 0x08 && r <= 0x0f) { this.collide(); return r <= 0x0b ? this.coll.mp[r - 8] : r === 0x0f ? this.coll.p3 : 0; }
      if (r === 0x10) return this.trig;
      if (r === 0x1f) return this.consol;
      return 0;
    }
    if (hi === 0xd200) {
      const p = a & 0x0f;
      if (p === 0x09) return this.kbcode;
      if (p === 0x0a) { let s = this.rnd; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.rnd = s >>> 0; return (s >>> 3) & 255; }
      if (p === 0x0f) return 0xff;
      return 0xff;
    }
    if (hi === 0xd300) return (a & 3) === 0 ? (0xf0 | this.joy) : 0;
    if (hi === 0xd400) {
      const p = a & 0x0f;
      if (p === 0x0b) return (this.line >> 1) & 255;
      if (p === 0x0f) return this.nmist | 0x1f;
      return 0;
    }
    return 0;
  }
  write(a, v) {
    if (a < 0xa000) { this.mem[a] = v; return; }
    if (a < 0xd000 || a >= 0xd800) return;                     // cart / OS area: ROM
    const hi = a & 0xff00;
    if (hi === 0xd000) { const r = a & 0x1f; this.gtia[r] = v; if (r === 0x1e) this.coll = { mp: [0, 0, 0, 0], p3: 0, from: this.line >= VBI_LINE ? 0 : this.line }; return; }
    if (hi === 0xd200) { const p = a & 0x0f; this.pokey[p] = v; if (p === 0x0e && !(v & 0x40)) this.irqPending = false; return; }
    if (hi === 0xd400) {
      const p = a & 0x0f; this.antic[p] = v;
      if (p === 0x0a) this.wsync = true;
      if (p === 0x0f) this.nmist = 0;
    }
  }
  // collision registers: players/missiles drawn from P/M memory over the lines shown since HITCLR (lazily, on read)
  collide() {
    const c = this.coll || { mp: [0, 0, 0, 0], p3: 0, from: 8 };
    const base = (this.antic[7] & 0xf8) << 8, g = this.gtia, m = this.mem;
    const upto = Math.min(this.line, VBI_LINE);
    for (let L = Math.max(8, c.from); L < upto; L++) {
      const pl = [0, 1, 2, 3].map(n => m[base + 0x400 + n * 0x100 + L]), ms = m[base + 0x300 + L];
      if (!pl[0] && !pl[1] && !pl[2] && !pl[3]) continue;
      const cov = (n, x) => { const d = x - g[n]; return d >= 0 && d < 8 && (pl[n] >> (7 - d)) & 1; };
      for (let x = 34; x < 222; x++) {
        const hit = [0, 1, 2, 3].map(n => cov(n, x));
        if (hit[3]) for (let n = 0; n < 3; n++) if (hit[n]) c.p3 |= 1 << n;
        for (let k = 0; k < 4; k++) {
          const d = x - g[4 + k];
          if (d >= 0 && d < 2 && (ms >> (2 * k + 1 - d)) & 1) for (let n = 0; n < 4; n++) if (hit[n]) c.mp[k] |= 1 << n;
        }
      }
    }
    c.from = upto; this.coll = c;
  }
  dliLines() {                                                  // scanlines that end a DLI-flagged display list line
    const H = { 2: 8, 3: 10, 4: 8, 5: 16, 6: 8, 7: 16, 8: 8, 9: 4, 10: 4, 11: 2, 12: 1, 13: 2, 14: 1, 15: 1 };
    const out = []; let pc = this.antic[2] | (this.antic[3] << 8), line = 8;
    for (let guard = 0; guard < 240 && line < VBI_LINE; guard++) {
      const ins = this.mem[pc]; pc = (pc + 1) & 0xffff;
      const mode = ins & 15; let h;
      if (mode === 0) h = ((ins >> 4) & 7) + 1;
      else if (mode === 1) { if (ins & 0x40) break; pc = this.mem[pc] | (this.mem[pc + 1] << 8); continue; }
      else { h = H[mode]; if (ins & 0x40) pc = (pc + 2) & 0xffff; }
      line += h;
      if (ins & 0x80) out.push(line - 1);
    }
    return out;
  }
  // one TV frame: run the CPU line by line, raising DLIs, the VBI and key IRQs on time
  runFrame() {
    const cpu = this.cpu, dlis = new Set(this.antic[14] & 0x80 ? this.dliLines() : []);
    for (this.line = 0; this.line < LINES; this.line++) {
      if (this.line === VBI_LINE && this.antic[14] & 0x40) { this.nmist = 0x40; cpu.nmi(); }
      let budget = CYC_LINE; this.wsync = false;
      while (budget > 0 && !this.wsync) {
        if (this.irqPending && this.pokey[14] & 0x40 && !cpu.i) cpu.irq();
        budget -= cpu.step();
      }
      if (dlis.has(this.line)) { this.nmist = 0x80; cpu.nmi(); }
    }
    this.frame++;
  }
  key(name) { this.kbcode = KEYS[name]; this.irqPending = true; }
}
