#!/usr/bin/env bash
# Copy the VMX game cores from microgames (their home) into vmx/cores/. Run it after a game changes there; never
# edit the copies here by hand. The Star Raiders cartridge is never copied: players open their own file.
set -euo pipefail
cd "$(dirname "$0")/.."
MG="${MICROGAMES:-../../microgames}"
SRC="$MG/ui/games"
[ -d "$SRC" ] || { echo "microgames not found at $SRC (set MICROGAMES=/path/to/microgames)"; exit 1; }

CORES=(blox_core.js blobs_core.js intercept_core.js invasion_core.js blackjack_core.js checkers_core.js
       reversi_core.js tricky_core.js tricky_rules.js zork_core.js zmachine.js zork1.z3
       starraiders_core.js starraiders_machine.js cpu6502.js)

for f in "${CORES[@]}"; do cp "$SRC/$f" vmx/cores/; done
cp "$MG/in/zork/LICENSE" vmx/cores/zork1.LICENSE        # Zork I's MIT licence travels with its story file
echo "copied ${#CORES[@]} files (+ Zork's licence) to vmx/cores/"
