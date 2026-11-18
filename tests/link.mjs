#!/usr/bin/env node
// Browser test for the link cable page (link/). GPL-3.0-or-later (see ../LICENSE).
//
//     node tests/link.mjs [folder for screenshots]
//
// Needs Node 18+ and Playwright with a Chromium (npm i playwright; npx playwright install chromium).
// It serves this folder itself on a free port. What it checks, in a phone-sized window:
//   1. Tricky Wicks, both Game Boys on 2P LINK, START on one: bytes go over the cable and both
//      leave the LINK screen for the same game (they show the same playfield);
//   2. the same with the cable pulled out: no bytes, and the game answers NO REPLY;
//   3. two players touching their own pads at the same moment each press their own Game Boy;
//   4. sound: Game Boy 1's samples reach the speaker (an AudioWorklet), and they are not silence;
//   5. Save keeps a save state of both Game Boys and Load goes back to it;
//   6. nothing is fetched from another site, and there are no page errors.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');   // CommonJS lookup, so NODE_PATH works too

const SITE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = process.argv[2] || path.join(SITE, 'tests', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.gb': 'application/octet-stream', '.md': 'text/plain' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(SITE, p);
  if (!file.startsWith(SITE) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

let failures = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failures++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [], foreign = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) foreign.push(r.url()); });

// Presses go straight to the emulated Game Boys, timed in emulated frames, so the test does not
// depend on how fast the machine runs the page.
async function frames(n) {
  await page.evaluate((n) => new Promise((done) => {
    const L = window.__link, start = L.host.devices[0].time;
    (function wait() { if (L.host.devices[0].time - start >= n / 59.73) done(); else requestAnimationFrame(wait); })();
  }), n);
}
async function press(gb, key) {
  await page.evaluate(([gb, key]) => window.__link.gbs[gb].key(key, true), [gb, key]);
  await frames(5);
  await page.evaluate(([gb, key]) => window.__link.gbs[gb].key(key, false), [gb, key]);
  await frames(5);
}
const screenHash = (gb) => page.evaluate((gb) => {
  const s = window.__link.gbs[gb].screen(); let h = 0;
  for (let i = 0; i < 160 * 120 * 4; i += 4) h = (h * 31 + s[i]) | 0;   // the playfield, not the panel
  return h;
}, gb);
// Does the left 2/3 of Game Boy gb's screen (the playfield) hold text on the bottom row? (NO REPLY)
const bottomInk = (gb) => page.evaluate((gb) => {
  const s = window.__link.gbs[gb].screen(); let dark = 0;
  for (let y = 116; y < 128; y++) for (let x = 16; x < 100; x++) if (s[(y * 160 + x) * 4] < 100) dark++;
  return dark;
}, gb);

async function round(cable) {
  await page.goto(BASE + 'link/');
  await page.click('#play-free');
  await page.waitForFunction(() => window.__link && window.__link.host.devices[0].time > 0.5);
  if (!cable) await page.click('#cable');
  check((await page.getAttribute('#cable', 'aria-pressed')) === String(cable), `cable button shows ${cable ? 'in' : 'out'}`);
  for (const gb of [0, 1]) { await press(gb, 'down'); await press(gb, 'down'); await press(gb, 'a'); }
  await frames(30);
  await press(0, 'start');
  await frames(120);
  const bytes = await page.evaluate(() => window.__link.bytes);
  await page.screenshot({ path: path.join(SHOTS, `link-${cable ? 'cable' : 'nocable'}.png`) });
  return bytes;
}

const linked = await round(true);
check(linked > 50, `bytes over the cable with it plugged in (${linked})`);
const [h0, h1] = [await screenHash(0), await screenHash(1)];
check(h0 === h1, 'both Game Boys show the same playfield once linked');
check((await bottomInk(0)) === 0, 'no NO REPLY on Game Boy 1');
await press(0, 'left'); await press(0, 'left');
await frames(10);
const moved = await page.evaluate(() => window.__link.bytes);
check(moved > linked, `the cable keeps talking during play (${linked} -> ${moved})`);

// Two fingers at once, one on each player's pad (Chromium touch events through CDP).
{
  const centre = (sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const a1 = await centre('.gb.p0 .ab .a'), s2 = await centre('.gb.p1 .ss b[data-k="start"]');
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a1, id: 1 }, { ...s2, id: 2 }] });
  await frames(2);
  const held = await page.evaluate(() => [...window.__link.local]);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await frames(2);
  const after = await page.evaluate(() => [...window.__link.local]);
  check(held[0] === 16 && held[1] === 128, `two fingers: A on Game Boy 1 and START on Game Boy 2 at once (${held})`);
  check(after[0] === 0 && after[1] === 0, 'and both let go');
}

// Sound: count what reaches the speaker over 60 frames.
await page.evaluate(() => {
  const sp = window.__link.speaker, play = sp.play.bind(sp);
  window.__heard = { n: 0, peak: 0 };
  sp.play = (bufs) => { for (const b of bufs) if (b) { window.__heard.n += b.length; for (const v of b) window.__heard.peak = Math.max(window.__heard.peak, Math.abs(v)); } play(bufs); };
});
await press(0, 'right'); await press(0, 'a'); await press(0, 'left'); await press(0, 'b'); await frames(20);   // the game's sounds
const heard = await page.evaluate(() => ({ ...window.__heard, running: window.__link.speaker.running }));
check(heard.running, 'the speaker started on the Play tap');
check(heard.n > 48000 * 2 * 0.8 && heard.n < 48000 * 2 * 1.3, `about a second of stereo samples in 60 frames of play (${heard.n / 2})`);
check(heard.peak > 500, `and they are not silence (peak ${heard.peak})`);

// Save and load.
await page.click('#save');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pa-link:TRICKY WICKS:state') || localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith(':state')))));
await frames(90);
await page.click('#load');
const after = await page.evaluate(() => window.__link.gbs.map((g) => g.time));
const back = saved && after.every((t, i) => Math.abs(t - saved.clocks[i] / 8388608) < 0.1);
check(!!saved && saved.states.length === 2, 'Save keeps a state of both Game Boys');
check(back, `Load goes back to it (${after.map((t) => t.toFixed(2))} vs ${saved ? saved.clocks.map((c) => (c / 8388608).toFixed(2)) : '-'})`);

const unlinked = await round(false);
check(unlinked === 0, `no bytes with the cable out (${unlinked})`);
check((await bottomInk(0)) > 20, 'Game Boy 1 says NO REPLY with the cable out');

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join('; ') : ''));
check(foreign.length === 0, 'nothing fetched from another site' + (foreign.length ? ': ' + foreign.join(', ') : ''));

await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
