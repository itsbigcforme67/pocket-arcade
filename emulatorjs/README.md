# EmulatorJS, as used by Pocket Arcade

The Game Boy, Game Boy Advance, WonderSwan and Neo Geo Pocket pages (`gb/`, `gba/`, `ws/`, `ngp/`) run on
[EmulatorJS](https://emulatorjs.org/). Everything they need is in this folder and is served from
this site; nothing is loaded from EmulatorJS's CDN.

`data/` is the `data` folder of the **EmulatorJS 4.2.3** release
(<https://github.com/EmulatorJS/EmulatorJS/releases/tag/v4.2.3>), unmodified, with only the four
cores these pages use:

| Console | EmulatorJS system | Core | Core source | Core licence |
|---|---|---|---|---|
| Game Boy / Game Boy Color | `gb` | gambatte | <https://github.com/EmulatorJS/gambatte-libretro> | GPL-2.0 |
| Game Boy Advance | `gba` | mgba | <https://github.com/EmulatorJS/mgba> | MPL-2.0 |
| WonderSwan / WonderSwan Color | `ws` | mednafen_wswan | <https://github.com/EmulatorJS/beetle-wswan-libretro> | GPL-2.0 |
| Neo Geo Pocket / Color | `ngp` | mednafen_ngp | <https://github.com/EmulatorJS/beetle-ngp-libretro> | GPL-2.0 |

Each core comes in two builds: `<core>-legacy-wasm.data`, which EmulatorJS uses unless told
otherwise, and `<core>-wasm.data`, used when "WebGL2" is switched on in its settings. The threaded
builds are left out because they need server headers that GitHub Pages cannot send. Each `.data` file is a 7-zip archive holding the
compiled core, its `license.txt` and a `core.json` naming its source repository. The cores run
inside RetroArch (GPL-3.0, <https://github.com/EmulatorJS/RetroArch>), which is compiled into each one.

EmulatorJS itself is GPL-3.0 (`LICENSE` here). `data/src/` holds the readable source of
`data/emulator.min.js`.

## Updating

Download a newer release archive from the EmulatorJS releases page, replace `data/` with its `data`
folder, and delete every file in `data/cores/` except the eight `gambatte`, `mgba`, `mednafen_wswan`
and `mednafen_ngp` builds named above, the two READMEs and the `reports` folder (keeping only those
four reports). Then run `tests/e2e.py`: `play/player.js` adjusts a few things in EmulatorJS when
it starts (see the comments there), and a new version may need those looked at again.
