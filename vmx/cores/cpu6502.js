// NMOS 6502 core (documented opcodes, decimal mode, the JMP ($xxFF) page bug), written from scratch. The host gives
// read(addr) / write(addr, v); step() runs one instruction and returns its cycles. nmi() / irq() raise interrupts.
// Plain JS, no I/O: ports to the ESP32 as it stands.

export class CPU6502 {
  constructor(read, write) {
    this.read = read; this.write = write;
    this.a = 0; this.x = 0; this.y = 0; this.s = 0xfd; this.pc = 0;
    this.c = 0; this.z = 0; this.i = 1; this.d = 0; this.v = 0; this.n = 0;
    this.cycles = 0;
  }
  r16(a) { return this.read(a) | (this.read((a + 1) & 0xffff) << 8); }
  r16bug(a) { return this.read(a) | (this.read((a & 0xff00) | ((a + 1) & 0xff)) << 8); }
  push(v) { this.write(0x100 | this.s, v & 255); this.s = (this.s - 1) & 255; }
  pop() { this.s = (this.s + 1) & 255; return this.read(0x100 | this.s); }
  get p() { return (this.n << 7) | (this.v << 6) | 0x20 | (this.d << 3) | (this.i << 2) | (this.z << 1) | this.c; }
  set p(v) { this.n = (v >> 7) & 1; this.v = (v >> 6) & 1; this.d = (v >> 3) & 1; this.i = (v >> 2) & 1; this.z = (v >> 1) & 1; this.c = v & 1; }
  nz(v) { this.n = (v >> 7) & 1; this.z = v === 0 ? 1 : 0; return v; }
  reset() { this.pc = this.r16(0xfffc); this.s = 0xfd; this.i = 1; }
  interrupt(vec, brk) {
    this.push(this.pc >> 8); this.push(this.pc); this.push(this.p & ~0x10 | (brk ? 0x10 : 0));
    this.i = 1; this.pc = this.r16(vec); this.cycles += 7;
  }
  nmi() { this.interrupt(0xfffa, false); }
  irq() { if (!this.i) { this.interrupt(0xfffe, false); return true; } return false; }

  adc(m) {
    if (this.d) {
      let lo = (this.a & 15) + (m & 15) + this.c, hi = (this.a >> 4) + (m >> 4);
      if (lo > 9) { lo += 6; hi++; }
      const bin = (this.a + m + this.c) & 255;
      this.z = bin === 0 ? 1 : 0;
      this.n = (hi << 4) & 0x80 ? 1 : 0;
      this.v = (~(this.a ^ m) & (this.a ^ (hi << 4)) & 0x80) ? 1 : 0;
      if (hi > 9) hi += 6;
      this.c = hi > 15 ? 1 : 0;
      this.a = ((hi << 4) | (lo & 15)) & 255;
      return;
    }
    const t = this.a + m + this.c;
    this.v = (~(this.a ^ m) & (this.a ^ t) & 0x80) ? 1 : 0;
    this.c = t > 255 ? 1 : 0; this.a = this.nz(t & 255);
  }
  sbc(m) {
    if (this.d) {
      const t = this.a - m - (1 - this.c);
      let lo = (this.a & 15) - (m & 15) - (1 - this.c), hi = (this.a >> 4) - (m >> 4);
      if (lo < 0) { lo -= 6; hi--; }
      if (hi < 0) hi -= 6;
      this.v = ((this.a ^ m) & (this.a ^ t) & 0x80) ? 1 : 0;
      this.c = t >= 0 ? 1 : 0; this.nz(t & 255);
      this.a = ((hi << 4) | (lo & 15)) & 255;
      return;
    }
    const t = this.a - m - (1 - this.c);
    this.v = ((this.a ^ m) & (this.a ^ t) & 0x80) ? 1 : 0;
    this.c = t >= 0 ? 1 : 0; this.a = this.nz(t & 255);
  }
  cmp(r, m) { const t = r - m; this.c = t >= 0 ? 1 : 0; this.nz(t & 255); }

  step() {
    const op = this.read(this.pc); this.pc = (this.pc + 1) & 0xffff;
    const e = OPS[op];
    if (!e) throw new Error(`illegal opcode $${op.toString(16)} at $${((this.pc - 1) & 0xffff).toString(16)}`);
    const [fn, mode, cyc] = e;
    let addr = 0, extra = 0;
    switch (mode) {
      case "imp": case "acc": break;
      case "imm": addr = this.pc; this.pc = (this.pc + 1) & 0xffff; break;
      case "zp": addr = this.read(this.pc); this.pc = (this.pc + 1) & 0xffff; break;
      case "zpx": addr = (this.read(this.pc) + this.x) & 255; this.pc = (this.pc + 1) & 0xffff; break;
      case "zpy": addr = (this.read(this.pc) + this.y) & 255; this.pc = (this.pc + 1) & 0xffff; break;
      case "abs": addr = this.r16(this.pc); this.pc = (this.pc + 2) & 0xffff; break;
      case "abx": { const b = this.r16(this.pc); this.pc = (this.pc + 2) & 0xffff; addr = (b + this.x) & 0xffff; if ((b ^ addr) & 0x100) extra = 1; break; }
      case "aby": { const b = this.r16(this.pc); this.pc = (this.pc + 2) & 0xffff; addr = (b + this.y) & 0xffff; if ((b ^ addr) & 0x100) extra = 1; break; }
      case "ind": addr = this.r16bug(this.r16(this.pc)); this.pc = (this.pc + 2) & 0xffff; break;
      case "izx": { const z = (this.read(this.pc) + this.x) & 255; this.pc = (this.pc + 1) & 0xffff; addr = this.read(z) | (this.read((z + 1) & 255) << 8); break; }
      case "izy": { const z = this.read(this.pc); this.pc = (this.pc + 1) & 0xffff; const b = this.read(z) | (this.read((z + 1) & 255) << 8); addr = (b + this.y) & 0xffff; if ((b ^ addr) & 0x100) extra = 1; break; }
      case "rel": { let o = this.read(this.pc); this.pc = (this.pc + 1) & 0xffff; if (o & 0x80) o -= 256; addr = (this.pc + o) & 0xffff; break; }
    }
    const n = fn(this, addr, mode);
    const c = cyc + (n === -1 ? 0 : (n || 0) + (PAGE_PENALTY.has(op) ? extra : 0));
    this.cycles += c;
    return c;
  }
}

function branch(cpu, addr, cond) { if (!cond) return 0; const x = ((cpu.pc ^ addr) & 0x100) ? 2 : 1; cpu.pc = addr; return x; }
const rd = (cpu, a, m) => (m === "imm" ? cpu.read(a) : cpu.read(a));
function rmw(cpu, a, m, f) {
  if (m === "acc") { cpu.a = f(cpu.a); return; }
  const v = cpu.read(a); cpu.write(a, v); cpu.write(a, f(v));      // the 6502's double write
}
const I = {
  LDA: (c, a, m) => { c.a = c.nz(rd(c, a, m)); }, LDX: (c, a, m) => { c.x = c.nz(rd(c, a, m)); }, LDY: (c, a, m) => { c.y = c.nz(rd(c, a, m)); },
  STA: (c, a) => { c.write(a, c.a); }, STX: (c, a) => { c.write(a, c.x); }, STY: (c, a) => { c.write(a, c.y); },
  TAX: c => { c.x = c.nz(c.a); }, TAY: c => { c.y = c.nz(c.a); }, TXA: c => { c.a = c.nz(c.x); }, TYA: c => { c.a = c.nz(c.y); },
  TSX: c => { c.x = c.nz(c.s); }, TXS: c => { c.s = c.x; },
  PHA: c => { c.push(c.a); }, PHP: c => { c.push(c.p | 0x10); }, PLA: c => { c.a = c.nz(c.pop()); }, PLP: c => { c.p = c.pop(); },
  AND: (c, a, m) => { c.a = c.nz(c.a & rd(c, a, m)); }, ORA: (c, a, m) => { c.a = c.nz(c.a | rd(c, a, m)); },
  EOR: (c, a, m) => { c.a = c.nz(c.a ^ rd(c, a, m)); },
  ADC: (c, a, m) => { c.adc(rd(c, a, m)); }, SBC: (c, a, m) => { c.sbc(rd(c, a, m)); },
  CMP: (c, a, m) => { c.cmp(c.a, rd(c, a, m)); }, CPX: (c, a, m) => { c.cmp(c.x, rd(c, a, m)); }, CPY: (c, a, m) => { c.cmp(c.y, rd(c, a, m)); },
  BIT: (c, a) => { const v = c.read(a); c.z = (c.a & v) === 0 ? 1 : 0; c.n = (v >> 7) & 1; c.v = (v >> 6) & 1; },
  INC: (c, a) => rmw(c, a, "", v => c.nz((v + 1) & 255)), DEC: (c, a) => rmw(c, a, "", v => c.nz((v - 1) & 255)),
  INX: c => { c.x = c.nz((c.x + 1) & 255); }, INY: c => { c.y = c.nz((c.y + 1) & 255); },
  DEX: c => { c.x = c.nz((c.x - 1) & 255); }, DEY: c => { c.y = c.nz((c.y - 1) & 255); },
  ASL: (c, a, m) => rmw(c, a, m, v => { c.c = v >> 7; return c.nz((v << 1) & 255); }),
  LSR: (c, a, m) => rmw(c, a, m, v => { c.c = v & 1; return c.nz(v >> 1); }),
  ROL: (c, a, m) => rmw(c, a, m, v => { const r = ((v << 1) | c.c) & 255; c.c = v >> 7; return c.nz(r); }),
  ROR: (c, a, m) => rmw(c, a, m, v => { const r = (v >> 1) | (c.c << 7); c.c = v & 1; return c.nz(r); }),
  JMP: (c, a) => { c.pc = a; },
  JSR: (c, a) => { const r = (c.pc - 1) & 0xffff; c.push(r >> 8); c.push(r); c.pc = a; },
  RTS: c => { c.pc = ((c.pop() | (c.pop() << 8)) + 1) & 0xffff; },
  RTI: c => { c.p = c.pop(); c.pc = c.pop() | (c.pop() << 8); },
  BRK: c => { c.pc = (c.pc + 1) & 0xffff; c.interrupt(0xfffe, true); c.cycles -= 7; },
  BCC: (c, a) => branch(c, a, !c.c), BCS: (c, a) => branch(c, a, c.c), BEQ: (c, a) => branch(c, a, c.z), BNE: (c, a) => branch(c, a, !c.z),
  BMI: (c, a) => branch(c, a, c.n), BPL: (c, a) => branch(c, a, !c.n), BVC: (c, a) => branch(c, a, !c.v), BVS: (c, a) => branch(c, a, c.v),
  CLC: c => { c.c = 0; }, SEC: c => { c.c = 1; }, CLI: c => { c.i = 0; }, SEI: c => { c.i = 1; },
  CLD: c => { c.d = 0; }, SED: c => { c.d = 1; }, CLV: c => { c.v = 0; }, NOP: () => {},
};
const TABLE = `
00 BRK imp 7|01 ORA izx 6|05 ORA zp 3|06 ASL zp 5|08 PHP imp 3|09 ORA imm 2|0A ASL acc 2|0D ORA abs 4|0E ASL abs 6
10 BPL rel 2|11 ORA izy 5|15 ORA zpx 4|16 ASL zpx 6|18 CLC imp 2|19 ORA aby 4|1D ORA abx 4|1E ASL abx 7
20 JSR abs 6|21 AND izx 6|24 BIT zp 3|25 AND zp 3|26 ROL zp 5|28 PLP imp 4|29 AND imm 2|2A ROL acc 2|2C BIT abs 4|2D AND abs 4|2E ROL abs 6
30 BMI rel 2|31 AND izy 5|35 AND zpx 4|36 ROL zpx 6|38 SEC imp 2|39 AND aby 4|3D AND abx 4|3E ROL abx 7
40 RTI imp 6|41 EOR izx 6|45 EOR zp 3|46 LSR zp 5|48 PHA imp 3|49 EOR imm 2|4A LSR acc 2|4C JMP abs 3|4D EOR abs 4|4E LSR abs 6
50 BVC rel 2|51 EOR izy 5|55 EOR zpx 4|56 LSR zpx 6|58 CLI imp 2|59 EOR aby 4|5D EOR abx 4|5E LSR abx 7
60 RTS imp 6|61 ADC izx 6|65 ADC zp 3|66 ROR zp 5|68 PLA imp 4|69 ADC imm 2|6A ROR acc 2|6C JMP ind 5|6D ADC abs 4|6E ROR abs 6
70 BVS rel 2|71 ADC izy 5|75 ADC zpx 4|76 ROR zpx 6|78 SEI imp 2|79 ADC aby 4|7D ADC abx 4|7E ROR abx 7
81 STA izx 6|84 STY zp 3|85 STA zp 3|86 STX zp 3|88 DEY imp 2|8A TXA imp 2|8C STY abs 4|8D STA abs 4|8E STX abs 4
90 BCC rel 2|91 STA izy 6|94 STY zpx 4|95 STA zpx 4|96 STX zpy 4|98 TYA imp 2|99 STA aby 5|9A TXS imp 2|9D STA abx 5
A0 LDY imm 2|A1 LDA izx 6|A2 LDX imm 2|A4 LDY zp 3|A5 LDA zp 3|A6 LDX zp 3|A8 TAY imp 2|A9 LDA imm 2|AA TAX imp 2|AC LDY abs 4|AD LDA abs 4|AE LDX abs 4
B0 BCS rel 2|B1 LDA izy 5|B4 LDY zpx 4|B5 LDA zpx 4|B6 LDX zpy 4|B8 CLV imp 2|B9 LDA aby 4|BA TSX imp 2|BC LDY abx 4|BD LDA abx 4|BE LDX aby 4
C0 CPY imm 2|C1 CMP izx 6|C4 CPY zp 3|C5 CMP zp 3|C6 DEC zp 5|C8 INY imp 2|C9 CMP imm 2|CA DEX imp 2|CC CPY abs 4|CD CMP abs 4|CE DEC abs 6
D0 BNE rel 2|D1 CMP izy 5|D5 CMP zpx 4|D6 DEC zpx 6|D8 CLD imp 2|D9 CMP aby 4|DD CMP abx 4|DE DEC abx 7
E0 CPX imm 2|E1 SBC izx 6|E4 CPX zp 3|E5 SBC zp 3|E6 INC zp 5|E8 INX imp 2|E9 SBC imm 2|EA NOP imp 2|EC CPX abs 4|ED SBC abs 4|EE INC abs 6
F0 BEQ rel 2|F1 SBC izy 5|F5 SBC zpx 4|F6 INC zpx 6|F8 SED imp 2|F9 SBC aby 4|FD SBC abx 4|FE INC abx 7`;
const OPS = new Array(256);
for (const ent of TABLE.trim().split(/[|\n]/)) {
  const [h, name, mode, cyc] = ent.trim().split(" ");
  OPS[parseInt(h, 16)] = [I[name], mode, +cyc];
}
// read instructions that take +1 cycle when indexing crosses a page
const PAGE_PENALTY = new Set([0x11, 0x19, 0x1d, 0x31, 0x39, 0x3d, 0x51, 0x59, 0x5d, 0x71, 0x79, 0x7d, 0xb1, 0xb9, 0xbc, 0xbd, 0xbe,
  0xd1, 0xd9, 0xdd, 0xf1, 0xf9, 0xfd]);
