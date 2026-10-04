# Pocket Arcade

A one-page console picker that links to five browser emulators:

* **Web Pokémon mini** (`../web-pokemini/`)
* **Web PocketStation** (`../web-pocketstation/`)
* **Web Brick** (`../web-brick/`): brick games and LCD handhelds
* **Web VMU** (`../web-vmu/`): the Dreamcast Visual Memory Unit
* **Web P/ECE** (`../web-piece/`): the Aquaplus P/ECE

It also lists one game that needs no files: **Tricky Wicks** (`tricky-wicks.html`), a falling-block puzzle kept in this repo as a single self-contained page. To update it, replace that file with a newer build. Its Game Boy version is the free game on the Game Boy page (`free/gb/tricky-wicks.gb`, see "Free games" below).

**Minigames** (`minigames/`) are small touch-screen games written for this site, with `minigames/index.html` as their picker. Each game has a folder of its own so it can be added to a phone's home screen as its own app, like the emulators: `index.html` (the whole game), `manifest.webmanifest`, `sw.js` (an offline cache that only touches caches named `mg-<game>-*`), and its icons (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon.png`). Installed, a game opens full screen, works offline and hides its "‹ Minigames" link. To add a game, copy that set from `minigames/wanted/`, change the names and the cache prefix, and add a card to the picker. So far there is one:

* **Wanted!** (`minigames/wanted/`; the old `minigames/wanted.html` address redirects there): find the face on the poster in a moving crowd and tap it. A catch adds 5 seconds (up to 50), a wrong tap takes 10, and the round ends when the clock hits zero. Its rules, timing and movement are ported line by line from the "Wanted!" minigame of Super Mario 64 DS, as decompiled by [sm64ds-decomp](https://github.com/tangosdev/sm64ds-decomp) (`src/actors/dScMgLuigi_c.cpp` there). No art, sound or data from the game is used: the four faces are emoji (🫒 🚕 🎳 🐱 by default, in Mario, Luigi, Wario and Yoshi's places), and players can pick their own under **Faces** (look-alike emoji make it harder). Version 1.2 adds a **Hard** mode that is not in the original: six faces drawn at random from about 150 emoji every round, a clock that runs 1.5 times as fast, 15 seconds off for a wrong tap, and faces that move 1.5 times as fast. Normal and Hard keep separate best scores. The game's data tables (the board for each level, the speeds and who gets picked as wanted) are not in the decomp; the block marked ROM TABLES at the top of the script holds those numbers, read from overlay 6 of the European cartridge (ASMP). Only these numbers are copied, nothing else from the ROM.

Four more consoles live in this repo and run on [EmulatorJS](https://emulatorjs.org/), each on a page of its own:

* **Game Boy / Game Boy Color** (`gb/`), `.gb` and `.gbc` files
* **Game Boy Advance** (`gba/`), `.gba` files
* **WonderSwan / WonderSwan Color** (`ws/`), `.ws` and `.wsc` files
* **Neo Geo Pocket / Color** (`ngp/`), `.ngp` and `.ngc` files

The picker itself is a single static file, `index.html`, with no build step and no dependencies.

## Game Boy, Game Boy Advance, WonderSwan and Neo Geo Pocket

The other emulators here each have a core written for the job in a repo of their own. There is no such core for these four, so they use EmulatorJS with its `gambatte`, `mgba`, `mednafen_wswan` and `mednafen_ngp` cores. EmulatorJS and the cores are served from this site (`emulatorjs/`, see the README there for versions, licences and how to update); nothing is loaded from a CDN.

| | |
|---|---|
| `gb/`, `gba/`, `ws/`, `ngp/` | one small page per console: its name, file types and which EmulatorJS system it is |
| `play/player.js`, `play/player.css` | everything the four pages share: the list of games, starting EmulatorJS, the layout while playing |
| `play/shaders/` | "Game Boy screen", a shader that shows original Game Boy games as on the real LCD (see the README there) |
| `emulatorjs/data/` | EmulatorJS 4.2.3 and the four cores, unmodified |
| `free/gb/`, `free/gba/` | the free games that come with the Game Boy and Game Boy Advance pages (published, see below) |
| `roms/gb/`, `roms/gba/`, `roms/ws/`, `roms/ngp/` | games to list on the page (not published, see below) |
| `tests/` | a browser test and the tiny test ROMs it boots |

What a page does:

* **Open a game from this device** takes a `.gb`/`.gbc` (or `.gba`, `.ws`/`.wsc`, `.ngp`/`.ngc`) file, or a zip of one. It is kept in the browser's storage and listed under *On this device* from then on.
* **Free game** (Game Boy page) lists the games that come with the site, each with a line about it and a link to download the file.
* **On this site** lists what is in `roms/<console>/`.
* While playing, the picture is drawn at a whole-number multiple of the console's resolution, in the screen's own pixels, as large as fits next to the touch controls. **Games** goes back to the list; the menu button (top right) has EmulatorJS's own menu: save and load state, export and import the save file, settings.
* **Game Boy screen:** original Game Boy games can be shown as on the real panel: green-yellow shades, a dot grid with shadows, a slow-to-clear picture. It is off until chosen in the menu under Settings, Graphics Settings, Shaders, and is remembered per game. Not offered for Game Boy Color games.
* **Game Boy Advance:** mGBA's built-in BIOS is used, so no BIOS file is needed. The touch controls add L and R above the D-pad and the A/B buttons.
* **WonderSwan:** games that say they are played upright start that way, and **Rotate** switches by hand. The touch controls change with it, and the choice is remembered per game.
* Battery saves are written to the browser's storage every 30 seconds and whenever the page is hidden or left. Save states are kept there too, one per game. Clearing the site's data erases both.

### Free games (`free/`)

Games in `free/<console>/` are part of the published site. A console's page lists them in the `free` list of its `ARCADE_SYSTEM` block (file name, title and a line about the game), and they show under **Free game** with a download link. They are fetched from the site when played, not copied into the browser's list.

Only put a game here if it is yours to give away, or its licence allows it. So far there are two. **Tricky Wicks** for Game Boy (`free/gb/tricky-wicks.gb`), the same game as `tricky-wicks.html`, built from the Tricky Wicks project (`port/gb/` there). To update it, replace the file. Its best score is kept as a battery save like any other game's. Its 2P LINK mode needs two Game Boys and a link cable, so in the browser it answers NO REPLY.

**Two-Floor Dungeon** for Game Boy Advance (`free/gba/dungeon.gba`) is a tech demo from the GBA two-floor engine project (`rom-c/dungeon-c.gba` there): a dungeon on two floor heights, drawn with the two affine background layers and skewed sprites for the walls, with a player who walks, jumps onto platforms and goes over or under the bridges. It orbits by itself until a button is pressed. To update it, replace the file.

To add another: put the file in `free/<console>/`, add a line to the `free` list in that console's `index.html`, and commit.

### The `roms/` folders

`.gitignore` keeps `roms/` out of the repo, so nothing you put there is published: a public page must not hand out games you do not have the right to share. On your own computer, `bash run.sh` serves the site and the pages read the folders directly.

To publish a game you may share (your own, or homebrew whose licence allows it), put it in `free/` instead (above); that keeps `roms/` private. To publish a whole `roms/` folder: remove the `roms/` line from `.gitignore`, run `bash tools/roms-index.sh` to write the `index.json` lists (GitHub Pages cannot list a folder), and commit.

### Trying and testing

```bash
bash run.sh                          # http://localhost:8770/  (it also prints the address for a phone on the same Wi-Fi)
python3 tests/e2e.py                 # in another terminal; needs: pip install playwright pillow
```

The test boots a ROM on each console in a phone-sized window and checks the list, the touch controls, the scaling, rotation, and that saves and save states survive a reload. It also boots the free games: a round of Tricky Wicks, and the dungeon demo moving. `tests/probes/` holds the test ROMs it uses; none of those is a game.

## How the addresses fit together

GitHub Pages serves every public repo of an account under one address, so with the six repos published you get:

```
https://YOU.github.io/pocket-arcade/        this page
https://YOU.github.io/web-pokemini/         Pokémon mini
https://YOU.github.io/web-pocketstation/    PocketStation
https://YOU.github.io/web-brick/            brick games
https://YOU.github.io/web-vmu/              VMU
https://YOU.github.io/web-piece/            P/ECE
```

The cards link to `../web-pokemini/`, `../web-pocketstation/`, `../web-brick/`, `../web-vmu/` and `../web-piece/`, so they work without knowing your user name. If you rename an app's repo, change the matching `href` (and `data-repo`) in `index.html`.

Want the picker at the very top, `https://YOU.github.io/`? Name this repo `YOU.github.io` instead (`bash publish.sh YOU.github.io`). The links still work.

Each app remembers that you arrived from this page and shows **‹ All consoles** in its Settings.

## Visitor counter and comments

Both are optional and switched off until you fill in the `EXTRAS` block near the bottom of `index.html`. They only run on the site named in `host`, so a local copy or someone's fork never counts visits or posts comments as yours.

* **Visitor counter:** [GoatCounter](https://www.goatcounter.com/), which counts visits without cookies. Create a free account, pick a site name, and in its Settings switch on "Allow adding visitor counts on your website". Put the site name in `goatcounter`. The number on the page can be up to four hours behind, and visitors with an ad blocker may not see it or be counted.
* **Comments:** [giscus](https://giscus.app/), which keeps the comments in this repo's GitHub Discussions. Turn on Discussions in the repo's Settings, install the [giscus app](https://github.com/apps/giscus) for this repo, then enter the repo on giscus.app and choose the Announcements category. Copy the `data-repo-id` and `data-category-id` values it shows into `giscusRepoId` and `giscusCategoryId`. Visitors need a GitHub account to post; you moderate in the Discussions tab.

The comment box is only fetched when a visitor scrolls down to it. Neither service sees anyone's BIOS, games or saves.

## Publishing

`bash publish.sh` creates the public repo, pushes, and switches on GitHub Pages from the `main` branch (needs `git` and the GitHub CLI `gh`, logged in). Later changes: `git add -A && git commit -m "..." && git push`.

## Licence

GNU General Public License, version 3 or later (see `LICENSE`). EmulatorJS (GPL-3.0) and its cores (GPL-2.0; mGBA MPL-2.0) keep their own licences; see `emulatorjs/README.md`. The Game Boy screen shader is adapted from brickboy-dmg-shader (Apache-2.0); see `play/shaders/README.md`. Unofficial fan project; console names are trademarks of their owners.
