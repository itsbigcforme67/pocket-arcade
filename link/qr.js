// Pocket Arcade: a small QR code maker (byte mode, error correction level M or L).
// GPL-3.0-or-later (see ../LICENSE). Written for the link page, after the QR code standard
// (ISO/IEC 18004) as explained in Project Nayuki's write-up; no code copied.
//
//   const q = qrEncode('https://example.org/#j=...');   // { size, dark(x, y) }
//   qrToSvg(q)                                          // an <svg> string, 4 modules of quiet zone

const ECC = {   // per version 1..40: error correction codewords per block, and number of blocks
  L: { per: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
       blocks: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], bits: 1 },
  M: { per: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
       blocks: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], bits: 0 },
};

function rawModules(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const dataCodewords = (v, e) => Math.floor(rawModules(v) / 8) - ECC[e].per[v - 1] * ECC[e].blocks[v - 1];

function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
  return z & 0xFF;
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0); r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) { r[j] = gfMul(r[j], root); if (j + 1 < degree) r[j] ^= r[j + 1]; }
    root = gfMul(root, 2);
  }
  return r;
}
function rsRemainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) {
    const f = b ^ r.shift(); r.push(0);
    div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
  }
  return r;
}

export function qrEncode(text, { ecc = 'M' } = {}) {
  const bytes = new TextEncoder().encode(text);
  let v = 1;
  for (; v <= 40; v++) {
    const countBits = v < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(v, ecc) * 8) break;
  }
  if (v > 40) throw new Error('too long for a QR code');
  const size = v * 4 + 17, cap = dataCodewords(v, ecc);

  // The bit stream: byte mode, length, data, terminator, padding.
  const bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap * 8 - bits.length));
  put(0, (8 - bits.length % 8) % 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a << 1 | b, 0));
  for (let pad = 0xEC; data.length < cap; pad ^= 0xEC ^ 0x11) data.push(pad);

  // Split into blocks, add error correction, interleave.
  const nBlocks = ECC[ecc].blocks[v - 1], eccLen = ECC[ecc].per[v - 1], raw = Math.floor(rawModules(v) / 8);
  const nShort = nBlocks - raw % nBlocks, shortLen = Math.floor(raw / nBlocks), div = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += dat.length;
    const e = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(e));
  }
  const words = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < nBlocks; j++) if (i !== shortLen - eccLen || j >= nShort) words.push(blocks[j][i]);
  }

  // Function patterns.
  const mod = new Uint8Array(size * size), fn = new Uint8Array(size * size);
  const set = (x, y, d) => { mod[y * size + x] = d ? 1 : 0; fn[y * size + x] = 1; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  }
  if (v > 1) {
    const n = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    const pos = [6];
    for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  const drawFormat = (mask) => {
    const d = ECC[ecc].bits << 3 | mask;
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = (i) => (b >>> i) & 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, 1);
  };
  drawFormat(0);
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const b = v << 12 | r;
    for (let i = 0; i < 18; i++) { const d = (b >>> i) & 1, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, d); set(c, a, d); }
  }

  // Data, in the zigzag order.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y * size + x] && i < words.length * 8) { mod[y * size + x] = (words[i >>> 3] >>> (7 - (i & 7))) & 1; i++; }
    }
  }

  // Try the eight masks, keep the one with the lowest penalty.
  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0,
  ];
  const apply = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y * size + x] && MASKS[m](x, y)) mod[y * size + x] ^= 1; };
  let best = 0, bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    apply(m); drawFormat(m);
    const s = penalty(mod, size);
    if (s < bestScore) { bestScore = s; best = m; }
    apply(m);
  }
  apply(best); drawFormat(best);
  return { size, version: v, dark: (x, y) => mod[y * size + x] === 1 };
}

function penalty(mod, size) {
  let score = 0, dark = 0;
  const at = (x, y) => mod[y * size + x];
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < size; a++) {
      let run = 1, line = '';
      for (let b = 0; b < size; b++) {
        const c = pass ? at(a, b) : at(b, a);
        line += c;
        if (b > 0 && c === (pass ? at(a, b - 1) : at(b - 1, a))) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
        else run = 1;
      }
      for (const pat of ['10111010000', '00001011101']) for (let k = line.indexOf(pat); k >= 0; k = line.indexOf(pat, k + 1)) score += 40;
    }
  }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = at(x, y); if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) score += 3;
  }
  for (let k = 0; k < size * size; k++) dark += mod[k];
  return score + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
}

export function qrToSvg(q, { border = 4 } = {}) {
  let path = '';
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.dark(x, y)) path += `M${x + border},${y + border}h1v1h-1z`;
  const n = q.size + border * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
