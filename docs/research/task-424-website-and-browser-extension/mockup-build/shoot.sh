#!/usr/bin/env bash
# Renders the captures of each direction from its code.html, through headless Chrome
# driven by the DevTools protocol (cdp_shot.mjs) so that every viewport is exact.
# Usage (from the repository root):
#   bash docs/research/task-424-website-and-browser-extension/mockup-build/shoot.sh [a b c d e]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
OUT="$ROOT/mobile-design-mockups/web_app"
dirs=("$@"); [ $# -eq 0 ] && dirs=(a b c d e)
JOBS="$(mktemp)"; echo "[" > "$JOBS"; first=1

shot() { # dir file width height scale hash
  local d="$1" f="$2" w="$3" h="$4" scale="$5" hash="$6" html mobile=false
  html="$(ls -d "$OUT"/direction_"$d"_*/)code.html"
  [ "$w" -lt 900 ] && mobile=true
  [ $first -eq 1 ] && first=0 || echo "," >> "$JOBS"
  printf '{"url":"file://%s#shot=1&%s","out":"%s","width":%s,"height":%s,"scale":%s,"mobile":%s}' \
    "$html" "$hash" "$(dirname "$html")/$f" "$w" "$h" "$scale" "$mobile" >> "$JOBS"
}

for d in "${dirs[@]}"; do source "$HERE/shots_$d.sh"; done
echo "]" >> "$JOBS"
node --experimental-websocket --no-warnings "$HERE/cdp_shot.mjs" "$JOBS"
rm -f "$JOBS"
