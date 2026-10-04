# Pocket Arcade

A one-page console picker that links to five browser emulators:

* **Web Pokémon mini** (`../web-pokemini/`)
* **Web PocketStation** (`../web-pocketstation/`)
* **Web Brick** (`../web-brick/`): brick games and LCD handhelds
* **Web VMU** (`../web-vmu/`): the Dreamcast Visual Memory Unit
* **Web P/ECE** (`../web-piece/`): the Aquaplus P/ECE

It also lists one game that needs no files: **Tricky Wicks** (`tricky-wicks.html`), a falling-block puzzle kept in this repo as a single self-contained page. To update it, replace that file with a newer build.

Three more consoles live in this repo and run on [EmulatorJS](https://emulatorjs.org/), each on a page of its own:

* **Game Boy / Game Boy Color** (`gb/`), `.gb` and `.gbc` files
* **WonderSwan / WonderSwan Color** (`ws/`), `.ws` and `.wsc` files
* **Neo Geo Pocket / Color** (`ngp/`), `.ngp` and `.ngc` files

The picker itself is a single static file, `index.html`, with no build step and no dependencies.

## Game Boy, WonderSwan and Neo Geo Pocket

The other emulators here each have a core written for the job in a repo of their own. There is no such core for these three, so they use EmulatorJS with its `gambatte`, `mednafen_wswan` and `mednafen_ngp` cores. EmulatorJS and the cores are served from this site (`emulatorjs/`, see the README there for versions, licences and how to update); nothing is loaded from a CDN.

| | |
|---|---|
| `gb/`, `ws/`, `ngp/` | one small page per console: its name, file types and which EmulatorJS system it is |
| `play/player.js`, `play/player.css` | everything the three pages share: the list of games, starting EmulatorJS, the layout while playing |
| `emulatorjs/data/` | EmulatorJS 4.2.3 and the three cores, unmodified |
| `roms/gb/`, `roms/ws/`, `roms/ngp/` | games to list on the page (not published, see below) |
| `tests/` | a browser test and the tiny test ROMs it boots |

What a page does:

* **Open a game from this device** takes a `.gb`/`.gbc` (or `.ws`/`.wsc`, `.ngp`/`.ngc`) file, or a zip of one. It is kept in the browser's storage and listed under *On this device* from then on.
* **On this site** lists what is in `roms/<console>/`.
* While playing, the picture is drawn at a whole-number multiple of the console's resolution, in the screen's own pixels, as large as fits next to the touch controls. **Games** goes back to the list; the menu button (top right) has EmulatorJS's own menu: save and load state, export and import the save file, settings.
* **WonderSwan:** games that say they are played upright start that way, and **Rotate** switches by hand. The touch controls change with it, and the choice is remembered per game.
* Battery saves are written to the browser's storage every 30 seconds and whenever the page is hidden or left. Save states are kept there too, one per game. Clearing the site's data erases both.

### The `roms/` folders

`.gitignore` keeps `roms/` out of the repo, so nothing you put there is published: a public page must not hand out games you do not have the right to share. On your own computer, `bash run.sh` serves the site and the pages read the folders directly.

To publish games you may share (your own, or homebrew whose licence allows it): remove the `roms/` line from `.gitignore`, run `bash tools/roms-index.sh` to write the `index.json` lists (GitHub Pages cannot list a folder), and commit.

### Trying and testing

```bash
bash run.sh                          # http://localhost:8770/  (it also prints the address for a phone on the same Wi-Fi)
python3 tests/e2e.py                 # in another terminal; needs: pip install playwright pillow
```

The test boots a ROM on each console in a phone-sized window and checks the list, the touch controls, the scaling, rotation, and that saves and save states survive a reload. `tests/probes/` holds the ROMs it uses; none is a game.

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

GNU General Public License, version 3 or later (see `LICENSE`). EmulatorJS (GPL-3.0) and its cores (GPL-2.0) keep their own licences; see `emulatorjs/README.md`. Unofficial fan project; console names are trademarks of their owners.
