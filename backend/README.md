# backend/canvas-gjs — decoupled GTK/Cairo backend

A **third rendering backend** for GeoGebra, next to the existing Java2D (desktop) and
HTML-canvas (web) ones. It implements the platform seam
(`org.geogebra.common.awt.AwtFactory` / `GGraphics2D`) so the kernel and all
`common/euclidian/draw/*` code run unchanged, while drawing goes to a host-provided
Cairo surface (GJS/GTK4).

## Decoupling contract

1. **Our code lives here**, in `backend/canvas-gjs`, in the namespace
   `org.geogebra.gjs` — never in `org.geogebra.web`.
2. **Allowed imports only:** `org.geogebra.common.*`, `org.geogebra.ggbjdk.*`,
   `com.google.gwt.core.client.*`, `jsinterop.*`, `java.*`.
   Forbidden: `org.geogebra.web.*`, `elemental2.*`, `com.google.gwt.dom.*`,
   `com.google.gwt.user.client.ui.*`. `build.sh` enforces this.
3. **Upstream is never edited.** `build.sh` only *copies* our `org/geogebra/gjs`
   tree into the (disposable) upstream clone, then compiles a single GWT module.
   Re-clone upstream any time; nothing to rebase.
4. **The host boundary is one file:** `HostGraphics` / `HostContext` (JsInterop
   natives). Everything platform-specific is behind it.

## What we reuse for free

`AwtFactoryHeadless` (upstream, `ggbjdk`) already implements **all geometry**:
`AffineTransform`, `Rectangle`, `Rectangle2D`, `RoundRectangle2D`, `GeneralPath`,
`Line2D`, `Ellipse2D`, `Arc2D`, `QuadCurve2D`, `Area`, `DefaultBasicStroke`,
`Dimension`. We only override the drawing/text/image parts, exactly like
`AwtFactoryW` does for the web.

| class | role |
| --- | --- |
| `AwtFactoryGjs` | extends `AwtFactoryHeadless`, overrides canvas/text/image |
| `GGraphics2DGjs` | `GGraphics2D` over `HostContext` (paths via `GPathIterator`) |
| `GBufferedImageGjs` | offscreen host surface |
| `GFontGjs` / `GFontRenderContextGjs` / `GTextLayoutGjs` | text |
| `GAlphaCompositeGjs` / `GGradientPaintGjs` / `GTexturePaintGjs` | paint/composite |
| `GjsBackend` | exported API (`init`, `isReady`, `drawDemo`, `drawOn`) |
| `HostGraphics` / `HostContext` | the only platform boundary (JsInterop) |
| `AbstractEventGjs` | GTK input wrapped as GeoGebra `AbstractEvent` |
| `EuclidianControllerGjs` | extends `EuclidianController` (1 abstract method) |
| `EuclidianViewGjs` | extends `EuclidianView`, paints into host graphics |

## Interaction is (mostly) free

`EuclidianController` (in `common`) has **one** abstract method
(`resetToolTipManager`) and exposes public entry points
`wrapMousePressed`, `wrapMouseDragged`, `wrapMouseReleased`, `wrapMouseMoved`,
`wrapMouseWheelMoved`. Hit detection, dragging, snapping, tool behaviour, panning and
zooming are all implemented in `common`. The platform only has to:

1. translate a GTK event into `AbstractEventGjs` (12 trivial getters), and
2. forward it to the inherited `wrap*` method.

`EuclidianViewGjs` mirrors the upstream `EuclidianViewNoGui`, which already renders the
whole scene into a `GGraphics2D` — here that graphics is backed by the host (Cairo)
surface.

## Build & smoke test

```bash
bash backend/build.sh      # decoupling check + GWT compile -> war/ggbcanvas
gjs backend/run-in-gjs.js geogebra/source/web/web/war/ggbcanvas/ggbcanvas.nocache.js
```

`run-in-gjs.js` supplies a **stub host** that records drawing calls. Expected tail:

```
after init       = true
drawDemo()       = ok 64x64
host calls       = 15
  ... beginPath() moveTo(0,0) lineTo(63,63) closePath() stroke() fillRect(10,10,20,20)
```

A real host replaces the stub with Cairo calls; nothing else changes.
