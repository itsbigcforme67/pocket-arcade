#!/usr/bin/env bash
# Copy the VMX games into vmx/cores/: every device build (vmx-firmware) and the one JS core left (Star Raiders, from
# microgames). Run it after a game changes there; never edit the copies here by hand. The Star Raiders cartridge is
# never copied: players open their own file.
set -euo pipefail
cd "$(dirname "$0")/.."
MG="${MICROGAMES:-../../microgames}"
SRC="$MG/ui/games"
[ -d "$SRC" ] || { echo "microgames not found at $SRC (set MICROGAMES=/path/to/microgames)"; exit 1; }

CORES=(starraiders_core.js starraiders_machine.js cpu6502.js)

for f in "${CORES[@]}"; do cp "$SRC/$f" vmx/cores/; done
# games built for the VMX itself and the VMX runtime that runs them (vmx-firmware: make, runtime/wasm/build.sh)
FW="${VMXFW:-../../vmx-firmware}"
VXP=(3CARDPOK.VXP 9BALL.VXP BACCARAT.VXP BIGSIX.VXP BLACKJAC.VXP BLOBS.VXP BLOX.VXP CASINOWA.VXP CHECKERS.VXP CHUCKALU.VXP CRAPS.VXP FOLDROOM.VXP
     FROGRACE.VXP HILO.VXP INTERCEP.VXP INVASION.VXP JUNCTION.VXP KENO.VXP LETITRID.VXP REDDOG.VXP REVERSI.VXP
     ROULETTE.VXP SCRATCH.VXP SICBO.VXP SLOTS.VXP TRICKYWI.VXP VIDEOPOK.VXP ZORKI.VXP)
for f in "${VXP[@]}"; do cp "$FW/build/games/$f" vmx/cores/; done
cp "$FW/build/vxrt.wasm" "$FW/runtime/wasm/vxrt.js" vmx/cores/
cp "$FW/games/zork/LICENSE" vmx/cores/zork1.LICENSE      # Zork I's MIT licence travels with its story (in ZORKI.VXP)
echo "copied ${#CORES[@]} files, ${#VXP[@]} GAME.VXP and the VMX runtime to vmx/cores/"
