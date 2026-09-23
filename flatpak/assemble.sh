#!/usr/bin/env bash
# Assemble the Flatpak staging directory from the built GWT module + host JS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WAR="$ROOT/geogebra/source/web/web/war/ggbcanvas"
STAGING="$ROOT/flatpak/staging"
APPID="io.github.lin_calvin.GJSGebra"

if [ ! -f "$WAR/ggbcanvas.nocache.js" ]; then
  echo "error: $WAR/ggbcanvas.nocache.js not found; run backend/build.sh first" >&2
  exit 1
fi

rm -rf "$STAGING"
mkdir -p "$STAGING/host"
cp "$WAR/ggbcanvas.nocache.js" "$STAGING/"
cp "$ROOT"/backend/host/*.js "$STAGING/host/"
cp "$ROOT/backend/host/giac.wasm" "$STAGING/host/"
cp "$ROOT/backend/host/command.properties" "$STAGING/host/"
cp -a "$ROOT/backend/host/fonts" "$STAGING/fonts"
cp "$ROOT/flatpak/gjsgebra" "$STAGING/"
cp "$ROOT/flatpak/$APPID.desktop" "$STAGING/"
cp "$ROOT/flatpak/$APPID.svg" "$STAGING/"

echo "staged -> $STAGING"
ls -la "$STAGING"
