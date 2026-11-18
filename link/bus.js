// Pocket Arcade device bus. GPL-3.0-or-later (see ../LICENSE).
//
// Emulated devices expose *ports*; the bus wires ports together. A wire between two ports of the
// same kind carries what the hardware would: a link cable carries serial bits clocked by one side,
// an IR link carries LED on/off edges. See docs/DEVICE_LINKS.md for the design and the roadmap
// (other tabs, other phones, real hardware).
//
// This first version holds Game Boys from the SameBoy link core (sameboy-link.wasm). All of them
// live in one WebAssembly module and run in lockstep, so a wire can hand a bit across within the
// same emulated instruction, which is what the Game Boy's 8 kHz serial port and the GBC's IR port
// need.

const KEYS = { right: 0, left: 1, up: 2, down: 3, a: 4, b: 5, select: 6, start: 7 };

export class GameBoyHost {
  // wasm: bytes or a URL of sameboy-link.wasm
  static async load(wasm) {
    const bytes = typeof wasm === 'string' || wasm instanceof URL
      ? await (await fetch(wasm)).arrayBuffer() : wasm;
    const host = new GameBoyHost();
    const { instance } = await WebAssembly.instantiate(bytes, host._imports());
    host._init(instance);
    return host;
  }

  constructor() {
    this.devices = [];       // index -> GameBoy
    this.onLog = (i, text) => {};
  }

  _imports() {
    const str = (p) => { const m = new Uint8Array(this.mem.buffer); let e = p; while (m[e]) e++; return new TextDecoder().decode(m.subarray(p, e)); };
    const dev = (i) => this.devices[i];
    const noop = () => 0;
    return {
      bus: {
        log: (i, p) => this.onLog(i, str(p)),
        serial_start: (i, bit) => dev(i).ports.serial._clockOut(bit),
        serial_end: (i) => dev(i).ports.serial._clockIn(),
        ir: (i, on) => dev(i).ports.ir._emit(on),
      },
      // SameBoy's core links a few libc calls it never makes here (files, the clock).
      wasi_snapshot_preview1: {
        clock_time_get: noop, fd_close: noop, fd_fdstat_get: noop, fd_seek: noop,
        fd_write: (fd, iov, n, written) => { new DataView(this.mem.buffer).setUint32(written, 0, true); return 0; },
      },
    };
  }

  _init(instance) {
    this.x = instance.exports;
    this.mem = this.x.memory;
    this.x._initialize();
  }

  // A new Game Boy. color: run as a Game Boy Color (needed for IR).
  add({ color = false } = {}) {
    const i = this.devices.length;
    if (i >= 4) throw new Error('at most four Game Boys');
    const gb = new GameBoy(this, i, color);
    this.devices.push(gb);
    return gb;
  }

  // Run every Game Boy for one frame, interleaved instruction by instruction.
  runFrame() {
    const mask = (1 << this.devices.length) - 1;
    return this.x.pa_run_lockstep(mask, 8388608 / 59.7275 * 1.1);
  }
}

export class GameBoy {
  constructor(host, index, color) {
    this.host = host;
    this.index = index;
    this.color = color;
    this._screenPtr = host.x.pa_create(index, color ? 1 : 0);
    this.ports = { serial: new SerialPort(this), ir: new IrPort(this) };
  }
  get x() { return this.host.x; }

  loadRom(bytes) {
    const p = this.x.pa_alloc(bytes.length);
    new Uint8Array(this.host.mem.buffer, p, bytes.length).set(bytes);
    this.x.pa_load_rom(this.index, p, bytes.length);   // SameBoy copies it
    this.x.pa_free(p);
  }

  // 160x144 RGBA pixels (a view into the module's memory: copy it before the next frame).
  screen() { return new Uint8ClampedArray(this.host.mem.buffer, this._screenPtr, 160 * 144 * 4); }

  key(name, down) { this.x.pa_key(this.index, KEYS[name], down ? 1 : 0); }

  // Emulated time in seconds.
  get time() { return this.x.pa_clock(this.index) / 8388608; }

  saveRam() {
    const n = this.x.pa_save_size(this.index);
    if (n <= 0) return null;
    const p = this.x.pa_alloc(n);
    this.x.pa_save(this.index, p, n);
    const out = new Uint8Array(this.host.mem.buffer, p, n).slice();
    this.x.pa_free(p);
    return out;
  }

  loadSaveRam(bytes) {
    const p = this.x.pa_alloc(bytes.length);
    new Uint8Array(this.host.mem.buffer, p, bytes.length).set(bytes);
    this.x.pa_load_save(this.index, p, bytes.length);
    this.x.pa_free(p);
  }
}

// The link port. The side whose serial clock is internal drives the transfer: for each bit it
// shifts out (_clockOut) the bus asks the far side for its bit and hands it ours (_clockIn).
// An empty port reads 1s, as a real Game Boy with nothing plugged in reads $FF.
export class SerialPort {
  constructor(gb) { this.gb = gb; this.peer = null; this._out = 1; this.onByte = null; this._bits = 0; this._n = 0; }

  // What the far end of a cable must offer: exchange(bit) -> bit, called on each clock edge
  // driven by this side. A local Game Boy answers at once; see docs for remote ends.
  _clockOut(bit) { this._out = bit; }
  _clockIn() {
    const out = this._out;
    const got = this.peer ? this.peer.exchange(out) : 1;
    this._trace(out);
    return got;
  }
  // Called by the far side's clock: give our bit, take theirs (only meaningful on external clock).
  exchange(bit) {
    const x = this.gb.x, i = this.gb.index;
    const mine = x.pa_serial_get_bit(i);
    x.pa_serial_set_bit(i, bit);
    this._trace(mine);
    return mine;
  }
  _trace(bit) {
    if (!this.onByte) return;
    this._bits = (this._bits << 1 | bit) & 0xFF;
    if (++this._n === 8) { this._n = 0; this.onByte(this._bits); }
  }
  attach(peer) { this.peer = peer; this.gb.x.pa_link(this.gb.index, peer ? 1 : 0); }
}

// The Game Boy Color IR port: an LED out and a sensor in. Every edge goes to the peers at once
// (the Game Boys run in lockstep), and to onEdge(on, seconds) for logging or a remote bridge.
export class IrPort {
  constructor(gb) { this.gb = gb; this.peers = []; this.onEdge = null; }
  _emit(on) {
    for (const p of this.peers) p.light(on);
    if (this.onEdge) this.onEdge(on, this.gb.time);
  }
  // Light from outside reaching the sensor.
  light(on) { this.gb.x.pa_ir_input(this.gb.index, on ? 1 : 0); }
}

// Wires. Each returns a function that undoes it.
export function linkCable(a, b) {
  a.ports.serial.attach(b.ports.serial);
  b.ports.serial.attach(a.ports.serial);
  return () => { a.ports.serial.attach(null); b.ports.serial.attach(null); };
}

export function irBeam(a, b) {
  a.ports.ir.peers.push(b.ports.ir);
  b.ports.ir.peers.push(a.ports.ir);
  return () => {
    a.ports.ir.peers = a.ports.ir.peers.filter((p) => p !== b.ports.ir);
    b.ports.ir.peers = b.ports.ir.peers.filter((p) => p !== a.ports.ir);
    a.ports.ir.light(false); b.ports.ir.light(false);
  };
}
