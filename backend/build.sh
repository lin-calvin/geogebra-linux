#!/usr/bin/env bash
# Build our GTK/Cairo backend module together with the upstream GeoGebra kernel.
#
# Self-contained: clones upstream if needed, applies low-memory/headless build
# settings, then compiles the org.geogebra.gjs.CanvasGjs GWT module.
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
GGB_REPO="${GGB_REPO:-https://github.com/geogebra/geogebra.git}"
GGB_REF="${GGB_REF:-main}"

if [ ! -d "$GGB/.git" ]; then
  echo ">>> cloning $GGB_REPO ($GGB_REF)"
  git clone --depth 1 --single-branch --branch "$GGB_REF" "$GGB_REPO" "$GGB"
fi

echo ">>> applying low-memory / headless build settings"
sed -i 's/^org.gradle.parallel=.*/org.gradle.parallel=false/' \
  "$GGB/gradle.properties" "$GGB/source/web/gradle.properties"
sed -i 's#^org.gradle.jvmargs=.*#org.gradle.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -Djava.awt.headless=true#' \
  "$GGB/gradle.properties" "$GGB/source/web/gradle.properties"
sed -i 's/maxHeapSize = "4096m"/maxHeapSize = "3072m"/' \
  "$GGB/source/build-logic/convention/src/main/kotlin/gwt-conventions.gradle.kts"
sed -i 's/options.forkOptions.jvmArgs = listOf("-Xmx4g")/options.forkOptions.jvmArgs = listOf("-Xmx2g")/' \
  "$GGB/source/web/web/build.gradle.kts"

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

echo ">>> copying JLaTeXMath fonts (for fontconfig)"
FONTS_SRC="$GGB/source/desktop/renderer-desktop/src/main/resources/com/himamis/retex/renderer/desktop/fonts"
FONTS_DEST="$ROOT/backend/host/fonts"
mkdir -p "$FONTS_DEST"
find "$FONTS_SRC" -name 'jlm_*.ttf' -exec cp -f {} "$FONTS_DEST/" \;
echo "    $(find "$FONTS_DEST" -name '*.ttf' | wc -l) fonts in $FONTS_DEST"

echo ">>> copying command.properties (function selector)"
cp -f "$GGB/source/shared/common-jre/src/main/resources/org/geogebra/common/jre/properties/command.properties" \
  "$ROOT/backend/host/command.properties"
