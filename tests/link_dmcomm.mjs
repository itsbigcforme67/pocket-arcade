#!/usr/bin/env node
// Digimon prong link (link/dmcomm.js) tests, in Node. GPL-3.0-or-later (see ../LICENSE).
//
//     node tests/link_dmcomm.mjs
//
//   1. Every packet survives encoding to line edges and decoding again, for V, X and Y prongs.
//   2. Two DigiROM devices on one wire, on a Timeline, hold a whole exchange the way two pets do,
//      and print what dmcomm would print, including copied (^) and check (@) digits.
//   3. With nobody on the other end, the starting side times out ("t").
import { encodePacket, PacketDecoder, DigiromDevice, prongs, parseDigirom } from '../link/dmcomm.js';
import { Timeline } from '../link/bus.js';

let failures = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failures++; };

for (const type of ['V', 'X', 'Y']) {
  let ok = 0;
  const words = [0x0000, 0xFFFF, 0xFC03, 0xFD02, 0x1234, 0x8001, 0xA5A5];
  for (const w of words) {
    const d = new PacketDecoder(type); let got = null, err = null;
    d.onPacket = (b) => { got = b; }; d.onError = (e) => { err = e; };
    let t = 1000;
    for (const e of encodePacket(type, w).edges) { t += e.dt; d.feed(e.active, t); }
    if (got === w && !err) ok++;
  }
  check(ok === words.length, `${type}: ${ok}/${words.length} packets survive encode and decode`);
}

function exchange(a, b, us = 2000000) {
  const A = new DigiromDevice(a), B = new DigiromDevice(b);
  const tl = new Timeline({ quantumUs: 50 });
  tl.add(A); tl.add(B);
  prongs(A, B);
  tl.run(us);
  return [A.text, B.text];
}

{
  const [a, b] = exchange('V1-FC03-FD02', 'V2-0E59-0F49');
  check(a === 's:FC03 r:0E59 s:FD02 r:0F49', `V: the side that starts prints “${a}”`);
  check(b === 'r:FC03 s:0E59 r:FD02 s:0F49', `V: the side that answers prints “${b}”`);
}
{
  const [a, b] = exchange('X1-1234-5678-9ABC', 'X2-^0^0^0^0-^F^F^F^F-4@500');
  check(b === 'r:1234 s:1234 r:5678 s:A987 r:9ABC s:4500', `X: copied, inverted and check digits (“${b}”)`);
  check(a === 's:1234 r:1234 s:5678 r:A987 s:9ABC r:4500', `X: the other side sees them (“${a}”)`);
}
{
  const [a, b] = exchange('Y1-0130-0230', 'Y2-0ABC-0DEF');
  check(a === 's:0130 r:0ABC s:0230 r:0DEF', `Y (inverted bits): “${a}”`);
}
{
  const A = new DigiromDevice('V1-FC03');
  const tl = new Timeline({ quantumUs: 50 }); tl.add(A); prongs(A);
  tl.run(1000000);
  check(A.text === 's:FC03 t', `alone: sends, then times out (“${A.text}”)`);
}
{
  let threw = false; try { parseDigirom('V1-FC0'); } catch { threw = true; }
  check(threw, 'a malformed DigiROM is refused');
}

console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
