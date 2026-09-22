// End-to-end: load the decoupled backend module, drive it, render via Cairo to PNG.
import GLib from 'gi://GLib';
import { installBrowserShim } from './shim.js';
import { installCairoHost } from './cairo-host.js';

const modulePath = ARGV[0];
const outPath = ARGV[1] || '/tmp/opencode/ggb-cairo-demo.png';
if (!modulePath) {
    printerr('usage: gjs -m run-cairo.js <ggbcanvas.nocache.js> [out.png]');
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

print('typeof GgbGjs = ' + typeof GgbGjs);
GgbGjs.init();
print('isReady       = ' + GgbGjs.isReady());
print(GgbGjs.drawDemoToFile(outPath));
print('host log      = ' + host.log.join(' | '));
print('file exists   = ' + GLib.file_test(outPath, GLib.FileTest.EXISTS));
