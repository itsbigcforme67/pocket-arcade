/* Pocket Arcade link core: SameBoy (MIT, https://github.com/LIJI32/SameBoy) wrapped for the
 * device bus in ../bus.js. GPL-3.0-or-later (see ../../LICENSE); SameBoy keeps its own licence
 * (../SAMEBOY-LICENSE).
 *
 * One WebAssembly module holds up to four Game Boys. Each one exposes its ports to JavaScript:
 *   serial  - bus.serial_start(i, bit) when it clocks a bit out on its own clock,
 *             bus.serial_end(i) -> bit coming back; JS feeds an externally clocked GB with
 *             pa_serial_set_bit() and reads its outgoing bit with pa_serial_get_bit().
 *   IR      - bus.ir(i, on) when its LED changes, pa_ir_input(i, on) for its sensor (GBC).
 * pa_run_lockstep() runs several Game Boys interleaved, the one that is behind first, so two
 * linked machines never drift more than one instruction apart: what a cable needs.
 */
#include <stdlib.h>
#include <string.h>
#include "Core/gb.h"
#include "bootstubs.h"

#define EXPORT(name) __attribute__((export_name(#name)))
#define IMPORT(name) __attribute__((import_module("bus"), import_name(#name)))

IMPORT(serial_start) void js_serial_start(int i, int bit);
IMPORT(serial_end) int js_serial_end(int i);
IMPORT(ir) void js_ir(int i, int on);
IMPORT(log) void js_log(int i, const char *s);

#define MAX_GB 4
#define W 160
#define H 144

static GB_gameboy_t *gbs[MAX_GB];
static uint32_t *screens[MAX_GB];
static uint64_t clocks[MAX_GB];
static int vblanks[MAX_GB];
static uint8_t *roms[MAX_GB];

static int index_of(GB_gameboy_t *gb)
{
    for (int i = 0; i < MAX_GB; i++) if (gbs[i] == gb) return i;
    return 0;
}

static uint32_t rgb_encode(GB_gameboy_t *gb, uint8_t r, uint8_t g, uint8_t b)
{
    return 0xFF000000u | (b << 16) | (g << 8) | r;   /* RGBA bytes in memory, as canvas ImageData wants */
}

static void vblank(GB_gameboy_t *gb, GB_vblank_type_t type) { vblanks[index_of(gb)]++; }

static void boot_rom_load(GB_gameboy_t *gb, GB_boot_rom_t type)
{
    if (type >= GB_BOOT_ROM_CGB_0) GB_load_boot_rom_from_buffer(gb, boot_cgb, sizeof boot_cgb);
    else GB_load_boot_rom_from_buffer(gb, boot_dmg, sizeof boot_dmg);
}

static void log_cb(GB_gameboy_t *gb, const char *s, GB_log_attributes_t a) { js_log(index_of(gb), s); }

static void serial_start(GB_gameboy_t *gb, bool bit) { js_serial_start(index_of(gb), bit); }
static bool serial_end(GB_gameboy_t *gb) { return js_serial_end(index_of(gb)) != 0; }
static void infrared(GB_gameboy_t *gb, bool on) { js_ir(index_of(gb), on); }

/* Make Game Boy i. color: 0 = Game Boy (DMG), 1 = Game Boy Color. Returns its screen (160x144 RGBA). */
EXPORT(pa_create) uint32_t *pa_create(int i, int color)
{
    if (i < 0 || i >= MAX_GB) return 0;
    if (!gbs[i]) {
        gbs[i] = GB_alloc();
        GB_init(gbs[i], color ? GB_MODEL_CGB_E : GB_MODEL_DMG_B);
        screens[i] = calloc(W * H, 4);
    }
    else {
        GB_switch_model_and_reset(gbs[i], color ? GB_MODEL_CGB_E : GB_MODEL_DMG_B);
    }
    GB_gameboy_t *gb = gbs[i];
    GB_set_log_callback(gb, log_cb);
    GB_set_boot_rom_load_callback(gb, boot_rom_load);
    GB_set_pixels_output(gb, screens[i]);
    GB_set_rgb_encode_callback(gb, rgb_encode);
    GB_set_vblank_callback(gb, vblank);
    GB_set_palette(gb, &GB_PALETTE_GREY);
    GB_set_infrared_callback(gb, infrared);
    GB_reset(gb);
    clocks[i] = 0;
    return screens[i];
}

/* A buffer of `size` bytes for JS to copy a ROM (or a battery save) into. */
EXPORT(pa_alloc) uint8_t *pa_alloc(int size) { return malloc(size); }
EXPORT(pa_free) void pa_free(void *p) { free(p); }

EXPORT(pa_load_rom) void pa_load_rom(int i, uint8_t *data, int size)
{
    GB_load_rom_from_buffer(gbs[i], data, size);
    GB_reset(gbs[i]);
}

EXPORT(pa_save_size) int pa_save_size(int i) { return GB_save_battery_size(gbs[i]); }
EXPORT(pa_save) int pa_save(int i, uint8_t *buf, int size) { return GB_save_battery_to_buffer(gbs[i], buf, size); }
EXPORT(pa_load_save) void pa_load_save(int i, uint8_t *buf, int size) { GB_load_battery_from_buffer(gbs[i], buf, size); }

/* key: 0 right, 1 left, 2 up, 3 down, 4 A, 5 B, 6 select, 7 start (SameBoy's GB_key_t order) */
EXPORT(pa_key) void pa_key(int i, int key, int down) { GB_set_key_state(gbs[i], (GB_key_t)key, down); }

/* Plug a cable into Game Boy i (callbacks to JS) or pull it out. */
EXPORT(pa_link) void pa_link(int i, int on)
{
    if (on) {
        GB_set_serial_transfer_bit_start_callback(gbs[i], serial_start);
        GB_set_serial_transfer_bit_end_callback(gbs[i], serial_end);
    }
    else {
        GB_disconnect_serial(gbs[i]);
    }
}
EXPORT(pa_serial_get_bit) int pa_serial_get_bit(int i) { return GB_serial_get_data_bit(gbs[i]); }
EXPORT(pa_serial_set_bit) void pa_serial_set_bit(int i, int bit) { GB_serial_set_data_bit(gbs[i], bit); }
EXPORT(pa_ir_input) void pa_ir_input(int i, int on) { GB_set_infrared_input(gbs[i], on); }

/* The emulated time of Game Boy i in 8 MHz units (SameBoy's), for timestamping port events. */
EXPORT(pa_clock) double pa_clock(int i) { return (double)clocks[i]; }

/* Run the Game Boys whose bits are set in `mask` interleaved, always stepping the one that is
 * furthest behind, until each has drawn a frame (or `limit` 8 MHz cycles passed, for a screen
 * that is off). Returns a bit mask of those that drew a frame. */
EXPORT(pa_run_lockstep) int pa_run_lockstep(int mask, double limit)
{
    int done = 0, want = 0;
    uint64_t start = UINT64_MAX;
    for (int i = 0; i < MAX_GB; i++) {
        if ((mask >> i & 1) && gbs[i]) {
            want |= 1 << i;
            vblanks[i] = 0;
            if (clocks[i] < start) start = clocks[i];
        }
    }
    if (!want) return 0;
    while (done != want) {
        int slow = -1;
        for (int i = 0; i < MAX_GB; i++) {
            if ((want >> i & 1) && (slow < 0 || clocks[i] < clocks[slow])) slow = i;
        }
        if (clocks[slow] - start > (uint64_t)limit) break;
        clocks[slow] += GB_run(gbs[slow]);
        if (vblanks[slow]) done |= 1 << slow;
    }
    return done;
}
