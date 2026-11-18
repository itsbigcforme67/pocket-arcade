# Device links

How Pocket Arcade could connect emulated devices to each other, to another phone, and to real hardware.
Examples: two Game Boys on a link cable, Pokémon Gold and a Pokémon Pikachu 2 GS over infrared, a Digimon
pet plugged into a WonderSwan, a VMU docked in a Dreamcast.

It has these parts: a survey of the real protocols and what the emulators can do, a design (a "device bus"),
what is built so far (`link/`), the interface other devices use to join an IR beam, the plan for Digimon pets,
a roadmap, and the licences involved.

Status, November 2026 (`link/`):

* **Two Game Boys joined by a link cable work** on one screen, in two tabs (BroadcastChannel), and on two
  phones (WebRTC, with codes carried by hand or by QR code; no server). Tricky Wicks' 2P LINK mode works
  end to end in all three; the tests check it.
* **Sound and save states** work.
* **The Game Boy Color IR port works** between two GBCs and between a GBC and a device written outside the
  SameBoy module, with timestamps in emulated microseconds (section 4). Tested with a homebrew test ROM.
* **The Digimon prong protocol** (dmcomm's "classic" V/X/Y signals) exists as JavaScript: packet encoder,
  decoder, DigiROM scripts, and a wire. No emulated pet is plugged into it yet (section 5).
* Nothing for real hardware yet.

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
2. **Two tabs on one device:** built as input netplay over `BroadcastChannel` (2.4, last option): each tab
   runs both Game Boys and the tabs swap buttons. The alternative, a `SharedWorker` that runs the cores while
   the tabs only draw, is not available in Safari on iOS before 16 and in some Android WebViews; netplay
   reuses the code of case 3 and works everywhere.
3. **Two phones:** built as input netplay over a WebRTC data channel, opt-in. Signalling is a code carried
   by hand (copy and paste, a link, or a QR code); no server of ours, and no third-party STUN server unless
   the player ticks a box. See 3.2.
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
  any fighting-game netplay. **For two-player link games this is the best network design, and it is what
  `link/` does** (delay-based, section 3.2).

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
| Game Boy / Color | gambatte in EmulatorJS | **Done:** SameBoy built to wasm (`link/`) with cable, IR, sound, save states and netplay. Next: a "two players" button on the gb/ page |
| GBA | mGBA in EmulatorJS | mGBA built to wasm without libretro, with a `GBASIODriver` that calls JS (MPL-2.0 allows this) |
| WonderSwan | beetle-wswan in EmulatorJS | Our own build of mednafen's wswan with its `comm` hooked to a `uart` port (GPL-2.0, so the build stays GPL), or a smaller core of our own |
| Neo Geo Pocket | beetle-ngp | The link code is a stub upstream; low priority |
| Pokémon mini | web-pokemini (our core) | Add an `optical` port to our core |
| PocketStation | web-pocketstation (our core) | `optical` port for IR. The PS1 side needs a PS1 emulator, out of scope; a "PC as PS1" uploader that writes save data to the PocketStation is in scope |
| VMU | web-vmu (our core) | `clocked-serial` port for VMU↔VMU. The Dreamcast side is out of scope, except a "dock" that copies saves |
| Digimon / Tamagotchi | web-brick (our core, E0C6200 family) | `pins` port on the pet's link pin(s); the protocol side is done (`link/dmcomm.js`). Plan in section 5 |
| Pikachu 2 GS | none | Needs its own ROM, which we cannot ship. Same rule as for games: the user brings it |

---


## 3. What is built: `link/`

| File | What it is |
|---|---|
| `link/index.html` | The page. **One screen:** two Game Boys, each with its own touch controls and keys, a **Cable in/out** switch, an **IR** switch (Game Boy Color games), a "face to face" layout for a phone lying flat between two players. **Two screens:** "Link two tabs" and "Link two phones" (3.2). Sound, **Save**/**Load** (one save state of both Game Boys per game), battery saves per Game Boy |
| `link/bus.js` | The device bus: `GameBoyHost`, `GameBoy`, `SerialPort`, `IrPort`, the optical port interface (`OpticalPort`, `Timeline`, `IrScriptDevice`, section 4), and the wires `linkCable(a, b)` and `irBeam(a, b)`. Works in a browser and in Node |
| `link/netplay.js` | Two-screen play: `Netplay` (input netplay with a fixed delay), `tabTransport()` (BroadcastChannel), `RtcLink` (WebRTC with hand-carried codes), `encodeSdp`/`decodeSdp` |
| `link/qr.js` | A small QR code maker of our own (byte mode, levels L and M, versions 1–40), for the WebRTC codes |
| `link/audio.js`, `link/audio-worklet.js` | Sound out through an AudioWorklet, with resampling when the device will not run at 48 kHz |
| `link/dmcomm.js` | The Digimon prong link (section 5): `encodePacket`, `PacketDecoder`, `parseDigirom`, `DigiromDevice`, `PinPort`, `prongs()` |
| `link/sameboy-link.wasm` | SameBoy's core plus `link/core/glue.c`, built with plain clang for `wasm32-wasi` (no Emscripten), 243 KB. Up to four Game Boys in one module, run interleaved by `pa_run_lockstep` (whichever is furthest behind goes next) |
| `link/core/` | `glue.c`; `build.sh`, which clones SameBoy at a fixed commit and builds it; `bootstubs.py`, which writes two tiny stand-in boot ROMs |
| `link/SAMEBOY-LICENSE` | SameBoy's licence (Expat/MIT) |

### 3.1 The core

How the cable works: when the Game Boy on internal clock shifts a bit out, SameBoy calls `serial_start`
and then `serial_end`. `bus.js` passes the call to the far `SerialPort`, which takes the slave's outgoing bit
(`pa_serial_get_bit`) and shifts ours in (`pa_serial_set_bit`). This is the wiring SameBoy's own two-player
libretro mode uses, but here the wire lives in JavaScript.

What `glue.c` adds to SameBoy, beyond the cable:

* **IR:** `bus.ir(i, on)` when a Game Boy Color's LED changes; `pa_ir_input` sets its sensor now and
  `pa_ir_at(i, clock, on)` queues a change for a set emulated time (a queue of 256 per Game Boy, applied
  between instructions). `pa_run_until(mask, clock)` runs Game Boys, interleaved, to a set time, which is how
  a `Timeline` drives them next to other devices. SameBoy models the sensor itself: it needs a warm-up after
  sensing is switched on, sees the Game Boy's own LED, and fades if the light stays on for a long time.
* **Sound:** every Game Boy fills its own buffer of 48 kHz 16-bit stereo samples (`pa_audio_*`); the page
  takes them after each frame and posts them to the AudioWorklet, mixing both Game Boys if asked. The
  worklet keeps about 60 ms queued and drops samples beyond 150 ms, so a page that runs ahead stays in time.
  Note for anyone changing `glue.c`: SameBoy asserts that a sample callback is set whenever a sample rate is,
  and a failed assert used to hang the page (libc retried a stderr write forever). `bus.js` now reports
  stderr through `onLog` and stops on `proc_exit`.
* **Save states:** SameBoy's own format (about 59 KB a Game Boy, battery RAM included). A host's state is
  every Game Boy's state plus the module's clock for each, so linked Game Boys line up again.
* **Determinism:** the start-up RAM is seeded per Game Boy (SameBoy randomises it), the libc clock reads 0,
  and the cartridge clock (MBC3 RTC) follows emulated time (`GB_RTC_MODE_ACCURATE`). Two copies of the module
  fed the same buttons on the same frames stay identical, which is what netplay needs. The cost: a game's
  real-time clock stops while the page is closed.
* **Test helper:** `pa_peek(i, addr)`.

**Boot ROMs:** Nintendo's boot ROMs are not ours to ship. SameBoy's own are MIT but need RGBDS to assemble,
and this environment could not build RGBDS. So `bootstubs.py` writes two stubs of ours. They set the registers
and I/O the way the real boot ROMs leave them, and unmap at `$0100`. The GBC stub also sets up
DMG-compatibility mode with grey palettes for original Game Boy games. The cost: no logo animation. A game
that checks registers the stubs do not set could behave differently. Swapping in SameBoy's real boot ROMs
later is a one-line change in `glue.c`.

### 3.2 Two screens

Both screens run **both** Game Boys in their own copy of the module. Only buttons cross over:

* Game Boy 1's side sends the state both start from (`start`: a save state of both Game Boys, so battery
  saves match too). The game file itself never crosses: the other side loads the same file. Tricky Wicks
  comes with the site; for anything else both players open the same file, and a SHA-256 of it is compared.
* Each frame, each side sends its buttons for `frame + delay` (a 9-bit word: eight keys, plus the cable
  state on Game Boy 1's side, so pulling the cable out happens on the same frame on both). A frame runs only
  when both sides' buttons for it are known; a side that falls behind runs an extra frame now and then.
* Every 120 frames each side sends a hash of both screens and clocks. If they ever differ, Game Boy 1's side
  sends its state again and both carry on from it ("out of step"). Messages carry the number of the start
  they belong to, so stragglers from before a restart are dropped.
* Delay: 2 frames between tabs, 5 between phones (83 ms; covers a round trip on most home Wi-Fi). There is no
  rollback yet.

**Two tabs:** both press "Link two tabs"; they find each other on a `BroadcastChannel` and the one with the
smaller random id is Game Boy 1. A third tab is ignored.

**Two phones (WebRTC):**

* The first phone makes an offer and shows it three ways: a QR code of a link to this page (`…/link/#j=CODE`),
  the code as text (Copy, and Share where the browser has it), and the link.
* The second phone opens the link (its camera app does this when scanning the QR code), or pastes the code,
  and shows its answer the same way (`#a=CODE`).
* The first phone takes the answer by pasting it, by scanning it in the page (Android Chrome has
  `BarcodeDetector`), or by scanning it with the camera app. The camera app opens the link in a new tab, and
  that tab hands the code to the first tab over a `BroadcastChannel`. This is what makes it work on iPhones,
  where pages cannot read QR codes.
* The codes are short (about 120 characters) because they hold only what the two browsers need: the ICE user
  name and password, the DTLS certificate fingerprint and the candidate addresses (an mDNS `uuid.local` name
  is written as 32 hex digits). `decodeSdp` rebuilds a full session description from them.
* No STUN server by default, so only addresses on the local network are offered: both phones must be on the
  same Wi-Fi, or one on the other's hotspot. A checkbox asks Google's public STUN server for the public
  address, which crosses most home routers. There is no TURN server, so some networks (symmetric NAT,
  carrier-grade NAT) will not connect.

### 3.3 Tests

* `node tests/link.mjs` (Playwright, Chromium, phone-sized): Tricky Wicks on two Game Boys, 2P LINK on
  both, START on one: about 115 bytes cross the cable, both Game Boys show the same playfield, the cable keeps
  talking during play, and neither says NO REPLY. Two fingers on the two players' pads at once each press
  their own Game Boy. Sound reaches the speaker (about 48 000 stereo samples a second, not silence). Save and
  Load. With the cable out, no bytes cross and the game says NO REPLY. No page errors, nothing fetched from
  another site.
* `node tests/link_net.mjs` (Playwright): two tabs, and two separate browser profiles over WebRTC (the
  joiner opens the `#j=` link, the answer goes back through a third tab opened from the `#a=` link). In both,
  Tricky Wicks' 2P LINK starts with each player pressing only their own buttons, more than 50 bytes cross the
  cable on both screens, both Game Boys show the same playfield, and both screens' copies are identical frame
  by frame. The second screen shows only Game Boy 2. Nothing is fetched from another site.
* `node tests/link_ir.mjs` (Node only): two GBCs on one beam count every pulse the other sends; a GBC and a
  JS device on a `Timeline` see each other's pulses, the GBC's measured to 0.1 µs of what its code should
  produce (249.9 µs on, 497.8 µs off); a save state loaded into a fresh host runs on identically.
* `node tests/link_dmcomm.mjs` (Node only): section 5.
* `tests/make_irtest.py` writes `tests/probes/irtest.gbc`, a 100-byte GBC program of ours: it counts light
  reaching its sensor at `$C000`, and sends bursts of 8 pulses while A is held.

**Not done yet:** rollback netplay; a link from the hub page or a "two players" button on `gb/`; real SameBoy
boot ROMs; any hardware end. The `gb/` page still runs gambatte.

## 4. Plugging in other devices: the optical (IR) port

The Pocket Pikachu Color (and later the Pokémon Pikachu 2 GS, a Pokémon mini, a PocketStation) will join a
Game Boy Color's IR beam from code that lives elsewhere: an emulator core in a private repository, loaded by
its own page, which imports `link/bus.js` from this site (or a copy of it). This is the contract.

### 4.1 The interface

Time is **emulated microseconds** (a float), counted from when the device was made. The `Timeline` keeps all
devices' clocks within one slice of each other, so "emulated time" is the same number on every device.

A **device** has:

| Member | What it does |
|---|---|
| `now()` | Its emulated time, µs |
| `runUntil(us)` | Run until its emulated time is at least `us`. Return anything (a Game Boy host returns which Game Boys finished a frame) |
| `ports.ir` | Its optical port |

An **optical port** has:

| Member | Who calls it | What it means |
|---|---|---|
| `light(on, us)` | The bus | Light reaching this device's sensor starts (`on = true`) or stops at emulated time `us`. A time the device has already passed applies at once; a time ahead of it must apply when the device gets there. `us` left out means now |
| `peers` | The bus fills it | Ports that see this device's LED |
| `emit(on, us)` | The device | Its LED turned on or off at emulated time `us` (inherited from `OpticalPort`; it calls `peer.light(on, us)` on every peer and `onLed`) |
| `onLed(on, us)` | Optional, anyone | A listener for logging, or for a bridge to real hardware |

Light is on/off only: no carrier. The Game Boy Color, the Pikachu 2 and the Pocket Pikachu Color send
unmodulated pulses. A device with a 38 kHz receiver (Tamagotchi Connection, probably) would demodulate in its
own port.

### 4.2 Timing

* The `Timeline` runs the device that is furthest behind first, in slices of `quantumUs` (default 8).
* An edge reaches a device that is behind its sender **at its exact time**; a device that is ahead sees it up
  to one slice late.
* With two devices that means: the one that runs second in a slice sees the first one's edges exactly, and
  the other way round they are up to 8 µs late. Mystery Gift's smallest feature is a 61 µs pulse and 0 and 1
  differ by 183 µs, so 8 µs is comfortable. Pass a smaller quantum if a protocol needs it; each slice costs
  one call into each device.
* Inside the SameBoy module the Game Boys still run in lockstep with each other (a Game Boy host is one
  device on the Timeline), and an IR beam between two Game Boys skips the Timeline: exact.
* A GBC timestamps its LED edges at the instruction that writes `RP`, so to within one instruction (≤ 6 µs).

### 4.3 Example: a Pocket Pikachu Color core

```js
import { GameBoyHost, Timeline, OpticalPort, irBeam } from 'https://YOU.github.io/pocket-arcade/link/bus.js';

class PikachuColor {                       // wraps a core that counts its own CPU cycles
  constructor(core, cyclesPerSecond) {
    this.core = core; this.hz = cyclesPerSecond;
    const dev = this;
    this.ports = { ir: new (class extends OpticalPort {
      light(on, us) { dev.core.queueSensor(on, us === undefined ? dev.core.cycles : us * dev.hz / 1e6); }
    })() };
    core.onLed = (on, cycle) => this.ports.ir.emit(on, cycle * 1e6 / this.hz);   // LED out, with its cycle
  }
  now() { return this.core.cycles * 1e6 / this.hz; }
  runUntil(us) { this.core.runTo(us * this.hz / 1e6); }   // and apply queued sensor changes on the way
}

const host = await GameBoyHost.load('…/link/sameboy-link.wasm');
const gbc = host.add({ color: true });
gbc.loadRom(romTheUserOpened);             // never a ROM from the site
const pika = new PikachuColor(core, 4_000_000);
const tl = new Timeline({ quantumUs: 8 });
tl.add(host); tl.add(pika);
irBeam(gbc, pika);
function frame() { tl.run(16742, (r) => { if (r[0]) draw(gbc.screen()); }); requestAnimationFrame(frame); }
```

What the core must provide: a cycle counter, a callback when the LED changes (with the cycle), a way to
queue a sensor change for a future cycle, and `runTo(cycle)`. `IrScriptDevice` in `bus.js` is a complete
device in 30 lines and the place to start; `tests/link_ir.mjs` shows one on a Timeline with a GBC.

Two more ends fit the same port without changes: a **recorder/replayer** (`IrScriptDevice` with a script),
and later a **hardware bridge** (section 2.5): `onLed` collects edges for the dongle to replay, and what the
dongle records comes back through `light(on, us)` with times on the emulated clock.

What stays out of this repository: the Pocket Pikachu Color and Pikachu 2 GS ROMs, recordings of their IR
traffic, and Pokémon game ROMs. A page that uses them asks the user for the files.

### 4.4 Checking it against Mystery Gift

Once the private core runs: a Pocket Pikachu Color sends watts to Pokémon Gold/Silver/Crystal through Mystery
Gift (section 1.3). That exercises every part of the contract: the GBC's handshake retries, 61 µs pulses, and
the receiver timing off-edge to off-edge. `onLed` on both ports gives a trace to compare with the timings in
1.3.

## 5. Digimon pets: the prong link plan

### 5.1 What exists

`link/dmcomm.js` speaks the "classic" protocol of the 1997–2000s Digimon pets, following dmcomm (MIT), the
Arduino/Pico firmware that the Digimon community uses to talk to real pets:

* **The wire:** `PinPort` and `prongs(...)`: one open-drain line, active while any device drives it (wired OR),
  with every change timestamped in emulated µs. A device calls `ports.pins.drive(active, us)`; the wire calls
  `ports.pins.onLine(active, us)` on everyone. Same Timeline as section 4.
* **Packets:** `encodePacket(type, bits)` gives the edges of one 16-bit packet for prong type V (2-prong:
  Digital Monster, Pendulum, D-3…), X (3-prong) or Y (Xros Mini), with dmcomm's send timings.
  `PacketDecoder` turns line edges back into packets, with dmcomm's accept windows.
* **DigiROMs:** `parseDigirom('V1-FC03-FD02')` reads dmcomm's text codes: type, turn (0 listen, 1 send
  first, 2 answer), packets, with `^` (copy or invert digits from the last packet received) and `@` (check
  digit). `DigiromDevice` runs one on the bus like a pet would, with the 100 ms reply timeout, and prints the
  result as dmcomm does (`s:FC03 r:0E59 s:FD02 r:0F49`, `t` for a timeout).
* **Tests** (`tests/link_dmcomm.mjs`): packets survive encoding and decoding for V, X and Y; two DigiROM
  devices on one wire hold a whole exchange; copy, invert and check digits come out as dmcomm computes them;
  alone, a sender times out.

These are dmcomm's numbers as written in its source. They have not been checked against a real pet here.

### 5.2 Steps

1. **A pin port in web-brick (the E0C6200-family core, its own repository).** The pet's prong goes to one
   I/O pin: an output it pulls low (R or P port) and an input it reads back (K or P port). Which bits, per
   model, is unverified: find them by logging the core's port writes while the pet starts a battle with
   nothing attached. The first thing it sends is a pre-active pulse of about 60 ms, easy to spot. Then:
   * a port write that changes the line calls `pins.drive(active, cycleToUs(cycle))`;
   * `pins.onLine(active, us)` queues the input bit for that time;
   * the core gets `now()` and `runUntil(us)`, as in 4.3.
   The E0C6200 runs from a 32.768 kHz crystal (OSC1) and, on most parts, a faster OSC3 the program can switch
   to; timestamps must follow whichever clock is running. That at 32 kHz an instruction takes 150 µs or more
   suggests the pets switch to OSC3 to talk, which the logging will show.
2. **An emulated pet against a script, in Node.** Pet (turn 2) ↔ `DigiromDevice('V1-…')` with a code the
   community has recorded for that model, and the reverse. Pass: the pet shows a battle and the script prints
   the pet's replies. No ROM in this repository: the test runs only where the user's ROM is present.
3. **Two emulated pets on one page.** Same as two Game Boys: both cores on one Timeline, `prongs(a, b)`.
4. **Two phones.** As for Game Boys: input netplay, each phone running both pets (the cores are deterministic
   given the same buttons). Packet-level relaying over the network would not work: a reply must start within
   100 ms of a packet ending, less than many round trips.
5. **A real pet through a dmcomm dongle (Web Serial or WebUSB, Android and desktop Chrome).** dmcomm takes a
   DigiROM over USB serial and prints the result line. Two modes:
   * *Scripted:* the page runs the emulated pet against `DigiromDevice` first to learn what it sends, then
     hands the dongle a DigiROM with those packets for the real pet. Works where the exchange does not depend
     on the other side's packets beyond what `^` and `@` can express.
   * *Live:* the dongle forwards each packet as it arrives and sends the next packet the page gives it. A USB
     round trip takes a few milliseconds, well inside the 100 ms reply window, so this works, but it needs a
     firmware mode that dmcomm may not have (unverified; check its current releases, else a small patch).
6. **Then:** D-3 to WonderSwan (section 1.2, unverified protocol), and the Tamagotchi Connection's IR on the
   optical port.

## 6. Roadmap

Done (November 2026): two Game Boys on one page; sound; save states; two tabs; two phones with hand-carried
codes; the optical port interface with µs timestamps; the dmcomm protocol layer.

Next, cheapest valuable step first:

1. **Finish `link/`:**
   * A card on the hub, or a "two players" button on the Tricky Wicks entry of `gb/`.
   * Rollback instead of fixed delay over WebRTC (SameBoy save states take about 0.1 ms; ten frames of
     rollback a frame is affordable).
   * Real SameBoy boot ROMs, built by `build.sh` when RGBDS is installed.
2. **Pocket Pikachu Color on the optical port** (private repository, section 4), checked against Mystery Gift.
3. **Digimon pets** (section 5): pin port in web-brick, then pet ↔ script, pet ↔ pet, then the dmcomm dongle.
4. **GB link dongle:** byte-exchange mode over WebUSB or Web Serial with an RP2040, building on
   gb-link-firmware or gblink.
5. **IR dongle:** RP2040 PIO or ESP32 RMT, record and replay of edge lists through `onLed` / `light()`.
   First target: GBC Mystery Gift against a real Gold/Silver/Crystal, then a real Pikachu 2 GS.
6. **Pokémon mini and PocketStation IR** on the optical port, in their own repos.
7. **GBA:** mGBA built to wasm with an SIO driver.
8. **WonderSwan:** mednafen wswan with `comm`, then the D-3 cable (needs the protocol worked out on real
   hardware first).
9. **Headphone-jack IR experiment.**

## 7. Licences

| Piece | Licence | Notes |
|---|---|---|
| Pocket Arcade (`link/`, `bus.js`, `netplay.js`, `qr.js`, `dmcomm.js`, `glue.c`, `bootstubs.py`, tests, `irtest.gbc`) | GPL-3.0-or-later | As the rest of the repo |
| SameBoy core (compiled into `sameboy-link.wasm`) | Expat (MIT) | Only `Core/` is used. The iOS and HexFiend folders, which carry an extra condition, are not used. Licence kept as `link/SAMEBOY-LICENSE` |
| wasi-libc (linked in) | Apache-2.0 WITH LLVM-exception / MIT / CC0 parts | Permissive. Compatible with GPL-3.0 |
| dmcomm (reference for `dmcomm.js`) | MIT | `dmcomm.js` is a rewrite in JavaScript, not a copy; it follows dmcomm's timings and text-code format so the two agree. Credited in the file |
| QR code standard (`qr.js`) | – | Written from the standard as explained by Project Nayuki; no code copied |
| mGBA (future) | MPL-2.0 | File-level copyleft, compatible with GPL-3.0 |
| mednafen / beetle cores (future) | GPL-2.0-or-later (most files) | Fine inside a GPL-3.0 site if the files say "or later"; check each file |
| gb-link-firmware / gblink (future) | GPL / MIT | Runs on the dongle, not in the site |
| GBE+ | GPL-2.0 | Reference only; its recorded IR databases are dumps of commercial devices, so not for this public site |

Third parties: the pages fetch nothing from other sites. The one exception is opt-in: ticking the STUN box on
"Link two phones" sends a request to `stun.l.google.com`.

Not on the public site, ever: boot ROMs, BIOS files, game ROMs, or the Pikachu 2 GS / Pocket Pikachu Color ROMs
or their IR recordings. Users bring their own, and the pages keep them in the browser.
