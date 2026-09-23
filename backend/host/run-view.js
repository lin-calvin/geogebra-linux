// Headless check for the native view API used by the shell's pan/zoom gestures:
// panBy(), zoomAt() and getViewState(). No display needed, so it runs in CI.
import GLib from 'gi://GLib';
import { installBrowserShim } from './shim.js';
import { installCairoHost } from './cairo-host.js';

const modulePath = ARGV[0];
const outDir = ARGV[1] || '/tmp/opencode';
if (!modulePath) {
    printerr('usage: gjs -m run-view.js <ggbcanvas.nocache.js> [outDir]');
    imports.system.exit(1);
}

installBrowserShim('file://' + modulePath);
const host = installCairoHost();

const [ok, bytes] = GLib.file_get_contents(modulePath);
if (!ok) {
    printerr('cannot read ' + modulePath);
    imports.system.exit(1);
}
(0, eval)(new TextDecoder('utf-8').decode(bytes));

let failures = 0;
function check(name, actual, expected, tol = 1e-6) {
    const good = Math.abs(actual - expected) <= tol;
    if (!good) {
        failures++;
    }
    print(`  ${good ? 'ok  ' : 'FAIL'} ${name}: ${actual} (expected ${expected})`);
}

function state() {
    return GgbApp.getViewState().split(',').map(Number);
}

const W = 480;
const H = 360;

GgbApp.init();
GgbApp.evalCommand('A=(1,2)');
GgbApp.evalCommand('f(x)=x^2');
GgbApp.setSize(W, H);

const render = (path) => {
    const ctx = new host.CairoContext(W, H);
    GgbApp.drawOn(ctx, W, H);
    ctx.surface.writeToPNG(path);
};

print('initial state = ' + GgbApp.getViewState());
const [x0, y0, sx0, sy0] = state();
render(outDir + '/view-0-initial.png');

// pan: shifts the origin in screen pixels, leaves the scale alone
GgbApp.panBy(50, 30);
const [x1, y1, sx1, sy1] = state();
print('after panBy(50,30) = ' + GgbApp.getViewState());
check('panBy xZero', x1, x0 + 50, 1e-6);
check('panBy yZero', y1, y0 + 30, 1e-6);
check('panBy xscale unchanged', sx1, sx0, 1e-9);
check('panBy yscale unchanged', sy1, sy0, 1e-9);
render(outDir + '/view-1-panned.png');

// zoom around a screen point: the scale is multiplied by the factor
GgbApp.zoomAt(W / 2, H / 2, 2);
const [x2, y2, sx2, sy2] = state();
print('after zoomAt(240,180,2) = ' + GgbApp.getViewState());
check('zoomAt xscale', sx2, sx1 * 2, 1e-6);
check('zoomAt yscale', sy2, sy1 * 2, 1e-6);
// the anchor point must map to the same world coordinate before and after
const worldAt = (px, py, xz, yz, sx, sy) => [
    (px - xz) / sx,
    (yz - py) / sy,
];
const [wx1, wy1] = worldAt(W / 2, H / 2, x1, y1, sx1, sy1);
const [wx2, wy2] = worldAt(W / 2, H / 2, x2, y2, sx2, sy2);
check('zoomAt anchor world x', wx2, wx1, 1e-6);
check('zoomAt anchor world y', wy2, wy1, 1e-6);
render(outDir + '/view-2-zoomed.png');

// zoom out by the inverse factor returns to the previous scale
GgbApp.zoomAt(W / 2, H / 2, 0.5);
const [, , sx3] = state();
check('zoomAt inverse', sx3, sx2 * 0.5, 1e-6);

print(failures === 0 ? 'ALL OK' : `${failures} FAILED`);
imports.system.exit(failures === 0 ? 0 : 1);
