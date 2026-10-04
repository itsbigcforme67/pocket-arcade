/* Game Boy screen, pass 1 of 2: the dots as they look on the panel.
 *
 * Ported for Pocket Arcade from brickboy-dmg-shader (https://github.com/kathoc/brickboy-dmg-shader),
 * itself a port of the display pipeline of the brickboy emulator. Copyright the brickboy and
 * brickboy-dmg-shader authors; licensed under the Apache License, Version 2.0 (see LICENSE-APACHE-2.0.txt).
 *
 * Changes from the original: this one pass holds grid.slang and finish.slang, rewritten from slang to
 * GLSL ES 1.00 for RetroArch's "gl" driver in a browser. The dot field fills the whole picture: the
 * original also draws the bare reflector and the printed border around it, which would stop the dots
 * landing on whole screen pixels here. The reflector's grain is worked out in the shader (two layers of
 * fine noise, without the original's broad bands) instead of read from a baked texture. The "aged panel"
 * pass (defects.slang) is left out; it does nothing at the original's default settings. The numbers are
 * the original's defaults (its dmg.json profile).
 *
 * What it does: draws each pixel as a dot with a gap around it that shows the light reflector, lays the
 * shadow the dark dots cast on the reflector behind them (the light comes from the upper left), then the
 * grain of the reflector sheet, a slight unevenness of brightness and darker corners.
 */

#if defined(VERTEX)

attribute vec4 VertexCoord;
attribute vec4 TexCoord;
uniform mat4 MVPMatrix;
varying vec2 vTex;

void main()
{
    gl_Position = MVPMatrix * VertexCoord;
    vTex = TexCoord.xy;
}

#elif defined(FRAGMENT)

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D Texture;            /* pass 0: one colour per dot */
uniform vec2 TextureSize;
uniform vec2 InputSize;               /* 160 x 144 */
uniform vec2 OutputSize;              /* the size shown, in screen pixels */
varying vec2 vTex;

const vec3 PANEL_BG = vec3(0.930, 0.850, 0.586);    /* the bare reflector */
const vec3 GAP = vec3(0.860, 0.811, 0.533);         /* between the dots: the lightest shade, not a dark line */
const vec3 DROP = vec3(0.397, 0.391, 0.222);        /* the shadow: a darker reflector, not black */

const float GRID_STRENGTH = 0.62;
const float DOT_FILL = 0.80;
const float UNLIT_ALPHA = 0.10;
const float GRID_CONTRAST = 0.95;
const float DROP_OFFSET = 1.35;       /* how far the shadow falls, in dots: the air gap */
const float DROP_BLUR = 0.85;
const float DROP_OPACITY = 0.34;
const float PAPER = 0.03;             /* grain of the reflector sheet */
const float PAPER_SCALE = 0.45;       /* its size, in dots */
const float SEED = 7.0;
const float GRADIENT = 0.08;          /* uneven brightness, lightest toward the upper left */
const float MATTE_GRAIN = 0.012;
const float VIGNETTE = 0.08;

float lumaOf(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

/* Smoothed noise between -0.5 and 0.5; p in lattice units. */
float vnoise(vec2 p, float seed)
{
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    vec2 s = vec2(seed * 17.0, seed * 59.0);
    float a = hash21(i + s), b = hash21(i + vec2(1.0, 0.0) + s);
    float c = hash21(i + vec2(0.0, 1.0) + s), d = hash21(i + vec2(1.0, 1.0) + s);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) - 0.5;
}

/* The colour of the dot that the point p (in dots, from the top left) lies in. */
vec3 dotAt(vec2 p) { return texture2D(Texture, (floor(p) + 0.5) / TextureSize).rgb; }

/* How dark the ink is at p: what would cast a shadow from there. Off the panel there is nothing. */
float inkAt(vec2 p)
{
    if (p.x < 0.0 || p.y < 0.0 || p.x >= InputSize.x || p.y >= InputSize.y) return 1.0 - lumaOf(PANEL_BG);
    return 1.0 - lumaOf(dotAt(p));
}
float casterDark(vec2 p, vec2 dir, float off, float blur)
{
    vec2 c = p + off * dir;
    return (inkAt(c) + inkAt(c + vec2(blur)) + inkAt(c - vec2(blur))
          + inkAt(c + vec2(blur, -blur)) + inkAt(c - vec2(blur, -blur))) * 0.2;
}

void main()
{
    vec2 uv = vTex * TextureSize / InputSize;       /* 0..1 across the picture, from the top left */
    vec2 cc = uv * InputSize;                       /* the same in dots */
    vec3 base = dotAt(cc);

    /* The dot fills DOT_FILL of its square; its edge is never narrower than one screen pixel. */
    vec2 cell = fract(cc);
    vec2 fw = InputSize / OutputSize + 1e-4;
    float margin = clamp((1.0 - DOT_FILL) * 0.5 + 0.10, 0.0, 0.42);
    vec2 e = max(vec2(margin), fw);
    vec2 m = smoothstep(vec2(0.0), e, cell) * smoothstep(vec2(0.0), e, 1.0 - cell);
    float body = m.x * m.y;

    vec3 gridded = mix(GAP, mix(PANEL_BG, base, 1.0 - UNLIT_ALPHA), body);
    gridded = (gridded - 0.5) * GRID_CONTRAST + 0.5;
    vec3 outc = mix(base, gridded, GRID_STRENGTH);

    /* The shadow of the dots up and to the left: a sharp one close by and a broad faint one further off. */
    const vec2 lightDir = vec2(-0.70710678, -0.70710678);
    float near = smoothstep(0.40, 0.75, casterDark(cc, lightDir, DROP_OFFSET, DROP_BLUR));
    float far = smoothstep(0.34, 0.80, casterDark(cc, lightDir, DROP_OFFSET * 2.4, max(DROP_BLUR, 0.25) * 2.6));
    float own = smoothstep(0.40, 0.75, 1.0 - lumaOf(outc));
    float amt = DROP_OPACITY * (1.0 - own) * clamp(near + 0.45 * far, 0.0, 1.0);
    outc = mix(outc, DROP, clamp(amt, 0.0, 1.0));

    /* Grain of the reflector: it scales the light coming back, so it shows on the light shades. */
    float g = (vnoise(cc / PAPER_SCALE, SEED) + vnoise(cc / (PAPER_SCALE * 1.7), SEED + 37.0)) * 0.5;
    g = clamp(2.5 * g * 0.81, -1.0, 1.0);
    outc *= 1.0 + PAPER * g;
    outc += PAPER * g * 0.33 * lumaOf(outc) * vec3(0.5, 0.0, -0.5);
    outc = clamp(outc, 0.0, 1.0);

    /* Finish: brightness a little uneven, darker corners, a trace of matte grain per screen pixel. */
    float prox = 1.0 - clamp(distance(uv, vec2(0.30, 0.28)), 0.0, 1.0);
    outc *= 1.0 + GRADIENT * (prox - 0.5) * 2.0;
    vec2 vc = uv - 0.5;
    outc *= 1.0 - VIGNETTE * dot(vc, vc) * 2.0;
    outc += (hash21(floor(uv * OutputSize)) - 0.5) * MATTE_GRAIN;

    gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}

#endif
