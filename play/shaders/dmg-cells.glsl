/* Game Boy screen, pass 0 of 2: the colour of each dot.
 *
 * Ported for Pocket Arcade from brickboy-dmg-shader (https://github.com/kathoc/brickboy-dmg-shader),
 * itself a port of the display pipeline of the brickboy emulator. Copyright the brickboy and
 * brickboy-dmg-shader authors; licensed under the Apache License, Version 2.0 (see LICENSE-APACHE-2.0.txt).
 *
 * Changes from the original: this one pass holds what were three (xtalk-field.slang, color-correct.slang
 * and ghost.slang), rewritten from slang to GLSL ES 1.00 for RetroArch's "gl" driver in a browser. It runs
 * at the game's own 160x144 instead of the size shown, so the slow response of the liquid crystal is kept
 * per dot, before the grid is drawn, and an ordinary 8 bit buffer is enough. The numbers are the
 * original's defaults (its dmg.json profile); settings that were at their neutral value are left out.
 *
 * What it does: finds which of the four shades each pixel is, gives it the panel's colour for that shade,
 * adds the smear between neighbours and the passive-matrix crosstalk (dark areas shading the rest of
 * their column and row), then lets the result follow slowly: quick to darken, slow to clear.
 */

#if defined(VERTEX)

attribute vec4 VertexCoord;
attribute vec4 TexCoord;
attribute vec4 FeedbackTexCoord;
uniform mat4 MVPMatrix;
varying vec2 vTex;
varying vec2 vFeedback;

void main()
{
    gl_Position = MVPMatrix * VertexCoord;
    vTex = TexCoord.xy;
    vFeedback = FeedbackTexCoord.xy;
}

#elif defined(FRAGMENT)

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D Texture;            /* the game's picture */
uniform sampler2D FeedbackTexture;    /* this pass's own output, one frame ago */
uniform vec2 TextureSize;
uniform vec2 InputSize;
varying vec2 vTex;
varying vec2 vFeedback;

/* the panel's colour for each shade, lightest to darkest, and the bare reflector behind it */
const vec3 SHADE0 = vec3(0.860, 0.811, 0.533);
const vec3 SHADE1 = vec3(0.550, 0.700, 0.400);
const vec3 SHADE2 = vec3(0.280, 0.510, 0.260);
const vec3 SHADE3 = vec3(0.130, 0.360, 0.170);
const vec3 PANEL_BG = vec3(0.930, 0.850, 0.586);

const float BRIGHTNESS = 0.88;
const float CONTRAST = 0.88;
const float BLEED = 0.16;             /* smear between neighbouring dots */
const float SATURATION = 0.85;
const float WARM = 0.06;
const float PANEL_GAMMA = 1.10;
const float BLACK_LIFT = 0.10;
const float DENSITY = 0.50;           /* the contrast wheel, at its middle */
const float OFF_TINT = 0.10;          /* the lightest shade never fully clears */
const float CROSSTALK = 0.34;
const float XTALK_SIGNED = 0.22;
const float XTALK_GRAY = 0.40;
const float XTALK_NOISE = 0.18;       /* each column's own strength: one console's fingerprint */
const float XTALK_EDGE = 0.40;
const float SEED = 7.0;

const float GHOST_STRENGTH = 0.52;
const float GHOST_GAMMA = 2.20;
const float GHOST_GATE = 0.05;
const float FRAME_MS = 16.742;        /* one Game Boy frame */

float lumaOf(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

/* How dark the pixel at column c.x, row c.y is: 0, 1/3, 2/3 or 1. Outside the picture counts as its edge. */
float darkAt(vec2 c)
{
    c = clamp(c, vec2(0.0), InputSize - 1.0);
    float l = lumaOf(texture2D(Texture, (c + 0.5) / TextureSize).rgb);
    return clamp(floor((1.0 - l) * 3.0 + 0.5) / 3.0, 0.0, 1.0);
}
vec3 shadeColor(float dark)
{
    if (dark < 0.17) return SHADE0;
    if (dark < 0.50) return SHADE1;
    if (dark < 0.83) return SHADE2;
    return SHADE3;
}

void main()
{
    vec2 cell = floor(vTex * TextureSize);
    float col = cell.x, row = cell.y;

    vec3 rgb = shadeColor(darkAt(cell));
    vec3 around = shadeColor(darkAt(cell + vec2(-1.0, 0.0))) + shadeColor(darkAt(cell + vec2(1.0, 0.0)))
                + shadeColor(darkAt(cell + vec2(0.0, -1.0))) + shadeColor(darkAt(cell + vec2(0.0, 1.0)));
    rgb = mix(rgb, around * 0.25, BLEED);

    float offW = smoothstep(0.5, 1.0, lumaOf(rgb));
    rgb = mix(rgb, SHADE3, OFF_TINT * DENSITY * offW);

    /* Crosstalk: the darkness of the pixels above (strongly) and below (weakly) in the same column,
       fading with distance, plus a weak share from the pixels to the left in the same row. */
    float vsum = 0.0, hsum = 0.0, d;
    for (int k = 1; k <= 40; k++) {
        float fk = float(k), w = exp(-fk / 12.0);
        if (row - fk >= 0.0) { d = darkAt(vec2(col, row - fk)); vsum += d * d * w; }
        if (row + fk < InputSize.y) { d = darkAt(vec2(col, row + fk)); vsum += 0.4 * d * d * w; }
    }
    vsum *= 1.0 - exp(-1.0 / 12.0);
    for (int k = 1; k <= 24; k++) {
        float fk = float(k);
        if (col - fk >= 0.0) { d = darkAt(vec2(col - fk, row)); hsum += d * d * exp(-fk / 8.0); }
    }
    hsum *= 1.0 - exp(-1.0 / 8.0);
    float field = vsum + 0.25 * hsum;
    field += XTALK_EDGE * abs(darkAt(vec2(col, row + 1.0)) - darkAt(vec2(col, row - 1.0)));
    field *= 1.0 + XTALK_NOISE * (hash21(vec2(col, SEED * 1.3 + 3.0)) - 0.5);
    field = max(field, 0.0);

    float amt = CROSSTALK * DENSITY * field;
    float midGray = 1.0 - abs(lumaOf(rgb) - 0.5) * 2.0;     /* shows most on a mid grey */
    amt *= mix(1.0, clamp(midGray, 0.0, 1.0), XTALK_GRAY);
    float darken = clamp(amt, 0.0, 0.65);
    rgb *= 1.0 - darken;
    rgb += XTALK_SIGNED * darken * (lumaOf(rgb) - 0.5);

    rgb = pow(max(rgb, 0.0), vec3(PANEL_GAMMA));
    float luma = lumaOf(rgb);
    rgb = mix(vec3(luma), rgb, SATURATION);
    rgb += WARM * luma * vec3(0.5, 0.15, -0.4);
    rgb = (rgb - 0.5) * CONTRAST + 0.5;
    rgb *= BRIGHTNESS;
    rgb = mix(rgb, PANEL_BG, BLACK_LIFT);
    vec3 target = clamp(rgb, 0.0, 1.0);

    /* The slow response. What was shown last frame moves toward the new colour: fast when it has to
       darken (the crystal is driven), slow when it has to clear (it relaxes on its own). Small
       differences settle at once, so a still picture stays sharp. */
    vec3 state = texture2D(FeedbackTexture, vFeedback).rgb;
    float tauRelax = 8.0 + 102.0 * GHOST_STRENGTH;
    float tauDrive = tauRelax * 0.35;
    vec3 darkening = step(target, state);
    vec3 a = 1.0 - exp(-vec3(FRAME_MS) / mix(vec3(tauRelax), vec3(tauDrive), darkening));
    float snap = 1.0 - smoothstep(0.0, GHOST_GATE, length(target - state));
    a = mix(a, vec3(1.0), snap);
    vec3 tg = pow(target, vec3(GHOST_GAMMA));
    vec3 st = pow(max(state, 0.0), vec3(GHOST_GAMMA));
    vec3 outc = pow(max(st + (tg - st) * a, 0.0), vec3(1.0 / GHOST_GAMMA));

    gl_FragColor = vec4(outc, 1.0);
}

#endif
