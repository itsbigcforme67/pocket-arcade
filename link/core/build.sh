#!/usr/bin/env bash
# Builds ../sameboy-link.wasm: SameBoy's core plus glue.c, for the device bus (../bus.js).
# Needs clang with the wasm32 target and wasi-libc (Debian/Ubuntu: apt install clang lld wasi-libc
# libclang-rt-18-dev-wasm32). No Emscripten. Usage: bash build.sh [path to a SameBoy checkout]
# Without a path it clones SameBoy at the commit below into a temporary folder.
set -euo pipefail
SAMEBOY_COMMIT=ea667ad79aa28409f034b1fd6da7304e1844750d   # SameBoy master, 2026-11-02 (v1.0.5)
here="$(cd "$(dirname "$0")" && pwd)"
src="${1:-}"
if [ -z "$src" ]; then
  src="$(mktemp -d)/SameBoy"
  git clone -q https://github.com/LIJI32/SameBoy "$src"
  git -C "$src" checkout -q "$SAMEBOY_COMMIT"
fi
python3 "$here/bootstubs.py"
version="$(sed -n 's/^VERSION := //p' "$src/version.mk")"
files="gb sgb apu memory mbc timing display camera sm83_cpu joypad save_state random rumble"
objs=()
out="$(mktemp -d)"
for f in $files; do
  clang --target=wasm32-wasi --sysroot=/usr -O2 -std=gnu11 -D_GNU_SOURCE -DGB_INTERNAL \
    -DGB_DISABLE_TIMEKEEPING -DGB_DISABLE_REWIND -DGB_DISABLE_DEBUGGER -DGB_DISABLE_CHEATS \
    -DGB_VERSION="\"$version\"" -DGB_COPYRIGHT_YEAR='"2026"' -I"$src" \
    -Wno-everything -c "$src/Core/$f.c" -o "$out/$f.o"
  objs+=("$out/$f.o")
done
clang --target=wasm32-wasi --sysroot=/usr -O2 -std=gnu11 -I"$src" -I"$here" \
  -DGB_DISABLE_TIMEKEEPING -DGB_DISABLE_REWIND -DGB_DISABLE_DEBUGGER -DGB_DISABLE_CHEATS \
  -c "$here/glue.c" -o "$out/glue.o"
clang --target=wasm32-wasi --sysroot=/usr -O2 -mexec-model=reactor \
  -Wl,--strip-all -Wl,--export=malloc -Wl,--export=free -Wl,-z,stack-size=1048576 \
  "${objs[@]}" "$out/glue.o" -o "$here/../sameboy-link.wasm"
cp "$src/LICENSE" "$here/../SAMEBOY-LICENSE"
ls -l "$here/../sameboy-link.wasm"
