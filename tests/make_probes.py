#!/usr/bin/env python3
"""Builds the tiny test ROMs in tests/probes/ that tests/e2e.py boots.

They are written for this project (GPL-3.0-or-later, like the rest of it) so the tests need no
game files. Each one shows a plain screen whose colour follows the buttons being held, which lets
a test (or you, on a phone) see that input reaches the emulated machine:

  probe.gb    Game Boy. Also keeps two bytes in battery-backed cartridge RAM, which a test can read
              back from the save file: byte 0 counts boots, byte 1 is the buttons held now.
              (Fresh cartridge RAM is all 255s, so the very first boot reads 0.)
  probe.ws    WonderSwan, same idea: byte 0 counts boots, byte 1 is the X pad (high four bits) and
              Y pad (low four bits), byte 2 is Start, A and B. Built from probe_ws.asm with nasm.
  probe-tall.ws   The same program with the "hold me upright" flag set in its header.
  probe.ngc   Neo Geo Pocket Color. Blue when idle; the colour changes with the buttons.
  probe.gba   Game Boy Advance, same idea as probe.gb, in battery-backed SRAM: byte 0 counts boots,
              byte 1 is A, B, Select, Start and the D-pad (the low byte of KEYINPUT, 1 = held) and
              byte 2 is R (1) and L (2). Dark blue when idle; the red and green follow the buttons.

dmg-acid2.gb and cgb-acid2.gbc in the same folder are not made here: they are Matt Currie's
display tests (MIT licence, see probes/README.md), kept so the tests also boot real programs.

Run:  python3 tests/make_probes.py      (probe.ws needs nasm; without it the existing file is kept)
"""
import os, shutil, struct, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "probes")
os.makedirs(OUT, exist_ok=True)


def game_boy():
    rom = bytearray(0x8000)
    rom[0x100:0x104] = bytes([0x00, 0xC3, 0x50, 0x01])          # nop ; jp $0150
    # 0x104-0x133 is where a licensed cartridge carries the maker's logo. It is left empty: the
    # emulator starts without a boot ROM and does not look at it (real hardware would refuse this).
    rom[0x134:0x13C] = b"PA PROBE"
    rom[0x147] = 0x03        # MBC1 + RAM + battery
    rom[0x148] = 0x00        # 32 KB ROM
    rom[0x149] = 0x02        # 8 KB RAM
    rom[0x14A] = 0x01
    code = bytes([
        0xF3,                    # di
        0x31, 0xFE, 0xFF,        # ld sp,$FFFE
        0x3E, 0x0A,              # ld a,$0A
        0xEA, 0x00, 0x00,        # ld ($0000),a        cartridge RAM on
        0x21, 0x00, 0xA0,        # ld hl,$A000
        0x34,                    # inc (hl)            boots
        # loop:
        0x3E, 0x20, 0xE0, 0x00,  # ld a,$20 ; ldh ($00),a     pick the direction keys
        0xF0, 0x00, 0xF0, 0x00,  # ldh a,($00) twice
        0x2F, 0xE6, 0x0F,        # cpl ; and $0F
        0xCB, 0x37, 0x47,        # swap a ; ld b,a
        0x3E, 0x10, 0xE0, 0x00,  # ld a,$10 ; ldh ($00),a     pick A, B, Select, Start
        0xF0, 0x00, 0xF0, 0x00,  # ldh a,($00) twice
        0x2F, 0xE6, 0x0F,        # cpl ; and $0F
        0xB0, 0x47,              # or b ; ld b,a       b = directions<<4 | buttons
        0x3E, 0x30, 0xE0, 0x00,  # ld a,$30 ; ldh ($00),a
        0x78,                    # ld a,b
        0xEA, 0x01, 0xA0,        # ld ($A001),a        held now
        0xE0, 0x47,              # ldh ($47),a         background palette: the screen's shade follows the keys
        0x18, 0x00,              # jr loop (distance filled in below)
    ])
    code = code[:-1] + bytes([(13 - len(code)) & 0xFF])    # "loop" is 13 bytes in
    rom[0x150:0x150 + len(code)] = code
    x = 0
    for b in rom[0x134:0x14D]:
        x = (x - b - 1) & 0xFF
    rom[0x14D] = x
    s = (sum(rom) - rom[0x14E] - rom[0x14F]) & 0xFFFF
    rom[0x14E], rom[0x14F] = s >> 8, s & 0xFF
    return bytes(rom)


def neo_geo_pocket():
    rom = bytearray(b"\xFF" * 0x1000)
    rom[0x00:0x1C] = b" LICENSED BY SNK CORPORATION"      # the text the system looks for, not a claim
    rom[0x1C:0x20] = struct.pack("<I", 0x200040)          # where the program starts
    rom[0x20:0x24] = bytes([0x00, 0x00, 0x00, 0x10])      # catalogue number 0, version 0, colour
    rom[0x24:0x30] = b"PA PROBE    "
    rom[0x30:0x40] = bytes(16)
    code = bytes([
        0x06, 0x07,                    # di
        # loop:
        0xC1, 0x82, 0x6F, 0x21,        # ld a,($6F82)        the buttons, as the system reports them
        0xF1, 0x18, 0x81, 0x00, 0x80,  # ld ($8118),$80      backdrop colour on, entry 0
        0xF1, 0xE0, 0x83, 0x41,        # ld ($83E0),a        red and green follow the buttons
        0xF1, 0xE1, 0x83, 0x00, 0x08,  # ld ($83E1),$08      some blue, always
        0x68, 0x00,                    # jr loop (distance filled in below)
    ])
    code = code[:-1] + bytes([(2 - len(code)) & 0xFF])     # "loop" is 2 bytes in
    rom[0x40:0x40 + len(code)] = code
    return bytes(rom)


def game_boy_advance():
    rom = bytearray(0x1000)
    # ARM code, hand-assembled (cond = always). The cartridge starts with a branch to 0xC0.
    code = [
        0xEA00002E,   # 000: b    0x0C0
    ]
    body = [
        0xE3A00404,   # 0C0: mov  r0, #0x04000000        I/O registers
        0xE3A01B01,   # 0C4: mov  r1, #0x400
        0xE3811003,   # 0C8: orr  r1, r1, #3             mode 3 (one colour per pixel), BG2 on
        0xE1C010B0,   # 0CC: strh r1, [r0]               DISPCNT
        0xE3A0240E,   # 0D0: mov  r2, #0x0E000000        SRAM
        0xE5D23000,   # 0D4: ldrb r3, [r2]
        0xE2833001,   # 0D8: add  r3, r3, #1
        0xE5C23000,   # 0DC: strb r3, [r2]               count the boot
        0xE3A04404,   # 0E0: mov  r4, #0x04000000        loop:
        0xE2844E13,   # 0E4: add  r4, r4, #0x130
        0xE1D450B0,   # 0E8: ldrh r5, [r4]               KEYINPUT, 0 = held
        0xE1E05005,   # 0EC: mvn  r5, r5
        0xE3A06B01,   # 0F0: mov  r6, #0x400
        0xE2466001,   # 0F4: sub  r6, r6, #1
        0xE0055006,   # 0F8: and  r5, r5, r6             ten buttons, 1 = held
        0xE5C25001,   # 0FC: strb r5, [r2, #1]
        0xE1A07425,   # 100: mov  r7, r5, lsr #8
        0xE5C27002,   # 104: strb r7, [r2, #2]
        0xE3858B11,   # 108: orr  r8, r5, #0x4400        dark blue, plus the buttons in red and green
        0xE3A09406,   # 10C: mov  r9, #0x06000000        VRAM
        0xE3A0AC96,   # 110: mov  r10, #0x9600           240 x 160 pixels
        0xE0C980B2,   # 114: strh r8, [r9], #2           fill:
        0xE25AA001,   # 118: subs r10, r10, #1
        0x1AFFFFFC,   # 11C: bne  fill
        0xEAFFFFEE,   # 120: b    loop
    ]
    struct.pack_into("<%dI" % len(code), rom, 0, *code)
    struct.pack_into("<%dI" % len(body), rom, 0xC0, *body)
    # 0x04-0x9F is where a licensed cartridge carries the maker's logo. Left empty: the emulator
    # starts the cartridge itself, without the console's boot program, and does not look at it.
    rom[0xA0:0xAC] = b"PA PROBE".ljust(12, b"\0")
    rom[0xAC:0xB0] = b"PAPB"
    rom[0xB0:0xB2] = b"01"
    rom[0xB2] = 0x96
    rom[0xBD] = (-sum(rom[0xA0:0xBD]) - 0x19) & 0xFF
    # Emulators tell what kind of save a cartridge has from a marker the SDK libraries leave in it.
    rom[0x200:0x20C] = b"SRAM_V113\0\0\0"
    return bytes(rom)


def wonderswan():
    src = os.path.join(HERE, "probe_ws.asm")
    made = []
    if not shutil.which("nasm"):
        print("nasm not found: keeping the existing probe.ws / probe-tall.ws")
        return made
    for name, tall in (("probe.ws", 0), ("probe-tall.ws", 1)):
        out = os.path.join(OUT, name)
        subprocess.run(["nasm", "-f", "bin", "-DTALL=%d" % tall, "-o", out, src], check=True)
        rom = bytearray(open(out, "rb").read())
        assert len(rom) == 0x10000, len(rom)
        s = sum(rom[:-2]) & 0xFFFF                        # checksum over everything but itself
        rom[-2], rom[-1] = s & 0xFF, s >> 8
        open(out, "wb").write(rom)
        made.append(name)
    return made


if __name__ == "__main__":
    open(os.path.join(OUT, "probe.gb"), "wb").write(game_boy())
    open(os.path.join(OUT, "probe.ngc"), "wb").write(neo_geo_pocket())
    open(os.path.join(OUT, "probe.gba"), "wb").write(game_boy_advance())
    print("wrote probe.gb, probe.ngc, probe.gba", *wonderswan())
