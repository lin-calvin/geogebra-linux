// Load GeoGebra's English string bundle (menu.properties) into the host and expose
// it as the global `ggbStrings` object the backend's LocalizationGjs reads.
//
// GWT has no java.util.ResourceBundle, so the strings have to come from the host.
import GLib from 'gi://GLib';

let strings = null;
let available = false;

/** Minimal java.util.Properties unescaping. */
function unescape(value) {
    if (value.indexOf('\\') < 0) {
        return value;
    }
    let out = '';
    for (let i = 0; i < value.length; i++) {
        const c = value[i];
        if (c !== '\\') {
            out += c;
            continue;
        }
        const next = value[++i];
        switch (next) {
            case 'n': out += '\n'; break;
            case 't': out += '\t'; break;
            case 'r': out += '\r'; break;
            case 'u':
                out += String.fromCharCode(parseInt(value.substr(i + 1, 4), 16));
                i += 4;
                break;
            default: out += next;
        }
    }
    return out;
}

/**
 * @param path menu.properties
 * @return whether the bundle was loaded
 */
export function loadStrings(path) {
    install();
    const [ok, bytes] = GLib.file_get_contents(path);
    if (!ok) {
        printerr('strings: cannot read ' + path + '; UI strings stay as their keys');
        return false;
    }
    const text = new TextDecoder('utf-8').decode(bytes);
    const map = new Map();
    for (const line of text.split('\n')) {
        const trimmed = line.trimStart();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
            continue;
        }
        const eq = line.indexOf('=');
        if (eq < 0) {
            continue;
        }
        const key = line.slice(0, eq).trim();
        if (key) {
            map.set(key, unescape(line.slice(eq + 1).trim()));
        }
    }
    strings = map;
    available = true;
    return true;
}

/** Installs the global the backend looks up, empty until loadStrings() succeeds. */
export function install() {
    globalThis.ggbStrings = {
        available: () => available,
        has: (key) => strings !== null && key !== null && strings.has(key),
        get: (key) => (strings !== null && key !== null && strings.has(key)
            ? strings.get(key) : ''),
    };
}

/** @return how many keys were loaded */
export function stringCount() {
    return strings ? strings.size : 0;
}
