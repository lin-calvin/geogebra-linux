// Command / function list for the function selector popup.
//
// Commands (name + syntaxes) are parsed from GeoGebra's English command.properties
// (shipped next to this file); built-in functions are listed below (they are not in
// the properties file).
import GLib from 'gi://GLib';

const FUNCTIONS = [
    ['sin', 'sin( <Angle> )'],
    ['cos', 'cos( <Angle> )'],
    ['tan', 'tan( <Angle> )'],
    ['asin', 'asin( <Number> )'],
    ['acos', 'acos( <Number> )'],
    ['atan', 'atan( <Number> )'],
    ['atan2', 'atan2( <Number>, <Number> )'],
    ['sinh', 'sinh( <Number> )'],
    ['cosh', 'cosh( <Number> )'],
    ['tanh', 'tanh( <Number> )'],
    ['ln', 'ln( <Number> )'],
    ['log', 'log( <Number> )'],
    ['exp', 'exp( <Number> )'],
    ['sqrt', 'sqrt( <Number> )'],
    ['cbrt', 'cbrt( <Number> )'],
    ['abs', 'abs( <Number> )'],
    ['floor', 'floor( <Number> )'],
    ['ceil', 'ceil( <Number> )'],
    ['round', 'round( <Number> )'],
    ['sign', 'sign( <Number> )'],
    ['min', 'min( <Number>, <Number> )'],
    ['max', 'max( <Number>, <Number> )'],
    ['mod', 'mod( <Number>, <Number> )'],
    ['nroot', 'nroot( <Number>, <Degree> )'],
    ['random', 'random()'],
];

function parseProperties(text) {
    const map = {};
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
            continue;
        }
        const eq = line.indexOf('=');
        if (eq < 0) {
            continue;
        }
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1)
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\');
        map[key] = value;
    }
    return map;
}

function buildSyntax(syntax, name) {
    return syntax.replace('[', name + '(').replace(']', ')').trim();
}

/** @return [{name, syntaxes, kind}] */
export function loadFunctions(moduleUrl) {
    const entries = [];
    try {
        const path = GLib.filename_from_uri(
            moduleUrl.replace(/[^/]*$/, 'command.properties'))[0];
        const [, bytes] = GLib.file_get_contents(path);
        const props = parseProperties(new TextDecoder('utf-8').decode(bytes));
        for (const key of Object.keys(props)) {
            if (key.endsWith('.Syntax')) {
                const name = key.slice(0, -'.Syntax'.length);
                entries.push({
                    name,
                    syntaxes: props[key].split('\n').map((s) => buildSyntax(s, name)),
                    kind: 'command',
                });
            }
        }
    } catch (e) {
        printerr('function list: cannot read command.properties: ' + e.message);
    }
    for (const [name, syntax] of FUNCTIONS) {
        entries.push({ name, syntaxes: [syntax], kind: 'function' });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return entries;
}
