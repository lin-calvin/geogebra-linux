#!/usr/bin/env bash
# Build the GWT kernel-export spike and run it inside GJS (SpiderMonkey).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SPIKE="$ROOT/spikes/gwt-in-gjs"
GGB="$ROOT/geogebra"
DEST="$GGB/source/web/web/src/main/java/org/geogebra/web"

if [ ! -d "$GGB/.git" ]; then
  echo "error: $GGB not found; run scripts/build-geogebra-web.sh first" >&2
  exit 1
fi

cp -a "$SPIKE/gwt/org/geogebra/web/." "$DEST/"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
"$GGB/gradlew" -p "$GGB/source/web" :web:gwtCompile \
  -Pgmodule=org.geogebra.web.KernelSpike --console=plain

JS="$GGB/source/web/web/war/kernelspike/kernelspike.nocache.js"
echo ">>> running $JS in gjs"
gjs "$SPIKE/loader.js" "$JS"
