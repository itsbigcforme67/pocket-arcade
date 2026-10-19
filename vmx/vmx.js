// VMX simulator: the VMX's firmware UI (boot, menus, saves, settings) and its games, for Pocket Arcade.
// The 1-bit Surf, the 3x5 font, the beeper sounds and the boot are copied unchanged from the VMX mockup
// (XMU GADGET/ui/mockup/xvm_menus.html, the film's reference); the menus follow it, with the real games in place of
// its placeholders. The games are in games.js (one adapter per core in cores/).
import { GAMES as ALL, seedNow } from "./games.js";

"use strict";
// ---------------------------------------------------------------- 1-bit surfaces (from the mockup)
class Surf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
  clear(c = 0) { this.d.fill(c); }
  px(x, y, c = 1) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[y * this.w + x] = c; }
  get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[y * this.w + x]; }
  fill(x, y, w, h, c = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); }
  rect(x, y, w, h, c = 1) { for (let i = 0; i < w; i++) { this.px(x + i, y, c); this.px(x + i, y + h - 1, c); }
    for (let j = 0; j < h; j++) { this.px(x, y + j, c); this.px(x + w - 1, y + j, c); } }
  rrect(x, y, w, h, c = 1) { for (let i = 1; i < w - 1; i++) { this.px(x + i, y, c); this.px(x + i, y + h - 1, c); }
    for (let j = 1; j < h - 1; j++) { this.px(x, y + j, c); this.px(x + w - 1, y + j, c); } }
  line(x0, y0, x1, y1, c = 1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c); }
  disc(cx, cy, r, c = 1) { for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++)
    if (x * x + y * y <= r * r + r * 0.6) this.px(cx + x, cy + y, c); }
  ring(cx, cy, r, c = 1) { for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = x * x + y * y; if (d <= r * r + r * 0.6 && d > (r - 1) * (r - 1) + (r - 1) * 0.6) this.px(cx + x, cy + y, c); } }
  // pill: rounded ends, h tall
  pill(x, y, w, h, mode, c = 1) {          // mode: "fill" | "line" | "ring" (fill + 1 px ring round it)
    const inside = (i, j, W, H) => { const r = H / 2; const cx = Math.min(Math.max(i + 0.5, r), W - r);
      return Math.hypot(i + 0.5 - cx, j + 0.5 - r) <= r + 0.15; };
    if (mode === "ring") { this.pill(x - 2, y - 2, w + 4, h + 4, "line", c); mode = "fill"; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const a = inside(i, j, w, h);
      if (!a) continue;
      if (mode === "fill") this.px(x + i, y + j, c);
      else if (!(i > 0 && j > 0 && i < w - 1 && j < h - 1 && inside(i - 1, j - 1, w - 2, h - 2))) this.px(x + i, y + j, c);
    }
  }
  text(x, y, s, c = 1) { s = String(s).toUpperCase(); for (const ch of s) { const g = FONT[ch] || FONT["?"];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === "1") this.px(x + q, y + r, c); x += 4; } }
  tri(x, y, up, c = 1) { for (let r = 0; r < 3; r++) for (let q = -r; q <= r; q++) this.px(x + q, up ? y + r : y + 2 - r, c); }
  blit(src, dx, dy, dw, dh, mask) {      // nearest-neighbour scale; mask "circle" crops to the inscribed circle
    for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) {
      if (mask === "circle") { const u = (i + 0.5) / dw - 0.5, v = (j + 0.5) / dh - 0.5; if (u * u + v * v > 0.25) continue; }
      const sx = Math.floor(i * src.w / dw), sy = Math.floor(j * src.h / dh);
      this.px(dx + i, dy + j, src.d[sy * src.w + sx]);
    }
  }
}
const tw = s => String(s).length * 4 - 1;

// 3x5 font (rows top to bottom, 3 bits each)
const F = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",D:"110101101101110",E:"111100110100111",F:"111100110100100",
  G:"011100101101011",H:"101101111101101",I:"111010010010111",J:"001001001101010",K:"101101110101101",L:"100100100100111",
  M:"101111111101101",N:"110101101101101",O:"010101101101010",P:"110101110100100",Q:"010101101110011",R:"110101110101101",
  S:"011100010001110",T:"111010010010010",U:"101101101101111",V:"101101101101010",W:"101101111111101",X:"101101010101101",
  Y:"101101010010010",Z:"111001010100111","0":"111101101101111","1":"010110010010111","2":"110001010100111",
  "3":"110001010001110","4":"101101111001001","5":"111100110001110","6":"011100111101111","7":"111001010010010",
  "8":"111101111101111","9":"111101111001110"," ":"000000000000000",".":"000000000000010","-":"000000111000000",
  "?":"110001010000010","!":"010010010000010",":":"000010000010000","/":"001001010100100","%":"101001010100101",
  "(":"010100100100010",")":"010001001001010","+":"000010111010000",">":"100010001010100","<":"001010100010001",
  "*":"000101010101000"
};
const FONT = F;

// ---------------------------------------------------------------- storage (every access may throw: private mode)
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const SET = Object.assign({ sound: true, bright: 2 }, load("vmx-settings", {}));
const RECS = load("vmx-saves", {});
const rec = id => (RECS[id] ||= {});

// ---------------------------------------------------------------- games
const EXTRA = new URLSearchParams(location.search).has("extra");     // Zork I and Star Raiders: owner's call pending
const GAMES = ALL.filter(a => !a.extra || EXTRA);
const ART = GAMES.map(a => { const s = new Surf(24, 24); a.art(s); return s; });
const MAIN = ["GAMES", "SAVES", "SETTINGS", "???"];

// main-menu glyphs, 12x12 (from the mockup)
function menuGlyph(k) {
  const s = new Surf(12, 12);
  if (k === 0) { s.pill(0, 3, 12, 7, "line"); s.fill(2, 6, 3, 1); s.fill(3, 5, 1, 3); s.px(8, 5); s.px(9, 7); }
  if (k === 1) { s.rect(2, 0, 8, 12); s.fill(4, 2, 4, 3); for (let x = 3; x < 9; x += 2) s.fill(x, 9, 1, 2); }
  if (k === 2) { s.ring(6, 6, 4); s.disc(6, 6, 1); for (const [x, y] of [[6,0],[6,11],[0,6],[11,6],[2,2],[10,2],[2,10],[10,10]]) s.px(x, y); }
  if (k === 3) { s.text(5, 3, "?"); s.rrect(0, 0, 12, 12); }
  return s;
}
const MENU_GLYPH = MAIN.map((_, k) => menuGlyph(k));

// ---------------------------------------------------------------- sound (beeper, from the mockup)
let ac = null, muted = true;
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === "suspended") ac.resume(); return ac; }
function tone(f, t0, dur, vol = 0.06, slideTo) {
  if (muted || !audio()) return;
  const o = ac.createOscillator(), g = ac.createGain(); o.type = "square";
  const t = ac.currentTime + t0; o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.85); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
const N = n => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note -> Hz
const blip = () => tone(1800, 0, 0.025, 0.04);
const okSnd = () => { tone(1200, 0, 0.04, 0.05); tone(1800, 0.05, 0.06, 0.05); };
const backSnd = () => { tone(1500, 0, 0.04, 0.05); tone(900, 0.05, 0.06, 0.05); };
const errSnd = () => { tone(220, 0, 0.12, 0.06); };
function chime(f, t0, dur, vol) {          // one beeper note with a quick bell-like decay
  if (muted || !audio()) return;
  const o = ac.createOscillator(), g = ac.createGain(); o.type = "square";
  const t = ac.currentTime + t0; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
function jingle() {                     // owner: A6 E6 A5 E6 A6, single hits, the whole chime a little under a second
  const T = 4.12;                       // starts right after the X settles (owner)
  const n = [[81, 0.00, 0.10], [76, 0.11, 0.10], [69, 0.22, 0.10], [76, 0.33, 0.10], [81, 0.44, 0.22]];
  n.forEach(([m, t, d]) => chime(N(m), T + t, d, 0.07));
}

// ---------------------------------------------------------------- screens
const lcd = new Surf(64, 64);
const S = { screen: "off", t: 0, main: 0, mainPos: 0, game: 0, gamePos: 0, save: 0, savePos: 0, erase: 0, setSel: 0,
  flash: "", flashT: 0, boot: 0, idle: 0, play: null, msg: "" };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const ease = (a, b, k) => a + (b - a) * k;
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };

// The X traced from the owner's reference video (settled logo frame), 2 levels: 2 lit face, 1 shaded face.
const XMASK = { w: 128, h: 103, rows: "011,12,0115|010,13,0115|010,15,0113|010,18,0110|011,18,092,12,015|012,11,22,16,088,14,015|013,11,22,15,087,14,016|014,12,22,14,085,14,017|015,11,24,16,077,17,018|016,11,25,16,074,18,018|017,11,26,15,070,111,018|018,11,26,15,068,111,019|018,12,26,17,064,110,021|019,12,26,19,060,110,022|020,12,29,17,054,114,022|021,12,29,16,054,114,022|023,11,29,17,051,114,023|024,11,210,17,045,117,024|026,11,28,110,041,116,026|026,11,211,19,037,118,026|027,11,213,16,036,118,027|027,12,213,19,030,119,028|029,12,29,11,22,110,025,121,029|029,13,28,11,22,114,020,120,031|030,13,210,116,012,126,031|031,13,29,117,011,125,032|033,12,29,151,033|034,13,211,146,034|036,11,213,142,036|036,12,212,142,036|037,12,212,140,037|038,12,212,138,038|039,13,28,11,22,131,21,14,039|042,11,212,132,041|042,12,211,125,23,14,041|042,13,212,121,26,12,042|044,12,211,117,29,12,043|045,11,213,113,29,13,044|044,12,213,113,29,11,046|044,12,214,19,213,046|044,12,214,15,21,11,215,046|044,12,215,13,218,046|044,12,236,12,044|044,12,236,12,044|043,13,236,12,044|043,13,236,12,044|043,13,236,13,043|042,14,236,13,043|041,14,237,14,042|040,15,238,14,041|039,16,238,14,041|038,17,239,15,039|038,17,239,15,039|037,18,239,16,038|036,19,216,14,219,17,037|036,18,216,12,03,11,218,17,037|036,17,215,13,05,12,216,18,036|034,18,215,13,08,11,216,17,036|033,19,215,12,010,11,216,17,035|031,110,214,12,013,12,215,18,033|031,110,214,11,015,12,215,17,033|031,19,213,12,018,11,216,16,032|029,111,212,12,020,11,216,16,031|029,19,214,11,022,11,215,16,031|029,19,211,12,025,12,213,16,031|028,19,211,13,026,12,214,16,029|027,18,212,12,030,11,213,17,028|026,18,213,11,031,12,213,17,027|025,18,212,12,033,12,212,18,026|024,19,211,12,036,11,211,18,026|024,18,211,12,038,11,210,110,024|023,19,210,11,042,11,29,19,024|022,110,28,12,044,11,210,18,023|021,111,27,12,045,11,211,18,022|021,110,27,12,048,11,210,17,022|019,111,27,11,051,11,210,17,021|018,110,27,12,054,11,29,17,020|018,19,27,12,056,11,29,17,019|017,19,27,12,057,12,28,18,018|017,18,27,063,11,26,18,018|015,110,25,12,064,11,28,16,017|015,18,25,13,066,11,27,16,017|014,18,25,12,069,12,26,16,016|013,19,24,12,071,12,26,16,015|013,18,24,12,074,11,25,17,014|010,110,24,12,076,12,24,17,013|010,19,22,13,081,11,23,17,012|010,17,24,12,082,12,22,19,010|010,16,22,14,084,11,21,110,010|09,17,21,13,087,112,09|08,16,23,12,089,111,09|07,17,22,11,093,15,21,14,08|06,111,094,110,07|05,16,21,13,097,110,06|04,110,0101,18,05|03,110,0103,18,04|02,19,0106,18,03|02,18,0108,17,03|01,18,0110,16,03|16,0115,14,03|15,0117,16|0126,12|0126,11,01" };
const XM = (() => { const d = new Uint8Array(XMASK.w * XMASK.h); let i = 0;
  for (const row of XMASK.rows.split("|")) for (const run of row.split(",")) { const v = +run[0], n = +run.slice(1); d.fill(v, i, i + n); i += n; }
  for (let y = 0; y < XMASK.h; y++) for (let x = XMASK.w >> 1; x < XMASK.w; x++)    // mirror the left half: symmetrical
    d[y * XMASK.w + x] = d[y * XMASK.w + XMASK.w - 1 - x];                          // shape and shading (owner)
  return d; })();
// Boot (owner, after the console's startup): only the goo morphing, then the X coming in.
//   0.0-2.6  the goo: a glowing blob that keeps changing shape
//   2.6-3.1  it flares; its glow floods the screen
//   3.1-4.1  the X (traced from the real logo: lit faces solid, shaded faces dithered) comes in huge and settles
//   4.2-4.8  "VMX" flies in under it, big to small; hold, then the main menu
const BOOT_END = 6.4;
const dith = (x, y, k) => BAYER[(y & 3) * 4 + (x & 3)] < k * 16;     // ordered dither: k 0..1 = density
function goo(cx, cy, R, t, glow) {
  for (let y = -30; y <= 30; y++) for (let x = -30; x <= 30; x++) {
    const a = Math.atan2(y, x), d = Math.hypot(x, y);
    const r = R * (1 + 0.22 * Math.sin(3 * a + t * 2.3) + 0.16 * Math.sin(5 * a - t * 3.1) + 0.10 * Math.sin(2 * a + t * 4.7)
                     + 0.12 * Math.sin(7 * a + t * 1.7) * Math.sin(t * 1.3));
    if (d <= r) lcd.px(cx + x, cy + y);
    else if (glow > 0 && d <= r + glow && dith(cx + x, cy + y, 0.5 * (1 - (d - r) / glow))) lcd.px(cx + x, cy + y);
  }
}
function drawX(cx, cy, w) {                            // the traced X, w px wide, centred on (cx, cy)
  const h = w * XMASK.h / XMASK.w;
  const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  const shade = clamp01(1 - (w - 60) / 80);          // shaded faces: dithered while big, solid once small (thin arms)
  for (let j = 0; j < Math.ceil(h); j++) for (let i = 0; i < Math.ceil(w); i++) {
    const sx = Math.floor((i + 0.5) * XMASK.w / w), sy = Math.floor((j + 0.5) * XMASK.h / h);
    if (sx >= XMASK.w || sy >= XMASK.h) continue;
    const v = XM[sy * XMASK.w + sx], X = x0 + i, Y = y0 + j;
    const mx = X < 32 ? X : 63 - X;                   // dither mirrored about the centre line too
    if (v === 2 || (v === 1 && dith(mx, Y, shade))) lcd.px(X, Y);
  }
}
function drawBoot(t) {
  lcd.clear();
  if (t < 2.6) {                                       // the goo, morphing
    const R = ease(3, 8, smooth(t / 1.4)) + 0.6 * Math.sin(t * 3);
    goo(32, 30, R, t, 3 + 1.5 * Math.sin(t * 4));
  } else if (t < 3.1) {                                // the flare
    const k = smooth((t - 2.6) / 0.5);
    goo(32, 30, ease(8, 16, k), t, ease(4, 60, k));
    if (k > 0.6) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (dith(x, y, (k - 0.6) * 2.5)) lcd.px(x, y);
  } else {                                             // the X comes in and settles; then the wordmark
    const k = smooth((t - 3.1) / 1.0);
    if (t < 3.25) { const f = 1 - (t - 3.1) / 0.15; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (dith(x, y, f)) lcd.px(x, y); }
    drawX(32, ease(32, 22, k), ease(150, 46, k));
    if (t > 4.2) {
      const q = smooth((t - 4.2) / 0.6), sc = Math.max(2, Math.round(ease(7, 2, q)));
      const w = tw("VMX") * sc;
      bigText(32 - Math.floor(w / 2), Math.round(ease(44, 45, q)), "VMX", sc);
    }
  }
}
function bigText(x, y, s, sc) {                        // the 3x5 font, each dot sc x sc
  for (const ch of s) { const g = FONT[ch] || FONT["?"];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === "1") lcd.fill(x + q * sc, y + r * sc, sc, sc);
    x += 4 * sc; }
}

if (new URLSearchParams(location.search).has("debug")) window.VMX = { S, GAMES, RECS, press: b => { down(b); up(b); } };   // for tests

function battery(x, y) { lcd.rect(x, y, 9, 5); lcd.px(x + 9, y + 2); lcd.fill(x + 2, y + 2, 4, 1); }
const centre = (y, s, c = 1) => lcd.text(32 - Math.floor(tw(s) / 2), y, s, c);

function drawMain() {
  lcd.clear();
  battery(53, 1);
  const pos = S.mainPos;
  for (let d = -2; d <= 2; d++) {
    const k = Math.round(pos) + d, idx = ((k % MAIN.length) + MAIN.length) % MAIN.length, off = k - pos;
    const y = 29 + off * 12, x = Math.round(7 - 4.5 * off * off);   // the arc: rows step back to the left
    const w = tw(MAIN[idx]) + 8;
    const sel = Math.abs(off) < 0.5;
    lcd.pill(x, Math.round(y) - 1, w, 9, sel ? "ring" : "fill");
    lcd.text(x + 4, Math.round(y) + 1, MAIN[idx], 0);
  }
  lcd.blit(MENU_GLYPH[S.main], 48, 25, 12, 12);        // the selected section's glyph on the right
}

function card(x, y, s, k, sel) {                      // a game card: black face, outline, pictogram
  lcd.fill(x, y, s, s, 0); lcd.rrect(x, y, s, s); if (sel) lcd.rrect(x - 1, y - 1, s + 2, s + 2);
  if (k !== null) lcd.blit(ART[k], x + 2, y + 2, s - 4, s - 4);
}

function drawGames() {
  lcd.clear();
  const pos = S.gamePos, n = GAMES.length, list = [];
  for (let d = -2; d <= 2; d++) {
    const k = Math.round(pos) + d, idx = ((k % n) + n) % n, off = k - pos;
    // the roulette arc: from bottom-left (behind) up through the selected card to top-right (next)
    const s = Math.round(32 - Math.min(Math.abs(off), 1.5) * 10);
    const x = Math.round(6 + off * 30), y = Math.round(12 - off * 13 + off * off * 2);
    list.push({ off, idx, s, x, y });
  }
  list.sort((a, b) => Math.abs(b.off) - Math.abs(a.off)).forEach(c => card(c.x, c.y, c.s, c.idx, Math.abs(c.off) < 0.5));
  const a = GAMES[S.game];
  lcd.fill(39, 28, 25, 22, 0);
  a.name.forEach((l, i) => lcd.text(40, 30 + i * 7, l));
  lcd.text(40, 44, "A:PLAY");
  lcd.text(1, 52, "DEMO"); lcd.tri(8, 58, false); lcd.text(64 - tw(`${S.game + 1}/${n}`), 58, `${S.game + 1}/${n}`);
}

function drawSaves() {
  lcd.clear();
  const a = GAMES[S.save];
  lcd.blit(ART[S.save], 4, 4, 24, 24, "circle");
  lcd.ring(16, 16, 15);
  a.score(rec(a.id)).forEach((l, i) => lcd.text(36, 4 + i * 8, l));
  lcd.text(36, 28, (S.save + 1) + "/" + GAMES.length);
  lcd.tri(32, 37, true);
  const w = Math.max(tw(a.title) + 10, 40), x = 32 - Math.floor(w / 2);
  lcd.pill(x, 42, w, 9, "fill"); centre(44, a.title, 0);
  lcd.tri(32, 54, false);
}

function drawErase() {
  lcd.clear();
  const a = GAMES[S.save];
  lcd.pill(2, 2, 60, 9, "fill"); centre(4, a.title, 0);
  ["KEEP", "ERASE"].forEach((o, i) => { const y = 19 + i * 13;
    lcd.pill(9, y, 46, 9, S.erase === i ? "fill" : "line"); centre(y + 2, o, S.erase === i ? 0 : 1); });
  lcd.text(2, 58, "B BACK  A OK");
}

const SETTINGS = ["SOUND", "BRIGHT", "ABOUT"];
function drawSettings() {
  lcd.clear();
  lcd.pill(2, 1, 60, 9, "fill"); centre(3, "SETTINGS", 0);
  const val = [SET.sound ? "ON" : "OFF", ["LOW", "MID", "HIGH"][SET.bright], ">"];
  SETTINGS.forEach((s, i) => { const y = 16 + i * 10, sel = i === S.setSel;
    if (sel) lcd.fill(2, y - 2, 60, 9);
    lcd.text(5, y, s, sel ? 0 : 1); lcd.text(59 - tw(val[i]), y, val[i], sel ? 0 : 1); });
  lcd.text(2, 59, "A: CHANGE");
}
function drawAbout() {
  lcd.clear();
  bigText(32 - Math.floor(tw("VMX") * 2 / 2), 4, "VMX", 2);
  centre(20, "SIMULATOR"); centre(30, "POCKET ARCADE"); centre(38, GAMES.length + " GAMES");
  centre(56, "B: BACK");
}
function drawExtra() { lcd.clear(); lcd.text(20, 20, "???"); lcd.text(4, 32, "COMING SOON"); lcd.text(14, 52, "B: BACK"); }
function drawMsg() {                                    // loading, missing cartridge, errors
  lcd.clear();
  const lines = S.msg.split("\n");
  lines.forEach((l, i) => centre(24 - lines.length * 4 + i * 8, l));
  if (S.screen === "cart") { centre(44, "A: OPEN FILE"); centre(52, "B: BACK"); }
}

function drawFlash() {
  if (!S.flash || S.t - S.flashT > 1.1) return;
  const w = tw(S.flash) + 8, x = 32 - Math.floor(w / 2);
  lcd.fill(x - 1, 23, w + 2, 13, 0); lcd.pill(x, 24, w, 11, "fill"); lcd.text(x + 4, 27, S.flash, 0);
}
const flash = m => { S.flash = m; S.flashT = S.t; };

// ---------------------------------------------------------------- playing a game
let loadToken = 0;
async function open(k, demo, attract = false) {
  const a = GAMES[k], token = ++loadToken;
  S.play = null; S.msg = "LOADING"; S.screen = "loading";
  try { a.m ||= await a.load.call(a); } catch (e) {
    if (token !== loadToken) return;
    errSnd(); S.screen = "games"; flash("NOT FOUND"); return; }
  if (token !== loadToken || S.screen !== "loading") return;
  if (a.needsCart && !a.cart) a.cart = cartFromStore();
  if (a.needsCart && !a.cart) { if (attract) { S.screen = "games"; return; } S.msg = "NEEDS YOUR\nCARTRIDGE\nFILE"; S.screen = "cart"; S.cartFor = k; return; }
  const g = a.start(a.m, seedNow(), demo);
  taps.length = 0; for (const b of BTN) held[b] = latch[b] = false;
  S.play = { k, a, g, demo, attract, prev: {}, acc: 0, since: 0 };
  S.screen = "play"; S.idle = 0;
}
function close() { S.play = null; S.screen = "games"; S.idle = 0; }

function cartFromStore() {
  try { const c = localStorage.getItem("vmx-starraiders-cart"); if (c) return Uint8Array.from(atob(c), ch => ch.charCodeAt(0)); } catch {}
  return null;
}
const cartInput = document.getElementById("cart");
cartInput.addEventListener("change", async () => {
  const f = cartInput.files[0]; cartInput.value = ""; if (!f) return;
  let bytes = new Uint8Array(await f.arrayBuffer());
  if (bytes.length === 8192 + 16) bytes = bytes.slice(16);                    // .car header
  if (bytes.length !== 8192) { errSnd(); flash("NOT 8 KB"); return; }
  const a = GAMES[S.cartFor]; a.cart = bytes;
  let bin = ""; for (const v of bytes) bin += String.fromCharCode(v);
  try { localStorage.setItem("vmx-starraiders-cart", btoa(bin)); } catch {}
  okSnd(); open(S.cartFor, false);
});

const BTN = ["up", "down", "left", "right", "a", "b"];
function tickGame() {
  const P = S.play, h = {}, e = {};
  for (const b of BTN) { h[b] = held[b] || latch[b]; e[b] = h[b] && !P.prev[b]; latch[b] = false; }
  P.prev = h;
  const tap = taps.shift();
  if (P.demo) {                                         // a demo ends on any press
    if (BTN.some(b => e[b])) { backSnd(); close(); return; }
  } else if (e.b && !P.a.usesB) { backSnd(); close(); return; }
  P.a.tick(P.g, { held: h, edges: e, tap, demo: P.demo });
  if (!P.demo && P.a.record(P.g, rec(P.a.id))) store("vmx-saves", RECS);
  if (P.attract && (P.since += 1 / 30) > 25) {          // attract mode: the next game's demo
    const n = (P.k + 1) % GAMES.length; S.game = n; open(n, true, true);
  }
}

// ---------------------------------------------------------------- input
const held = {}, latch = {}, taps = [];
function go(screen) { S.screen = screen; S.idle = 0; }
function press(b) {
  S.idle = 0;
  const sc = S.screen;
  if (sc === "off") { power(); return; }
  if (sc === "boot") return;
  if (sc === "play") { if (b === "side") { backSnd(); close(); } return; }   // the game gets the rest
  if (b === "side") b = "b";                            // in the menus the side button is back
  if (sc === "main") {
    if (b === "up") { S.main = (S.main + MAIN.length - 1) % MAIN.length; blip(); }
    if (b === "down") { S.main = (S.main + 1) % MAIN.length; blip(); }
    if (b === "a") { okSnd(); go(["games", "saves", "settings", "extra"][S.main]); }
  } else if (sc === "games") {
    if (b === "left" || b === "up") { S.game = (S.game + GAMES.length - 1) % GAMES.length; blip(); }
    if (b === "right") { S.game = (S.game + 1) % GAMES.length; blip(); }
    if (b === "a") { okSnd(); open(S.game, false); }
    if (b === "down") { okSnd(); open(S.game, true); }
    if (b === "b") { backSnd(); go("main"); }
  } else if (sc === "saves") {
    if (b === "up") { S.save = (S.save + GAMES.length - 1) % GAMES.length; blip(); }
    if (b === "down") { S.save = (S.save + 1) % GAMES.length; blip(); }
    if (b === "a") { okSnd(); S.erase = 0; go("erase"); }
    if (b === "b") { backSnd(); go("main"); }
  } else if (sc === "erase") {
    if (b === "up" || b === "down") { S.erase = 1 - S.erase; blip(); }
    if (b === "a") {
      if (S.erase) { const a = GAMES[S.save]; delete RECS[a.id]; a.erase?.(); store("vmx-saves", RECS); backSnd(); flash("ERASED"); }
      else okSnd();
      go("saves");
    }
    if (b === "b") { backSnd(); go("saves"); }
  } else if (sc === "settings") {
    if (b === "up") { S.setSel = (S.setSel + SETTINGS.length - 1) % SETTINGS.length; blip(); }
    if (b === "down") { S.setSel = (S.setSel + 1) % SETTINGS.length; blip(); }
    if (b === "a" || b === "left" || b === "right") {
      if (S.setSel === 0) { SET.sound = !SET.sound; muted = !SET.sound; okSnd(); }
      if (S.setSel === 1) { SET.bright = (SET.bright + (b === "left" ? 2 : 1)) % 3; blip(); }
      if (S.setSel === 2 && b === "a") { okSnd(); go("about"); }
      store("vmx-settings", SET);
    }
    if (b === "b") { backSnd(); go("main"); }
  } else if (sc === "about" || sc === "extra") { if (b === "b") { backSnd(); go(sc === "about" ? "settings" : "main"); } }
  else if (sc === "cart") {
    if (b === "a") cartInput.click();
    if (b === "b") { backSnd(); go("games"); }
  } else if (sc === "loading") { if (b === "b") { loadToken++; go("games"); } }
}
function power() { muted = !SET.sound; audio(); close(); go("boot"); S.boot = 0; jingle(); }

// the button went down (from touch, keys or a pad)
function down(b) {
  if (b === "side") { sideAt = performance.now(); return; }   // decided on release: short = back, long = power
  if (S.screen === "play") { held[b] = latch[b] = true; taps.push(b); }
  if (S.screen === "play" && S.play && !S.play.demo) return;
  if (S.screen === "play") { S.idle = 0; return; }     // a demo: tickGame sees the press and ends it
  press(b);
}
function up(b) {
  if (b === "side") { if (sideAt < 0) return; const long = performance.now() - sideAt > LONG; sideAt = -1;
    if (long) power(); else press("side"); return; }
  held[b] = false;
}
let sideAt = -1;
const LONG = 700;                                       // ms: a long press on the side button powers off and on

// scroll positions chase their targets (shortest way round on the wrapping lists)
function chase(cur, target, n, dt) {
  if (n) { let d = target - (((cur % n) + n) % n); if (d > n / 2) d -= n; if (d < -n / 2) d += n; return cur + d * Math.min(1, dt * 14); }
  return cur + (target - cur) * Math.min(1, dt * 14);
}

// ---------------------------------------------------------------- render loop
const canvas = document.getElementById("lcd"), ctx = canvas.getContext("2d");
const img = ctx.createImageData(64, 64);
const ONS = [[62, 128, 29], [94, 192, 44], [125, 255, 58]], OFF = [10, 16, 8];
let last = performance.now();
function frame(now) {
  const raw = Math.max(0, (now - last) / 1000), dt = Math.min(0.05, raw); last = now; S.t += dt;
  pollPads();
  if (sideAt >= 0 && now - sideAt > LONG) { sideAt = -1; power(); }      // powers off without waiting for release
  S.mainPos = chase(S.mainPos, S.main, MAIN.length, dt);
  S.gamePos = chase(S.gamePos, S.game, GAMES.length, dt);
  let buf = lcd.d;
  if (S.screen === "play" && S.play) {
    const P = S.play;
    P.acc += Math.min(0.25, raw);
    while (S.play === P && P.acc >= 1 / 30) { P.acc -= 1 / 30; tickGame(); }
    if (S.play === P) buf = P.a.draw(P.g);
  } else {
    if (S.screen === "main" || S.screen === "games") {  // idle in the menus: the games play themselves
      S.idle += dt; if (S.idle > 30) { S.idle = 0; open(S.game, true, true); }
    }
    if (S.screen === "off") lcd.clear();
    else if (S.screen === "boot") { S.boot += dt; drawBoot(S.boot); if (S.boot > BOOT_END) go("main"); }
    else ({ main: drawMain, games: drawGames, saves: drawSaves, erase: drawErase, settings: drawSettings, about: drawAbout,
            extra: drawExtra, loading: drawMsg, cart: drawMsg })[S.screen]?.();
    drawFlash();
  }
  const ON = ONS[SET.bright] || ONS[2], D = img.data;
  for (let i = 0, j = 0; i < 4096; i++, j += 4) { const c = buf[i] ? ON : OFF; D[j] = c[0]; D[j + 1] = c[1]; D[j + 2] = c[2]; D[j + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  document.body.classList.toggle("on", S.screen !== "off");
  requestAnimationFrame(frame);
}

// the screen: a whole number of device pixels per VMX pixel, as large as the bezel allows
function fit() {
  const box = canvas.parentElement, cs = getComputedStyle(box);
  const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const dpr = window.devicePixelRatio || 1, k = Math.max(1, Math.floor(avail * dpr / 64));
  canvas.style.width = canvas.style.height = (k * 64 / dpr) + "px";
}
addEventListener("resize", fit); fit();
requestAnimationFrame(frame);

// ---------------------------------------------------------------- wiring
const map = { "k-up": "up", "k-down": "down", "k-left": "left", "k-right": "right", "k-a": "a", "k-b": "b", "k-side": "side" };
for (const [id, b] of Object.entries(map)) {
  const el = document.getElementById(id);
  el.addEventListener("pointerdown", e => { e.preventDefault(); el.classList.add("pressed"); audio(); down(b); });
  const release = () => { if (!el.classList.contains("pressed")) return; el.classList.remove("pressed"); up(b); };
  el.addEventListener("pointerup", release); el.addEventListener("pointercancel", release); el.addEventListener("pointerleave", release);
  el.addEventListener("contextmenu", e => e.preventDefault());
}
// keys as on the other Pocket Arcade consoles: Z / Space = A, X = B; Esc or Backspace is the side button
const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", z: "a", Z: "a", " ": "a", Enter: "a",
  x: "b", X: "b", Escape: "side", Backspace: "side" };
const keyEl = b => document.getElementById(Object.keys(map).find(k => map[k] === b));
document.addEventListener("keydown", e => { const b = KEYS[e.key]; if (!b || e.ctrlKey || e.metaKey || e.altKey) return; e.preventDefault();
  if (e.repeat) return; keyEl(b)?.classList.add("pressed"); audio(); down(b); });
document.addEventListener("keyup", e => { const b = KEYS[e.key]; if (!b) return; keyEl(b)?.classList.remove("pressed"); up(b); });
document.getElementById("power").addEventListener("click", () => { audio(); power(); });

// pads: A / B, the D-pad or left stick; Select or Start is the side button
const padPrev = {};
function pollPads() {
  const h = {};
  for (const p of navigator.getGamepads ? navigator.getGamepads() : []) {
    if (!p) continue;
    const bt = i => p.buttons[i]?.pressed;
    h.left ||= bt(14) || p.axes[0] < -0.5; h.right ||= bt(15) || p.axes[0] > 0.5;
    h.up ||= bt(12) || p.axes[1] < -0.5;   h.down ||= bt(13) || p.axes[1] > 0.5;
    h.a ||= bt(0); h.b ||= bt(1); h.side ||= bt(8) || bt(9);
  }
  for (const b of [...BTN, "side"]) {
    if (h[b] && !padPrev[b]) down(b); else if (!h[b] && padPrev[b]) up(b);
    padPrev[b] = !!h[b];
  }
}
