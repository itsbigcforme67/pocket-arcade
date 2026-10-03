# Pocket Arcade

A one-page console picker that links to three browser emulators:

* **Web Pokémon mini** (`../web-pokemini/`)
* **Web PocketStation** (`../web-pocketstation/`)
* **Web Brick** (`../web-brick/`): brick games and LCD handhelds

It is a single static file, `index.html`, with no build step and no dependencies.

## How the addresses fit together

GitHub Pages serves every public repo of an account under one address, so with the four repos published you get:

```
https://YOU.github.io/pocket-arcade/        this page
https://YOU.github.io/web-pokemini/         Pokémon mini
https://YOU.github.io/web-pocketstation/    PocketStation
https://YOU.github.io/web-brick/            brick games
```

The cards link to `../web-pokemini/`, `../web-pocketstation/` and `../web-brick/`, so they work without knowing your user name. If you rename an app's repo, change the matching `href` (and `data-repo`) in `index.html`.

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

GNU General Public License, version 3 or later (see `LICENSE`). Unofficial fan project; console names are trademarks of their owners.
