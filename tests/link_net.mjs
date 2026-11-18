#!/usr/bin/env node
// Two-screen tests for the link page (link/): two tabs, and two "phones". GPL-3.0-or-later.
//
//     node tests/link_net.mjs [folder for screenshots]
//
// Needs Node 18+ and Playwright with a Chromium. It serves this folder itself on a free port.
//   1. Two tabs of one browser press "Link two tabs": they pair over BroadcastChannel, one becomes
//      Game Boy 1 and the other Game Boy 2, and Tricky Wicks' 2P LINK game starts with each
//      player pressing only their own buttons. Both tabs' copies of both Game Boys stay identical.
//   2. Two separate browser profiles (two phones) link over WebRTC with the codes carried by hand:
//      the joiner opens the starter's link (#j=...), and the answer goes back through a third tab
//      opened from the answer's link (#a=...), as a phone's camera app would open it. Same game.
//   3. Nothing is fetched from another site (no STUN unless ticked), and no page errors.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

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
const errors = [], foreign = [];
const watch = (page, name) => {
  page.on('pageerror', (e) => errors.push(name + ': ' + e));
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) foreign.push(r.url()); });
  return page;
};

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };

// Wait for `n` frames of the link game on a page.
const frames = (page, n) => page.evaluate((n) => new Promise((done) => {
  const net = window.__link.net, start = net.frame;
  (function wait() { if (net.frame - start >= n) done(); else setTimeout(wait, 10); })();
}), n);
// This player presses a key (their own Game Boy) for a few frames.
async function press(page, key) {
  const bit = { right: 1, left: 2, up: 4, down: 8, a: 16, b: 32, select: 64, start: 128 }[key];
  await page.evaluate((b) => { window.__link.net.local = b; }, bit);
  await frames(page, 6);
  await page.evaluate(() => { window.__link.net.local = 0; });
  await frames(page, 6);
}
// Record a hash of both Game Boys' screens every 30 frames, to compare the two copies.
const record = (page) => page.evaluate(() => {
  const L = window.__link; L.hashes = new Map();
  const prev = L.net.onFrame;
  L.net.onFrame = () => {
    prev();
    if (L.net.frame % 30) return;
    let h = 0;
    for (const gb of L.gbs) { const s = gb.screen(); for (let i = 0; i < s.length; i += 4) h = (h * 31 + s[i]) | 0; }
    L.hashes.set(L.net.frame, h);
  };
});
const playfield = (page, gb) => page.evaluate((gb) => {
  const s = window.__link.gbs[gb].screen(); let h = 0;
  for (let i = 0; i < 160 * 120 * 4; i += 4) h = (h * 31 + s[i]) | 0;
  return h;
}, gb);

async function playTrickyWicks(p1, p2, label) {
  await record(p1); await record(p2);
  await frames(p1, 45);                // the title screen
  for (const p of [p1, p2]) { await press(p, 'down'); await press(p, 'down'); await press(p, 'a'); }
  await frames(p1, 30);
  await press(p1, 'start');
  await frames(p1, 150);
  await frames(p2, 30);
  const b1 = await p1.evaluate(() => window.__link.bytes), b2 = await p2.evaluate(() => window.__link.bytes);
  check(b1 > 50 && b2 > 50, `${label}: bytes over the cable on both screens (${b1}, ${b2})`);
  const [a0, a1] = [await playfield(p1, 0), await playfield(p1, 1)];
  check(a0 === a1, `${label}: Game Boy 1 and 2 show the same playfield`);
  const h1 = await p1.evaluate(() => [...window.__link.hashes]), h2 = new Map(await p2.evaluate(() => [...window.__link.hashes]));
  const common = h1.filter(([f]) => h2.has(f));
  check(common.length >= 5 && common.every(([f, h]) => h2.get(f) === h), `${label}: both screens' copies identical, frame by frame (${common.length} frames compared)`);
  const desync = await p1.evaluate(() => window.__link.net.desync) || await p2.evaluate(() => window.__link.net.desync);
  check(!desync, `${label}: never out of step`);
  const own = await p2.evaluate(() => [...document.querySelectorAll('#consoles .gb')].map((g) => g.dataset.i).join());
  check(own === '1', `${label}: the second screen shows only Game Boy 2 (${own})`);
  await p1.screenshot({ path: path.join(SHOTS, `link-${label}-1.png`) });
  await p2.screenshot({ path: path.join(SHOTS, `link-${label}-2.png`) });
}

// 1. Two tabs.
{
  const ctx = await browser.newContext(phone);
  const [p1, p2] = [watch(await ctx.newPage(), 'tab1'), watch(await ctx.newPage(), 'tab2')];
  for (const p of [p1, p2]) await p.goto(BASE + 'link/');
  await p1.click('#tabs');
  await p2.click('#tabs');
  for (const p of [p1, p2]) await p.waitForFunction(() => window.__link && window.__link.net && window.__link.net.started, null, { timeout: 15000 });
  const sides = [await p1.evaluate(() => window.__link.me), await p2.evaluate(() => window.__link.me)];
  check(sides.sort().join() === '0,1', `the tabs took Game Boy 1 and Game Boy 2 (${sides})`);
  const [g1, g2] = (await p1.evaluate(() => window.__link.me)) === 0 ? [p1, p2] : [p2, p1];
  await playTrickyWicks(g1, g2, 'tabs');
  await ctx.close();
}

// 2. Two phones over WebRTC.
{
  const ctxA = await browser.newContext(phone), ctxB = await browser.newContext(phone);
  const a = watch(await ctxA.newPage(), 'phoneA');
  await a.goto(BASE + 'link/');
  await a.click('#phones');
  await a.click('#rtc-host');
  await a.waitForFunction(() => document.getElementById('rtc-code').value.startsWith('PA1~o~'));
  const offer = await a.inputValue('#rtc-code');
  check(offer.length < 400, `the offer code is short (${offer.length} characters)`);
  check(await a.$eval('#rtc-qr svg', (s) => !!s), 'the offer is shown as a QR code');

  const b = watch(await ctxB.newPage(), 'phoneB');
  await b.goto(BASE + 'link/#j=' + encodeURIComponent(offer));
  check((await b.inputValue('#rtc-input')) === offer, 'the joining phone opened from the link has the code filled in');
  await b.click('#rtc-go');
  await b.waitForFunction(() => document.getElementById('rtc-code').value.startsWith('PA1~a~'));
  const answer = await b.inputValue('#rtc-code');

  // Phone A's camera app opens the answer's link in a new tab of the same browser.
  const a2 = watch(await ctxA.newPage(), 'phoneA-camera');
  await a2.goto(BASE + 'link/#a=' + encodeURIComponent(answer));
  await a2.waitForFunction(() => /Switch back/.test(document.getElementById('rtc-msg').textContent), null, { timeout: 5000 });
  check(true, 'the answer opened in another tab went back to the starting tab');
  for (const p of [a, b]) await p.waitForFunction(() => window.__link && window.__link.net && window.__link.net.started, null, { timeout: 20000 });
  check(true, 'the phones connected');
  await playTrickyWicks(a, b, 'phones');
  await ctxA.close(); await ctxB.close();
}

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join('; ') : ''));
check(foreign.length === 0, 'nothing fetched from another site' + (foreign.length ? ': ' + foreign.join(', ') : ''));
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
