#!/usr/bin/env python3
"""Builds tests/probes/irtest.gbc, a tiny Game Boy Color program for testing the IR port.

Written for this project (GPL-3.0-or-later). No assembler needed: the few instructions are
written out below with their opcodes. What it does:

  * It watches its IR sensor all the time and counts each time light starts reaching it:
    the count is the byte at $C000 (it wraps at 256).
  * While A is held it sends bursts of 8 pulses: the LED is on for 64 turns of a 4-cycle loop and
    off for 128 (about 250 us on, 500 us off at normal speed). $C001 counts the bursts sent.
  * The screen stays blank.

tests/link_ir.mjs uses it to check that pulses cross an IR beam between two Game Boy Colors, and
between a Game Boy Color and a device written in JavaScript, with timestamps in microseconds.

Run:  python3 tests/make_irtest.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "probes", "irtest.gbc")

ON_LOOPS, OFF_LOOPS, PULSES = 64, 128, 8


def program(base):
    code, labels, fix = bytearray(), {}, []

    def emit(*b): code.extend(b)
    def label(n): labels[n] = base + len(code)
    def jr(op, n): emit(op, 0); fix.append(('jr', len(code) - 1, n))
    def jp(op, n): emit(op, 0, 0); fix.append(('jp', len(code) - 2, n))

    emit(0xF3)                          # di
    emit(0x31, 0xFE, 0xFF)              # ld sp,$FFFE
    emit(0xAF)                          # xor a
    emit(0xEA, 0x00, 0xC0)              # ld [$C000],a    light count
    emit(0xEA, 0x01, 0xC0)              # ld [$C001],a    bursts sent
    emit(0xEA, 0x02, 0xC0)              # ld [$C002],a    light seen last time
    emit(0x3E, 0xC0, 0xE0, 0x56)        # ld a,$C0 / ldh [RP],a   sensor on, LED off
    label('main')
    emit(0x3E, 0x10, 0xE0, 0x00)        # ld a,$10 / ldh [P1],a   select the A/B/Select/Start row
    emit(0xF0, 0x00, 0xF0, 0x00)        # ldh a,[P1] twice, to let it settle
    emit(0xCB, 0x47)                    # bit 0,a          A (0 = held)
    jp(0xCA, 'send')                    # jp z,send
    emit(0xF0, 0x56)                    # ldh a,[RP]
    emit(0xCB, 0x4F)                    # bit 1,a          0 = light reaching the sensor
    jr(0x20, 'dark')                    # jr nz,dark
    emit(0xFA, 0x02, 0xC0)              # ld a,[$C002]
    emit(0xB7)                          # or a
    jr(0x20, 'main')                    # jr nz,main       still the same light
    emit(0x3E, 0x01, 0xEA, 0x02, 0xC0)  # ld a,1 / ld [$C002],a
    emit(0x21, 0x00, 0xC0, 0x34)        # ld hl,$C000 / inc [hl]
    jr(0x18, 'main')
    label('dark')
    emit(0xAF, 0xEA, 0x02, 0xC0)        # xor a / ld [$C002],a
    jr(0x18, 'main')

    label('send')
    emit(0x06, PULSES)                  # ld b,8
    label('pulse')
    emit(0x3E, 0xC1, 0xE0, 0x56)        # LED on
    emit(0x0E, ON_LOOPS)                # ld c,64
    label('d1'); emit(0x0D); jr(0x20, 'd1')        # dec c / jr nz
    emit(0x3E, 0xC0, 0xE0, 0x56)        # LED off
    emit(0x0E, OFF_LOOPS)               # ld c,128
    label('d2'); emit(0x0D); jr(0x20, 'd2')
    emit(0x05); jr(0x20, 'pulse')       # dec b / jr nz,pulse
    emit(0x21, 0x01, 0xC0, 0x34)        # inc [$C001]
    emit(0xAF, 0xEA, 0x02, 0xC0)        # forget our own light
    jp(0xC3, 'main')

    for kind, at, n in fix:
        if kind == 'jr':
            d = labels[n] - (base + at + 1)
            assert -128 <= d < 128
            code[at] = d & 0xFF
        else:
            code[at:at + 2] = labels[n].to_bytes(2, 'little')
    return bytes(code)


def rom():
    r = bytearray(0x8000)
    r[0x100:0x104] = bytes([0x00, 0xC3, 0x50, 0x01])        # nop / jp $0150
    # $104-$133 is where a licensed cartridge carries the maker's logo. Left empty, as in
    # make_probes.py: the link page's stand-in boot ROMs do not check it.
    r[0x134:0x13F] = b'IRTEST'.ljust(11, b'\0')
    r[0x143] = 0xC0                                          # Game Boy Color only
    r[0x147] = 0x00                                          # ROM only
    r[0x14B] = 0x00
    p = program(0x150)
    r[0x150:0x150 + len(p)] = p
    r[0x14D] = (-sum(r[0x134:0x14D]) - (0x14D - 0x134)) & 0xFF
    s = sum(r) - r[0x14E] - r[0x14F]
    r[0x14E:0x150] = (s & 0xFFFF).to_bytes(2, 'big')
    return bytes(r)


if __name__ == '__main__':
    with open(OUT, 'wb') as f:
        f.write(rom())
    print(OUT)
