#!/usr/bin/env bash
# Build our GTK/Cairo backend module together with the upstream GeoGebra kernel.
#
# Decoupling rules enforced here:
#   * our sources live in backend/canvas-gjs (this repo)
#   * they are only *copied into* the upstream clone, never merged/edited
#   * they may import org.geogebra.common.* and org.geogebra.ggbjdk.* only
#     (no org.geogebra.web.*, no elemental2/DOM)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend/canvas-gjs"
GGB="$ROOT/geogebra"
DEST="$GGB/source/web/web/src/main/java"

if [ ! -d "$GGB/.git" ]; then
  echo "error: $GGB not found; run scripts/build-geogebra-web.sh first" >&2
  exit 1
fi

echo ">>> decoupling check (forbidden imports in our backend)"
if grep -rnE '^\s*import\s+(static\s+)?(org\.geogebra\.web|elemental2|com\.google\.gwt\.dom|com\.google\.gwt\.user\.client\.ui)' \
    "$BACKEND" --include='*.java'; then
  echo "error: backend must not depend on web/DOM APIs" >&2
  exit 1
fi
echo "    ok"

echo ">>> injecting backend into upstream source tree"
rm -rf "$DEST/org/geogebra/gjs"
cp -a "$BACKEND/org" "$DEST/"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
echo ">>> compiling org.geogebra.gjs.CanvasGjs"
"$GGB/gradlew" -p "$GGB/source/web" :web:gwtCompile \
  -Pgmodule=org.geogebra.gjs.CanvasGjs --console=plain

echo ">>> output: $GGB/source/web/web/war/ggbcanvas/"
ls -la "$GGB/source/web/web/war/ggbcanvas/" 2>/dev/null || true
