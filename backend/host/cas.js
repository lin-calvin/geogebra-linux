// Load GeoGebra's Giac CAS (the WebAssembly build from giac-gwt) into the GJS host
// and expose it as the global `ggbCas` object the backend's HostCas talks to.
//
// The emscripten glue expects a browser; it only needs a handful of shims, and
// because SpiderMonkey cannot settle the promise from the async WebAssembly
// instantiation path we hand it a synchronous instantiateWasm hook.
import GLib from 'gi://GLib';

let caseval = null;

function shim(name, value) {
    try {
        if (typeof globalThis[name] === 'undefined') {
            globalThis[name] = value;
        }
    } catch (e) {
        printerr('cas: could not define ' + name + ': ' + e);
    }
}

function readWasm(glue, wasmPath) {
    if (wasmPath) {
        const [ok, bytes] = GLib.file_get_contents(wasmPath);
        if (ok) {
            return bytes;
        }
        printerr('cas: cannot read ' + wasmPath + ', falling back to the embedded copy');
    }
    const marker = 'data:application/wasm;base64,';
    const at = glue.indexOf(marker);
    if (at < 0) {
        throw new Error('no embedded wasm found in the glue');
    }
    let end = at + marker.length;
    while (end < glue.length && /[A-Za-z0-9+/=]/.test(glue[end])) {
        end++;
    }
    return GLib.base64_decode(glue.slice(at + marker.length, end));
}

/**
 * @param gluePath path to the emscripten glue (giac.wasm.js, optionally with the
 *                 embedded wasm stripped out)
 * @param wasmPath path to the raw giac.wasm, or null to use the embedded copy
 * @return whether the CAS is ready to use
 */
export function loadCas(gluePath, wasmPath) {
    // GJS already provides a read-only `window` aliasing globalThis, so the glue
    // takes its ENVIRONMENT_IS_WEB path without any help.
    shim('self', globalThis);
    shim('performance', { now: () => GLib.get_monotonic_time() / 1000 });
    shim('crypto', {
        getRandomValues(view) {
            for (let i = 0; i < view.length; i++) {
                view[i] = Math.floor(Math.random() * 256);
            }
            return view;
        },
    });
    shim('document', { currentScript: null });

    const [okGlue, glueBytes] = GLib.file_get_contents(gluePath);
    if (!okGlue) {
        throw new Error('cas: cannot read ' + gluePath);
    }
    const glue = new TextDecoder('utf-8').decode(glueBytes);
    const wasmBytes = readWasm(glue, wasmPath);

    const g = (globalThis.__ggb__giac = {});
    g.instantiateWasm = (info, receiveInstance) => {
        // synchronous on purpose: SpiderMonkey never settles the promise from
        // WebAssembly.instantiate here, and emscripten accepts the exports directly
        const module = new WebAssembly.Module(wasmBytes);
        const instance = new WebAssembly.Instance(module, info);
        receiveInstance(instance, module);
        return instance.exports;
    };
    g.onAbort = (what) => printerr('cas: abort: ' + what);

    (0, eval)(glue);

    caseval = g.cwrap('caseval', 'string', ['string']);
    if (GLib.getenv('GJSGEBRA_CAS_DEBUG') === '1') {
        const raw = caseval;
        caseval = (command) => {
            let out;
            try {
                out = raw(command);
            } catch (e) {
                printerr('[cas] ' + command + '  !! ' + e);
                throw e;
            }
            print('[cas] ' + command + '\n   -> ' + out);
            return out;
        };
    }
    globalThis.ggbCas = {
        loaded: () => caseval !== null,
        caseval: (command) => caseval(command),
    };
    return true;
}

/** @return whether the CAS has been loaded */
export function casLoaded() {
    return caseval !== null;
}
