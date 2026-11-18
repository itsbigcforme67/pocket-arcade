// Pocket Arcade device bus. GPL-3.0-or-later (see ../LICENSE).
//
// Emulated devices expose *ports*; the bus wires ports together. A wire between two ports of the
// same kind carries what the hardware would: a link cable carries serial bits clocked by one side,
// an IR beam carries LED on/off edges. See docs/DEVICE_LINKS.md for the design and the roadmap
// (other tabs, other phones, real hardware).
//
// Game Boys come from the SameBoy link core (sameboy-link.wasm). All of them live in one
// WebAssembly module and run in lockstep, so a wire can hand a bit across within the same
// emulated instruction, which is what the Game Boy's 8 kHz serial port and the GBC's IR port need.
//
// Other devices (a Pocket Pikachu Color, a Pokémon mini, a Digimon pet...) can share an IR beam
// with them through the optical port interface below (OpticalPort, Timeline). Times on that
// interface are emulated microseconds.

export const KEYS = { right: 0, left: 1, up: 2, down: 3, a: 4, b: 5, select: 6, start: 7 };
const HZ = 8388608;               // SameBoy's clock unit: 8 MHz ticks (2 per CPU cycle at normal speed)
const TICKS_PER_US = HZ / 1e6;

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
        ir: (i, on) => dev(i).ports.ir._emit(!!on),
      },
      // SameBoy's core links a few libc calls it never makes here (files). The clock reads 0:
      // the cartridge clock follows emulated time instead, so every copy of a game runs the same.
      wasi_snapshot_preview1: {
        clock_time_get: (id, prec, out) => { new DataView(this.mem.buffer).setBigUint64(out, 0n, true); return 0; },
        fd_close: noop, fd_fdstat_get: noop, fd_seek: noop,
        // Messages to stderr (a failed assert) go to onLog; say every byte was written, or libc retries forever.
        fd_write: (fd, iov, n, written) => {
          const v = new DataView(this.mem.buffer); let total = 0, text = '';
          for (let k = 0; k < n; k++) {
            const p = v.getUint32(iov + k * 8, true), len = v.getUint32(iov + k * 8 + 4, true);
            text += new TextDecoder().decode(new Uint8Array(this.mem.buffer, p, len)); total += len;
          }
          if (text) this.onLog(-1, text);
          v.setUint32(written, total, true); return 0;
        },
        proc_exit: (code) => { throw new Error('SameBoy core stopped (' + code + ')'); },
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

  get mask() { return (1 << this.devices.length) - 1; }

  // Run every Game Boy for one frame, interleaved instruction by instruction.
  runFrame() {
    return this.x.pa_run_lockstep(this.mask, HZ / 59.7275 * 1.1);
  }

  // Run every Game Boy, interleaved, until each reaches emulated time `us`. Returns a bit mask of
  // those that finished a frame on the way. This makes the whole host one device on a Timeline.
  now() { return Math.min(...this.devices.map((d) => d.now())); }
  runUntil(us) { return this.x.pa_run_until(this.mask, us * TICKS_PER_US); }

  // Every Game Boy's state, as one object that structuredClone, postMessage and BroadcastChannel
  // can carry. `states` are SameBoy save states; `clocks` keep linked Game Boys lined up.
  saveState() {
    return { clocks: this.devices.map((d) => this.x.pa_clock(d.index)), states: this.devices.map((d) => d.saveState()) };
  }
  loadState(s) {
    this.devices.forEach((d, i) => { d.loadState(s.states[i]); this.x.pa_set_clock(i, s.clocks[i]); });
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

  _copyIn(bytes, fn) {
    const p = this.x.pa_alloc(bytes.length);
    new Uint8Array(this.host.mem.buffer, p, bytes.length).set(bytes);
    const r = fn(p, bytes.length);
    this.x.pa_free(p);
    return r;
  }

  // Start over as a Game Boy (color false) or Game Boy Color (true), with nothing loaded.
  reset(color = this.color) { this.color = color; this.x.pa_create(this.index, color ? 1 : 0); }

  loadRom(bytes) { this._copyIn(bytes, (p, n) => this.x.pa_load_rom(this.index, p, n)); }   // SameBoy copies it

  // 160x144 RGBA pixels (a view into the module's memory: copy it before the next frame).
  screen() { return new Uint8ClampedArray(this.host.mem.buffer, this._screenPtr, 160 * 144 * 4); }

  key(name, down) { this.x.pa_key(this.index, KEYS[name], down ? 1 : 0); }
  // All eight keys at once: bit KEYS[name] set = held.
  keys(mask) { this.x.pa_keys(this.index, mask); }

  // Emulated time in seconds, and in microseconds.
  get time() { return this.x.pa_clock(this.index) / HZ; }
  now() { return this.x.pa_clock(this.index) / TICKS_PER_US; }
  // Run this Game Boy alone until emulated time `us` (its cable partner, if any, is not run).
  runUntil(us) { return this.x.pa_run_until(1 << this.index, us * TICKS_PER_US); }

  // Sound. When on, each run leaves 48 kHz stereo samples behind; takeAudio() returns them
  // (an Int16Array, left and right interleaved) and empties the buffer.
  set audio(on) { this.x.pa_audio_on(this.index, on ? 1 : 0); this._audio = !!on; }
  get audio() { return !!this._audio; }
  takeAudio() {
    const n = this.x.pa_audio_count(this.index);
    const out = new Int16Array(this.host.mem.buffer, this.x.pa_audio_buffer(this.index), n * 2).slice();
    this.x.pa_audio_take(this.index);
    return out;
  }

  saveRam() {
    const n = this.x.pa_save_size(this.index);
    if (n <= 0) return null;
    const p = this.x.pa_alloc(n);
    this.x.pa_save(this.index, p, n);
    const out = new Uint8Array(this.host.mem.buffer, p, n).slice();
    this.x.pa_free(p);
    return out;
  }
  loadSaveRam(bytes) { this._copyIn(bytes, (p, n) => this.x.pa_load_save(this.index, p, n)); }

  // A SameBoy save state (includes the battery RAM). Load it into a Game Boy running the same game.
  saveState() {
    const n = this.x.pa_state_size(this.index);
    const p = this.x.pa_alloc(n);
    this.x.pa_state_save(this.index, p);
    const out = new Uint8Array(this.host.mem.buffer, p, n).slice();
    this.x.pa_free(p);
    return out;
  }
  loadState(bytes) {
    const err = this._copyIn(bytes, (p, n) => this.x.pa_state_load(this.index, p, n));
    if (err) throw new Error('not a save state for this game (' + err + ')');
  }

  // A byte as the CPU would read it (tests and tools).
  peek(addr) { return this.x.pa_peek(this.index, addr); }
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

// ---------------------------------------------------------------------------------------------
// Optical (IR) ports.
//
// The interface any device implements to share an IR beam, whether it runs in this module, in
// another WebAssembly module (a Pocket Pikachu Color core from its own repository), or in plain JS:
//
//   port.light(on, us)   Light reaching the sensor starts (on = true) or stops, at emulated time
//                        `us` (microseconds, the receiving device's clock, which the Timeline keeps
//                        equal for every device). A time the device has already passed applies at
//                        once; a time ahead of it applies when the device gets there. `us` left
//                        out means now.
//   port.peers           Ports that see this one's LED. When the LED changes, the port calls
//                        peer.light(on, us) on each, with us = the emulated time of the change.
//   port.onLed           Optional listener, onLed(on, us), for logging or a bridge to hardware.
//
// OpticalPort below implements the sending half; a device's port extends it and adds light().
// Each device also needs now() and runUntil(us) (see Timeline).
export class OpticalPort {
  constructor() { this.peers = []; this.onLed = null; this.led = false; }
  // Call this from the device whenever its LED changes.
  emit(on, us) {
    if (on === this.led) return;
    this.led = on;
    for (const p of this.peers) p.light(on, us);
    if (this.onLed) this.onLed(on, us);
  }
  light(on, us) { throw new Error('light() not implemented'); }
}

// The Game Boy Color IR port.
export class IrPort extends OpticalPort {
  constructor(gb) { super(); this.gb = gb; }
  _emit(on) { this.emit(on, this.gb.now()); }
  light(on, us) {
    const x = this.gb.x, i = this.gb.index;
    if (us === undefined) x.pa_ir_input(i, on ? 1 : 0);
    else x.pa_ir_at(i, us * TICKS_PER_US, on ? 1 : 0);
  }
}

// Runs several devices side by side in emulated time, in slices of `quantumUs` microseconds,
// the device that is furthest behind first. A device is anything with now() and runUntil(us):
// a GameBoyHost (all its Game Boys at once, still in lockstep with each other), a GameBoy, or a
// device from elsewhere. An IR edge reaches a device that is behind the sender at its exact
// time; one that is ahead sees it up to one quantum late. Mystery Gift-style IR (61 us pulses,
// cells of 183 us) needs a quantum well under 30 us; the default is 8.
export class Timeline {
  constructor({ quantumUs = 8 } = {}) { this.quantum = quantumUs; this.devices = []; this.t = 0; }
  add(device) { this.devices.push(device); this.t = Math.max(this.t, device.now()); return device; }
  // Advance every device by `us` microseconds. Calls onSlice(results) after each slice, where
  // results[k] is what devices[k].runUntil returned (a Game Boy host returns frames drawn).
  run(us, onSlice) {
    const end = this.t + us;
    while (this.t < end) {
      const t = Math.min(end, this.t + this.quantum);
      const order = this.devices.map((d, k) => [d.now(), k]).sort((a, b) => a[0] - b[0]);
      const results = [];
      for (const [, k] of order) results[k] = this.devices[k].runUntil(t);
      this.t = t;
      if (onSlice) onSlice(results);
    }
  }
}

// An optical device written in plain JS: plays a list of LED edges and records what its sensor
// sees. It is the smallest example of the interface above, and the tests use it in place of a
// real device. script: [{ us, on }] in emulated microseconds, in order.
export class IrScriptDevice {
  constructor(script = []) {
    this.script = script.slice();
    this.seen = [];            // [{ on, us }] light reaching this device
    this.t = 0;
    const dev = this;
    this.ports = { ir: new (class extends OpticalPort { light(on, us) { dev.seen.push({ on, us: us ?? dev.t }); } })() };
  }
  now() { return this.t; }
  runUntil(us) {
    while (this.script.length && this.script[0].us <= us) {
      const e = this.script.shift();
      this.t = Math.max(this.t, e.us);
      this.ports.ir.emit(e.on, e.us);
    }
    this.t = Math.max(this.t, us);
  }
}

// Wires. Each returns a function that undoes it.
export function linkCable(a, b) {
  a.ports.serial.attach(b.ports.serial);
  b.ports.serial.attach(a.ports.serial);
  return () => { a.ports.serial.attach(null); b.ports.serial.attach(null); };
}

// An IR beam between two devices (or two optical ports): each sees the other's LED.
export function irBeam(a, b) {
  const pa = a.ports ? a.ports.ir : a, pb = b.ports ? b.ports.ir : b;
  pa.peers.push(pb);
  pb.peers.push(pa);
  if (pa.led) pb.light(true);
  if (pb.led) pa.light(true);
  return () => {
    pa.peers = pa.peers.filter((p) => p !== pb);
    pb.peers = pb.peers.filter((p) => p !== pa);
    pa.light(false); pb.light(false);
  };
}
