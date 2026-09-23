// Render one LaTeX string through the JLaTeXMath + Cairo pipeline to a PNG, for
// eyeballing typesetting without starting the whole app.
//
//   gjs -m dump-latex.js <ggbcanvas.nocache.js> '<latex>' [size] [out.png]
//
// Needs the JLaTeXMath fonts visible to fontconfig, i.e.
//   XDG_DATA_DIRS=$PWD/backend/host:$XDG_DATA_DIRS
import GLib from 'gi://GLib';
import { installBrowserShim } from './shim.js';
import { installCairoHost } from './cairo-host.js';

const modulePath = ARGV[0];
const latex = ARGV[1];
const size = Number(ARGV[2] || 18);
const outPath = ARGV[3] || '/tmp/opencode/dump-latex.png';
if (!modulePath || !latex) {
    printerr("usage: gjs -m dump-latex.js <ggbcanvas.nocache.js> '<latex>' [size] [out.png]");
    imports.system.exit(1);
}

installBrowserShim('file://' + modulePath);
installCairoHost();
const [ok, bytes] = GLib.file_get_contents(modulePath);
if (!ok) {
    printerr('cannot read ' + modulePath);
    imports.system.exit(1);
}
(0, eval)(new TextDecoder('utf-8').decode(bytes));
GgbApp.init();

const [w, h] = GgbApp.measureLatex(latex, size).split(',').map(Number);
const width = Math.max(1, Math.ceil(w)) + 4;
const height = Math.max(1, Math.ceil(h)) + 8;
const ctx = globalThis.ggbHost.createContext(width, height);
GgbApp.drawLatex(ctx, latex, size, 2, 2, 255, 255, 255);
globalThis.ggbHost.writePng(ctx, outPath);
print('measured ' + w + 'x' + h + '  widget ' + width + 'x' + height + '  -> ' + outPath);
