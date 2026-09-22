// Bootstrap the full app and render it through Cairo.
import GLib from 'gi://GLib';
import { installBrowserShim } from './shim.js';
import { installCairoHost } from './cairo-host.js';

const modulePath = ARGV[0];
const outPath = ARGV[1] || '/tmp/opencode/ggb-app-demo.png';
if (!modulePath) {
    printerr('usage: gjs -m run-app.js <ggbcanvas.nocache.js> [out.png]');
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

print('typeof GgbApp = ' + typeof GgbApp);
GgbApp.init();
print('isReady       = ' + GgbApp.isReady());
print('eval A=(1,2)  = ' + GgbApp.evalCommand('A=(1,2)'));
print('eval f(x)=x^2 = ' + GgbApp.evalCommand('f(x)=x^2'));
print('eval s=Line(A,(3,1)) = ' + GgbApp.evalCommand('s=Line(A,(3,1))'));
print('objects       = ' + GgbApp.objectLabels());
print('count         = ' + GgbApp.objectCount());

const W = 480;
const H = 360;
GgbApp.setSize(W, H);
const ctx = new host.CairoContext(W, H);
GgbApp.drawOn(ctx, W, H);
ctx.surface.writeToPNG(outPath);
print('wrote         = ' + outPath + ' exists=' + GLib.file_test(outPath, GLib.FileTest.EXISTS));
