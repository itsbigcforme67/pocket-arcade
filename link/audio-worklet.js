// Pocket Arcade link page: plays the Game Boys' samples. GPL-3.0-or-later (see ../LICENSE).
// Receives Float32Arrays of interleaved stereo at 48 kHz and plays them at the context's rate.
class LinkSpeaker extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(48000 * 2);       // one second of stereo
    this.r = 0; this.w = 0; this.pos = 0;
    this.step = 48000 / sampleRate;
    this.port.onmessage = (e) => this.push(e.data);
  }
  get size() { return (this.w - this.r + this.buf.length) % this.buf.length; }
  push(d) {
    for (let i = 0; i < d.length; i++) { this.buf[this.w] = d[i]; this.w = (this.w + 1) % this.buf.length; }
    // Keep latency low: more than 150 ms waiting means the page ran ahead; drop to 60 ms.
    if (this.size > 48000 * 2 * 0.15) this.r = (this.w - 48000 * 2 * 0.06 + this.buf.length) % this.buf.length & ~1;
  }
  process(inputs, outputs) {
    const [L, R] = outputs[0];
    for (let i = 0; i < L.length; i++) {
      if (this.size < 4) { L[i] = 0; if (R) R[i] = 0; continue; }
      L[i] = this.buf[this.r]; if (R) R[i] = this.buf[this.r + 1];
      this.pos += this.step;
      while (this.pos >= 1 && this.size >= 2) { this.pos -= 1; this.r = (this.r + 2) % this.buf.length; }
    }
    return true;
  }
}
registerProcessor('link-speaker', LinkSpeaker);
