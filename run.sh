#!/usr/bin/env bash
# Serve this folder on your own computer: bash run.sh, then open the address it prints.
# A phone on the same Wi-Fi can use the second address.
cd "$(dirname "$0")"
PORT="${1:-8770}"
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "Pocket Arcade:  http://localhost:$PORT/"
[ -n "$IP" ] && echo "From a phone:   http://$IP:$PORT/"
exec python3 -m http.server "$PORT"
