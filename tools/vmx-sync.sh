#!/usr/bin/env bash
# Copy the VMX game cores from microgames (their home) into vmx/cores/. Run it after a game changes there; never
# edit the copies here by hand.
#   bash tools/vmx-sync.sh            the games cleared for the public site
#   bash tools/vmx-sync.sh --extra    also Zork I and Star Raiders' machine, into vmx/cores/extra/ (kept out of git
#                                     through .git/info/exclude until the owner clears them; see README, VMX)
# The Star Raiders cartridge is never copied: players open their own.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${MICROGAMES:-../../microgames}/ui/games"
[ -d "$SRC" ] || { echo "microgames not found at $SRC (set MICROGAMES=/path/to/microgames)"; exit 1; }

PUBLIC=(blox_core.js blobs_core.js intercept_core.js invasion_core.js blackjack_core.js checkers_core.js
        reversi_core.js tricky_core.js tricky_rules.js)
EXTRA=(zork_core.js zmachine.js zork1.z3 starraiders_core.js starraiders_machine.js cpu6502.js)

for f in "${PUBLIC[@]}"; do cp "$SRC/$f" vmx/cores/; done
echo "copied ${#PUBLIC[@]} files to vmx/cores/"

if [ "${1:-}" = "--extra" ]; then
  mkdir -p vmx/cores/extra
  for f in "${EXTRA[@]}"; do cp "$SRC/$f" vmx/cores/extra/; done
  grep -qx 'vmx/cores/extra/' .git/info/exclude 2>/dev/null || echo 'vmx/cores/extra/' >> .git/info/exclude
  echo "copied ${#EXTRA[@]} files to vmx/cores/extra/ (not tracked by git)"
fi
