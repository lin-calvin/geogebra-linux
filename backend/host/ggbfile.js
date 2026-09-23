// Read/write GeoGebra .ggb files.
//
// A .ggb is a ZIP archive containing geogebra.xml. This implementation is pure JS
// (with vendored pako for deflate/inflate) so it also works inside a Flatpak
// sandbox, where zip/unzip binaries are not available. A plain .xml path is
// read/written directly.
import GLib from 'gi://GLib';

// --- load vendored pako (MIT) ---
{
    const pakoPath = GLib.filename_from_uri(
        import.meta.url.replace(/[^/]*$/, 'pako.js'))[0];
    const [, pakoBytes] = GLib.file_get_contents(pakoPath);
    (0, eval)(new TextDecoder('utf-8').decode(pakoBytes));
}

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

/** @return a Uint8Array ZIP containing the given {name, data} entries */
export function makeZip(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = new TextEncoder().encode(entry.name);
        const raw = entry.data;
        const deflated = pako.deflateRaw(raw);
        const useDeflate = deflated.length < raw.length;
        const data = useDeflate ? deflated : raw;
        const method = useDeflate ? 8 : 0;
        const crc = crc32(raw);

        const local = new Uint8Array([
            ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(method),
            ...u16(0), ...u16(0x21),
            ...u32(crc), ...u32(data.length), ...u32(raw.length),
            ...u16(nameBytes.length), ...u16(0),
        ]);
        chunks.push(local, nameBytes, data);
        central.push({ nameBytes, method, crc, compSize: data.length, rawSize: raw.length, offset });
        offset += local.length + nameBytes.length + data.length;
    }

    const centralStart = offset;
    for (const c of central) {
        const header = new Uint8Array([
            ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(c.method),
            ...u16(0), ...u16(0x21),
            ...u32(c.crc), ...u32(c.compSize), ...u32(c.rawSize),
            ...u16(c.nameBytes.length), ...u16(0), ...u16(0),
            ...u16(0), ...u16(0), ...u32(0), ...u32(c.offset),
        ]);
        chunks.push(header, c.nameBytes);
        offset += header.length + c.nameBytes.length;
    }

    const centralSize = offset - centralStart;
    chunks.push(new Uint8Array([
        ...u32(0x06054b50), ...u16(0), ...u16(0),
        ...u16(central.length), ...u16(central.length),
        ...u32(centralSize), ...u32(centralStart), ...u16(0),
    ]));

    let total = 0;
    for (const c of chunks) {
        total += c.length;
    }
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) {
        out.set(c, pos);
        pos += c.length;
    }
    return out;
}

/** @return a map of entry name -> Uint8Array */
export function readZip(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    const min = Math.max(0, bytes.length - 22 - 65536);
    for (let i = bytes.length - 22; i >= min; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) {
        throw new Error('not a ZIP archive');
    }
    const count = view.getUint16(eocd + 10, true);
    let off = view.getUint32(eocd + 16, true);
    const files = {};
    for (let i = 0; i < count; i++) {
        if (view.getUint32(off, true) !== 0x02014b50) {
            throw new Error('corrupt ZIP central directory');
        }
        const method = view.getUint16(off + 10, true);
        const compSize = view.getUint32(off + 20, true);
        const nameLen = view.getUint16(off + 28, true);
        const extraLen = view.getUint16(off + 30, true);
        const commentLen = view.getUint16(off + 32, true);
        const localOff = view.getUint32(off + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(off + 46, off + 46 + nameLen));

        const localNameLen = view.getUint16(localOff + 26, true);
        const localExtraLen = view.getUint16(localOff + 28, true);
        const dataStart = localOff + 30 + localNameLen + localExtraLen;
        const data = bytes.subarray(dataStart, dataStart + compSize);
        files[name] = method === 8 ? pako.inflateRaw(data) : data;

        off += 46 + nameLen + extraLen + commentLen;
    }
    return files;
}

/** @return the geogebra.xml content of a .ggb (or the raw content of a .xml) */
export function readGgb(path) {
    if (path.toLowerCase().endsWith('.xml')) {
        const [, contents] = GLib.file_get_contents(path);
        return new TextDecoder('utf-8').decode(contents);
    }
    const [, bytes] = GLib.file_get_contents(path);
    const xml = readZip(bytes)['geogebra.xml'];
    if (!xml) {
        throw new Error('geogebra.xml not found in ' + path);
    }
    return new TextDecoder('utf-8').decode(xml);
}

/** Writes geogebra.xml into a .ggb (or the raw XML if path ends with .xml). */
export function writeGgb(path, xml) {
    const bytes = new TextEncoder().encode(xml);
    if (path.toLowerCase().endsWith('.xml')) {
        GLib.file_set_contents(path, bytes);
        return;
    }
    GLib.file_set_contents(path, makeZip([{ name: 'geogebra.xml', data: bytes }]));
}
