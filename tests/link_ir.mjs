#!/usr/bin/env node
// IR port tests for the device bus (link/bus.js), in Node, no browser. GPL-3.0-or-later.
//
//     node tests/link_ir.mjs
//
// Uses tests/probes/irtest.gbc (made by tests/make_irtest.py): it counts the light reaching its
// sensor at $C000 and sends bursts of 8 pulses while A is held. Checks:
//   1. two Game Boy Colors on one IR beam: every pulse one sends, the other counts;
//   2. a Game Boy Color and a JS device on a Timeline: the device sees the pulses with the right
//      widths in microseconds, and the Game Boy counts the pulses the device sends;
//   3. a save state taken mid-game and loaded into a fresh host gives the same screen later.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameBoyHost, Timeline, IrScriptDevice, irBeam } from '../link/bus.js';

const SITE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const wasm = fs.readFileSync(path.join(SITE, 'link/sameboy-link.wasm'));
const rom = fs.readFileSync(path.join(SITE, 'tests/probes/irtest.gbc'));
let failures = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failures++; };

// 1. Two GBCs.
{
  const host = await GameBoyHost.load(wasm);
  const [a, b] = [host.add({ color: true }), host.add({ color: true })];
  for (const gb of [a, b]) gb.loadRom(rom);
  irBeam(a, b);
  for (let f = 0; f < 30; f++) host.runFrame();
  a.key('a', true);
  for (let f = 0; f < 3; f++) host.runFrame();
  a.key('a', false);
  for (let f = 0; f < 10; f++) host.runFrame();
  const bursts = a.peek(0xC001), seen = b.peek(0xC000);
  check(bursts > 0, `Game Boy 1 sent bursts while A was held (${bursts})`);
  check(seen === (bursts * 8) % 256, `Game Boy 2 counted every pulse (${seen} for ${bursts} bursts of 8)`);
  check(b.peek(0xC001) === 0 && a.peek(0xC000) === 0, 'nothing went the other way');
}

// 2. A GBC and a JS device on a Timeline, 8 us slices.
{
  const host = await GameBoyHost.load(wasm);
  const gb = host.add({ color: true });
  gb.loadRom(rom);
  const t0 = 300000, script = [];
  for (let k = 0; k < 5; k++) script.push({ us: t0 + k * 300, on: true }, { us: t0 + k * 300 + 100, on: false });
  const dev = new IrScriptDevice(script);
  const tl = new Timeline({ quantumUs: 8 });
  tl.add(host); tl.add(dev);
  irBeam(gb, dev);
  tl.run(200000);
  check(dev.seen.length === 0, 'the device sees nothing before A is pressed');
  gb.key('a', true);
  tl.run(10000);
  gb.key('a', false);
  tl.run(400000);
  const e = dev.seen, on = [], off = [];
  for (let k = 1; k < e.length; k++) (e[k - 1].on ? on : off).push(e[k].us - e[k - 1].us);
  const mcycle = 1e6 / 1048576;
  const wantOn = 262 * mcycle, wantOff = 522 * mcycle;
  const near = (xs, v) => xs.length > 0 && xs.every((x) => Math.abs(x - v) < 3);
  check(e.length >= 16 && e.length % 16 === 0, `the device saw whole bursts (${e.length} edges)`);
  check(near(on, wantOn), `LED on for ${wantOn.toFixed(1)} us each time (saw ${[...new Set(on.map((x) => x.toFixed(1)))].join(', ')})`);
  check(near(off.filter((x) => x < wantOff + 10), wantOff), `and off for ${wantOff.toFixed(1)} us between the pulses of a burst (saw ${[...new Set(off.filter((x) => x < wantOff + 10).map((x) => x.toFixed(1)))].join(', ')})`);
  check(gb.peek(0xC000) === 5, `the Game Boy counted the device's 5 pulses (${gb.peek(0xC000)})`);
}

// 3. Save states.
{
  const tw = fs.readFileSync(path.join(SITE, 'free/gb/tricky-wicks.gb'));
  const h1 = await GameBoyHost.load(wasm);
  const g1 = h1.add(); g1.loadRom(tw);
  for (let f = 0; f < 200; f++) h1.runFrame();
  const state = h1.saveState();
  const h2 = await GameBoyHost.load(wasm);
  const g2 = h2.add(); g2.loadRom(tw);
  h2.loadState(state);
  for (const gb of [g1, g2]) gb.key('start', true);
  for (let f = 0; f < 120; f++) { h1.runFrame(); h2.runFrame(); }
  const same = Buffer.compare(Buffer.from(g1.screen()), Buffer.from(g2.screen())) === 0;
  check(state.states[0].length > 1000, `a save state (${state.states[0].length} bytes)`);
  check(same && g1.time === g2.time, 'a host loaded from it runs on identically');
}

console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
