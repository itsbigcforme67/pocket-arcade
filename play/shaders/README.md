# Game Boy screen

A shader for the Game Boy page: the original Game Boy's reflective LCD. The four greys become the
panel's own green-yellow shades; each pixel is a dot with a light gap around it, casting a faint shadow
on the reflector behind; dark areas shade the rest of their column; and the picture is slow to clear,
so moving things leave a short trail.

While playing an original Game Boy game: menu (top right), **Settings**, **Graphics Settings**,
**Shaders**, **Game Boy screen**. EmulatorJS remembers the choice for each game. It is not offered for
Game Boy Color games (it would replace their colours with the four panel shades) or for zipped games
(the page cannot read the cartridge header inside a zip to tell which kind it is).

| File | |
|---|---|
| `dmg-screen.glslp` | the preset: two passes |
| `dmg-cells.glsl` | pass 0, at 160x144: each dot's colour, crosstalk, slow response |
| `dmg-dots.glsl` | pass 1, at the size shown: dot grid, shadows, grain, finish |
| `LICENSE-APACHE-2.0.txt` | the licence of the original and of these files |

`play/player.js` fetches the three shader files when an original Game Boy game starts and hands them to
EmulatorJS as one more entry in its Shaders menu.

## Where it comes from

It is a cut-down port of **brickboy-dmg-shader** by kathoc
(<https://github.com/kathoc/brickboy-dmg-shader>, commit `befc4d7`), which is itself a port of the
display pipeline of the brickboy emulator. The maths and every number are theirs; the original's
`docs/display-pipeline` explains where the numbers come from and is worth reading. Licensed under the
Apache License, Version 2.0 (`LICENSE-APACHE-2.0.txt`), which may be combined with this site's GPL-3.0.

The original is six passes in RetroArch's slang format with floating-point buffers. EmulatorJS's
RetroArch runs on WebGL and loads only the older GLSL presets, so it could not be used as it is.

## What was changed

* **Rewritten from slang to GLSL ES 1.00**, with the settings fixed at the original's defaults (its
  `dmg.json` profile) instead of adjustable.
* **Two passes instead of six.** Crosstalk, colour and the slow response are one pass at the game's own
  160x144; grid, shadows, grain and finish are one pass at the size shown. In the original the slow
  response comes after the grid, at the size shown, in a floating-point buffer. Here it is kept per
  dot, before the grid, where an ordinary 8 bit buffer is enough and a phone has far less to draw.
* **No border.** The original also draws the bare reflector and the printed border around the dot
  field. That makes each dot 160/168 of a whole number of screen pixels; here the dots fill the picture
  and land exactly on screen pixels, which this site's whole-number scaling is for.
* **Grain worked out in the shader** (two layers of fine noise) instead of read from the original's
  baked texture (334 KB), without its broad bands.
* **No "aged panel" pass** (dead lines, rot, dust). It does nothing at the original's default settings.

## How close it is

Both were run on the same frames (the original's own test scene, with a moving sprite) at 7x, the
original with its border and grain switched off so the two can be compared pixel for pixel:

* still picture: mean difference 0.17 of 255 per colour value; 0.025% of values differ by more than 8
* moving picture: mean 0.18 of 255; the differences are in the trail behind the sprite, and at the
  top-left edge, where the original (without its border) lets edge dots cast shadows from outside
* grain on a flat light field: spread between dots 1.9% here, 2.0% in the original as shipped

In EmulatorJS it was checked with its WebGL 1 and WebGL 2 builds of the Gambatte core (identical
pictures). All of this was on a software renderer; how fast it runs on a given phone is not known.

## Changing it

The numbers at the top of each `.glsl` file are the original's parameters under the same names in
plain words (for example `GHOST_STRENGTH` is its `bb_ghost_strength`). To make the shader the default
for original Game Boy games, add `shader: 'Game Boy screen'` to `defaults` in `play()` in `player.js`
when `screenShader` found one.
