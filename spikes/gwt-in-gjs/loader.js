// GJS loader spike: try to run GWT (sso-linked) output in SpiderMonkey.
const GLib = imports.gi.GLib;

const path = ARGV[0];
if (!path) {
    printerr("usage: gjs gwt-in-gjs.js <module.nocache.js>");
    imports.system.exit(1);
}

// --- minimal browser environment -------------------------------------------
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.$wnd = globalThis;

globalThis.navigator = { userAgent: "safari", appVersion: "5.0" };
globalThis.location = {
    href: "file://" + path,
    search: "",
    hash: "",
    protocol: "file:",
    host: "",
    hostname: "",
    pathname: path,
};

function fakeElement(tag) {
    return {
        tagName: String(tag).toUpperCase(),
        nodeName: String(tag).toUpperCase(),
        style: {},
        src: "",
        href: "",
        rel: "",
        type: "",
        innerHTML: "",
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
    // GWT bootstraps on DOMContentLoaded; GJS has no event loop, so fire it now.
    addEventListener(type, cb) {
        if (type === "DOMContentLoaded" && typeof cb === "function") {
            cb();
        }
    },
};
globalThis.$doc = globalThis.document;

// Native host functions the GWT/Java side can call back into (JsInterop).
globalThis.ggbHost = {
    add(a, b) { return a + b; },
    log(message) { print("[ggbHost] " + message); },
};

// --- load the GWT output ----------------------------------------------------
const [ok, bytes] = GLib.file_get_contents(path);
if (!ok) {
    printerr("cannot read " + path);
    imports.system.exit(1);
}
const code = new TextDecoder("utf-8").decode(bytes);

try {
    (0, eval)(code);
} catch (e) {
    printerr("EVAL FAILED: " + e);
    printerr(e.stack || "");
    imports.system.exit(2);
}

// --- probe the exported API -------------------------------------------------
print("typeof ggbspike      = " + typeof ggbspike);
print("typeof gwtOnLoad     = " + typeof gwtOnLoad);
print("typeof GgbSpike      = " + typeof GgbSpike);
if (typeof GgbSpike !== "undefined") {
    print("GgbSpike.isLoaded()  = " + GgbSpike.isLoaded());
    print("GgbSpike.add(2,3)    = " + GgbSpike.add(2, 3));
    print("GgbSpike.hypot(3,4)  = " + GgbSpike.hypot(3, 4));
    print("GgbSpike.list()      = " + GgbSpike.list());
    print("GgbSpike.map()       = " + GgbSpike.map());
}

if (typeof KernelSpike !== "undefined") {
    print("KernelSpike.processFilename('a/b.ggb')   = " + KernelSpike.processFilename("a/b.ggb"));
    print("KernelSpike.validFontSize(13)            = " + KernelSpike.validFontSize(13));
    print("KernelSpike.myDoubleToString(3.14159)    = " + KernelSpike.myDoubleToString(3.14159));
    print("KernelSpike.myDoubleToString(1.0/3.0)    = " + KernelSpike.myDoubleToString(1.0 / 3.0));
    print("KernelSpike.hostAdd(20, 22)              = " + KernelSpike.hostAdd(20, 22));
}
