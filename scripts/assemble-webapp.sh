#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WAR="$ROOT/geogebra/source/web/web/war"
DEST="$ROOT/webapp"

# Which app to ship. "suite" = Calculator Suite (modern UI), offline entry point.
APP="${GGB_APP:-suite}"
ENTRY="$WAR/${APP}-offline.html"

if [ ! -f "$ENTRY" ]; then
  echo "error: $ENTRY not found. Build it first:" >&2
  echo "  ./gradlew -p source/web :web:gwtCompile :web:copyHtml -Pgmodule=org.geogebra.web.SuperWeb" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
cp -a "$WAR/." "$DEST/"

# keep only the chosen offline entry point as index.html
find "$DEST" -maxdepth 1 -name '*.html' -delete
cp "$ENTRY" "$DEST/index.html"

echo "assembled webapp ($APP) -> $DEST"
