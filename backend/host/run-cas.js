// Headless end-to-end check of the Giac CAS: load the WebAssembly engine, boot the
// kernel with CASFactoryGjs, and evaluate CAS commands. No display needed.
import GLib from 'gi://GLib';
import { installBrowserShim } from './shim.js';
import { installCairoHost } from './cairo-host.js';
import { loadCas } from './cas.js';

const modulePath = ARGV[0];
if (!modulePath) {
    printerr('usage: gjs -m run-cas.js <ggbcanvas.nocache.js>');
    imports.system.exit(1);
}
const hostDir = GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]);

const started = GLib.get_monotonic_time();
loadCas(hostDir + '/giac-glue.js', hostDir + '/giac.wasm');
print('cas load       = ' + ((GLib.get_monotonic_time() - started) / 1000).toFixed(0) + ' ms');

installBrowserShim('file://' + modulePath);
installCairoHost();
const [ok, bytes] = GLib.file_get_contents(modulePath);
if (!ok) {
    printerr('cannot read ' + modulePath);
    imports.system.exit(1);
}
(0, eval)(new TextDecoder('utf-8').decode(bytes));

GgbApp.init();
GgbApp.setCasEnabled(true);
GgbApp.setSize(480, 360);

const state = () => GgbApp.getViewState();
const rows = () => GgbApp.getObjectRows();

print('');
print('--- derivative: CAS on ---');
GgbApp.evalCommand('Derivative(x^2)');
print('  Derivative(x^2)   -> ' + rows());
GgbApp.newConstruction();
GgbApp.evalCommand('Derivative(sin(x))');
print('  Derivative(sin x) -> ' + rows());
GgbApp.newConstruction();
GgbApp.evalCommand('f(x)=x^2');
GgbApp.evalCommand('Derivative(f)');
print('  Derivative(f)     -> ' + rows());

print('');
print('--- other CAS commands ---');
for (const cmd of ['Integral(x^2)', 'Factor(x^2-1)', 'Simplify((x^2-1)/(x-1))']) {
    GgbApp.newConstruction();
    let r;
    try {
        r = GgbApp.evalCommand(cmd);
    } catch (e) {
        r = 'ERR ' + e;
    }
    print('  ' + cmd.padEnd(26) + ' -> ' + r + '  ' + rows());
}

print('');
print('--- view still fine ---');
print('  view state        = ' + state());
