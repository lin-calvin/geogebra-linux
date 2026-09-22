# Spike: run the GWT-compiled GeoGebra kernel inside GJS

Question this spike answers: **can the GeoGebra kernel (`org.geogebra.Common`,
compiled to JS by GWT) run in a non-browser JS engine (GJS / SpiderMonkey), and can
it call back into native host functions?**

Answer: **yes.**

## Result

```
typeof GgbSpike      = function
GgbSpike.add(2,3)    = 5
GgbSpike.list()      = [alpha, beta]          # java.util.ArrayList
GgbSpike.map()       = 1,2                    # java.util.HashMap
KernelSpike.processFilename('a/b.ggb')   = a_b.ggb          # org.geogebra.common.util.Util
KernelSpike.validFontSize(13)            = 14
KernelSpike.myDoubleToString(1.0/3.0)    = 0.3333333333333333  # kernel MyDouble
[ggbHost] hostAdd(20, 22)                 # Java -> JS callback
KernelSpike.hostAdd(20, 22)              = 42
```

So both directions work:

- **GJS -> kernel**: GWT output loads and executes real kernel code.
- **kernel -> GJS**: `@JsType(isNative=true)` bindings call host functions — the seam a
  Cairo rendering backend would use.

## How

- `gwt/` contains two GWT modules:
  - `GgbSpike` — trivial export (JRE emulation sanity check).
  - `KernelSpike` — inherits `org.geogebra.Common` + `org.geogebra.GgbJdk` +
    `org.geogebra.editor.JLMEditorDev`, links with the `sso` single-script linker,
    exports static methods via JsInterop (`generateJsInteropExports` is already on in
    the GeoGebra build).
- `loader.js` provides a minimal browser shim (`window`, `document.compatMode`,
  `navigator.userAgent`, `location`, `$wnd`/`$doc`, a synchronous `DOMContentLoaded`
  listener, and `ggbHost`), then `eval`s the GWT output.

## Notes / limitations

- GWT's auto-run entry point does **not** fire (its bootstrap relies on
  `DOMContentLoaded` + `setInterval`, and GJS has no event loop). This is bypassed by
  exporting explicit `init`/API methods instead of relying on `EntryPoint`.
- This spike does **not** yet bootstrap a full `App`/`Construction` (which needs a
  platform layer: `AwtFactory`, `FontManager`, ...). It proves the runtime bridge, not
  the app wiring.
- Kernel compile graph drags in `editor.share` and JLaTeXMath, i.e. the kernel is not
  dependency-free even though `org.geogebra.common` itself has zero `com.google.gwt` /
  `elemental2` imports.

## Run

```bash
bash spikes/gwt-in-gjs/run.sh
```
