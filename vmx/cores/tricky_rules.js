// Tricky Wicks rules, the owner's game: the compiled C core (port/core -> build_core.sh) copied unchanged from
// ~/claude projects/TRICKY WICKS/v1.5/tricky-wicks.html (lines 113-2099). Do not edit; rebuild from there.
export const CORE = /* Made by build_core.sh from port/core. Do not edit by hand. */
(function () {
var bufferView;
var base64ReverseLookup = new Uint8Array(123/*'z'+1*/);
for (var i = 25; i >= 0; --i) {
base64ReverseLookup[48+i] = 52+i; // '0-9'
base64ReverseLookup[65+i] = i; // 'A-Z'
base64ReverseLookup[97+i] = 26+i; // 'a-z'
}
base64ReverseLookup[43] = 62; // '+'
base64ReverseLookup[47] = 63; // '/'
/** @noinline Inlining this function would mean expanding the base64 string 4x times in the source code, which Closure seems to be happy to do. */
function base64DecodeToExistingUint8Array(uint8Array, offset, b64) {
var b1, b2, i = 0, j = offset, bLength = b64.length, end = offset + (bLength*3>>2) - (b64[bLength-2] == '=') - (b64[bLength-1] == '=');
for (; i < bLength; i += 4) {
b1 = base64ReverseLookup[b64.charCodeAt(i+1)];
b2 = base64ReverseLookup[b64.charCodeAt(i+2)];
uint8Array[j++] = base64ReverseLookup[b64.charCodeAt(i)] << 2 | b1 >> 4;
if (j < end) uint8Array[j++] = b1 << 4 | b2 >> 2;
if (j < end) uint8Array[j++] = b2 << 6 | base64ReverseLookup[b64.charCodeAt(i+3)];
}
}
function initActiveSegments(imports) {
base64DecodeToExistingUint8Array(bufferView, 1024, "MS41AGtpbmQsdCx0bSxvZmYsbXVsdCxudGgsY2huLHBfa2luZCxwX3QscF9jb2wscF95LHBfc2VyaWFsLG5fa2luZCxuX3Qsc2NvcmUscGxhY2VkLGxldmVsLHdpY2ssYmVzdF93aWNrLHBoYXNlLG92ZXIsc2hha2UscG93ZXIsaW5jb21pbmcsbl9ib29tcyxib29tX3IsYm9vbV9jLGJvb21fdCxuX3BvcHMscG9wX3gscG9wX3kscG9wX3QscG9wX3R5cGUscG9wX2EscG9wX2Isbl9zZngsc2Z4LHNmeF9hcmcs");
base64DecodeToExistingUint8Array(bufferView, 1268, "AQAAADAAAAABAAAAYAAAAAEAAACQAAAAAQAAAMAAAAABAAAA8AAAAAEAAAAgAQAAAQAAAFABAAABAAAAUQEAAAEAAABSAQAAAQAAAFMBAAABAAAAVAEAAAEAAABVAQAAAQAAAFYBAAABAAAAcAEAAAQAAAB0AQAAAgAAAHYBAAABAAAAeAEAAAEAAAB5AQAAAQAAAHoBAAABAAAAewEAAAEAAACCAQAAAQAAAIgBAAACAAAAlAEAAAEAAACXAQAAAQAAAJgBAAABAAAApAEAAAEAAACwAQAAAQAAALwBAAABAAAAvQEAAAEAAADJAQAAAQAAANUBAAABAAAA4QEAAAEAAADuAQAAAgAAAAYCAAACAAAAHgIAAAEAAAAfAgAAAQAAACcCAAAB");
base64DecodeToExistingUint8Array(bufferView, 1584, "yAAAAAwAAABgCQAACQAAABYAAAAO");
base64DecodeToExistingUint8Array(bufferView, 1616, "CgUGDAkDDg0LBw8ODQsHDwEAAwQFAgcICQYPDA0OCwoBBAgQ");
base64DecodeToExistingUint8Array(bufferView, 1664, "AQAFAgMECQYHCA8OCwwNCv///wAAAQEB/wAB/wH/AAEBAgQI/wABAAABAP8ECAECAAAAAAAABAgBAgUECAECBf///////wsMDQ4PBgcICQoAAgABAQACAAACAQAAAAIBAQAAAgIBAAAAAgIBAQACAgIBAAICAgEAAQICAQACAQEBAAIBAQEAAgIBAQACAgEBAgMAAQ==");
base64DecodeToExistingUint8Array(bufferView, 1824, "U1NTU0NDQ1RUWEJCRkZGS/8AAQAAAQD/BAgBAgECBAg=");
}
function asmFunc(imports) {
var buffer = new ArrayBuffer(65536);
var HEAP8 = new Int8Array(buffer);
var HEAP16 = new Int16Array(buffer);
var HEAP32 = new Int32Array(buffer);
var HEAPU8 = new Uint8Array(buffer);
var HEAPU16 = new Uint16Array(buffer);
var HEAPU32 = new Uint32Array(buffer);
var HEAPF32 = new Float32Array(buffer);
var HEAPF64 = new Float64Array(buffer);
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_abs = Math.abs;
var Math_clz32 = Math.clz32;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_floor = Math.floor;
var Math_ceil = Math.ceil;
var Math_trunc = Math.trunc;
var Math_sqrt = Math.sqrt;
var global$0 = 11520;
function $0($0_1) {
$0_1 = $0_1 | 0;
HEAP32[770] = Math_imul($0_1, 612) + 1856;
}
function $1($0_1) {
$0_1 = $0_1 | 0;
return Math_imul($0_1, 612) + 1856 | 0;
}
function $2() {
return 1028;
}
function $3() {
return 1264;
}
function $4($0_1) {
$0_1 = $0_1 | 0;
return HEAP32[($0_1 << 2) + 1584 >> 2];
}
function $5() {
return 1024;
}
function $6($0_1, $1_1) {
$0_1 = $0_1 | 0;
$1_1 = $1_1 | 0;
var $2_1 = 0, $3_1 = 0, $4_1 = 0, $5_1 = 0, $6_1 = 0, $7_1 = 0, $8_1 = 0, $9_1 = 0, $10_1 = 0, $11_1 = 0, $12_1 = 0, $13_1 = 0, $14_1 = 0, $15_1 = 0;
$12_1 = global$0 - 16 | 0;
global$0 = $12_1;
$2_1 = HEAP32[770];
HEAP8[$2_1 + 561 | 0] = 0;
HEAP8[$2_1 + 542 | 0] = 0;
block : {
if (HEAPU8[$2_1 + 379 | 0]) {
break block
}
block2 : {
block20 : {
block3 : {
switch (HEAPU8[$2_1 + 378 | 0]) {
case 0:
block5 : {
if (!HEAPU8[$2_1 + 390 | 0]) {
break block5
}
$3_1 = HEAPU16[$2_1 + 392 >> 1];
if (!$3_1) {
break block5
}
$4_1 = HEAPU8[$2_1 + 406 | 0] + 1 | 0;
HEAP8[$2_1 + 406 | 0] = $4_1;
if (($4_1 & 255) != 3) {
break block5
}
HEAP8[$2_1 + 406 | 0] = 0;
HEAP16[$2_1 + 392 >> 1] = $3_1 - 1;
}
if ($1_1 & 16) {
$7(1)
}
if ($1_1 & 32) {
$7(-1)
}
block6 : {
if ($1_1 & 1) {
$8(-1);
$2_1 = HEAP32[770];
HEAP8[$2_1 + 387 | 0] = 255;
HEAP8[$2_1 + 382 | 0] = 0;
break block6;
}
if ($1_1 & 2) {
$8(1);
$2_1 = HEAP32[770];
HEAP8[$2_1 + 387 | 0] = 1;
HEAP8[$2_1 + 382 | 0] = 0;
break block6;
}
$2_1 = HEAP32[770];
$3_1 = $0_1 >>> 1 & 1;
$4_1 = $0_1 & 1;
if (($3_1 | 0) != ($4_1 | 0)) {
$3_1 = $3_1 - $4_1 | 0;
if (HEAPU8[$2_1 + 387 | 0] != ($3_1 & 255)) {
break block6
}
$4_1 = HEAPU8[$2_1 + 382 | 0] + 1 | 0;
HEAP8[$2_1 + 382 | 0] = $4_1;
if (($4_1 & 255) >>> 0 < 12) {
break block6
}
if (!($4_1 & 3)) {
$8($3_1);
$2_1 = HEAP32[770];
$4_1 = HEAPU8[$2_1 + 382 | 0];
}
if (($4_1 & 255) >>> 0 < 16) {
break block6
}
HEAP8[$2_1 + 382 | 0] = $4_1 - 4;
break block6;
}
HEAP8[$2_1 + 387 | 0] = 0;
}
if ($1_1 & 8) {
HEAP8[$2_1 + 381 | 0] = 1
}
block8 : {
if ($1_1 & 4) {
$0_1 = (HEAPU8[$2_1 + 339 | 0] + 15 & 240) >>> 4 | 0;
$1_1 = $0_1 - 1 | 0;
$3_1 = ($1_1 | 0) <= 7 ? 7 : $1_1;
while (1) {
block7 : {
$1_1 = $0_1;
if (($1_1 - 1 | 0) >= 7) {
$1_1 = $3_1 + 1 | 0;
break block7;
}
$0_1 = $1_1 + 1 | 0;
if (!HEAPU8[(HEAPU8[$2_1 + 338 | 0] + Math_imul($1_1, 6) & 255) + $2_1 | 0]) {
continue
}
}
break;
};
$4_1 = $1_1 << 4;
HEAP8[$2_1 + 339 | 0] = $4_1;
break block8;
}
block10 : {
if (!(!($0_1 & 8) | !HEAPU8[$2_1 + 381 | 0])) {
$5_1 = 1;
$0_1 = 1024;
break block10;
}
$0_1 = Math_imul(HEAPU8[$2_1 + 374 | 0], 18);
$0_1 = ($0_1 >>> 0 >= 453 ? 453 : $0_1) + 59 | 0;
}
$1_1 = $0_1 + HEAPU16[$2_1 + 388 >> 1] | 0;
HEAP16[$2_1 + 388 >> 1] = $1_1;
block12 : {
block11 : {
while (1) {
if (($1_1 & 65535) >>> 0 < 256) {
break block11
}
$1_1 = $1_1 - 256 | 0;
HEAP16[$2_1 + 388 >> 1] = $1_1;
$3_1 = HEAP8[$2_1 + 338 | 0];
$4_1 = HEAPU8[$2_1 + 339 | 0];
$0_1 = $4_1 + 1 | 0;
if ($9($3_1, $0_1 & 255)) {
HEAP8[$2_1 + 380 | 0] = 0;
HEAP8[$2_1 + 339 | 0] = $0_1;
continue;
}
break;
};
HEAP16[$2_1 + 388 >> 1] = 0;
break block12;
}
$4_1 = HEAPU8[$2_1 + 339 | 0];
$0_1 = $4_1 + 1 | 0;
$3_1 = HEAPU8[$2_1 + 338 | 0];
}
if ($9($3_1 << 24 >> 24, $0_1 & 255)) {
break block2
}
$0_1 = HEAPU8[$2_1 + 380 | 0] + 1 | 0;
HEAP8[$2_1 + 380 | 0] = $0_1;
if (($5_1 ^ -1) & ($0_1 & 255) >>> 0 < 20) {
break block2
}
}
if (($4_1 & 255) >>> 0 <= 15) {
HEAP8[$2_1 + 336 | 0] = 0;
HEAP8[$2_1 + 379 | 0] = 1;
break block2;
}
$0_1 = (HEAPU8[$2_1 + 338 | 0] + Math_imul(($4_1 & 240) >>> 4 | 0, 6) | 0) - 6 & 255;
$10($0_1);
$1_1 = HEAP32[770];
HEAP8[$1_1 + $0_1 | 0] = HEAPU8[$1_1 + 336 | 0];
$1_1 = 0;
$2_1 = HEAP32[770];
if (HEAPU8[$2_1 + 336 | 0] == 1) {
$1_1 = HEAPU8[$2_1 + 337 | 0]
}
HEAP8[($0_1 + $2_1 | 0) + 48 | 0] = $1_1;
$0_1 = HEAP32[770];
HEAP8[$0_1 + 336 | 0] = 0;
HEAP8[$0_1 + 400 | 0] = 0;
HEAP32[$0_1 + 396 >> 2] = 0;
HEAP8[$0_1 + 384 | 0] = 0;
HEAP8[$0_1 + 376 | 0] = 0;
HEAP16[$0_1 + 372 >> 1] = HEAPU16[$0_1 + 372 >> 1] + 1;
$2_1 = HEAPU8[$0_1 + 375 | 0] + 1 | 0;
HEAP8[$0_1 + 375 | 0] = $2_1;
$1_1 = 3;
block13 : {
if (($2_1 & 255) != 12) {
break block13
}
HEAP8[$0_1 + 375 | 0] = 0;
$1_1 = 4;
$2_1 = HEAPU8[$0_1 + 374 | 0];
if (($2_1 | 0) == 255) {
break block13
}
HEAP8[$0_1 + 374 | 0] = $2_1 + 1;
}
$11($1_1, 0);
$2_1 = HEAP32[770];
HEAP8[$2_1 + 378 | 0] = 1;
break block2;
case 3:
$2_1 = 0;
while (1) {
$1_1 = HEAP32[770];
if (($2_1 | 0) != 48) {
$0_1 = $1_1 + $2_1 | 0;
if (HEAPU8[$0_1 + 96 | 0] != 255) {
$3_1 = HEAPU8[$0_1 | 0];
block14 : {
if (!($3_1 >>> 0 > 5 | !(1 << $3_1 & 50))) {
$0_1 = $8_1 & 255;
HEAP8[$0_1 + 3088 | 0] = 1;
$6_1 = $6_1 + 1 | 0;
break block14;
}
$0_1 = $8_1 & 255;
if (($3_1 & 254) == 2) {
HEAP8[$0_1 + 3088 | 0] = 2;
$10_1 = $10_1 + 1 | 0;
break block14;
}
HEAP8[$0_1 + 3088 | 0] = 3;
$13_1 = $13_1 + 1 | 0;
}
HEAP8[($0_1 + $1_1 | 0) + 562 | 0] = $2_1;
$8_1 = $8_1 + 1 | 0;
}
$2_1 = $2_1 + 1 | 0;
continue;
}
break;
};
HEAP8[$1_1 + 561 | 0] = $8_1;
block15 : {
if (!($6_1 & 255)) {
break block15
}
$14_1 = $8_1 & 255;
while (1) {
if (($5_1 | 0) == ($14_1 | 0)) {
break block15
}
block16 : {
if (HEAPU8[$5_1 + 3088 | 0] != 1) {
break block16
}
$0_1 = HEAP32[770];
$3_1 = HEAPU8[($0_1 + $5_1 | 0) + 562 | 0];
$0_1 = ($0_1 + $3_1 | 0) + 96 | 0;
HEAP8[$0_1 | 0] = HEAPU8[$0_1 | 0] + 1;
$0_1 = $3_1 << 24 >> 24;
$4_1 = ((($0_1 | 0) <= 5 ? 5 : $0_1) >>> 0) / 6 | 0;
$1_1 = HEAP32[770];
$2_1 = $3_1 + $1_1 | 0;
$0_1 = HEAPU8[$2_1 + 96 | 0];
if (($0_1 | 0) == 9) {
$0_1 = 15;
$11_1 = HEAPU8[$2_1 | 0];
$0_1 = ($11_1 & 254) != 4 ? HEAPU8[HEAPU8[$2_1 + 48 | 0] + 1616 | 0] : $0_1;
$15_1 = $3_1 + Math_imul($4_1, -6) | 0;
$2_1 = -4;
while (1) {
if ($2_1) {
block17 : {
if (!(HEAPU8[$2_1 + 1700 | 0] & $0_1)) {
break block17
}
$1_1 = $12($4_1 + HEAPU8[$2_1 + 1704 | 0] << 24 >> 24, HEAPU8[$2_1 + 1708 | 0] + $15_1 << 24 >> 24);
if (($1_1 | 0) == 255) {
break block17
}
$7_1 = $1_1 + HEAP32[770] | 0;
$9_1 = $7_1 + 96 | 0;
if (HEAPU8[$9_1 | 0] != 255) {
break block17
}
block19 : {
switch (HEAPU8[$7_1 | 0] - 1 | 0) {
case 0:
if (($11_1 | 0) != 5) {
if (!(HEAPU8[$2_1 + 1712 | 0] & HEAPU8[HEAPU8[$7_1 + 48 | 0] + 1616 | 0])) {
break block17
}
}
HEAP8[$9_1 | 0] = 0;
$7_1 = HEAP32[770];
$1_1 = HEAPU8[$7_1 + 376 | 0] + 1 | 0;
HEAP8[$7_1 + 376 | 0] = $1_1;
$1_1 = $1_1 & 255;
$11(7, $1_1 >>> 0 >= 16 ? 16 : $1_1);
break block17;
case 1:
case 2:
break block19;
default:
break block17;
};
}
HEAP8[$9_1 | 0] = 0;
$9_1 = HEAP32[770];
$7_1 = HEAPU8[$9_1 + 376 | 0];
HEAP8[($1_1 + $9_1 | 0) + 192 | 0] = $7_1 >>> 0 <= 1 ? 1 : $7_1;
$7_1 = HEAP32[770];
$9_1 = HEAPU8[$7_1 + 385 | 0] + 1 | 0;
HEAP8[$7_1 + 385 | 0] = $9_1;
HEAP8[($1_1 + $7_1 | 0) + 240 | 0] = $9_1;
$9_1 = HEAP32[770];
$7_1 = HEAPU8[$9_1 + 384 | 0];
HEAP8[($1_1 + $9_1 | 0) + 288 | 0] = $7_1 >>> 0 >= 3 ? 3 : $7_1;
$7_1 = $1_1;
$1_1 = HEAP32[770];
if (HEAPU8[$7_1 + $1_1 | 0] != 3 | HEAPU8[$1_1 + 400 | 0]) {
break block17
}
HEAP8[$1_1 + 400 | 0] = 1;
$7_1 = $1_1;
$1_1 = HEAP32[$1_1 + 396 >> 2] + HEAPU16[$1_1 + 392 >> 1] | 0;
HEAP16[$7_1 + 392 >> 1] = $1_1 >>> 0 >= 2400 ? 2400 : $1_1;
}
$2_1 = $2_1 + 1 | 0;
continue;
}
break;
};
$1_1 = HEAP32[770];
$0_1 = HEAPU8[($3_1 + $1_1 | 0) + 96 | 0];
}
if (($0_1 & 255) >>> 0 < 22) {
break block16
}
$0_1 = HEAPU8[$1_1 + $3_1 | 0];
$10($3_1);
if (($0_1 | 0) != 1) {
break block16
}
$13(10);
}
$5_1 = $5_1 + 1 | 0;
continue;
};
}
if (!($10_1 & 255)) {
break block20
}
$14_1 = $8_1 & 255;
$4_1 = 0;
while (1) {
if (($4_1 | 0) == ($14_1 | 0)) {
break block20
}
block21 : {
if (HEAPU8[$4_1 + 3088 | 0] != 2) {
break block21
}
$1_1 = HEAP32[770];
$0_1 = HEAPU8[($1_1 + $4_1 | 0) + 562 | 0];
$1_1 = ($0_1 + $1_1 | 0) + 96 | 0;
HEAP8[$1_1 | 0] = HEAPU8[$1_1 | 0] + 1;
$1_1 = $0_1 << 24 >> 24;
$1_1 = ((($1_1 | 0) <= 5 ? 5 : $1_1) >>> 0) / 6 | 0;
$2_1 = HEAP32[770];
$3_1 = $0_1 + $2_1 | 0;
block22 : {
if (HEAPU8[$3_1 + 96 | 0] != 14) {
break block22
}
$11_1 = Math_imul(HEAPU8[HEAPU8[$3_1 + 288 | 0] + 1648 | 0], Math_imul(HEAPU8[$3_1 + 240 | 0], HEAPU8[$3_1 + 192 | 0])) & 65535;
$13(Math_imul($11_1, 100));
$2_1 = HEAP32[770];
$3_1 = HEAPU8[($0_1 + $2_1 | 0) + 192 | 0];
if ($3_1 >>> 0 > HEAPU8[$2_1 + 377 | 0]) {
HEAP8[$2_1 + 377 | 0] = $3_1
}
$5_1 = $1_1 << 4;
$7_1 = $0_1 + Math_imul($1_1, -6) | 0;
$9_1 = ($7_1 << 4) + 16 | 0;
$3_1 = HEAPU8[$2_1 + 407 | 0];
if (($3_1 | 0) == 12) {
$3_1 = $2_1 + 559 | 0
} else {
HEAP8[($2_1 + $3_1 | 0) + 408 | 0] = $1_1;
$2_1 = HEAP32[770];
HEAP8[(HEAPU8[$2_1 + 407 | 0] + $2_1 | 0) + 420 | 0] = $7_1;
$2_1 = HEAP32[770];
HEAP8[(HEAPU8[$2_1 + 407 | 0] + $2_1 | 0) + 432 | 0] = 0;
$2_1 = HEAP32[770];
$3_1 = $2_1 + 407 | 0;
}
HEAP8[$3_1 | 0] = HEAPU8[$3_1 | 0] + 1;
$2_1 = $0_1 + $2_1 | 0;
$3_1 = HEAPU8[$2_1 + 240 | 0];
$14($9_1 & 255, ($5_1 | 12) & 255, HEAPU8[$2_1 + 288 | 0] ? 2 : $3_1 >>> 0 > 1, $3_1, $11_1);
HEAP8[HEAP32[770] + 386 | 0] = 8;
$11(8, 0);
$2_1 = HEAP32[770];
if (HEAPU8[($0_1 + $2_1 | 0) + 288 | 0]) {
$11(9, 0);
$2_1 = HEAP32[770];
}
if (HEAPU8[$0_1 + $2_1 | 0] != 3) {
$2_1 = -8;
while (1) {
if ($2_1) {
$3_1 = $12($1_1 + HEAPU8[$2_1 + 1688 | 0] << 24 >> 24, $7_1 + HEAPU8[$2_1 + 1696 | 0] << 24 >> 24);
block23 : {
if (($3_1 | 0) == 255) {
break block23
}
$3_1 = $3_1 + HEAP32[770] | 0;
if (HEAPU8[$3_1 | 0] != 6) {
break block23
}
$3_1 = $3_1 + 96 | 0;
if (HEAPU8[$3_1 | 0] != 255) {
break block23
}
HEAP8[$3_1 | 0] = 0;
$13(50);
}
$2_1 = $2_1 + 1 | 0;
continue;
}
break;
};
$2_1 = HEAP32[770];
break block22;
}
HEAP8[$2_1 + 402 | 0] = $5_1 + 16;
HEAP8[$2_1 + 401 | 0] = $9_1;
}
if (HEAPU8[($0_1 + $2_1 | 0) + 96 | 0] < 34) {
break block21
}
$10($0_1);
}
$4_1 = $4_1 + 1 | 0;
continue;
};
case 2:
break block3;
default:
break block2;
};
}
$1_1 = 144;
while (1) {
if (($1_1 | 0) != 192) {
$0_1 = $1_1 + $2_1 | 0;
block24 : {
if (!HEAPU8[$0_1 - 144 | 0]) {
break block24
}
$4_1 = HEAPU8[$0_1 | 0];
if (!$4_1) {
break block24
}
$2_1 = $0_1;
$0_1 = $4_1 - 4 | 0;
HEAP8[$2_1 | 0] = $0_1 >>> 0 <= $4_1 >>> 0 ? $0_1 : 0;
$2_1 = HEAP32[770];
$3_1 = HEAPU8[$2_1 + $1_1 | 0] ? 1 : $3_1;
}
$1_1 = $1_1 + 1 | 0;
continue;
}
break;
};
if ($3_1 & 255) {
break block2
}
$11(5, 0);
$2_1 = HEAP32[770];
HEAP8[$2_1 + 378 | 0] = 1;
break block2;
}
block25 : {
if (!($13_1 & 255)) {
break block25
}
$3_1 = $8_1 & 255;
$2_1 = 0;
while (1) {
if (($2_1 | 0) == ($3_1 | 0)) {
break block25
}
block26 : {
if (HEAPU8[$2_1 + 3088 | 0] != 3) {
break block26
}
$1_1 = HEAP32[770];
$0_1 = HEAPU8[($1_1 + $2_1 | 0) + 562 | 0];
$4_1 = ($0_1 + $1_1 | 0) + 96 | 0;
$1_1 = HEAPU8[$4_1 | 0] + 1 | 0;
HEAP8[$4_1 | 0] = $1_1;
if (($1_1 & 255) >>> 0 < 18) {
break block26
}
$10($0_1);
}
$2_1 = $2_1 + 1 | 0;
continue;
};
}
$2_1 = HEAP32[770];
if (!(($6_1 | $10_1 | $13_1) & 255)) {
$0_1 = HEAPU8[$2_1 + 383 | 0] + 1 | 0;
HEAP8[$2_1 + 383 | 0] = $0_1;
if (($0_1 & 255) >>> 0 < 7) {
break block2
}
if (HEAPU8[$2_1 + 385 | 0]) {
HEAP8[$2_1 + 384 | 0] = HEAPU8[$2_1 + 384 | 0] + 1
}
HEAP8[$2_1 + 378 | 0] = 1;
HEAP8[$2_1 + 385 | 0] = 0;
break block2;
}
HEAP8[$2_1 + 383 | 0] = 0;
}
block27 : {
if (HEAPU8[$2_1 + 378 | 0] != 1) {
break block27
}
$10_1 = 0;
$8_1 = 0;
while (1) {
if (($8_1 & 255) >>> 0 <= 5) {
$3_1 = 0;
$4_1 = $8_1 + 42 | 0;
$6_1 = $4_1;
while (1) {
if (($3_1 & 255) >>> 0 <= 7) {
$1_1 = HEAP32[770];
$0_1 = $4_1 & 255;
$2_1 = HEAPU8[$1_1 + $0_1 | 0];
if ($2_1) {
$5_1 = $6_1 & 255;
if (($5_1 | 0) != ($0_1 | 0)) {
HEAP8[$1_1 + $5_1 | 0] = $2_1;
$1_1 = 0;
$2_1 = HEAP32[770] + 48 | 0;
HEAP8[$2_1 + $5_1 | 0] = HEAPU8[$0_1 + $2_1 | 0];
$2_1 = HEAP32[770] + 96 | 0;
HEAP8[$2_1 + $5_1 | 0] = HEAPU8[$0_1 + $2_1 | 0];
$2_1 = HEAP32[770] + 192 | 0;
HEAP8[$2_1 + $5_1 | 0] = HEAPU8[$0_1 + $2_1 | 0];
$2_1 = HEAP32[770] + 240 | 0;
HEAP8[$2_1 + $5_1 | 0] = HEAPU8[$0_1 + $2_1 | 0];
$2_1 = HEAP32[770] + 288 | 0;
HEAP8[$2_1 + $5_1 | 0] = HEAPU8[$0_1 + $2_1 | 0];
$2_1 = $6_1 - $4_1 | 0;
while (1) {
if ($2_1 & 255) {
$1_1 = $1_1 + 16 | 0;
$2_1 = $2_1 - 6 | 0;
continue;
}
break;
};
HEAP8[($5_1 + HEAP32[770] | 0) + 144 | 0] = $1_1;
$10($0_1);
$10_1 = 1;
}
$6_1 = $6_1 - 6 | 0;
}
$4_1 = $4_1 - 6 | 0;
$3_1 = $3_1 + 1 | 0;
continue;
}
break;
};
$8_1 = $8_1 + 1 | 0;
continue;
}
break;
};
$2_1 = 0;
$1_1 = HEAP32[770];
block28 : {
if (!$10_1) {
while (1) {
if (($2_1 | 0) == 48) {
break block28
}
$0_1 = $1_1 + $2_1 | 0;
if (!(HEAPU8[$0_1 | 0] == 1 & HEAPU8[$0_1 + 48 | 0] > 5)) {
$2_1 = $2_1 + 1 | 0;
continue;
}
break;
};
if (($2_1 | 0) == 48) {
break block28
}
$0_1 = 0;
while (1) {
if (($0_1 & 255) >>> 0 <= 5) {
$2_1 = 0;
while (1) {
$6_1 = $2_1 << 24 >> 24;
if (($6_1 | 0) <= 7) {
block30 : {
$3_1 = Math_imul($2_1, 6) + $0_1 & 255;
$4_1 = $3_1 + $1_1 | 0;
if (HEAPU8[$4_1 | 0] != 1) {
break block30
}
$8_1 = HEAPU8[$4_1 + 48 | 0];
if ($8_1 >>> 0 < 10) {
break block30
}
if (!$15($3_1)) {
break block30
}
$3_1 = $2_1;
while (1) {
block31 : {
$4_1 = $3_1;
if ($3_1 << 24 >> 24 > 6) {
$4_1 = 7;
break block31;
}
$3_1 = $4_1 + 1 << 24 >> 24;
if ($15($12($3_1, $0_1 << 24 >> 24))) {
continue
}
}
break;
};
$3_1 = $0_1 << 24 >> 24;
$5_1 = $16(10, $6_1, $3_1, 0);
$4_1 = $4_1 << 24 >> 24;
$10_1 = $16(10, $4_1, $3_1, 2);
$3_1 = $16(15, $6_1, $3_1, 0) + $16(15, $4_1, $3_1, 2) & 255;
$6_1 = $5_1 + $10_1 & 255;
$3_1 = $3_1 >>> 0 > $6_1 >>> 0 ? 10 : $3_1 >>> 0 < $6_1 >>> 0 ? 15 : $8_1;
while (1) {
if (($4_1 | 0) < $2_1 << 24 >> 24) {
break block30
}
$6_1 = ((Math_imul($2_1, 6) + $0_1 & 255) + $1_1 | 0) + 48 | 0;
if (($3_1 | 0) != HEAPU8[$6_1 | 0]) {
HEAP8[$6_1 | 0] = $3_1;
$1_1 = HEAP32[770];
HEAP8[$1_1 + 560 | 0] = HEAPU8[$1_1 + 560 | 0] + 1;
}
$2_1 = $2_1 + 1 | 0;
continue;
};
}
$2_1 = $2_1 + 1 | 0;
continue;
}
break;
};
$0_1 = $0_1 + 1 | 0;
continue;
}
break;
};
$6_1 = 0;
$4_1 = 0;
label18 : while (1) {
if (($6_1 & 255) >>> 0 > 7) {
break block28
}
$0_1 = 0;
while (1) {
block32 : {
if (($0_1 & 255) >>> 0 <= 5) {
$2_1 = $4_1 & 255;
$3_1 = $2_1 + $1_1 | 0;
if (HEAPU8[$3_1 | 0] != 1) {
break block32
}
$8_1 = $3_1 + 48 | 0;
$3_1 = HEAPU8[$8_1 | 0];
if ($3_1 >>> 0 < 6) {
break block32
}
if (!$17($2_1)) {
break block32
}
if ($15($2_1)) {
break block32
}
$5_1 = HEAPU8[$3_1 + 1712 | 0];
$2_1 = 0;
while (1) {
if (($2_1 | 0) == 4) {
break block32
}
block33 : {
if (!($5_1 & HEAPU8[$2_1 + 1696 | 0])) {
break block33
}
if (!$18($3_1, $6_1 << 24 >> 24, $0_1 << 24 >> 24, $2_1 & 255)) {
break block33
}
HEAP8[$8_1 | 0] = HEAPU8[$3_1 + 1728 | 0];
$1_1 = HEAP32[770];
HEAP8[$1_1 + 560 | 0] = HEAPU8[$1_1 + 560 | 0] + 1;
break block32;
}
$2_1 = $2_1 + 1 | 0;
continue;
};
}
$6_1 = $6_1 + 1 | 0;
continue label18;
}
$4_1 = $4_1 + 1 | 0;
$0_1 = $0_1 + 1 | 0;
continue;
};
};
}
HEAP8[$1_1 + 378 | 0] = 2;
break block27;
}
$5_1 = 0;
$8_1 = 0;
$4_1 = 0;
label21 : while (1) {
if (($4_1 & 255) >>> 0 <= 7) {
$1_1 = 0;
while (1) {
block34 : {
if (($1_1 & 255) >>> 0 <= 5) {
$3_1 = HEAP32[770];
$0_1 = $3_1 + ($5_1 & 255) | 0;
$6_1 = HEAPU8[$0_1 | 0];
if (($6_1 & 254) != 4) {
break block34
}
$10_1 = $0_1 + 96 | 0;
if (HEAPU8[$10_1 | 0] != 255) {
break block34
}
$2_1 = -4;
while (1) {
if (!$2_1) {
break block34
}
block35 : {
$0_1 = $12(HEAPU8[$2_1 + 1704 | 0] + $4_1 << 24 >> 24, HEAPU8[$2_1 + 1708 | 0] + $1_1 << 24 >> 24);
if (($0_1 | 0) == 255) {
break block35
}
$0_1 = $0_1 + $3_1 | 0;
if (HEAPU8[$0_1 + 96 | 0] != 255) {
break block35
}
block37 : {
block36 : {
switch (HEAPU8[$0_1 | 0] - 1 | 0) {
case 0:
break block36;
case 1:
case 2:
break block37;
default:
break block35;
};
}
if (($6_1 | 0) == 5) {
break block37
}
if (!(HEAPU8[$2_1 + 1712 | 0] & HEAPU8[HEAPU8[$0_1 + 48 | 0] + 1616 | 0])) {
break block35
}
}
HEAP8[$10_1 | 0] = 0;
$8_1 = 1;
break block34;
}
$2_1 = $2_1 + 1 | 0;
continue;
};
}
$4_1 = $4_1 + 1 | 0;
continue label21;
}
$5_1 = $5_1 + 1 | 0;
$1_1 = $1_1 + 1 | 0;
continue;
};
}
break;
};
$1_1 = HEAP32[770];
if ($8_1 & 255) {
HEAP8[$1_1 + 385 | 0] = 0;
HEAP8[$1_1 + 383 | 0] = 0;
$11(6, 0);
HEAP8[HEAP32[770] + 378 | 0] = 3;
break block27;
}
if (HEAPU8[$1_1 + 400 | 0]) {
$2_1 = 0;
while (1) {
block38 : {
if (($2_1 & 255) >>> 0 > 11) {
$2_1 = 12;
break block38;
}
$0_1 = HEAPU16[$1_1 + 392 >> 1];
if ($0_1 >>> 0 < 200) {
break block38
}
HEAP16[$1_1 + 392 >> 1] = $0_1 - 200;
$2_1 = $2_1 + 1 | 0;
continue;
}
break;
};
HEAP8[$1_1 + 400 | 0] = 0;
HEAP16[$1_1 + 392 >> 1] = 0;
HEAP8[$1_1 + 403 | 0] = HEAPU8[$1_1 + 403 | 0] + $2_1;
$14(HEAPU8[$1_1 + 401 | 0], HEAPU8[$1_1 + 402 | 0] + 6 & 255, 3, $2_1 & 255, 0);
$11(10, 0);
$1_1 = HEAP32[770];
}
HEAP32[$1_1 + 396 >> 2] = 0;
block39 : {
$5_1 = HEAPU8[$1_1 + 404 | 0];
if (!$5_1) {
break block39
}
$2_1 = 0;
while (1) {
if (($2_1 | 0) != 6) {
HEAP8[($12_1 + 10 | 0) + $2_1 | 0] = 0;
$2_1 = $2_1 + 1 | 0;
continue;
}
break;
};
HEAP8[$1_1 + 404 | 0] = 0;
$6_1 = 0;
$3_1 = 0;
while (1) {
if (!(!($5_1 & 255) | ($3_1 & 255) >>> 0 > 47)) {
$4_1 = HEAP32[770];
$0_1 = HEAPU8[$4_1 + 405 | 0];
HEAP8[$4_1 + 405 | 0] = ($0_1 + 1 >>> 0) % 6;
$2_1 = 7;
block40 : {
while (1) {
if ($2_1 << 24 >> 24 < 0) {
break block40
}
$1_1 = $0_1 + Math_imul($2_1, 6) & 255;
if (HEAPU8[$1_1 + $4_1 | 0]) {
$2_1 = $2_1 - 1 | 0;
continue;
}
break;
};
$10($1_1);
HEAP8[$1_1 + HEAP32[770] | 0] = 6;
$4_1 = $0_1 + ($12_1 + 10 | 0) | 0;
$0_1 = HEAPU8[$4_1 | 0];
HEAP8[$4_1 | 0] = $0_1 + 1;
HEAP8[($1_1 + HEAP32[770] | 0) + 144 | 0] = ($0_1 + $2_1 << 4) + 32;
$6_1 = $6_1 + 1 | 0;
$5_1 = $5_1 - 1 | 0;
}
$3_1 = $3_1 + 1 | 0;
continue;
}
break;
};
$0_1 = $6_1 & 255;
if (!$0_1) {
break block39
}
$14(56, 32, 4, $0_1, 0);
$11(11, 0);
$0_1 = HEAP32[770];
HEAP8[$0_1 + 386 | 0] = 6;
HEAP8[$0_1 + 378 | 0] = 2;
break block27;
}
$19();
}
$2_1 = 432;
$0_1 = 0;
while (1) {
$3_1 = $2_1 - 432 | 0;
$1_1 = HEAP32[770];
if ($3_1 >>> 0 < HEAPU8[$1_1 + 407 | 0]) {
$4_1 = $1_1 + $2_1 | 0;
$1_1 = HEAPU8[$4_1 | 0] + 1 | 0;
HEAP8[$4_1 | 0] = $1_1;
if (($1_1 & 255) >>> 0 <= 19) {
$1_1 = $0_1 & 255;
if (($1_1 | 0) != ($3_1 | 0)) {
$3_1 = HEAP32[770];
HEAP8[($3_1 + $1_1 | 0) + 408 | 0] = HEAPU8[($2_1 + $3_1 | 0) - 24 | 0];
$3_1 = HEAP32[770];
HEAP8[($3_1 + $1_1 | 0) + 420 | 0] = HEAPU8[($2_1 + $3_1 | 0) - 12 | 0];
$3_1 = $1_1;
$1_1 = HEAP32[770];
HEAP8[($3_1 + $1_1 | 0) + 432 | 0] = HEAPU8[$1_1 + $2_1 | 0];
}
$0_1 = $0_1 + 1 | 0;
}
$2_1 = $2_1 + 1 | 0;
continue;
}
break;
};
HEAP8[$1_1 + 407 | 0] = $0_1;
$0_1 = 494;
$2_1 = 0;
$4_1 = 0;
while (1) {
if ($2_1 >>> 0 < HEAPU8[$1_1 + 444 | 0]) {
$3_1 = ($1_1 + $2_1 | 0) + 469 | 0;
$1_1 = HEAPU8[$3_1 | 0] + 1 | 0;
HEAP8[$3_1 | 0] = $1_1;
if (($1_1 & 255) >>> 0 <= 59) {
$1_1 = $4_1 & 255;
if (($1_1 | 0) != ($2_1 | 0)) {
$3_1 = HEAP32[770];
HEAP8[($3_1 + $1_1 | 0) + 445 | 0] = HEAPU8[($2_1 + $3_1 | 0) + 445 | 0];
$3_1 = HEAP32[770];
HEAP8[($3_1 + $1_1 | 0) + 457 | 0] = HEAPU8[($2_1 + $3_1 | 0) + 457 | 0];
$3_1 = HEAP32[770];
HEAP8[($3_1 + $1_1 | 0) + 469 | 0] = HEAPU8[($2_1 + $3_1 | 0) + 469 | 0];
$3_1 = HEAP32[770];
HEAP8[($3_1 + $1_1 | 0) + 481 | 0] = HEAPU8[($2_1 + $3_1 | 0) + 481 | 0];
$3_1 = $1_1 << 1;
$1_1 = HEAP32[770];
$3_1 = $3_1 + $1_1 | 0;
$1_1 = $0_1 + $1_1 | 0;
HEAP16[$3_1 + 494 >> 1] = HEAPU16[$1_1 >> 1];
HEAP16[$3_1 + 518 >> 1] = HEAPU16[$1_1 + 24 >> 1];
}
$4_1 = $4_1 + 1 | 0;
}
$0_1 = $0_1 + 2 | 0;
$2_1 = $2_1 + 1 | 0;
$1_1 = HEAP32[770];
continue;
}
break;
};
HEAP8[$1_1 + 444 | 0] = $4_1;
$0_1 = HEAPU8[$1_1 + 386 | 0];
if (!$0_1) {
break block
}
HEAP8[$1_1 + 386 | 0] = $0_1 - 1;
}
global$0 = $12_1 + 16 | 0;
}
function $7($0_1) {
var $1_1 = 0;
$1_1 = HEAP32[770];
if (HEAPU8[$1_1 + 336 | 0] == 1) {
HEAP8[$1_1 + 337 | 0] = HEAPU8[HEAPU8[$1_1 + 337 | 0] + (($0_1 | 0) > 0 ? 1632 : 1664) | 0];
$11(2, 0);
}
}
function $8($0_1) {
var $1_1 = 0;
$1_1 = $0_1;
$0_1 = HEAP32[770];
$1_1 = $1_1 + HEAPU8[$0_1 + 338 | 0] << 24 >> 24;
if ($9($1_1, HEAPU8[$0_1 + 339 | 0])) {
HEAP8[$0_1 + 338 | 0] = $1_1;
$11(1, 0);
}
}
function $9($0_1, $1_1) {
var $2_1 = 0, $3_1 = 0, $4_1 = 0, $5_1 = 0;
block : {
if ($0_1 >>> 0 > 5 | $1_1 >>> 0 > 128) {
break block
}
$4_1 = $1_1 + 15 | 0;
block2 : {
block4 : {
block3 : {
block1 : {
if ($1_1 >>> 0 >= 16) {
$2_1 = HEAP32[770];
$3_1 = $0_1 - 6 | 0;
if (!HEAPU8[$2_1 + ($3_1 + Math_imul($1_1 >>> 4 | 0, 6) & 255) | 0]) {
break block1
}
break block2;
}
$2_1 = HEAP32[770];
if (($4_1 & 255) >>> 0 < 16) {
break block3
}
$3_1 = $0_1 - 6 | 0;
}
if (HEAPU8[(Math_imul(($4_1 & 240) >>> 4 | 0, 6) + $3_1 & 255) + $2_1 | 0]) {
break block
}
if ($1_1 >>> 0 > 15) {
break block4
}
}
if (HEAPU8[$0_1 + $2_1 | 0]) {
break block2
}
}
$5_1 = 1;
}
return $5_1;
}
return 0;
}
function $10($0_1) {
HEAP8[HEAP32[770] + $0_1 | 0] = 0;
HEAP8[(HEAP32[770] + $0_1 | 0) + 48 | 0] = 0;
HEAP8[(HEAP32[770] + $0_1 | 0) + 96 | 0] = 255;
HEAP8[(HEAP32[770] + $0_1 | 0) + 144 | 0] = 0;
HEAP8[(HEAP32[770] + $0_1 | 0) + 192 | 0] = 0;
HEAP8[(HEAP32[770] + $0_1 | 0) + 240 | 0] = 0;
HEAP8[(HEAP32[770] + $0_1 | 0) + 288 | 0] = 0;
}
function $11($0_1, $1_1) {
var $2_1 = 0, $3_1 = 0;
$2_1 = HEAP32[770];
$3_1 = HEAPU8[$2_1 + 542 | 0];
if ($3_1 >>> 0 <= 7) {
HEAP8[($2_1 + $3_1 | 0) + 543 | 0] = $0_1;
$0_1 = HEAP32[770];
HEAP8[(HEAPU8[$0_1 + 542 | 0] + $0_1 | 0) + 551 | 0] = $1_1;
$0_1 = HEAP32[770];
HEAP8[$0_1 + 542 | 0] = HEAPU8[$0_1 + 542 | 0] + 1;
}
}
function $12($0_1, $1_1) {
var $2_1 = 0;
$2_1 = 255;
block : {
if ($0_1 >>> 0 > 7) {
break block
}
$2_1 = 255;
if ($1_1 >>> 0 > 5) {
break block
}
$0_1 = Math_imul($0_1, 6) + $1_1 | 0;
$2_1 = HEAPU8[HEAP32[770] + ($0_1 & 255) | 0] ? $0_1 : -1;
}
return $2_1 & 255;
}
function $13($0_1) {
var $1_1 = 0, $2_1 = 0;
$1_1 = HEAP32[770];
$2_1 = HEAP32[$1_1 + 368 >> 2] + $0_1 | 0;
HEAP32[$1_1 + 368 >> 2] = $2_1 >>> 0 >= 999999 ? 999999 : $2_1;
if (HEAPU8[$1_1 + 390 | 0]) {
HEAP32[$1_1 + 396 >> 2] = HEAP32[$1_1 + 396 >> 2] + $0_1;
$0_1 = HEAPU16[$1_1 + 392 >> 1] + ($0_1 << (HEAPU8[$1_1 + 400 | 0] != 0)) | 0;
HEAP16[$1_1 + 392 >> 1] = $0_1 >>> 0 >= 2400 ? 2400 : $0_1;
}
}
function $14($0_1, $1_1, $2_1, $3_1, $4_1) {
var $5_1 = 0, $6_1 = 0;
$6_1 = HEAP32[770];
$5_1 = HEAPU8[$6_1 + 444 | 0];
if (($5_1 | 0) == 12) {
HEAP8[$6_1 + 559 | 0] = HEAPU8[$6_1 + 559 | 0] + 1;
return;
}
HEAP8[($5_1 + $6_1 | 0) + 445 | 0] = $0_1;
HEAP8[(HEAP32[770] + $5_1 | 0) + 457 | 0] = $1_1;
HEAP8[(HEAP32[770] + $5_1 | 0) + 469 | 0] = 0;
HEAP8[(HEAP32[770] + $5_1 | 0) + 481 | 0] = $2_1;
$0_1 = HEAP32[770];
$1_1 = $0_1 + ($5_1 << 1) | 0;
HEAP16[$1_1 + 494 >> 1] = $3_1;
HEAP16[$1_1 + 518 >> 1] = $4_1;
HEAP8[$0_1 + 444 | 0] = HEAPU8[$0_1 + 444 | 0] + 1;
}
function $15($0_1) {
if (!$17($0_1)) {
return 0
}
$0_1 = HEAPU8[(HEAP32[770] + $0_1 | 0) + 48 | 0];
return ($0_1 | 0) == 10 | ($0_1 | 0) == 15;
}
function $16($0_1, $1_1, $2_1, $3_1) {
var $4_1 = 0;
$4_1 = $12(HEAPU8[$3_1 + 1700 | 0] + $1_1 << 24 >> 24, HEAPU8[$3_1 + 1704 | 0] + $2_1 << 24 >> 24);
if (!$18($0_1, $1_1, $2_1, $3_1)) {
return 0
}
if (!$17($4_1)) {
return 1
}
return !(HEAPU8[$3_1 + 1708 | 0] & HEAPU8[HEAPU8[(HEAP32[770] + $4_1 | 0) + 48 | 0] + 1712 | 0]);
}
function $17($0_1) {
var $1_1 = 0;
block : {
if (($0_1 | 0) == 255) {
break block
}
$0_1 = HEAP32[770] + $0_1 | 0;
if (HEAPU8[$0_1 | 0] != 1 | HEAPU8[$0_1 + 96 | 0] != 255) {
break block
}
$1_1 = HEAPU8[$0_1 + 48 | 0] - 6 >>> 0 < 10;
}
return $1_1;
}
function $18($0_1, $1_1, $2_1, $3_1) {
var $4_1 = 0;
block : {
if (!(HEAPU8[$3_1 + 1696 | 0] & HEAPU8[$0_1 + 1616 | 0])) {
break block
}
$1_1 = $12(HEAPU8[$3_1 + 1700 | 0] + $1_1 << 24 >> 24, HEAPU8[$3_1 + 1704 | 0] + $2_1 << 24 >> 24);
if (($1_1 | 0) == 255) {
break block
}
$1_1 = $1_1 + HEAP32[770] | 0;
if (HEAPU8[$1_1 | 0] != 1) {
break block
}
$1_1 = HEAPU8[$1_1 + 48 | 0];
if (!(HEAPU8[$3_1 + 1708 | 0] & HEAPU8[$1_1 + 1616 | 0])) {
break block
}
$4_1 = HEAPU8[(($0_1 << 2) + $3_1 | 0) + 1744 | 0] == HEAPU8[(HEAPU8[$3_1 + 1808 | 0] + ($1_1 << 2) | 0) + 1744 | 0];
}
return $4_1;
}
function $19() {
var $0_1 = 0;
$0_1 = HEAP32[770];
if (HEAPU8[$0_1 + 2 | 0]) {
HEAP8[$0_1 + 336 | 0] = 0;
HEAP8[$0_1 + 379 | 0] = 1;
return;
}
HEAP16[$0_1 + 336 >> 1] = HEAPU8[$0_1 + 341 | 0] | HEAPU8[$0_1 + 342 | 0] << 8;
$21();
$0_1 = HEAP32[770];
HEAP16[$0_1 + 338 >> 1] = 2;
HEAP16[$0_1 + 388 >> 1] = 0;
HEAP8[$0_1 + 380 | 0] = 0;
HEAP8[$0_1 + 387 | 0] = 0;
HEAP8[$0_1 + 381 | 0] = 0;
HEAP8[$0_1 + 382 | 0] = 0;
HEAP8[$0_1 + 378 | 0] = 0;
HEAP8[$0_1 + 340 | 0] = HEAPU8[$0_1 + 340 | 0] + 1;
}
function $20($0_1, $1_1) {
$0_1 = $0_1 | 0;
$1_1 = $1_1 | 0;
var $2_1 = 0, $3_1 = 0;
$2_1 = HEAP32[770];
while (1) {
if (($3_1 | 0) == 612) {
$3_1 = 96;
while (1) {
$2_1 = HEAP32[770];
if (($3_1 | 0) != 144) {
HEAP8[$2_1 + $3_1 | 0] = 255;
$3_1 = $3_1 + 1 | 0;
continue;
}
break;
};
HEAP8[$2_1 + 378 | 0] = 0;
HEAP8[$2_1 + 374 | 0] = 1;
HEAP8[$2_1 + 390 | 0] = $1_1;
HEAP8[$2_1 + 405 | 0] = ($0_1 >>> 0) % 6;
HEAP16[$2_1 + 344 >> 1] = $0_1 ? Math_imul($0_1, -25033) : 1;
$21();
$19();
} else {
HEAP8[$2_1 + $3_1 | 0] = 0;
$3_1 = $3_1 + 1 | 0;
continue;
}
break;
};
}
function $21() {
var $0_1 = 0, $1_1 = 0, $2_1 = 0, $3_1 = 0, $4_1 = 0;
$1_1 = 255;
$0_1 = HEAP32[770];
$2_1 = HEAPU8[$0_1 + 363 | 0];
if (($2_1 | 0) != 255) {
$1_1 = $2_1 + 1 | 0;
HEAP8[$0_1 + 363 | 0] = $1_1;
}
$2_1 = HEAPU8[$0_1 + 364 | 0];
if (($2_1 | 0) == 255) {
$2_1 = 1
} else {
HEAP8[$0_1 + 364 | 0] = $2_1 + 1;
$2_1 = $2_1 >>> 0 > 11;
}
$3_1 = HEAPU8[$0_1 + 365 | 0];
if (($3_1 | 0) != 255) {
HEAP8[$0_1 + 365 | 0] = $3_1 + 1
}
HEAP8[$0_1 + 342 | 0] = 0;
block2 : {
block1 : {
block : {
if (($1_1 & 255) >>> 0 < 7) {
break block
}
if ($2_1) {
$1_1 = $22(16);
$0_1 = HEAP32[770];
if (!$1_1) {
break block1
}
$1_1 = HEAPU8[$0_1 + 363 | 0];
}
if (($1_1 & 255) >>> 0 < 9 | HEAPU8[$0_1 + 365 | 0] < 13) {
break block
}
$1_1 = $22(12);
$0_1 = HEAP32[770];
if ($1_1) {
break block
}
HEAP8[$0_1 + 341 | 0] = 5;
HEAP8[$0_1 + 365 | 0] = 0;
return;
}
$1_1 = HEAPU8[$0_1 + 362 | 0];
if ($1_1) {
break block2
}
$1_1 = HEAPU8[$0_1 + 390 | 0] ? 16 : 15;
HEAP8[$0_1 + 362 | 0] = $1_1;
$2_1 = 0;
while (1) if (($1_1 & 255) >>> 0 <= $2_1 >>> 0) {
while (1) {
$2_1 = $1_1 - 1 | 0;
$0_1 = $2_1 & 255;
if ($0_1) {
$1_1 = $22($1_1 & 255);
$3_1 = $0_1;
$0_1 = HEAP32[770] + 346 | 0;
$3_1 = $3_1 + $0_1 | 0;
$4_1 = HEAPU8[$3_1 | 0];
HEAP8[$3_1 | 0] = HEAPU8[$0_1 + $1_1 | 0];
HEAP8[($1_1 + HEAP32[770] | 0) + 346 | 0] = $4_1;
$1_1 = $2_1;
continue;
}
break;
};
$0_1 = HEAP32[770];
$1_1 = HEAPU8[$0_1 + 362 | 0];
break block2;
} else {
HEAP8[($0_1 + $2_1 | 0) + 346 | 0] = HEAPU8[$2_1 + 1824 | 0];
$2_1 = $2_1 + 1 | 0;
$0_1 = HEAP32[770];
$1_1 = HEAPU8[$0_1 + 362 | 0];
continue;
};
}
HEAP8[$0_1 + 341 | 0] = 6;
HEAP8[$0_1 + 364 | 0] = 0;
return;
}
$1_1 = $1_1 - 1 | 0;
HEAP8[$0_1 + 362 | 0] = $1_1;
block11 : {
block5 : {
block10 : {
block8 : {
block6 : {
block4 : {
block9 : {
block3 : {
block7 : {
$1_1 = HEAPU8[(($1_1 & 255) + $0_1 | 0) + 346 | 0];
switch ($1_1 - 83 | 0) {
case 0:
break block3;
case 1:
break block4;
case 2:
case 3:
case 4:
break block5;
case 5:
break block6;
default:
break block7;
};
}
switch ($1_1 - 66 | 0) {
case 0:
break block8;
case 1:
break block9;
default:
break block10;
};
}
HEAP8[$0_1 + 341 | 0] = 1;
$1_1 = $22(2);
HEAP8[HEAP32[770] + 342 | 0] = $1_1;
return;
}
HEAP8[$0_1 + 341 | 0] = 1;
$1_1 = $22(4);
HEAP8[HEAP32[770] + 342 | 0] = $1_1 + 2;
return;
}
HEAP8[$0_1 + 341 | 0] = 1;
$1_1 = $22(4);
HEAP8[HEAP32[770] + 342 | 0] = $1_1 + 6;
return;
}
HEAP8[$0_1 + 341 | 0] = 1;
HEAP8[$0_1 + 342 | 0] = 10;
return;
}
HEAP8[$0_1 + 341 | 0] = 2;
return;
}
if (($1_1 | 0) == 75) {
break block11
}
}
HEAP8[$0_1 + 341 | 0] = 4;
return;
}
HEAP8[$0_1 + 341 | 0] = 3;
}
function $22($0_1) {
var $1_1 = 0, $2_1 = 0, $3_1 = 0;
$2_1 = HEAP32[770];
$1_1 = HEAPU16[$2_1 + 344 >> 1];
$1_1 = $1_1 << 7 ^ $1_1;
$1_1 = ($1_1 & 65024) >>> 9 ^ $1_1;
$3_1 = $1_1 << 8 ^ $1_1;
HEAP16[$2_1 + 344 >> 1] = $3_1;
$2_1 = $0_1 - 1 | 0;
block : {
if (!($2_1 & $0_1)) {
$0_1 = $1_1 & $2_1;
break block;
}
$0_1 = (($3_1 & 65535) >>> 0) % ($0_1 >>> 0) | 0;
}
return $0_1 & 255;
}
function $23($0_1) {
$0_1 = $0_1 | 0;
var $1_1 = 0;
$1_1 = HEAP32[770];
HEAP8[$1_1 + 404 | 0] = HEAPU8[$1_1 + 404 | 0] + $0_1;
}
function $24() {
var $0_1 = 0, $1_1 = 0;
$0_1 = HEAP32[770];
$1_1 = HEAPU8[$0_1 + 403 | 0];
HEAP8[$0_1 + 403 | 0] = 0;
return $1_1 | 0;
}
function $25($0_1) {
$0_1 = $0_1 | 0;
HEAP8[3140] = 12;
$0_1 = Math_imul($0_1, 31) + 7 & 65535;
HEAP16[1568] = $0_1 >>> 0 <= 1 ? 1 : $0_1;
HEAP8[3138] = 0;
HEAP8[3139] = 0;
}
function $26() {
var $0_1 = 0, $1_1 = 0, $2_1 = 0, $3_1 = 0, $4_1 = 0, $5_1 = 0, $6_1 = 0, $7_1 = 0, $8_1 = 0, $9_1 = 0, $10_1 = 0, $11_1 = 0, $12_1 = 0, $13_1 = 0, $14_1 = 0, $15_1 = 0, $16_1 = 0, $17_1 = 0, $18_1 = 0, $19_1 = 0, $20_1 = 0, $21_1 = 0, $22_1 = 0;
block1 : {
$3_1 = HEAP32[770];
block : {
if (HEAPU8[$3_1 + 378 | 0]) {
break block
}
$9_1 = HEAPU8[$3_1 + 336 | 0];
if (!$9_1) {
break block
}
if (!HEAPU8[$3_1 + 379 | 0]) {
break block1
}
}
HEAP8[3138] = 0;
return 0;
}
block7 : {
block6 : {
block5 : {
block3 : {
block2 : {
if (!HEAPU8[3138]) {
$1_1 = HEAPU8[$3_1 + 340 | 0];
break block2;
}
$1_1 = HEAPU8[$3_1 + 340 | 0];
if (($1_1 | 0) == HEAPU8[3141]) {
break block3
}
}
HEAP8[3141] = $1_1;
HEAP8[3138] = 1;
HEAP8[3146] = 255;
$0_1 = HEAPU8[$3_1 + 374 | 0];
HEAP8[3139] = $0_1 >>> 0 >= 19 ? 20 : 57 - ($0_1 << 1) | 0;
HEAP8[3140] = $0_1 >>> 0 >= 32 ? 8 : 12 - ($0_1 >>> 3 | 0) | 0;
HEAP8[3142] = 0;
HEAP8[3143] = 0;
HEAP8[3144] = 0;
HEAP8[3145] = 0;
HEAP8[3147] = 0;
HEAP8[3148] = 0;
HEAP8[3149] = 0;
$0_1 = $3_1;
while (1) {
if (($5_1 | 0) != 6) {
$1_1 = 0;
$4_1 = $0_1;
$7_1 = $5_1 + 3150 | 0;
block4 : {
while (1) {
$2_1 = 8;
if (($1_1 | 0) == 8) {
break block4
}
if (!HEAPU8[$4_1 | 0]) {
$4_1 = $4_1 + 6 | 0;
$1_1 = $1_1 + 1 | 0;
continue;
}
break;
};
$2_1 = $1_1;
}
HEAP8[$7_1 | 0] = $2_1;
$2_1 = 8 - ($2_1 & 255) | 0;
if (($2_1 | 0) > ($8_1 & 255)) {
HEAP8[3148] = $2_1;
$8_1 = $2_1;
}
$0_1 = $0_1 + 1 | 0;
$5_1 = $5_1 + 1 | 0;
continue;
}
break;
};
$1_1 = 0;
$4_1 = 0;
while (1) {
if (($1_1 | 0) != 48) {
if ((HEAPU8[$1_1 + $3_1 | 0] & 254) == 4) {
$0_1 = $4_1 + 1 | 0;
HEAP8[3149] = $0_1;
HEAP8[($4_1 & 255) + 3168 | 0] = $1_1;
$4_1 = $0_1;
}
$1_1 = $1_1 + 1 | 0;
continue;
}
break;
};
if (($9_1 | 0) != 1) {
break block5
}
$1_1 = 0;
$0_1 = HEAPU8[$3_1 + 337 | 0];
$4_1 = $0_1;
while (1) {
HEAP8[($1_1 & 255) + 3217 | 0] = $4_1;
$1_1 = $1_1 + 1 | 0;
$4_1 = HEAPU8[($4_1 & 255) + 1632 | 0];
if (($0_1 | 0) != ($4_1 | 0)) {
continue
}
break;
};
HEAP8[3216] = $1_1;
break block6;
}
if (!HEAPU8[3144]) {
break block6
}
$0_1 = HEAPU8[3139];
if ($0_1) {
HEAP8[3139] = $0_1 - 1;
return 0;
}
HEAP8[3139] = HEAPU8[3140];
if (($9_1 | 0) == 1) {
$19_1 = 16;
if (HEAPU8[$3_1 + 337 | 0] != HEAPU8[3225]) {
break block7
}
}
$19_1 = 4;
$3_1 = HEAPU8[$3_1 + 338 | 0];
$2_1 = HEAPU8[3224];
if (($3_1 | 0) == ($2_1 | 0)) {
break block7
}
if (($3_1 | 0) == HEAPU8[3146]) {
$0_1 = HEAPU8[3147] + 1 | 0;
HEAP8[3147] = $0_1;
if (($0_1 & 255) >>> 0 > 1) {
break block7
}
}
HEAP8[3146] = $3_1;
$19_1 = $2_1 >>> 0 > $3_1 >>> 0 ? 2 : 1;
break block7;
}
HEAP8[3216] = 1;
HEAP8[3217] = 0;
}
while (1) {
if ($16_1 & 1 | ($21_1 & 255) >>> 0 > 1) {
break block7
}
$8_1 = HEAPU8[3143];
$0_1 = $8_1 + 1 | 0;
HEAP8[3143] = $0_1;
$6_1 = HEAPU8[3142];
$16_1 = 0;
block8 : {
if (HEAPU8[3216] != ($0_1 & 255)) {
break block8
}
$0_1 = $6_1 + 1 | 0;
HEAP8[3142] = $0_1;
HEAP8[3143] = 0;
$16_1 = 0;
if (($0_1 & 255) != 6) {
break block8
}
HEAP8[3144] = 1;
$16_1 = 1;
}
block11 : {
block9 : {
$5_1 = HEAP32[770];
$2_1 = HEAPU8[$5_1 + 338 | 0];
if (($2_1 | 0) == ($6_1 | 0)) {
break block9
}
$0_1 = Math_imul(HEAPU8[HEAP32[770] + 374 | 0], 18);
$5_1 = HEAP32[770];
$4_1 = (Math_imul(($0_1 >>> 0 >= 453 ? 453 : $0_1) + 59 | 0, HEAPU8[3139] + Math_imul(HEAPU8[3140] + 1 | 0, $8_1 + (($2_1 >>> 0 < $6_1 >>> 0 ? $6_1 - $2_1 | 0 : $2_1 - $6_1 | 0) & 255) | 0) | 0) >>> 12) + ((HEAPU8[$5_1 + 339 | 0] + 15 & 240) >>> 4) << 16 >> 16;
$10_1 = HEAPU8[$5_1 + 338 | 0];
$2_1 = $6_1 >>> 0 < $10_1 >>> 0 ? $10_1 : $6_1;
$3_1 = $6_1 >>> 0 > $10_1 >>> 0 ? $10_1 : $6_1;
$16_1 = HEAPU8[3144];
while (1) {
$0_1 = $3_1 & 255;
if ($0_1 >>> 0 > $2_1 >>> 0) {
break block9
}
block10 : {
if (($0_1 | 0) == ($10_1 | 0)) {
break block10
}
$1_1 = 0;
while (1) {
if (($1_1 | 0) > ($4_1 | 0) | $1_1 >>> 0 > 7) {
break block10
}
$0_1 = Math_imul($1_1, 6);
$1_1 = $1_1 + 1 | 0;
if (!HEAPU8[($0_1 + $3_1 & 255) + $5_1 | 0]) {
continue
}
break;
};
break block11;
}
$3_1 = $3_1 + 1 | 0;
continue;
};
}
$20_1 = HEAPU8[$8_1 + 3217 | 0];
$12_1 = HEAPU8[$6_1 + 3150 | 0] - 1 | 0;
block12 : {
if ($12_1 << 24 >> 24 < 0) {
$2_1 = 55537;
break block12;
}
$22_1 = HEAPU8[3148];
$8_1 = Math_imul($12_1, 6) + $6_1 | 0;
$10_1 = $8_1 & 255;
$17_1 = HEAPU8[$5_1 + 336 | 0];
HEAP8[$10_1 + $5_1 | 0] = $17_1;
HEAP8[($10_1 + HEAP32[770] | 0) + 48 | 0] = ($17_1 | 0) == 1 ? $20_1 : 0;
$0_1 = HEAPU16[1568];
$0_1 = $0_1 << 7 ^ $0_1;
$0_1 = ($0_1 & 65024) >>> 9 ^ $0_1;
$0_1 = $0_1 << 8 ^ $0_1;
HEAP16[1568] = $0_1;
$2_1 = $12_1 & 255;
$2_1 = (($6_1 | 0) == 2 ? ($2_1 >>> 0 < 3 ? Math_imul(3 - $2_1 | 0, -150) : 0) : 0) + Math_imul(7 - $2_1 | 0, -6) + (($0_1 & 65535) >>> 0) % 24 | 0;
block17 : {
block13 : {
$14_1 = HEAPU8[3149];
$13_1 = HEAP32[770];
$18_1 = $10_1 + $13_1 | 0;
if (!$14_1 & (HEAPU8[$18_1 | 0] & 254) != 4) {
break block13
}
$5_1 = 0;
$15_1 = 0;
while (1) {
block15 : {
block14 : {
$0_1 = $15_1 & 255;
if ($0_1 >>> 0 <= $14_1 >>> 0) {
if (($0_1 | 0) != ($14_1 | 0)) {
break block14
}
$3_1 = $10_1;
$4_1 = HEAPU8[$18_1 | 0];
$0_1 = $8_1;
if (($4_1 & 254) == 4) {
break block15
}
}
if (!($5_1 & 255)) {
break block13
}
$4_1 = 0;
$0_1 = 0;
$8_1 = 0;
label6 : while (1) {
if ($5_1 & 255) {
$5_1 = $5_1 - 1 | 0;
$11_1 = HEAPU8[($5_1 & 255) + 3280 | 0];
$18_1 = (($11_1 >>> 0 <= 5 ? 5 : $11_1) >>> 0) / 6 | 0;
$9_1 = Math_imul($18_1, -6);
$3_1 = 15;
$1_1 = $11_1 + $13_1 | 0;
$7_1 = HEAPU8[$1_1 | 0];
if (($7_1 & 254) != 4) {
$3_1 = HEAPU8[HEAPU8[$1_1 + 48 | 0] + 1616 | 0]
}
$11_1 = $9_1 + $11_1 | 0;
$1_1 = -4;
while (1) {
if (!$1_1) {
continue label6
}
block16 : {
if (!(HEAPU8[$1_1 + 1856 | 0] & $3_1)) {
break block16
}
$12_1 = $12($18_1 + HEAPU8[$1_1 + 1844 | 0] << 24 >> 24, $11_1 + HEAPU8[$1_1 + 1848 | 0] << 24 >> 24);
if (($12_1 | 0) == 255) {
break block16
}
$15_1 = $12_1 + 3232 | 0;
if (HEAPU8[$15_1 | 0]) {
break block16
}
$9_1 = $12_1 + $13_1 | 0;
$14_1 = HEAPU8[$9_1 | 0];
if (($14_1 | 0) == 1) {
if (($7_1 | 0) != 5) {
if (!(HEAPU8[$1_1 + 1852 | 0] & HEAPU8[HEAPU8[$9_1 + 48 | 0] + 1616 | 0])) {
break block16
}
}
HEAP8[$15_1 | 0] = 1;
HEAP8[($5_1 & 255) + 3280 | 0] = $12_1;
$5_1 = $5_1 + 1 | 0;
$4_1 = $4_1 + 1 | 0;
break block16;
}
if (($14_1 & 254) != 2) {
break block16
}
HEAP8[$15_1 | 0] = 1;
if (($14_1 | 0) == 3) {
$0_1 = $0_1 + 1 | 0;
break block16;
}
$8_1 = $8_1 + 1 | 0;
}
$1_1 = $1_1 + 1 | 0;
continue;
};
}
break;
};
$3_1 = $0_1 & 255;
$0_1 = $3_1 + ($8_1 & 255) | 0;
if ($0_1) {
$0_1 = Math_imul(Math_imul($0_1, $4_1 & 255), 45) + 30 | 0;
$2_1 = ($0_1 + ($3_1 ? (HEAPU16[$13_1 + 392 >> 1] >>> 2 | 0) + 80 | 0 : 0) | 0) + $2_1 | 0;
break block17;
}
$2_1 = (($22_1 >>> 0 <= 4 ? -50 : Math_imul($22_1, 25) - 150 | 0) + $2_1 | 0) + Math_imul($4_1 & 255, 10) | 0;
break block17;
}
$3_1 = HEAPU8[$0_1 + 3168 | 0];
$4_1 = HEAPU8[$13_1 + $3_1 | 0];
$0_1 = $3_1;
}
$1_1 = $0_1 & 255;
$7_1 = (($1_1 >>> 0 <= 5 ? 5 : $1_1) >>> 0) / 6 | 0;
$11_1 = Math_imul($7_1, -6) + $0_1 | 0;
$1_1 = -4;
$9_1 = ($4_1 & 255) == 5;
block18 : {
while (1) {
if (!$1_1) {
break block18
}
block21 : {
$4_1 = $12($7_1 + HEAPU8[$1_1 + 1844 | 0] << 24 >> 24, $11_1 + HEAPU8[$1_1 + 1848 | 0] << 24 >> 24);
block19 : {
if (($4_1 | 0) == 255) {
break block19
}
block20 : {
$4_1 = $4_1 + $13_1 | 0;
switch (HEAPU8[$4_1 | 0] - 1 | 0) {
case 0:
break block20;
case 1:
case 2:
break block21;
default:
break block19;
};
}
if (HEAPU8[$1_1 + 1852 | 0] & HEAPU8[HEAPU8[$4_1 + 48 | 0] + 1616 | 0] | $9_1) {
break block21
}
}
$1_1 = $1_1 + 1 | 0;
continue;
}
break;
};
block22 : {
$4_1 = $5_1 & 255;
if ($4_1) {
break block22
}
$1_1 = -48;
while (1) {
if (!$1_1) {
break block22
}
HEAP8[$1_1 + 3280 | 0] = 0;
$1_1 = $1_1 + 1 | 0;
continue;
};
}
HEAP8[$3_1 + 3232 | 0] = 1;
HEAP8[$4_1 + 3280 | 0] = $0_1;
$5_1 = $5_1 + 1 | 0;
}
$15_1 = $15_1 + 1 | 0;
continue;
};
}
$1_1 = -4;
$9_1 = $20_1 + 1616 | 0;
$8_1 = ($17_1 & 254) != 2;
while (1) {
if ($1_1) {
$5_1 = 0;
$3_1 = 0;
$0_1 = $12_1 + HEAPU8[$1_1 + 1844 | 0] | 0;
$11_1 = HEAPU8[$1_1 + 1848 | 0] + $6_1 << 24 >> 24;
$4_1 = ($0_1 & 255) >>> 0 < 8 & ($11_1 | 0) >= 0 & ($11_1 | 0) < 6;
$7_1 = 0;
block23 : {
if (!$4_1) {
break block23
}
$0_1 = $12($0_1 << 24 >> 24, $11_1);
$7_1 = 0;
if (($0_1 | 0) == 255) {
break block23
}
$0_1 = $0_1 + $13_1 | 0;
$5_1 = HEAPU8[$0_1 | 0];
$7_1 = 0;
if (($5_1 | 0) != 1) {
break block23
}
$3_1 = (HEAPU8[$1_1 + 1852 | 0] & HEAPU8[HEAPU8[$0_1 + 48 | 0] + 1616 | 0]) != 0;
$5_1 = 1;
$7_1 = 1;
}
block24 : {
if (($17_1 | 0) == 1) {
if (HEAPU8[$1_1 + 1856 | 0] & HEAPU8[$9_1 | 0]) {
$0_1 = $2_1 - 14 | 0;
if (!$4_1) {
break block24
}
$0_1 = $2_1 + 3 | 0;
if (!$5_1) {
break block24
}
$0_1 = ($3_1 ? 16 : -10) + $2_1 | 0;
if ($7_1) {
break block24
}
$0_1 = $2_1 + 18 | 0;
if (($5_1 & 254) == 2) {
break block24
}
$0_1 = ($5_1 | 0) == 6 ? $2_1 - 10 | 0 : $2_1;
break block24;
}
$0_1 = $3_1 ? $2_1 - 8 | 0 : $2_1;
break block24;
}
$0_1 = $3_1 ? $2_1 + 20 | 0 : $2_1;
if (!$8_1) {
break block24
}
$0_1 = ($17_1 | 0) == 6 ? ($3_1 ? $2_1 - 12 | 0 : $2_1) : $2_1;
}
$2_1 = $0_1;
$1_1 = $1_1 + 1 | 0;
continue;
}
break;
};
if (($17_1 | 0) != 6 | ($6_1 ? ($6_1 | 0) != 5 : 0)) {
break block17
}
$2_1 = $2_1 + 6 | 0;
}
HEAP8[$10_1 + $13_1 | 0] = 0;
HEAP8[($10_1 + HEAP32[770] | 0) + 48 | 0] = 0;
}
if (HEAP16[1611] >= $2_1 << 16 >> 16 ? HEAPU8[3145] : 0) {
break block11
}
HEAP8[3224] = $6_1;
HEAP8[3145] = 1;
HEAP8[3225] = $20_1;
HEAP16[1611] = $2_1;
}
$21_1 = $21_1 + 1 | 0;
continue;
};
}
return $19_1 | 0;
}
bufferView = HEAPU8;
initActiveSegments(imports);
function __wasm_memory_size() {
return buffer.byteLength / 65536 | 0;
}
function __wasm_memory_grow(pagesToAdd) {
pagesToAdd = pagesToAdd | 0;
var oldPages = __wasm_memory_size() | 0;
var newPages = oldPages + pagesToAdd | 0;
if ((oldPages < newPages) && (newPages < 65536)) {
var newBuffer = new ArrayBuffer(Math_imul(newPages, 65536));
var newHEAP8 = new Int8Array(newBuffer);
newHEAP8.set(HEAP8);
HEAP8 = new Int8Array(newBuffer);
HEAP16 = new Int16Array(newBuffer);
HEAP32 = new Int32Array(newBuffer);
HEAPU8 = new Uint8Array(newBuffer);
HEAPU16 = new Uint16Array(newBuffer);
HEAPU32 = new Uint32Array(newBuffer);
HEAPF32 = new Float32Array(newBuffer);
HEAPF64 = new Float64Array(newBuffer);
buffer = newBuffer;
bufferView = HEAPU8;
}
return oldPages;
}
return {
"memory": Object.create(Object.prototype, {
"grow": {
"value": __wasm_memory_grow
},
"buffer": {
"get": function () {
return buffer;
}
}
}),
"web_use": $0,
"web_game": $1,
"web_names": $2,
"web_layout": $3,
"web_const": $4,
"web_version": $5,
"tw_step": $6,
"tw_init": $20,
"tw_receive": $23,
"tw_take_outgoing": $24,
"tw_ai_init": $25,
"tw_ai_think": $26
};
}
var retasmFunc = asmFunc({
});
return retasmFunc;
})();
