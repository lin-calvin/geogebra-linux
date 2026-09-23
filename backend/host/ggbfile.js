// Read/write GeoGebra .ggb files.
// A .ggb is a ZIP archive containing geogebra.xml; we shell out to zip/unzip so
// deflate-compressed files work. A plain .xml path is read/written directly.
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

function run(argv) {
    const launcher = new Gio.SubprocessLauncher({
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });
    const proc = launcher.spawnv(argv);
    const [, stdout, stderr] = proc.communicate_utf8(null, null);
    if (!proc.get_successful()) {
        throw new Error(stderr || ('command failed: ' + argv.join(' ')));
    }
    return stdout;
}

/** @return the geogebra.xml content of a .ggb (or the raw content of a .xml) */
export function readGgb(path) {
    if (path.toLowerCase().endsWith('.xml')) {
        const [, contents] = GLib.file_get_contents(path);
        return new TextDecoder('utf-8').decode(contents);
    }
    return run(['unzip', '-p', path, 'geogebra.xml']);
}

/** Writes geogebra.xml into a .ggb (or the raw XML if path ends with .xml). */
export function writeGgb(path, xml) {
    const bytes = new TextEncoder().encode(xml);
    if (path.toLowerCase().endsWith('.xml')) {
        GLib.file_set_contents(path, bytes);
        return;
    }
    const tmpDir = GLib.dir_make_tmp('ggb-XXXXXX');
    const xmlPath = GLib.build_filenamev([tmpDir, 'geogebra.xml']);
    GLib.file_set_contents(xmlPath, bytes);
    try {
        try {
            Gio.File.new_for_path(path).delete(null);
        } catch (e) {
            // output did not exist
        }
        run(['zip', '-j', '-q', '-X', path, xmlPath]);
    } finally {
        GLib.remove(xmlPath);
        GLib.rmdir(tmpDir);
    }
}
