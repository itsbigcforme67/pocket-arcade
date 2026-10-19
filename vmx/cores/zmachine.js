// Z-machine, version 3 (Zork I-III and the other early Infocom-format story files), written from scratch after the
// public Z-Machine Standards Document 1.1. No browser or node dependencies, so it ports to the ESP32 as it stands.
//   const vm = new ZMachine(storyBytes, seed);
//   vm.run();               // runs until the game wants a line: vm.state === "input" (or "quit"); text in vm.take()
//   vm.input("open mailbox"); vm.run(); ...
// SAVE/RESTORE snapshot into vm.saved (the caller may persist it). Seeded RNG, so a run is repeatable.

const A0 = "abcdefghijklmnopqrstuvwxyz", A1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", A2 = "\0\n0123456789.,!?_#'\"/\\-:()";
const s16 = x => (x << 16) >> 16;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export class ZMachine {
  constructor(story, seed = 1) {
    this.story = Uint8Array.from(story); this.seed = seed; this.saved = null;
    if (this.story[0] !== 3) throw new Error(`story is version ${this.story[0]}; only version 3 is supported`);
    this.restart();
  }
  restart() {
    const keep = this.m ? this.m[0x11] & 3 : 0;
    this.m = this.story.slice(); this.m[0x11] = (this.m[0x11] & ~3) | keep;
    this.m[1] &= ~0x70;                                          // status line available, screen not split, fixed font
    this.dynEnd = this.w(0x0e); this.globals = this.w(0x0c); this.objt = this.w(0x0a); this.abbr = this.w(0x18);
    this.pc = this.w(6); this.stack = []; this.frames = [{ pc: 0, locals: [], sp: 0, store: -1 }];
    this.out = ""; this.streams3 = []; this.state = "run"; this.rnd = rng(this.seed); this.status = null;
    this.readDict();
  }
  // ---- memory -----------------------------------------------------------------------------------------------------
  w(a) { return (this.m[a] << 8) | this.m[a + 1]; }
  sw(a, v) { this.m[a] = (v >> 8) & 255; this.m[a + 1] = v & 255; }
  getVar(v) {
    if (v === 0) { if (!this.stack.length) throw new Error("stack underflow"); return this.stack.pop(); }
    if (v < 16) return this.frames[this.frames.length - 1].locals[v - 1];
    return this.w(this.globals + 2 * (v - 16));
  }
  setVar(v, x) {
    x &= 0xffff;
    if (v === 0) this.stack.push(x);
    else if (v < 16) this.frames[this.frames.length - 1].locals[v - 1] = x;
    else this.sw(this.globals + 2 * (v - 16), x);
  }
  peekVar(v) { return v === 0 ? this.stack[this.stack.length - 1] : this.getVar(v); }        // "indirect" refs:
  pokeVar(v, x) { if (v === 0) this.stack[this.stack.length - 1] = x & 0xffff; else this.setVar(v, x); }  // the stack in place
  // ---- text -------------------------------------------------------------------------------------------------------
  zstr(a) {                                                     // -> [text, address after]
    const zs = [];
    for (;;) { const x = this.w(a); a += 2; zs.push((x >> 10) & 31, (x >> 5) & 31, x & 31); if (x & 0x8000) break; }
    let s = "", shift = 0, abbr = 0, esc = 0, hi = 0;
    for (const z of zs) {
      if (abbr) { s += this.zstr(this.w(this.abbr + 2 * (32 * (abbr - 1) + z)) * 2)[0]; abbr = 0; continue; }
      if (esc === 1) { hi = z; esc = 2; continue; }
      if (esc === 2) { s += this.zscii((hi << 5) | z); esc = 0; continue; }
      if (z === 0) { s += " "; shift = 0; continue; }
      if (z <= 3) { abbr = z; continue; }
      if (z === 4 || z === 5) { shift = z - 3; continue; }
      const al = shift; shift = 0;
      if (al === 2 && z === 6) { esc = 1; continue; }
      s += (al === 0 ? A0 : al === 1 ? A1 : A2)[z - 6];
    }
    return [s, a];
  }
  zscii(c) { return c === 13 ? "\n" : c >= 32 && c < 127 ? String.fromCharCode(c) : c === 0 ? "" : "?"; }
  encode(word) {                                                // dictionary form: 6 z-chars in 2 words
    const zs = [];
    for (const ch of word) {
      const i = A0.indexOf(ch), j = A2.indexOf(ch);
      if (i >= 0) zs.push(i + 6); else if (j >= 2) zs.push(5, j + 6);
      else { const c = ch.charCodeAt(0) & 1023; zs.push(5, 6, c >> 5, c & 31); }
      if (zs.length >= 6) break;
    }
    while (zs.length < 6) zs.push(5);
    return [(zs[0] << 10) | (zs[1] << 5) | zs[2], 0x8000 | (zs[3] << 10) | (zs[4] << 5) | zs[5]];
  }
  readDict() {
    let a = this.w(8); const n = this.m[a]; this.seps = [];
    for (let i = 0; i < n; i++) this.seps.push(String.fromCharCode(this.m[a + 1 + i]));
    a += 1 + n; const len = this.m[a], cnt = s16(this.w(a + 1)); a += 3;
    this.dict = new Map(); this.words = [];                     // words: [{ text, addr, flags }] in dictionary order
    for (let i = 0; i < Math.abs(cnt); i++, a += len) {
      this.dict.set(this.w(a) * 65536 + this.w(a + 2), a);
      this.words.push({ text: this.zstr(a)[0], addr: a, flags: this.m[a + 4] });
    }
  }
  lookup(word) { const [x, y] = this.encode(word); return this.dict.get(x * 65536 + y) || 0; }
  print(s) {
    if (this.streams3.length) { this.streams3[this.streams3.length - 1].text += s; return; }
    this.out += s;
  }
  take() { const s = this.out; this.out = ""; return s; }
  // ---- objects ----------------------------------------------------------------------------------------------------
  obj(o) { return this.objt + 62 + (o - 1) * 9; }
  parent(o) { return o ? this.m[this.obj(o) + 4] : 0; }
  sibling(o) { return o ? this.m[this.obj(o) + 5] : 0; }
  child(o) { return o ? this.m[this.obj(o) + 6] : 0; }
  objName(o) { if (!o) return ""; const p = this.w(this.obj(o) + 7); return this.m[p] ? this.zstr(p + 1)[0] : ""; }
  firstProp(o) { const p = this.w(this.obj(o) + 7); return p + 1 + 2 * this.m[p]; }
  propAddr(o, n) {
    if (!o) return 0;
    for (let a = this.firstProp(o); ;) {
      const b = this.m[a]; if (!b) return 0;
      const num = b & 31; if (num === n) return a + 1; if (num < n) return 0;
      a += 2 + (b >> 5);
    }
  }
  removeObj(o) {
    const p = this.parent(o); if (!p) return;
    const oa = this.obj(o), pa = this.obj(p);
    if (this.m[pa + 6] === o) this.m[pa + 6] = this.m[oa + 5];
    else { let x = this.m[pa + 6]; while (this.sibling(x) !== o) x = this.sibling(x); this.m[this.obj(x) + 5] = this.m[oa + 5]; }
    this.m[oa + 4] = 0; this.m[oa + 5] = 0;
  }
  // ---- execution --------------------------------------------------------------------------------------------------
  operand(t) {
    if (t === 0) { const v = this.w(this.pc); this.pc += 2; return v; }
    if (t === 1) return this.m[this.pc++];
    return this.getVar(this.m[this.pc++]);
  }
  store(x) { this.setVar(this.m[this.pc++], x); }
  branch(cond) {
    const b = this.m[this.pc++]; let off;
    if (b & 0x40) off = b & 0x3f;
    else { off = ((b & 0x3f) << 8) | this.m[this.pc++]; if (off & 0x2000) off -= 0x4000; }
    if (!!(b & 0x80) !== !!cond) return;
    if (off === 0 || off === 1) this.ret(off); else this.pc += off - 2;
  }
  call(addr, args, store) {
    if (addr === 0) { this.setVar(store, 0); return; }
    let a = addr * 2; const n = this.m[a++], locals = [];
    for (let i = 0; i < n; i++, a += 2) locals.push(i < args.length ? args[i] : this.w(a));
    this.frames.push({ pc: this.pc, locals, sp: this.stack.length, store });
    this.pc = a;
  }
  ret(x) {
    const f = this.frames.pop(); this.stack.length = f.sp; this.pc = f.pc;
    if (f.store >= 0) this.setVar(f.store, x);
  }
  showStatus() {
    this.status = { room: this.objName(this.getVar(16)), score: s16(this.getVar(17)), moves: this.getVar(18),
                    time: !!(this.m[1] & 2) };
  }
  run(limit = 2e6) {
    while (this.state === "run" && limit-- > 0) this.step();
    return this.state;
  }
  input(line) {
    if (this.state !== "input") return;
    const tb = this.textBuf, pb = this.parseBuf;
    line = line.toLowerCase().slice(0, Math.max(0, this.m[tb] - 1));
    for (let i = 0; i < line.length; i++) this.m[tb + 1 + i] = line.charCodeAt(i);
    this.m[tb + 1 + line.length] = 0;
    const toks = [];
    for (let i = 0; i < line.length;) {
      const c = line[i];
      if (c === " ") { i++; continue; }
      if (this.seps.includes(c)) { toks.push([c, i]); i++; continue; }
      let j = i; while (j < line.length && line[j] !== " " && !this.seps.includes(line[j])) j++;
      toks.push([line.slice(i, j), i]); i = j;
    }
    const n = Math.min(toks.length, this.m[pb]);
    this.m[pb + 1] = n;
    for (let k = 0; k < n; k++) {
      const e = pb + 2 + 4 * k;
      this.sw(e, this.lookup(toks[k][0])); this.m[e + 2] = toks[k][0].length; this.m[e + 3] = toks[k][1] + 1;
    }
    this.state = "run";
  }
  snapshot(pc) {
    return { mem: this.m.slice(0, this.dynEnd), stack: this.stack.slice(), pc,
             frames: this.frames.map(f => ({ ...f, locals: f.locals.slice() })) };
  }
  step() {
    const m = this.m, op = m[this.pc++];
    let kind, num, types;
    if (op >= 0xc0) {
      kind = op & 0x20 ? 3 : 2; num = op & 0x1f; const t = m[this.pc++];
      types = [(t >> 6) & 3, (t >> 4) & 3, (t >> 2) & 3, t & 3];
    } else if (op >= 0x80) {
      const t = (op >> 4) & 3; num = op & 0x0f;
      if (t === 3) { kind = 0; types = []; } else { kind = 1; types = [t]; }
    } else { kind = 2; num = op & 0x1f; types = [op & 0x40 ? 2 : 1, op & 0x20 ? 2 : 1]; }
    const a = [];
    for (const t of types) { if (t === 3) break; a.push(this.operand(t)); }
    const [x, y, z] = a;
    if (kind === 2) switch (num) {
      case 1: return this.branch(a.slice(1).includes(x));
      case 2: return this.branch(s16(x) < s16(y));
      case 3: return this.branch(s16(x) > s16(y));
      case 4: { const v = s16(this.peekVar(x)) - 1; this.pokeVar(x, v); return this.branch(v < s16(y)); }
      case 5: { const v = s16(this.peekVar(x)) + 1; this.pokeVar(x, v); return this.branch(v > s16(y)); }
      case 6: return this.branch(this.parent(x) === y);
      case 7: return this.branch((x & y) === y);
      case 8: return this.store(x | y);
      case 9: return this.store(x & y);
      case 10: return this.branch(x && (m[this.obj(x) + (y >> 3)] & (0x80 >> (y & 7))));
      case 11: if (x) m[this.obj(x) + (y >> 3)] |= 0x80 >> (y & 7); return;
      case 12: if (x) m[this.obj(x) + (y >> 3)] &= ~(0x80 >> (y & 7)); return;
      case 13: return this.pokeVar(x, y);
      case 14: {
        if (!x) return;
        this.removeObj(x);
        const oa = this.obj(x), da = this.obj(y);
        m[oa + 5] = m[da + 6]; m[da + 6] = x; m[oa + 4] = y; return;
      }
      case 15: return this.store(this.w((x + 2 * y) & 0xffff));
      case 16: return this.store(m[(x + y) & 0xffff]);
      case 17: {
        const p = this.propAddr(x, y);
        if (!p) return this.store(this.w(this.objt + 2 * (y - 1)));
        return this.store((m[p - 1] >> 5) === 0 ? m[p] : this.w(p));
      }
      case 18: return this.store(this.propAddr(x, y));
      case 19: {
        if (!x) return this.store(0);
        if (y === 0) return this.store(m[this.firstProp(x)] & 31);
        const p = this.propAddr(x, y); if (!p) throw new Error(`get_next_prop: object ${x} has no property ${y}`);
        return this.store(m[p + 1 + (m[p - 1] >> 5)] & 31);
      }
      case 20: return this.store(s16(x) + s16(y));
      case 21: return this.store(s16(x) - s16(y));
      case 22: return this.store(Math.imul(s16(x), s16(y)));
      case 23: if (!s16(y)) throw new Error("division by zero"); return this.store(Math.trunc(s16(x) / s16(y)));
      case 24: if (!s16(y)) throw new Error("division by zero"); return this.store(s16(x) % s16(y));
    }
    else if (kind === 1) switch (num) {
      case 0: return this.branch(x === 0);
      case 1: { const v = this.sibling(x); this.store(v); return this.branch(v); }
      case 2: { const v = this.child(x); this.store(v); return this.branch(v); }
      case 3: return this.store(this.parent(x));
      case 4: return this.store(x ? (m[x - 1] >> 5) + 1 : 0);
      case 5: return this.pokeVar(x, s16(this.peekVar(x)) + 1);
      case 6: return this.pokeVar(x, s16(this.peekVar(x)) - 1);
      case 7: return this.print(this.zstr(x)[0]);
      case 9: return this.removeObj(x);
      case 10: return this.print(this.objName(x));
      case 11: return this.ret(x);
      case 12: this.pc += s16(x) - 2; return;
      case 13: return this.print(this.zstr(x * 2)[0]);
      case 14: return this.store(this.peekVar(x));
      case 15: return this.store(~x);
    }
    else if (kind === 0) switch (num) {
      case 0: return this.ret(1);
      case 1: return this.ret(0);
      case 2: case 3: {
        const [s, end] = this.zstr(this.pc); this.pc = end; this.print(s);
        if (num === 3) { this.print("\n"); this.ret(1); } return;
      }
      case 4: return;
      case 5: this.saved = this.snapshot(this.pc); return this.branch(true);
      case 6: {
        if (!this.saved) return this.branch(false);
        const sv = this.saved; this.m.set(sv.mem); this.stack = sv.stack.slice(); this.pc = sv.pc;
        this.frames = sv.frames.map(f => ({ ...f, locals: f.locals.slice() }));
        return this.branch(true);                                 // continues as the SAVE did, now succeeding
      }
      case 7: return this.restart();
      case 8: return this.ret(this.stack.pop());
      case 9: this.stack.pop(); return;
      case 10: this.state = "quit"; return;
      case 11: return this.print("\n");
      case 12: return this.showStatus();
      case 13: return this.branch(true);
    }
    else switch (num) {
      case 0: return this.call(x, a.slice(1), m[this.pc++]);
      case 1: return this.sw((x + 2 * y) & 0xffff, z);
      case 2: m[(x + y) & 0xffff] = z & 255; return;
      case 3: {
        const p = this.propAddr(x, y); if (!p) throw new Error(`put_prop: object ${x} has no property ${y}`);
        if ((m[p - 1] >> 5) === 0) m[p] = z & 255; else this.sw(p, z); return;
      }
      case 4: this.showStatus(); this.textBuf = x; this.parseBuf = y; this.state = "input"; return;
      case 5: return this.print(this.zscii(x));
      case 6: return this.print(String(s16(x)));
      case 7: {
        const n = s16(x);
        if (n > 0) return this.store(1 + Math.floor(this.rnd() * n));
        this.rnd = rng(n ? -n : this.seed); return this.store(0);
      }
      case 8: return this.setVar(0, x);
      case 9: { const v = this.getVar(0); return this.pokeVar(x, v); }
      case 10: case 11: case 21: return;                          // split/set window, sound: no upper window here
      case 19: {
        const n = s16(x);
        if (n === 3) this.streams3.push({ addr: y, text: "" });
        else if (n === -3 && this.streams3.length) {
          const t = this.streams3.pop(); this.sw(t.addr, t.text.length);
          for (let i = 0; i < t.text.length; i++) m[t.addr + 2 + i] = t.text.charCodeAt(i) === 10 ? 13 : t.text.charCodeAt(i);
        }
        return;
      }
      case 20: return;
    }
    throw new Error(`unknown opcode ${["0OP", "1OP", "2OP", "VAR"][kind]}:${num} at ${(this.pc).toString(16)}`);
  }
}
