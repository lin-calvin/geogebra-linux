// Measure the cost of one full canvas frame (kernel paint + Cairo/Pango host)
// without starting the app: the GTK side only adds the surface blit.
//
//   gjs -m bench-draw.js <ggbcanvas.nocache.js> [frames] [width] [height]
import GLib from 'gi://GLib';
import { installBrowserShim } from './shim.js';
import { installCairoHost } from './cairo-host.js';

const modulePath = ARGV[0];
const frames = Number(ARGV[1] || 120);
const W = Number(ARGV[2] || 1000);
const H = Number(ARGV[3] || 700);
if (!modulePath) {
    printerr('usage: gjs -m bench-draw.js <ggbcanvas.nocache.js> [frames] [w] [h]');
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

const scene = ARGV[4] || 'default';
if (scene === 'empty') {
    GgbApp.newConstruction();
} else if (scene === 'heavy') {
    GgbApp.newConstruction();
    GgbApp.evalCommand('f(x)=x^2');
    for (let i = 0; i < 40; i++) {
        GgbApp.evalCommand(`g${i}(x)=sin(${(i % 7) + 1}x)+${i}/10`);
    }
} else {
    GgbApp.evalCommand('A=(1,2)');
    GgbApp.evalCommand('f(x)=x^2');
    GgbApp.evalCommand('s=Line(A,(3,1))');
}
GgbApp.setSize(W, H);
print(`scene=${scene}  objects=${GgbApp.objectCount()}  canvas=${W}x${H}  frames=${frames}`);

const ctx = globalThis.ggbHost.createContext(W, H);

function once() {
    GgbApp.drawOn(ctx, W, H);
}

for (let i = 0; i < 10; i++) {
    once(); // warm up (background image, drawable lists, JIT)
}

const samples = [];
for (let i = 0; i < frames; i++) {
    const t = GLib.get_monotonic_time();
    once();
    samples.push((GLib.get_monotonic_time() - t) / 1000);
}
samples.sort((a, b) => a - b);
const sum = samples.reduce((a, b) => a + b, 0);
const pct = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
print(`  min ${samples[0].toFixed(2)} ms   p50 ${pct(0.5).toFixed(2)}   p90 ${pct(0.9).toFixed(2)}` +
    `   max ${samples[samples.length - 1].toFixed(2)}   mean ${(sum / samples.length).toFixed(2)} ms`);
print(`  => p50 ${(1000 / pct(0.5)).toFixed(0)} fps   mean ${(1000 / (sum / samples.length)).toFixed(0)} fps`);
