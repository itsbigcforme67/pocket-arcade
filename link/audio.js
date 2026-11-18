// Pocket Arcade link page: sound out. GPL-3.0-or-later (see ../LICENSE).
//   const sp = new Speaker(); await sp.start();   // from a click or tap (browsers require one)
//   sp.play([gb1.takeAudio(), gb2.takeAudio()]);  // Int16Array stereo buffers, mixed
export class Speaker {
  async start() {
    if (this.ctx) { if (this.ctx.state !== 'running') await this.ctx.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC({ sampleRate: 48000, latencyHint: 'interactive' }); } catch { this.ctx = new AC(); }
    await this.ctx.audioWorklet.addModule(new URL('audio-worklet.js', import.meta.url));
    this.node = new AudioWorkletNode(this.ctx, 'link-speaker', { outputChannelCount: [2] });
    this.node.connect(this.ctx.destination);
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }
  play(buffers) {
    if (!this.node) return;
    const live = buffers.filter((b) => b && b.length);
    if (!live.length) return;
    const n = Math.min(...live.map((b) => b.length)), out = new Float32Array(n), k = 1 / 32768 / live.length;
    for (const b of live) for (let i = 0; i < n; i++) out[i] += b[i] * k;
    this.node.port.postMessage(out, [out.buffer]);
  }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }
}
