// Run the decoupled GTK/Cairo backend module inside GJS with a stub host.
// The stub records the drawing calls the backend emits (a real host would map these
// onto Cairo).
const GLib = imports.gi.GLib;

const path = ARGV[0];
if (!path) {
    printerr("usage: gjs run-in-gjs.js <ggbcanvas.nocache.js>");
    imports.system.exit(1);
}

// --- browser shim (same as the spike) --------------------------------------
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.$wnd = globalThis;
globalThis.navigator = { userAgent: "safari" };
globalThis.location = { href: "file://" + path, search: "", hash: "", protocol: "file:" };

function fakeElement(tag) {
    return {
        tagName: String(tag).toUpperCase(),
        style: {},
        setAttribute() {},
        getAttribute() { return null; },
        appendChild() {},
        removeChild() {},
        addEventListener() {},
        removeEventListener() {},
        parentNode: null,
    };
}
globalThis.document = {
    compatMode: "CSS1Compat",
    location: globalThis.location,
    readyState: "complete",
    body: fakeElement("body"),
    head: fakeElement("head"),
    documentElement: fakeElement("html"),
    createElement: fakeElement,
    createTextNode: (t) => ({ textContent: String(t) }),
    getElementsByTagName: () => [],
    getElementById: () => null,
    querySelector: () => null,
    write: () => {},
    writeln: () => {},
    addEventListener(type, cb) {
        if (type === "DOMContentLoaded" && typeof cb === "function") {
            cb();
        }
    },
};
globalThis.$doc = globalThis.document;

// --- recording host ---------------------------------------------------------
const calls = [];

function HostContext(width, height) {
    this.width = width;
    this.height = height;
    this.lineWidth = 1;
    this.strokeStyle = "";
    this.fillStyle = "";
    this.globalAlpha = 1;
    this.font = "";
}
const track = (name) => function (...args) { calls.push(name + "(" + args.join(",") + ")"); };
for (const m of [
    "beginPath", "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "closePath",
    "rect", "stroke", "fill", "fillEvenOdd", "clip", "resetClip", "saveTransform",
    "restoreTransform", "translate2", "scale2", "transform2", "setStrokeStyle",
    "setFillStyle", "setLineCap", "setLineJoin", "setLineDash", "setFont", "fillText",
    "fillRect", "clearRect", "drawImage", "dispose",
]) {
    HostContext.prototype[m] = track(m);
}
HostContext.prototype.setLineWidth = function (w) { this.lineWidth = w; calls.push("setLineWidth(" + w + ")"); };
HostContext.prototype.getGlobalAlpha = function () { return this.globalAlpha; };
HostContext.prototype.setGlobalAlpha = function (a) { this.globalAlpha = a; calls.push("setGlobalAlpha(" + a + ")"); };

globalThis.ggbHost = {
    available: () => true,
    log: (m) => print("[host] " + m),
    createContext: (w, h) => new HostContext(w, h),
};

// --- load the module --------------------------------------------------------
const [ok, bytes] = GLib.file_get_contents(path);
if (!ok) {
    printerr("cannot read " + path);
    imports.system.exit(1);
}
try {
    (0, eval)(new TextDecoder("utf-8").decode(bytes));
} catch (e) {
    printerr("EVAL FAILED: " + e);
    printerr(e.stack || "");
    imports.system.exit(2);
}

// --- drive the backend ------------------------------------------------------
print("typeof GgbGjs    = " + typeof GgbGjs);
print("before init      = " + GgbGjs.isReady());
GgbGjs.init();
print("after init       = " + GgbGjs.isReady());
print("factory          = " + GgbGjs.factoryName());
print("drawDemo()       = " + GgbGjs.drawDemo());
print("host calls       = " + calls.length);
print("  " + calls.join("\n  "));
