#!/usr/bin/env bash
# Writes roms/<console>/index.json: the list of games the gb/, gba/, ws/ and ngp/ pages show under
# "On this site". Only needed where the web server cannot list a folder itself (GitHub Pages);
# "bash run.sh" on your own computer can. Run it again after adding or removing games.
set -euo pipefail
cd "$(dirname "$0")/.."
list() {   # list <console> <extension>...
  local dir="roms/$1"; shift
  mkdir -p "$dir"
  python3 - "$dir" "$@" <<'PY'
import json, os, sys
d, exts = sys.argv[1], tuple("." + e for e in sys.argv[2:])
names = sorted((f for f in os.listdir(d) if f.lower().endswith(exts)), key=str.lower)
json.dump(names, open(os.path.join(d, "index.json"), "w"), indent=1, ensure_ascii=False)
print("%s/index.json: %d game%s" % (d, len(names), "" if len(names) == 1 else "s"))
PY
}
list gb gb gbc
list gba gba
list ws ws wsc
list ngp ngp ngc
