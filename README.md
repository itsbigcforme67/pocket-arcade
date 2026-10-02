# Pocket Arcade

A one-page console picker that links to two browser emulators:

* **Web Pokémon mini** (`../web-pokemini/`)
* **Web PocketStation** (`../web-pocketstation/`)

It is a single static file, `index.html`, with no build step and no dependencies.

## How the addresses fit together

GitHub Pages serves every public repo of an account under one address, so with the three repos published you get:

```
https://YOU.github.io/pocket-arcade/        this page
https://YOU.github.io/web-pokemini/         Pokémon mini
https://YOU.github.io/web-pocketstation/    PocketStation
```

The cards link to `../web-pokemini/` and `../web-pocketstation/`, so they work without knowing your user name. If you rename an app's repo, change the matching `href` (and `data-repo`) in `index.html`.

Want the picker at the very top, `https://YOU.github.io/`? Name this repo `YOU.github.io` instead (`bash publish.sh YOU.github.io`). The links still work.

Each app remembers that you arrived from this page and shows **‹ All consoles** in its Settings.

## Publishing

`bash publish.sh` creates the public repo, pushes, and switches on GitHub Pages from the `main` branch (needs `git` and the GitHub CLI `gh`, logged in). Later changes: `git add -A && git commit -m "..." && git push`.

## Licence

GNU General Public License, version 3 or later (see `LICENSE`). Unofficial fan project; console names are trademarks of their owners.
