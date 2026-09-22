#!/usr/bin/env bash
# Clone GeoGebra and compile the web (GWT) app from source.
# Produces geogebra/source/web/web/war/{index,*-offline}.html + web3d/ + css/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GGB="$ROOT/geogebra"
GGB_REPO="${GGB_REPO:-https://github.com/geogebra/geogebra.git}"
GGB_REF="${GGB_REF:-main}"
GGB_MODULE="${GGB_MODULE:-org.geogebra.web.SuperWeb}"

if [ -n "${JAVA_HOME:-}" ] && [ ! -x "${JAVA_HOME}/bin/java" ]; then
  unset JAVA_HOME
fi

if [ ! -d "$GGB/.git" ]; then
  echo ">>> cloning $GGB_REPO ($GGB_REF)"
  git clone --depth 1 --single-branch --branch "$GGB_REF" "$GGB_REPO" "$GGB"
else
  echo ">>> reusing existing clone at $GGB"
fi

# Keep the GWT build within modest memory limits so it works on 4-8 GB runners
# (upstream defaults assume a beefier machine: 4g daemon + 4g GWT + 4g javac).
echo ">>> applying low-memory build settings"
sed -i 's/^org.gradle.parallel=.*/org.gradle.parallel=false/' \
  "$GGB/gradle.properties" "$GGB/source/web/gradle.properties"
sed -i 's#^org.gradle.jvmargs=.*#org.gradle.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8#' \
  "$GGB/gradle.properties" "$GGB/source/web/gradle.properties"
sed -i 's/maxHeapSize = "4096m"/maxHeapSize = "3072m"/' \
  "$GGB/source/build-logic/convention/src/main/kotlin/gwt-conventions.gradle.kts"
sed -i 's/options.forkOptions.jvmArgs = listOf("-Xmx4g")/options.forkOptions.jvmArgs = listOf("-Xmx2g")/' \
  "$GGB/source/web/web/build.gradle.kts"

echo ">>> compiling GWT module $GGB_MODULE (this takes several minutes)"
cd "$GGB"
./gradlew -p source/web :web:gwtCompile :web:copyHtml \
  -Pgmodule="$GGB_MODULE" -Pgdraft -Pgworkers=1 \
  --console=plain --no-daemon

echo ">>> web build done: $GGB/source/web/web/war"
