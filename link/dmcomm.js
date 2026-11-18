// Pocket Arcade: Digimon virtual pet prong link ("classic" protocol). GPL-3.0-or-later (see
// ../LICENSE). A JavaScript rewrite, for the device bus, of what the dmcomm project (BladeSabre,
// MIT, https://github.com/dmcomm/dmcomm-arduino-lib) does on a microcontroller: the timings,
// the text codes ("DigiROMs" such as V1-FC03-FD02) and their results ("s:FC03 r:FD02") follow
// dmcomm so that an emulated pet, a real pet behind a dmcomm dongle, and these scripts all agree.
//
// The wire: one open-drain line plus ground. A pet pulls the line to its active level or lets
// it go idle. Two pets take turns sending 16-bit packets, least significant bit first:
//
//   pre-active (about 60 ms), start idle, start active, then per bit: idle, active.
//   The idle time gives the bit: longer than a threshold = 1 (V, X); Y is inverted.
//
// Three prong types: V (2-prong pets: Digital Monster, Pendulum, D-3...), X (3-prong: Xros
// Loader, iC...), Y (Xros Mini). Times below in microseconds unless the name says ms.

export const SIGNALS = {
  V: { pre_idle: 3000, pre_active_ms: [40, 59, 80], start_idle: [1400, 2083, 2500], start_active: [300, 917, 1400],
       bit_idle_min: 400, bit0_idle: 850, bit_idle_threshold: 1800, bit1_idle: 2667, bit_idle_max: 3400,
       bit_active_min: 800, bit1_active: 1667, bit0_active: 3167, bit_active_max: 4000, cooldown: 400, invert: false, active_high: false },
  X: { pre_idle: 3000, pre_active_ms: [40, 60, 80], start_idle: [1500, 2200, 3500], start_active: [1000, 1600, 2600],
       bit_idle_min: 800, bit0_idle: 1600, bit_idle_threshold: 2600, bit1_idle: 4000, bit_idle_max: 5500,
       bit_active_min: 1000, bit1_active: 1600, bit0_active: 4000, bit_active_max: 5500, cooldown: 400, invert: false, active_high: false },
  Y: { pre_idle: 5000, pre_active_ms: [30, 40, 50], start_idle: [9000, 11000, 13000], start_active: [4000, 6000, 8000],
       bit_idle_min: 800, bit0_idle: 4000, bit_idle_threshold: 3000, bit1_idle: 1400, bit_idle_max: 4500,
       bit_active_min: 1000, bit1_active: 4400, bit0_active: 1600, bit_active_max: 5000, cooldown: 200, invert: true, active_high: true },
};
export const REPLY_TIMEOUT_US = 100000;

// The edges that send one packet: [{ dt, active }], dt = microseconds since the previous edge
// (the first is relative to the start of sending, after the line has been idle).
export function encodePacket(type, bits) {
  const s = SIGNALS[type], out = [];
  out.push({ dt: s.pre_idle, active: true });
  out.push({ dt: s.pre_active_ms[1] * 1000, active: false });
  out.push({ dt: s.start_idle[1], active: true });
  let prev = s.start_active[1];
  for (let i = 0; i < 16; i++, bits >>= 1) {
    const one = bits & 1;
    out.push({ dt: prev, active: false });
    out.push({ dt: one ? s.bit1_idle : s.bit0_idle, active: true });
    prev = one ? s.bit1_active : s.bit0_active;
  }
  out.push({ dt: prev, active: false });
  return { edges: out, tail: s.cooldown };
}

// Turns line edges back into packets. feed(active, us) with every change of the line;
// onPacket(bits) for each packet, onError(text) for a malformed one.
export class PacketDecoder {
  constructor(type) { this.s = SIGNALS[type]; this.reset(); this.onPacket = () => {}; this.onError = () => {}; this.level = false; this.since = 0; }
  reset() { this.state = 'pre'; this.bits = 0; this.i = 0; }
  feed(active, us) {
    if (active === this.level) return;
    const len = us - this.since, was = this.level;
    this.level = active; this.since = us;
    this._segment(was, len);
  }
  _segment(active, len) {
    const s = this.s, inRange = (r) => len >= r[0] && len <= r[2];
    const bad = (what) => { this.onError(`${what} (${Math.round(len)} us)`); this.reset(); };
    switch (this.state) {
      case 'pre':
        if (!active) return;
        if (len >= s.pre_active_ms[0] * 1000 && len <= s.pre_active_ms[2] * 1000) this.state = 'start_idle';
        else if (len > s.bit_active_min) bad('pre-active');
        return;
      case 'start_idle': if (!active && inRange(s.start_idle)) this.state = 'start_active'; else bad('start idle'); return;
      case 'start_active': if (active && inRange(s.start_active)) this.state = 'bit_idle'; else bad('start active'); return;
      case 'bit_idle':
        if (active || len < s.bit_idle_min || len > s.bit_idle_max) return bad('bit ' + this.i + ' idle');
        this.bits = (this.bits >>> 1) | (len > s.bit_idle_threshold ? 0x8000 : 0);
        this.state = 'bit_active';
        return;
      case 'bit_active':
        if (!active || len < s.bit_active_min || len > s.bit_active_max) return bad('bit ' + this.i + ' active');
        if (++this.i < 16) { this.state = 'bit_idle'; return; }
        { const bits = s.invert ? this.bits ^ 0xFFFF : this.bits; this.reset(); this.onPacket(bits); }
        return;
    }
  }
}

// ---- DigiROMs: dmcomm's text codes --------------------------------------------------------
//
//   V1-FC03-FD02   prong type V, turn 1 (send first), then the packets to send
//   turn 0 = only listen, 1 = send first, 2 = listen first (reply to the other pet)
//   In a packet, "^X" takes that hex digit from the last packet received, flipping the bits set
//   in X (so ^0 copies it, ^F inverts it); "@X" makes that digit a check digit, chosen so the
//   sum of all digits sent so far is X modulo 16.

export function parseDigirom(text) {
  const m = text.trim().toUpperCase().match(/^([VXY])([0-2])((?:-[0-9A-F@^]+)*)$/);
  if (!m) throw new Error('not a classic DigiROM: ' + text);
  const packets = m[3].split('-').filter(Boolean).map((p) => {
    let bits = 0, copy = 0, invert = 0, check = -1, checkPos = 12;
    const chars = p.match(/[@^]?[0-9A-F]/g);
    if (!chars || chars.length !== 4 || chars.join('') !== p) throw new Error('bad packet: ' + p);
    chars.forEach((c, i) => {
      const pos = 12 - i * 4, d = parseInt(c[c.length - 1], 16);
      if (c[0] === '@') { check = d; checkPos = pos; }
      else if (c[0] === '^') { copy |= (~d & 0xF) << pos; invert |= d << pos; }
      else bits |= d << pos;
    });
    return { bits, copy, invert, check, checkPos };
  });
  return { type: m[1], turn: +m[2], packets };
}

// Runs a DigiROM as a device on the bus: a pet's half of a battle or exchange, with no pet.
// It is also what a real pet looks like through a dmcomm dongle, and what the tests pair with an
// emulated pet. Device interface: now(), runUntil(us), ports.pins (see PinPort).
export class DigiromDevice {
  constructor(text, { listenUs = 5000000 } = {}) {
    this.rom = parseDigirom(text);
    this.listenUs = listenUs;
    this.t = 0;
    this.result = [];          // ['s:FC03', 'r:FD02', 't', ...] as dmcomm prints them
    this.done = false;
    this.ports = { pins: new PinPort() };
    this.decoder = new PacketDecoder(this.rom.type);
    this.decoder.onPacket = (bits) => this._received(bits);
    this.decoder.onError = (e) => { if (this.waiting) { this.errors.push(e); this.waiting = null; this.done = true; } };
    this.errors = [];
    // The timeout is for a reply to start (as dmcomm's); once the line moves, wait for the packet.
    this.ports.pins.onLine = (active, us) => {
      if (this.waiting && active && us <= this.waiting.until) this.waiting.until = Infinity;
      this.decoder.feed(active, us);
    };
    this.next = 0; this.checksum = 0; this.last = 0; this.outbox = []; this.waiting = null;
    if (this.rom.turn === 1) this._send(0); else this._listen(this.listenUs, 0);
  }
  now() { return this.t; }
  runUntil(us) {
    while (true) {
      const e = this.outbox[0], w = this.waiting;
      const tNext = Math.min(e ? e.us : Infinity, w ? w.until : Infinity);
      if (tNext > us) break;
      this.t = Math.max(this.t, tNext);
      if (e && e.us === tNext) { this.outbox.shift(); if (e.drive !== undefined) this.ports.pins.drive(e.drive, e.us); else e.then(); }
      else { this.waiting = null; this.result.push('t'); this.done = true; }
    }
    this.t = Math.max(this.t, us);
  }
  get text() { return this.result.join(' '); }

  _listen(timeout, from) { this.waiting = { until: from + timeout }; }
  _received(bits) {
    if (!this.waiting || this.done) return;
    const at = this.decoder.since;       // when the packet ended
    this.waiting = null;
    this.last = bits;
    this.result.push('r:' + bits.toString(16).toUpperCase().padStart(4, '0'));
    if (this.rom.turn === 0) this._listen(this.listenUs, at);
    else this._send(at);
  }
  _send(from) {
    const p = this.rom.packets[this.next++];
    if (!p) { this.done = true; return; }
    let bits = (p.bits & ~p.copy) | (p.copy & this.last);
    bits = (bits & ~p.invert) | (p.invert & ~this.last & 0xFFFF);
    if (p.check >= 0) bits &= ~(0xF << p.checkPos);
    for (let i = 0; i < 4; i++) this.checksum += bits >> (4 * i);
    this.checksum %= 16;
    if (p.check >= 0) { bits |= (((p.check - this.checksum) % 16 + 16) % 16) << p.checkPos; this.checksum = p.check; }
    this.result.push('s:' + bits.toString(16).toUpperCase().padStart(4, '0'));
    const { edges, tail } = encodePacket(this.rom.type, bits);
    let t = from;
    for (const e of edges) { t += e.dt; this.outbox.push({ us: t, drive: e.active }); }
    t += tail;
    this.outbox.push({ us: t, then: () => {
      if (this.next >= this.rom.packets.length && this.rom.turn === 2) { this.done = true; return; }
      this._listen(REPLY_TIMEOUT_US, t);
    } });
  }
}

// The pins port: one open-drain line. drive(active, us) when this device pulls the line (or lets
// it go); the bus calls onLine(active, us) when the line as everyone sees it changes. The line is
// active while any device on it drives it active (wired OR).
export class PinPort {
  constructor() { this.wire = null; this.driving = false; this.onLine = null; }
  drive(active, us) { this.driving = active; if (this.wire) this.wire._update(us); }
}

// Join pin ports (two pets' prongs, a pet and a dongle...). Returns a function that undoes it.
export function prongs(...devices) {
  const ports = devices.map((d) => (d.ports ? d.ports.pins : d));
  const wire = { level: false, _update(us) {
    const level = ports.some((p) => p.driving);
    if (level === this.level) return;
    this.level = level;
    for (const p of ports) if (p.onLine) p.onLine(level, us);
  } };
  for (const p of ports) p.wire = wire;
  return () => { for (const p of ports) p.wire = null; };
}
