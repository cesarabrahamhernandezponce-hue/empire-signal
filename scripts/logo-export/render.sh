#!/usr/bin/env bash
# Render the Empire wordmark HTML to PNGs with headless Chromium.
# Outputs at 2x device scale for crisp raster logos.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
HTML="file://$HERE/wordmark.html"
CHROME="$HOME/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome"
OUT="${1:-$HERE/output}"
SCALE=2

mkdir -p "$OUT"

shot () {
  local name="$1" w="$2" h="$3" bg="$4" mark="$5"
  "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor="$SCALE" \
    --default-background-color=00000000 \
    --virtual-time-budget=4000 \
    --window-size="$w,$h" \
    --screenshot="$OUT/$name" \
    "$HTML?w=$w&h=$h&bg=$bg&mark=$mark" >/dev/null 2>&1
  echo "  $name  (${w}x${h} @${SCALE}x = $((w*SCALE))x$((h*SCALE))px, bg=$bg, mark=$mark)"
}

echo "Rendering to $OUT"
# Wide wordmark
shot empire-wordmark-transparent.png 800 300 transparent wordmark
shot empire-wordmark-cream.png        800 300 cream       wordmark
# Square wordmark
shot empire-square-transparent.png    512 512 transparent wordmark
shot empire-square-cream.png          512 512 cream       wordmark
# Square single-letter "E" fallback mark (reads at small avatar sizes)
shot empire-E-transparent.png         512 512 transparent E
shot empire-E-cream.png               512 512 cream       E

echo "Done."
ls -l "$OUT"
