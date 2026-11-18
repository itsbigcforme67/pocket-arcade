# Device links

How Pocket Arcade could connect emulated devices to each other, to another phone, and to real hardware.
Examples: two Game Boys on a link cable, Pokémon Gold and a Pokémon Pikachu 2 GS over infrared, a Digimon
pet plugged into a WonderSwan, a VMU docked in a Dreamcast.

It has four parts: a survey of the real protocols and what the emulators can do, a proposed design (a "device
bus"), what is built so far (`link/`), and a roadmap with the licences involved.

Status, November 2026: **two Game Boys on one page, joined by a link cable, work** (`link/`). Tricky Wicks'
2P LINK mode connects there. The IR port is wired the same way but has had only a smoke test. Nothing else in
this document is built yet.

---

## 1. Survey

### 1.1 What EmulatorJS gives us: nothing for links

The `gb/`, `gba/`, `ws/` and `ngp/` pages run EmulatorJS 4.2.3 with libretro cores. None of them can link:

* **gambatte-libretro** has link-cable code (`gambatte_gb_link_mode`: network server or client, over TCP).
  It sits behind `HAVE_NETWORK`, which the Emscripten build leaves off, so it is not in our WebAssembly
  core. Even if it were, a browser cannot open TCP sockets.
  ([Makefile.libretro](https://github.com/libretro/gambatte-libretro/blob/master/Makefile.libretro),
  [core options](https://github.com/libretro/gambatte-libretro/blob/master/libgambatte/libretro/libretro_core_options.h))
* **mGBA's libretro frontend** has no SIO or lockstep code. Linking works only in mGBA's Qt app, between
  windows in one process.
* **beetle-wswan** only gained a serial-port stub in July 2026 (commit 0917378, "Backport serial port (comm)
  emulation"). Sent bytes complete at once and nothing is ever received. The 4.2.3 build predates even that.
* **beetle-ngp** stubs `system_comms_*` out.
* **EmulatorJS netplay** is off by default in 4.2.3: it needs `EJS_DEBUG_XX` and `EJS_EXPERIMENTAL_NETPLAY`.
  It syncs the controller inputs of a single game between peers. It does not join two consoles
  ([emulator.js v4.2.3](https://github.com/EmulatorJS/EmulatorJS/blob/v4.2.3/data/src/emulator.js)).

So every link needs a core we build ourselves, with its ports exposed to JavaScript. The sibling apps
(`web-pokemini`, `web-pocketstation`, `web-vmu`, `web-brick`) already run cores written for the job, so
adding ports there is our own code to change.

### 1.2 The pairings

| Link | Physical layer and protocol | Timing | Who drives | Open emulators with it | Licence |
|---|---|---|---|---|---|
| **Game Boy ↔ Game Boy** (cable) | Synchronous 8-bit shift, MSB first; SB `FF01`, SC `FF02` (bit 7 start, bit 0 clock source, bit 1 CGB fast clock) | 8192 Hz internal clock (122 µs a bit, about 1 KB/s); 16/262/524 kHz on GBC; the external clock can be anything up to about 500 kHz | The side set to internal clock; the other waits forever without a clock. Unplugged, the master reads `$FF` | **SameBoy**: bit-level callbacks, two Game Boys in its libretro core and Cocoa app. mGBA (GB lockstep, Qt only). GBE+ (SDL_net) | SameBoy MIT, mGBA MPL-2.0, GBE+ GPL-2.0 |
| **GBA ↔ GBA** (cable) | Normal 8/32-bit (SPI-like), Multiplayer (half-duplex UART-ish, up to 4), UART, JOY Bus | Multiplayer at 9600 to 115200 bps (5755 cycles a transfer at 115200 with 2 GBAs); Normal at 256 kHz or 2 MHz | Master (GBA 0) | **mGBA**: `GBASIODriver` and `src/gba/sio/lockstep.c`, threads in one process | MPL-2.0 |
| **GBC IR** (GBC ↔ GBC, Mystery Gift) | LED out and photodiode in, RP `FF56` (bit 0 LED, bit 1 light seen, bits 6–7 read enable). No standard protocol; each game bit-bangs its own | Software timed: the CPU polls RP and times edges with TIMA (see 1.3) | Each game decides | **SameBoy**: `GB_set_infrared_callback`, `GB_set_infrared_input`. GBE+ (records of devices) | MIT / GPL-2.0 |
| **Pokémon Pikachu 2 GS ↔ Gold/Silver/Crystal** | GBC IR, Mystery Gift protocol | As Mystery Gift (1.3) | The Pikachu 2 starts, the GBC answers | GBE+ replays a recorded pulse database (`GBC_POKEMON_PIKACHU_2`). The device itself is not emulated anywhere we know of | GPL-2.0 |
| **WonderSwan ↔ WonderSwan / Digimon pets** | EXT port, UART 8N1 at 3.3 V; data `$B1`, control `$B3` (bit 6: 9600 / 38400 bps); serial send and receive interrupts | 9600 or 38400 bps (1.04 ms or 260 µs a byte) | Either side (UART) | Mednafen upstream has `comm.cpp` with an external "WonderFence" bridge. beetle-wswan has only a stub | GPL-2.0 |
| **D-3 / D-Ark ↔ WonderSwan** (*Digimon Adventure 02: D1 Tamers* "D-3 Coliseum", *Digital Monster Ver. WonderSwan*) | A cable from the pet's port to the WonderSwan EXT port. *Digital Monster Ver. WonderSwan* shipped with an adapter for the original pets ([Wikimon](https://wikimon.net/Digimon_Link_System), [StrategyWiki](https://strategywiki.org/wiki/Digital_Monster_Ver._WonderSwan)) | Unverified: probably the pet's own pulse code, timed by WonderSwan software | Unverified | None | – |
| **Digimon pet ↔ pet** (DM, D-3, Pendulum…) | One open-drain wire plus ground (2-prong "V", 3-prong "X", Xros Mini "Y"). The two pets take turns sending 16-bit packets | V: start active 917 µs; bit 0 = 850 µs idle + 3167 µs active; bit 1 = 2667 µs idle + 1667 µs active; 100 ms reply timeout ([dmcomm](https://github.com/dmcomm/dmcomm-arduino-lib/blob/main/src/dmcomm_classic_communicator.cpp)) | The initiating pet | **dmcomm** (Arduino, real pets only). BrickEmuPy runs Digimon ROMs but has no link | dmcomm MIT, BrickEmuPy CC0 |
| **Tamagotchi ↔ Tamagotchi** | P1/P2 have no link. Connection (2004+) uses IR, "nearly NEC" ([Hackaday, 2026-01](https://hackaday.com/2026/01/10/reverse-engineering-the-tamagotchi-ir-connection)) | Millisecond-scale pulses; 38 kHz carrier unverified | The initiating pet | BrickEmuPy runs Connection v3 ROMs (marked error-prone), with no IR; TamaLIB (P1, GPL-2.0) has no link | – |
| **Pokémon mini ↔ Pokémon mini** | IR LED and sensor, bit-banged by the game. The exact I/O bits are unverified (GBE+ uses `$2060`/`$2061`) | Software timed | Each game decides | GBE+ links two instances over SDL_net. PokeMini has none | GPL-2.0 |
| **PocketStation ↔ PS1** | The memory-card slot: PS1 SIO0, SPI-like, about 250 kHz, command/answer frames as for any memory card, plus PocketStation commands | 250 kHz byte clock with ACK pulses | The PS1 | No open emulator links one; no$psx (closed) emulates the PocketStation | – |
| **PocketStation ↔ PocketStation** | IR LED (`IRDA_DATA 0C800004h`) and sensor (IRQ 12), bit-banged; long pulse about 2× short ([psx-spx](https://github.com/psx-spx/psx-spx.github.io/blob/master/docs/pocketstation.md)) | Software timed with timer 2 | Each game decides | None | – |
| **VMU ↔ Dreamcast** | Maple bus (two-wire, packet-based) | Unverified at about 2 Mbps | The Dreamcast | Flycast emulates the VMU as a Maple device. DreamPotato docks to Flycast | GPL-2.0 / MIT |
| **VMU ↔ VMU** | The VMU's own synchronous serial port (SIO0/SIO1 of the LC8670) through the connector | Software chosen | Either side | libevmu (ElysianVMU's core): VMU↔VMU over TCP, work in progress | MIT (reported) |

Items marked unverified could not be checked against a primary source in this session. The blocked sources
were GBATEK, the WSdev wiki and dmitry.gr. Check those items before building on them.

### 1.3 Mystery Gift and the Pocket Pikachu Color, in numbers

The Pocket Pikachu Color's IR code is a port of the Gold/Silver/Crystal Mystery Gift code. These timings come
from [pokecrystal `engine/link/mystery_gift.asm`](https://github.com/pret/pokecrystal/blob/master/engine/link/mystery_gift.asm):

* **Timer:** TAC = 65536 Hz.
  * The "fast" timer used for handshakes is TMA = −2, an interrupt every 2 ticks = **32768 Hz** (30.5 µs).
    The source comment says "every 3 increments", but the arithmetic gives 2. Measure this.
  * The receive timer runs freely at 65536 Hz.
* **Handshake:** LED off 61, on 5, off 21, on 5, off 5 (in fast-timer periods).
* **Data:**
  * Preamble: off 5, on 5, off 21.
  * TMA becomes −12, an interrupt every **183 µs**.
  * Each bit is sent MSB first. The LED turns on at the interrupt and off again 4 ticks later, a **61 µs pulse**.
    The cell is then one period for a 0 (**183 µs**) or two for a 1 (**366 µs**).
  * Trailer: on 5, off 17. A 16-bit additive checksum and a one-byte status follow.
  * The receiver times off-edge to off-edge. A gap of $12 ticks or more (about 275 µs) decodes as a 1.
* **Partner:** the Pikachu 2 is recognised by the first byte of its trainer data. The version constant in
  pokecrystal is `POKEMON_PIKACHU_2_VERSION EQU 3`. The partner type byte `$AC` is from the owner's notes on
  the Pikachu 2 GS code; it is not in pokecrystal.

What this means for the design: the smallest feature is a 61 µs pulse, and 0 and 1 differ by 183 µs.
Emulating both ends in one lockstep loop is easy. A real-world bridge must reproduce edges to about ±30 µs,
which rules out anything that passes through a JavaScript event loop in real time (section 2.5).

---

## 2. Design: the device bus

### 2.1 Ports and wires

Every emulated device exposes **ports**. A **wire** joins two ports of the same kind. The bus never knows
what a game means. It moves only what the hardware moves.

| Port kind | Carries | Devices |
|---|---|---|
| `clocked-serial` | One bit each way per clock edge, clocked by one side | GB/GBC link, GBA Normal mode, VMU SIO, PS1 memory-card slot (SPI-like) |
| `uart` | Bytes with a baud rate | WonderSwan EXT, GBA Multiplayer/UART |
| `optical` | LED on/off edges, timestamped; a sensor that sees light | GBC IR, Pikachu 2, Pokémon mini, PocketStation, Tamagotchi Connection |
| `pins` | Levels of one or more open-drain lines, timestamped | Digimon prongs, D-3 to WonderSwan |
| `packet` | Whole frames | Maple bus (VMU ↔ Dreamcast), when emulated at frame level |

A wire is a small object with the same interface whatever is at the other end. The other end can be a
device on the same page, a device in another tab, a device on another phone, or real hardware.

### 2.2 Time: lockstep or timestamps

There are two kinds of link, and they need different things.

* **Clocked links** (Game Boy cable, SPI-like slots): the slave's register shifts on the master's clock edge.
  The slave must answer within the same edge, a few microseconds. On one page this is easy: run both cores
  interleaved, instruction by instruction, and let the master's bit callback call straight into the slave.
  This is what `link/` does. Across a network, an edge cannot wait for a round trip, so we change the unit
  of exchange: whole bytes, with the slave's next byte predicted (see 2.4).
* **Timed links** (IR, pins, UART): edges or bytes carry **timestamps in emulated time**. The receiving
  core replays them at the same emulated time. A core may run ahead only as far as the slack of its partner
  allows. For two cores on one page that is one instruction. Across a network it is a lookahead window (2.4).

Today the EmulatorJS cores step a whole frame (16.7 ms) at a time. Both a GB serial bit (122 µs) and a
Mystery Gift IR cell (183 µs) are far smaller. **A link needs a core that runs in slices smaller than a
frame and calls out on port activity.** That is why `link/` uses its own SameBoy build, not gambatte from
EmulatorJS. The SameBoy loop costs about 1.7 ms a frame for one Game Boy and 3.3 ms for two in lockstep
(Node, this machine).

### 2.3 Locations

1. **One page:** several cores in one WebAssembly module (as in `link/`), or in one worker. Exact. This is
   the first target for every pairing whose two halves we can emulate.
2. **Two tabs on one device:** `BroadcastChannel` or a `SharedWorker`. Run the cores in one shared worker
   and the tabs only draw, and this becomes case 1. That is better than syncing two loops.
3. **Two phones:** WebRTC data channel, opt-in. Signalling through a QR code or a pasted code (no server
   of ours), or a small optional relay. The link runs at network latency, so the protocol layer of 2.4 is
   needed.
4. **Real hardware:** Web Serial or WebUSB to a microcontroller dongle, or Web Bluetooth. The dongle does
   the microsecond work. See 2.5.

### 2.4 Over a network: bytes, not bits

A 30–100 ms WebRTC round trip is hundreds of serial bits, so bit-level lockstep across phones would freeze
the games. Approaches, from simplest to most general:

* **Byte exchange with a guessed reply (Game Boy cable).** When the master starts a transfer, its core is
  paused until the slave's byte arrives (as in gambatte's `NetSerial`). Most games are turn-based over the
  link and tolerate this; Tetris-style games tolerate it at a lower frame rate.
* **Emulated-time lockstep with a window.** Each side sends `(emulated time, port events)` and may run up to
  W ms of emulated time ahead of the other's last report. A larger W gives smoother play but more lag on the
  link. This is what mGBA's `mLockstep` does between threads.
* **Input netplay instead** (both phones run both Game Boys and swap only buttons). This is deterministic
  and exact, because the link stays inside one module on each phone. It needs a rollback or delay scheme like
  any fighting-game netplay. **For two-player link games this is the best network design**, and `link/` is
  already built for it: both Game Boys sit in one deterministic module.

### 2.5 Real hardware

The browser cannot time microseconds. Its event loop, USB polling (1 ms) and Bluetooth intervals (7.5 ms or
more) are all too coarse. So the hardware dongle must:

* **GB link plug:** act as the remote Game Boy at bit level. The dongle answers the real Game Boy's clock
  edges itself, and exchanges whole bytes with the page over USB. Existing firmware does exactly this:
  stacksmashing's [gb-link-firmware](https://github.com/stacksmashing/gb-link-firmware) (RP2040, WebUSB, GPL)
  and [vaguilar/gblink](https://github.com/vaguilar/gblink) (USB UART, MIT). We would use the byte-exchange
  mode of 2.4.
* **IR (ESP32 or RP2040 with an IR LED and a photodiode, unmodulated):** the page sends a list of
  `(Δt µs, level)` edges recorded from the emulated LED. The dongle replays them with hardware timers (RP2040
  PIO or ESP32 RMT), records what it sees as the same kind of list, and sends that back. The emulated side then
  needs the partner's whole message before it can answer, which Mystery Gift's handshake allows (the GBC
  retries). This is a *record and replay* bridge, the same way GBE+ emulates the Pikachu 2.
* **Digimon prongs:** [dmcomm](https://github.com/dmcomm/dmcomm-project) (MIT) already turns the pulses into
  text codes over USB serial, such as `V1-FC03-FD02`. The emulated pet's pin port would produce and consume
  those codes. This is the cheapest real-hardware bridge, because the timing is in milliseconds.
* **Headphone-jack IR (experiment):**
  * How it works: at 48 kHz an audio buffer gives 20.8 µs steps. That is enough to *send* a Mystery Gift
    pulse train through an IR LED on the jack, since a 61 µs pulse is about 3 samples. Receiving would go
    through the microphone line, which is AC-coupled and filtered, so expect only rough edges.
  * Obstacles: phones without a jack need a USB-C audio adapter. Many adapters filter out-of-band audio.
    Output latency is unknown but constant, and a whole message is pre-rendered, so the latency does not
    matter.
  * Verdict: worth one evening with a scope. Do not rely on it.

Browser support for the hardware bridge:

* **Android Chrome:** WebUSB works. Web Serial arrived in Chrome 148 (beta in April 2026; stable status
  unverified).
* **iOS (every browser, all WebKit):** has none of Web Serial, WebUSB or Web Bluetooth. iPhone users would
  only get the audio-jack experiment or a networked dongle (ESP32 on Wi-Fi with a WebSocket, served from the
  dongle itself).

### 2.6 What we must build ourselves, per core

| Device | Core today | What a link needs |
|---|---|---|
| Game Boy / Color | gambatte in EmulatorJS | **Done for one page:** SameBoy built to wasm (`link/`). Next: sound, save states, and moving the gb/ page's cable mode onto it |
| GBA | mGBA in EmulatorJS | mGBA built to wasm without libretro, with a `GBASIODriver` that calls JS (MPL-2.0 allows this) |
| WonderSwan | beetle-wswan in EmulatorJS | Our own build of mednafen's wswan with its `comm` hooked to a `uart` port (GPL-2.0, so the build stays GPL), or a smaller core of our own |
| Neo Geo Pocket | beetle-ngp | The link code is a stub upstream; low priority |
| Pokémon mini | web-pokemini (our core) | Add an `optical` port to our core |
| PocketStation | web-pocketstation (our core) | `optical` port for IR. The PS1 side needs a PS1 emulator, out of scope; a "PC as PS1" uploader that writes save data to the PocketStation is in scope |
| VMU | web-vmu (our core) | `clocked-serial` port for VMU↔VMU. The Dreamcast side is out of scope, except a "dock" that copies saves |
| Digimon / Tamagotchi | web-brick (our core, E0C6200 family) | `pins` port on the pet's link pin(s), plus a dmcomm text-code adapter |
| Pikachu 2 GS | none | Needs its own ROM, which we cannot ship. Same rule as for games: the user brings it |

---

## 3. What is built: `link/`

| File | What it is |
|---|---|
| `link/index.html` | The page: two Game Boys on one screen, each with its own touch controls and keys, a **Cable in/out** switch and an **IR** switch (Game Boy Color games only). It has a "face to face" layout for a phone lying flat between two players. Battery saves are kept per Game Boy |
| `link/bus.js` | The device bus: `GameBoyHost`, `GameBoy`, `SerialPort`, `IrPort`, and the wires `linkCable(a, b)` and `irBeam(a, b)`. It works in a browser and in Node |
| `link/sameboy-link.wasm` | SameBoy's core plus `link/core/glue.c`, built with plain clang for `wasm32-wasi` (no Emscripten), 224 KB. Up to four Game Boys in one module, run interleaved by `pa_run_lockstep` (whichever is furthest behind goes next) |
| `link/core/` | `glue.c`; `build.sh`, which clones SameBoy at a fixed commit and builds it; `bootstubs.py`, which writes two tiny stand-in boot ROMs |
| `link/SAMEBOY-LICENSE` | SameBoy's licence (Expat/MIT) |
| `tests/link.mjs` | Browser test (Playwright, Chromium) |

How the cable works: when the Game Boy on internal clock shifts a bit out, SameBoy calls `serial_start`
and then `serial_end`. `bus.js` passes the call to the far `SerialPort`, which takes the slave's outgoing bit
(`pa_serial_get_bit`) and shifts ours in (`pa_serial_set_bit`). This is the wiring SameBoy's own two-player
libretro mode uses, but here the wire lives in JavaScript. That is where a remote end can be swapped in later.

**Boot ROMs:**
* Nintendo's boot ROMs are not ours to ship. SameBoy's own are MIT but need RGBDS to assemble, and this
  session could not build RGBDS.
* So `bootstubs.py` writes two stubs of ours. They set the registers and I/O the way the real boot ROMs leave
  them, and unmap at `$0100`. The GBC stub also sets up DMG-compatibility mode with grey palettes for
  original Game Boy games.
* The cost: no logo animation. A game that checks registers the stubs do not set could behave differently.
* Swapping in SameBoy's real boot ROMs later is a one-line change in `glue.c`.

**Tested:** `node tests/link.mjs` runs a phone-sized headless Chromium and checks:
* Tricky Wicks on two Game Boys, 2P LINK on both, START on one. About 115 bytes cross the cable, both
  Game Boys show the same playfield, the cable keeps talking during play, and neither says NO REPLY.
* With the cable pulled out, no bytes cross and the game says NO REPLY.
* There are no page errors, and nothing is fetched from another site.

The IR wire had a smoke test in Node only: a test program blinks the LED of one GBC, and the edges reach the
bus with their emulated timestamps. No game has used it yet.

**Not done yet:**
* Sound.
* Save states.
* Speed control: the page runs at real time and catches up by at most 4 frames.
* Network and hardware ends.
* No link from the hub page yet.
* The `gb/` page still runs gambatte.

---

## 4. Roadmap

Rough order, cheapest valuable step first:

1. **Finish `link/`:**
   * Sound: SameBoy's sample callback into an AudioWorklet, from one Game Boy or mixed.
   * Save states for both Game Boys.
   * A card on the hub, or a "two players" button on the Tricky Wicks entry of `gb/`.
   * Real SameBoy boot ROMs, built by `build.sh` when RGBDS is installed.
2. **Two phones, input netplay** (2.4, last option):
   * WebRTC with copy-paste or QR signalling.
   * Both phones run both Game Boys, and only buttons cross the network.
   * Delay-based first (3–4 frames), rollback later. SameBoy save states are fast enough.
3. **GBC IR between two Game Boy Color games on one page:** works in principle today. Test it with a
   homebrew IR test ROM written for the site, since we cannot ship a Pokémon game.
4. **dmcomm bridge for web-brick:** a `pins` port on the Digimon cores and Web Serial to a dmcomm
   Arduino/Pico. Millisecond timing, existing MIT firmware, and a real pet on the other end.
5. **GB link dongle:** byte-exchange mode over WebUSB or Web Serial with an RP2040, building on
   gb-link-firmware or gblink.
6. **IR dongle:** RP2040 PIO or ESP32 RMT, record and replay of edge lists. First target: GBC Mystery Gift
   against a real Gold/Silver/Crystal, then a real Pikachu 2 GS.
7. **Pokémon mini and PocketStation IR** between two instances on one page, in their own repos.
8. **GBA:** mGBA built to wasm with an SIO driver.
9. **WonderSwan:** mednafen wswan with `comm`, then the D-3 cable (needs the protocol worked out on real
   hardware first).
10. **Headphone-jack IR experiment.**

## 5. Licences

| Piece | Licence | Notes |
|---|---|---|
| Pocket Arcade (`link/`, `bus.js`, `glue.c`, `bootstubs.py`, tests) | GPL-3.0-or-later | As the rest of the repo |
| SameBoy core (compiled into `sameboy-link.wasm`) | Expat (MIT) | Only `Core/` is used. The iOS and HexFiend folders, which carry an extra condition, are not used. Licence kept as `link/SAMEBOY-LICENSE` |
| wasi-libc (linked in) | Apache-2.0 WITH LLVM-exception / MIT / CC0 parts | Permissive. Compatible with GPL-3.0 |
| mGBA (future) | MPL-2.0 | File-level copyleft, compatible with GPL-3.0 |
| mednafen / beetle cores (future) | GPL-2.0-or-later (most files) | Fine inside a GPL-3.0 site if the files say "or later"; check each file |
| dmcomm (future, firmware on the dongle) | MIT | – |
| gb-link-firmware / gblink (future) | GPL / MIT | Runs on the dongle, not in the site |
| GBE+ | GPL-2.0 | Reference only; its recorded IR databases are dumps of commercial devices, so not for this public site |

Not on the public site, ever: boot ROMs, BIOS files, game ROMs, or the Pikachu 2 GS ROM or its IR
recordings. Users bring their own, and the pages keep them in the browser.
