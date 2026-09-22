// Minimal browser environment so GWT (sso-linked) output can be eval'd in GJS.
export function installBrowserShim(href) {
    // GJS ESM already defines a non-writable `window` === globalThis.
    if (typeof window === "undefined") {
        globalThis.window = globalThis;
    }
    globalThis.self = globalThis;
    globalThis.$wnd = globalThis;
    globalThis.navigator = { userAgent: "safari" };
    globalThis.location = { href, search: "", hash: "", protocol: "file:" };

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
            // GWT bootstraps on DOMContentLoaded; GJS has no event loop.
            if (type === "DOMContentLoaded" && typeof cb === "function") {
                cb();
            }
        },
    };
    globalThis.$doc = globalThis.document;
}
