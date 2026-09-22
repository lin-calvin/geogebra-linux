# ggb-linux

Unofficial **GeoGebra for Linux** desktop app: the GeoGebra web app **compiled from source**
(Gradle + GWT) and wrapped in a **Tauri v2** window.

Official GeoGebra only ships *Classic 5* for Linux; the modern UI (Calculator Suite,
Graphing, Geometry, 3D, CAS) has no Linux desktop build. This project fills that gap
by building the web app from the upstream source and packaging it as a native-feeling
Linux desktop app (`deb` + `AppImage`).

## How it works

1. `scripts/build-geogebra-web.sh` clones [geogebra/geogebra](https://github.com/geogebra/geogebra)
   and compiles the `org.geogebra.web.SuperWeb` GWT module (`war/web3d`).
2. `scripts/assemble-webapp.sh` copies the `war/` output into `webapp/` and uses the
   offline entry point (`suite-offline.html` → `index.html`).
3. Tauri embeds `webapp/` and serves it in a webkit2gtk window.

## Build locally

Requirements: JDK 17, Node 20+, Rust 1.88+, and the Tauri Linux deps
(`libwebkit2gtk-4.1-dev`, `libsoup-3.0-dev`, `libgtk-3-dev`, `librsvg2-dev`,
`libayatana-appindicator3-dev`, `libxdo-dev`, `build-essential`, `pkg-config`).

```bash
bash scripts/build-geogebra-web.sh   # compile GeoGebra from source (several minutes)
bash scripts/assemble-webapp.sh      # -> webapp/
npm install
npx tauri build                      # -> src-tauri/target/release/bundle/{deb,appimage}
```

CI (`.github/workflows/build.yml`) does the same and uploads the `deb`/`AppImage` artifacts.

## Layout

| path | purpose |
| --- | --- |
| `scripts/` | source build + asset assembly |
| `src-tauri/` | Tauri (Rust) shell and config |
| `geogebra/` | upstream source clone (git-ignored) |
| `webapp/` | assembled frontend (git-ignored) |

## License / trademark

GeoGebra is © GeoGebra GmbH and is free for **non-commercial** use only
(see <https://www.geogebra.org/license>). This repository only contains packaging
glue; the compiled GeoGebra assets keep their original license. "GeoGebra" is a
trademark of GeoGebra GmbH.
