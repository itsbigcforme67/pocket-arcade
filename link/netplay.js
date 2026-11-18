// Pocket Arcade link netplay. GPL-3.0-or-later (see ../LICENSE).
//
// Two players on two screens (two tabs, or two phones) play a link-cable game. Each side runs
// BOTH Game Boys in one SameBoy module, joined by the cable exactly as on one page; only the
// buttons cross the network. The core is deterministic, so the two copies stay identical as long
// as they apply the same buttons on the same frame. That is input netplay with a fixed delay:
// what you press now reaches both copies `delay` frames later. See docs/DEVICE_LINKS.md, 2.4.
//
// A transport is anything with send(msg), onmessage = (msg) => {}, onclose = () => {}, close().
// Messages are plain objects that may hold Uint8Arrays. Two transports are here:
//   tabTransport()   BroadcastChannel between two tabs of one browser
//   RtcLink          a WebRTC data channel between two devices, set up by copying (or scanning) a
//                    short code each way; no server, and no third-party STUN unless asked for

const VERSION = 1;

// ---- The session ----------------------------------------------------------------------------

export class Netplay {
  // host: a GameBoyHost holding two Game Boys with the same game loaded.
  // me: 0 = this side plays Game Boy 1 and sends the starting state; 1 = Game Boy 2.
  constructor({ host, transport, me, delay = 4, romHash, title = '' }) {
    Object.assign(this, { host, transport, me, delay, romHash, title });
    this.frame = 0;                 // next frame to run
    this.inputs = [new Map(), new Map()];   // player -> frame -> word (bits 0-7 keys, bit 8 cable)
    this.local = 0;                 // this side's keys now
    this.cable = true;              // Game Boy 1's player decides
    this.started = false;
    this.onStatus = () => {};       // (text, state) state: 'wait' | 'play' | 'error' | 'closed'
    this.onStart = () => {};
    this.onFrame = () => {};        // after each frame has run
    this.onCable = () => {};
    this.sums = new Map();
    this.desync = false;
    this.rtt = 0;
    transport.onmessage = (m) => this._message(m);
    transport.onclose = () => { this.started = false; this.onStatus('The other player left.', 'closed'); };
  }

  begin() {
    this._hello(false);
    this.onStatus('Waiting for the other player…', 'wait');
    this._ping = setInterval(() => this.transport.send({ t: 'ping', at: performance.now() }), 2000);
  }

  close() {
    clearInterval(this._ping);
    try { this.transport.send({ t: 'bye' }); } catch {}
    this.transport.close();
    this.started = false;
  }

  _hello(reply) { this.transport.send({ t: 'hello', v: VERSION, me: this.me, rom: this.romHash, title: this.title, reply }); }

  _message(m) {
    // Messages from before the last (re)start belong to the old game: drop them.
    if ((m.t === 'in' || m.t === 'sum') && m.e !== this.epoch) return;
    switch (m.t) {
      case 'hello':
        if (m.v !== VERSION) return this._fail('The other page is a different version. Reload both.');
        if (m.me === this.me) return this._fail('Both sides want the same Game Boy.');
        if (m.rom !== this.romHash) return this._fail(`The other player opened a different game (${m.title || 'unknown'}). Open the same file on both.`);
        if (!m.reply) this._hello(true);         // they may have missed ours
        if (this.me === 0 && !this.started) this._sendStart();
        break;
      case 'start':
        this.epoch = m.e;
        this.host.loadState(m.state);
        this.delay = m.delay;
        this._begin(m.cable);
        break;
      case 'in':
        for (let k = 0; k < m.k.length; k++) this.inputs[1 - this.me].set(m.f + k, m.k[k]);
        break;
      case 'sum': {
        const mine = this.sums.get(m.f);
        if (mine !== undefined && mine !== m.h) this._desync();
        else this.sums.set(-m.f - 1, m.h);
        break;
      }
      case 'resync':
        if (this.me === 0) this._sendStart();
        break;
      case 'ping': this.transport.send({ t: 'pong', at: m.at }); break;
      case 'pong': this.rtt = performance.now() - m.at; break;
      case 'bye': this.transport.onclose(); break;
    }
  }

  _fail(text) { this.started = false; this.onStatus(text, 'error'); }

  _sendStart() {
    // Game Boy 1's side sends the state both start from: same game, same battery saves.
    this.epoch = (this.epoch || 0) + 1;
    this.transport.send({ t: 'start', e: this.epoch, state: this.host.saveState(), delay: this.delay, cable: this.cable });
    this._begin(this.cable);
  }

  _begin(cable) {
    this.frame = 0;
    this.inputs = [new Map(), new Map()];
    this.sums.clear();
    this.desync = false;
    for (let f = 0; f < this.delay; f++) for (const p of [0, 1]) this.inputs[p].set(f, cable ? 256 : 0);
    this.cable = cable;
    this.started = true;
    this.onStatus('Linked', 'play');
    this.onStart();
  }

  _desync() {
    if (this.desync) return;
    this.desync = true;
    this.onStatus('Out of step: starting both again from Game Boy 1’s state…', 'wait');
    this.started = false;
    if (this.me === 0) this._sendStart(); else this.transport.send({ t: 'resync' });
  }

  // Run up to `max` frames, as far as both players' buttons are known. Returns frames run.
  run(max) {
    let ran = 0;
    while (this.started && ran < max) {
      const f = this.frame, other = this.inputs[1 - this.me].get(f);
      if (other === undefined) break;
      // Schedule this side's buttons `delay` frames ahead and send them.
      const word = this.local | (this.me === 0 && this.cable ? 256 : 0);
      this.inputs[this.me].set(f + this.delay, word);
      this.transport.send({ t: 'in', e: this.epoch, f: f + this.delay, k: [word] });
      const words = [this.inputs[0].get(f), this.inputs[1].get(f)];
      this.inputs[0].delete(f); this.inputs[1].delete(f);
      const cable = !!(words[0] & 256);
      if (cable !== this._cableNow) { this._cableNow = cable; this.onCable(cable); }
      this.host.devices[0].keys(words[0] & 255);
      this.host.devices[1].keys(words[1] & 255);
      this.host.runFrame();
      this.frame++;
      ran++;
      if (this.frame % 120 === 0) this._checksum();
      this.onFrame();
    }
    return ran;
  }

  // How far the other side's buttons reach ahead of this one: more than `delay` means this side
  // is behind and should run an extra frame now and then.
  get lead() {
    let f = this.frame; const m = this.inputs[1 - this.me];
    while (m.has(f)) f++;
    return f - this.frame;
  }

  _checksum() {
    let h = 0x811C9DC5;
    for (const d of this.host.devices) {
      const s = d.screen();
      for (let i = 0; i < s.length; i += 12) h = Math.imul(h ^ s[i], 0x01000193);
      h = Math.imul(h ^ (d.time * 1e6 | 0), 0x01000193);
    }
    const theirs = this.sums.get(-this.frame - 1);
    this.sums.set(this.frame, h);
    this.transport.send({ t: 'sum', e: this.epoch, f: this.frame, h });
    if (theirs !== undefined && theirs !== h) this._desync();
    for (const k of this.sums.keys()) if (Math.abs(k) < this.frame - 600) this.sums.delete(k);
  }
}

export async function sha256(bytes) {
  if (globalThis.crypto && crypto.subtle) {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0x811C9DC5;                // not a secure context (plain http on a LAN): a plain hash
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193);
  return 'fnv' + (h >>> 0).toString(16) + '-' + bytes.length;
}

// ---- Two tabs: BroadcastChannel -------------------------------------------------------------
//
// Both tabs call tabTransport(); they find each other and the one with the smaller random id
// plays Game Boy 1. Resolves to { transport, me }. A third tab is ignored.

export function tabTransport(name = 'pocket-arcade-link') {
  return new Promise((resolve) => {
    const ch = new BroadcastChannel(name);
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    let peer = null;
    const t = {
      send: (m) => ch.postMessage({ from: id, to: peer, m }),
      onmessage: () => {}, onclose: () => {},
      close: () => { try { ch.postMessage({ from: id, to: peer, m: { t: 'bye' } }); } catch {} ch.close(); },
    };
    const pair = (other) => { peer = other; resolve({ transport: t, me: id < other ? 0 : 1 }); };
    ch.onmessage = ({ data }) => {
      if (!data || data.from === id) return;
      if (peer) { if (data.from === peer && data.to === id && data.m) t.onmessage(data.m); return; }
      if (data.knock) {
        if (data.to === id) { ch.postMessage({ knock: true, from: id, to: data.from }); pair(data.from); }
        else if (!data.to) ch.postMessage({ knock: true, from: id, to: data.from });
      }
    };
    ch.postMessage({ knock: true, from: id });
  });
}

// ---- Two devices: WebRTC with hand-carried codes --------------------------------------------
//
// Game Boy 1's player makes an offer code and shows it (text, link and QR code); Game Boy 2's
// player enters it and gets an answer code back to show; Game Boy 1's player enters that. Codes
// are a few hundred characters: the session description cut down to what the two browsers need
// (ICE user name and password, the DTLS fingerprint, the candidate addresses).
//
// No STUN server by default: that works when both devices are on the same network (Wi-Fi or one
// phone's hotspot). `stun` is opt-in, e.g. 'stun:stun.l.google.com:19302', which asks that
// server for this device's public address, so it also works across most home routers. No TURN.

export class RtcLink {
  constructor({ stun = null } = {}) {
    this.pc = new RTCPeerConnection({ iceServers: stun ? [{ urls: stun }] : [] });
    this.transport = null;
    this.onopen = () => {};
    this.onclose = () => {};
  }

  async offer() {
    this._channel(this.pc.createDataChannel('link', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this._gathered();
    return encodeSdp(this.pc.localDescription.sdp, 'o');
  }

  async answer(offerCode) {
    const { type, sdp } = decodeSdp(offerCode);
    if (type !== 'offer') throw new Error('That is an answer code; this side needs an offer code.');
    this.pc.ondatachannel = (e) => this._channel(e.channel);
    await this.pc.setRemoteDescription({ type, sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this._gathered();
    return encodeSdp(this.pc.localDescription.sdp, 'a');
  }

  async accept(answerCode) {
    const { type, sdp } = decodeSdp(answerCode);
    if (type !== 'answer') throw new Error('That is an offer code; this side needs the answer code.');
    await this.pc.setRemoteDescription({ type, sdp });
  }

  close() { try { this.pc.close(); } catch {} }

  _gathered() {
    return new Promise((done) => {
      if (this.pc.iceGatheringState === 'complete') return done();
      const t = setTimeout(done, 4000);
      this.pc.addEventListener('icegatheringstatechange', () => { if (this.pc.iceGatheringState === 'complete') { clearTimeout(t); done(); } });
    });
  }

  _channel(ch) {
    ch.binaryType = 'arraybuffer';
    const parts = new Map();
    const t = {
      send: (m) => {
        if (ch.readyState !== 'open') return;
        const s = pack(m);
        if (s.length <= 16000) ch.send(s);
        else {
          const id = Math.random().toString(36).slice(2, 8), n = Math.ceil(s.length / 16000);
          for (let i = 0; i < n; i++) ch.send(JSON.stringify({ $part: id, i, n, s: s.slice(i * 16000, (i + 1) * 16000) }));
        }
      },
      onmessage: () => {}, onclose: () => {},
      close: () => { try { ch.close(); } catch {} this.close(); },
    };
    ch.onmessage = (e) => {
      let m = JSON.parse(e.data);
      if (m.$part) {
        const p = parts.get(m.$part) || []; p[m.i] = m.s; parts.set(m.$part, p);
        if (p.filter((x) => x !== undefined).length < m.n) return;
        parts.delete(m.$part);
        m = JSON.parse(p.join(''));
      }
      t.onmessage(unpack(m));
    };
    ch.onopen = () => { this.transport = t; this.onopen(t); };
    ch.onclose = () => { t.onclose(); this.onclose(); };
  }
}

// JSON with Uint8Arrays as base64.
function pack(m) {
  return JSON.stringify(m, (k, v) => (v instanceof Uint8Array ? { $b: toB64(v) } : v));
}
function unpack(m) {
  if (m && typeof m === 'object') {
    if (typeof m.$b === 'string' && Object.keys(m).length === 1) return fromB64(m.$b);
    for (const k of Object.keys(m)) m[k] = unpack(m[k]);
  }
  return m;
}
function toB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); }
function fromB64(s) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }

// Session description <-> code. Code: "PA1" ~ o|a ~ ufrag ~ pwd ~ fingerprint (base64url) ~
// candidates joined by ",", each "<h|s|r><address>/<port>"; an mDNS name (uuid.local) is written
// "m" plus its 32 hex digits. Every character is one a URL may carry unescaped.
export function encodeSdp(sdp, kind) {
  const line = (k) => { const m = sdp.match(new RegExp('^a=' + k + ':(.*)$', 'm')); return m ? m[1].trim() : ''; };
  const fp = line('fingerprint').split(' ')[1].split(':').map((h) => parseInt(h, 16));
  const fpb = btoa(String.fromCharCode(...fp)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const cands = [];
  for (const m of sdp.matchAll(/^a=candidate:\S+ (\d) (udp|UDP) \d+ (\S+) (\d+) typ (host|srflx|relay)/gm)) {
    if (m[1] !== '1') continue;
    let addr = m[3];
    const mdns = addr.match(/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i);
    if (mdns) addr = 'm' + mdns.slice(1).join('');
    cands.push(m[5][0] + addr + '/' + m[4]);
  }
  return ['PA1', kind, line('ice-ufrag'), line('ice-pwd'), fpb, cands.join(',')].join('~');
}

export function decodeSdp(code) {
  code = code.trim();
  const at = code.indexOf('PA1~');
  if (at < 0) throw new Error('That does not look like a link code.');
  code = decodeURIComponent(code.slice(at)).replace(/\s+/g, '');
  const [, kind, ufrag, pwd, fpb, cands = ''] = code.split('~');
  if (!pwd || !fpb) throw new Error('That link code is cut short.');
  const fp = Array.from(atob(fpb.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - fpb.length % 4) % 4)),
    (c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(':');
  const lines = [
    'v=0', `o=- ${Date.now()} 2 IN IP4 127.0.0.1`, 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
  ];
  let n = 1;
  for (const c of cands.split(',').filter(Boolean)) {
    const type = { h: 'host', s: 'srflx', r: 'relay' }[c[0]];
    let [addr, port] = c.slice(1).split('/');
    if (addr[0] === 'm' && addr.length === 33) addr = addr.slice(1).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5') + '.local';
    const prio = { host: 2122260223, srflx: 1686052607, relay: 41885439 }[type] - n;
    lines.push(`a=candidate:${n++} 1 udp ${prio} ${addr} ${port} typ ${type}` + (type === 'host' ? '' : ' raddr 0.0.0.0 rport 0') + ' generation 0');
  }
  lines.push(`a=ice-ufrag:${ufrag}`, `a=ice-pwd:${pwd}`, `a=fingerprint:sha-256 ${fp}`,
    `a=setup:${kind === 'o' ? 'actpass' : 'active'}`, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144');
  if (cands) lines.push('a=end-of-candidates');
  return { type: kind === 'o' ? 'offer' : 'answer', sdp: lines.join('\r\n') + '\r\n' };
}
