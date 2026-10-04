; Pocket Arcade test ROM for the WonderSwan. GPL-3.0-or-later, like the rest of the project.
; Build: nasm -f bin -DTALL=0 -o probes/probe.ws probe_ws.asm   (make_probes.py does this and fixes the checksum)
;
; Shows a plain screen whose shade follows the buttons being held, and keeps a few bytes in the
; cartridge's battery-backed RAM so a test can read them back from the save file:
;   byte 0  how many times the ROM has booted
;   byte 1  X pad (high four bits) and Y pad (low four bits) held now
;   byte 2  Start (bit 1), A (bit 2), B (bit 3) held now
; (Fresh cartridge RAM is all 255s, so the very first boot reads 0.)
; TALL=1 sets the header flag that says the game is played with the console held upright.

%ifndef TALL
%define TALL 0
%endif

        bits 16
        cpu 186
        org 0x0000              ; the last 64 KB of a cartridge sits at F000:0000

start:  cli
        cld
        xor ax, ax
        mov ss, ax
        mov sp, 0x2000

        mov al, 0x20            ; the eight grey levels the mono screen can pick from
        out 0x1C, al
        mov al, 0x64
        out 0x1D, al
        mov al, 0xA8
        out 0x1E, al
        mov al, 0xFC
        out 0x1F, al
        xor al, al
        out 0x00, al            ; no layers: the whole screen is the backdrop colour
        mov al, 0x01
        out 0x14, al            ; screen on

        mov ax, 0x1000          ; cartridge RAM
        mov ds, ax
        inc byte [0]

again:  mov al, 0x10            ; Y pad
        out 0xB5, al
        nop
        nop
        in al, 0xB5
        and al, 0x0F
        mov bl, al
        mov al, 0x20            ; X pad
        out 0xB5, al
        nop
        nop
        in al, 0xB5
        shl al, 4
        or bl, al
        mov al, 0x40            ; Start, A, B
        out 0xB5, al
        nop
        nop
        in al, 0xB5
        and al, 0x0F
        mov bh, al

        mov [1], bl
        mov [2], bh

        mov al, bl              ; fold everything into three bits for the backdrop shade
        shr al, 4
        or al, bl
        or al, bh
        and al, 0x07
        out 0x01, al
        jmp again

        times 0xFFF0 - ($ - $$) db 0xFF

        jmp 0xF000:start        ; where the processor starts
        db 0x00                 ; (unused)
        db 0x00                 ; publisher: none
        db 0x00                 ; mono
        db 0x00                 ; game number
        db 0x00                 ; version
        db 0x00                 ; ROM size code
        db 0x01                 ; 8 KB of battery-backed RAM
        db 0x04 | TALL          ; bit 0: held upright
        db 0x00                 ; no clock
        dw 0x0000               ; checksum, filled in by make_probes.py
