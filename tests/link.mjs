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
//   3. nothing is fetched from another site, and there are no page errors.
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

const unlinked = await round(false);
check(unlinked === 0, `no bytes with the cable out (${unlinked})`);
check((await bottomInk(0)) > 20, 'Game Boy 1 says NO REPLY with the cable out');

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join('; ') : ''));
check(foreign.length === 0, 'nothing fetched from another site' + (foreign.length ? ': ' + foreign.join(', ') : ''));

await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
