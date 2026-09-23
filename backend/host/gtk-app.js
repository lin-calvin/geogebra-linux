// GeoGebra on GTK4 + libadwaita (GJS), laid out like the official Classic app:
// toolbar row on top, algebra panel (input + object list) on the left, graphics
// view on the right, math keyboard at the bottom.
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { installBrowserShim } from './shim.js';
import { installCairoHost, contextForCr } from './cairo-host.js';
import { readGgb, writeGgb } from './ggbfile.js';

const modulePath = ARGV[0];
if (!modulePath) {
    printerr('usage: gjs -m gtk-app.js <ggbcanvas.nocache.js>');
    imports.system.exit(1);
}

// --- load the GWT-compiled kernel + app ------------------------------------
installBrowserShim('file://' + modulePath);
installCairoHost();
const [ok, bytes] = GLib.file_get_contents(modulePath);
if (!ok) {
    printerr('cannot read ' + modulePath);
    imports.system.exit(1);
}
(0, eval)(new TextDecoder('utf-8').decode(bytes));
GgbApp.init();
GgbApp.evalCommand('A=(1,2)');
GgbApp.evalCommand('f(x)=x^2');
GgbApp.evalCommand('s=Line(A,(3,1))');

// GeoGebra tool modes (EuclidianConstants)
const TOOLS = [
    ['object-select-symbolic', 'Move', 0],
    ['mark-location-symbolic', 'Point', 1],
    ['insert-object-symbolic', 'Line', 2],
    ['go-bottom-symbolic', 'Segment', 15],
    ['view-grid-symbolic', 'Polygon', 16],
    ['edit-cut-symbolic', 'Intersect', 5],
    ['go-top-symbolic', 'Angle', 36],
    ['user-trash-symbolic', 'Delete', 6],
];

const app = new Adw.Application({
    application_id: 'org.geogebra.gjs',
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});

let win = null;
let area = null;
let listBox = null;
let algebraEntry = null;
let keyboardRevealer = null;
let toastOverlay = null;
let currentPath = null;

function redraw() {
    if (area) {
        area.queue_draw();
    }
}

function toast(message) {
    if (toastOverlay) {
        toastOverlay.add_toast(new Adw.Toast({ title: message }));
    }
}

function updateTitle() {
    if (win) {
        win.set_title(currentPath
            ? GLib.path_get_basename(currentPath) + ' — GeoGebra'
            : 'GeoGebra');
    }
}

// ---------------------------------------------------------------- algebra view

function colorDot(hex) {
    const dot = new Gtk.DrawingArea({ width_request: 14, height_request: 14 });
    dot.set_valign(Gtk.Align.CENTER);
    dot.set_draw_func((widget, cr, width, height) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        cr.setSourceRGBA(r, g, b, 1);
        cr.arc(width / 2, height / 2, Math.min(width, height) / 2 - 1, 0, 2 * Math.PI);
        cr.fill();
    });
    return dot;
}

function refreshAlgebra() {
    if (!listBox) {
        return;
    }
    let child;
    while ((child = listBox.get_first_child())) {
        listBox.remove(child);
    }
    const rows = GgbApp.getObjectRows();
    if (!rows) {
        return;
    }
    for (const line of rows.split('\n')) {
        const [label, value, visible, color] = line.split('\t');
        const row = new Gtk.ListBoxRow();
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 6,
            margin_end: 6,
        });
        const dot = colorDot(color || '#000000');
        const labelWidget = new Gtk.Label({ label: label, width_chars: 3, xalign: 0 });
        labelWidget.add_css_class('heading');
        const valueWidget = new Gtk.Label({
            label: value === undefined ? '' : value,
            xalign: 0,
            hexpand: true,
            ellipsize: 3,
        });
        const eye = new Gtk.ToggleButton({
            icon_name: visible === '0' ? 'view-hidden-symbolic' : 'view-visible-symbolic',
            active: visible !== '0',
            has_frame: false,
        });
        eye.connect('toggled', () => {
            GgbApp.setVisible(label, eye.get_active());
            redraw();
        });
        box.append(dot);
        box.append(labelWidget);
        box.append(valueWidget);
        box.append(eye);
        row.set_child(box);
        listBox.append(row);
    }
}

function submitInput() {
    const text = algebraEntry.get_text().trim();
    if (!text) {
        return;
    }
    const result = GgbApp.evalCommand(text);
    algebraEntry.set_text('');
    if (result.startsWith('error')) {
        toast(result);
    }
    refreshAlgebra();
    redraw();
}

// ------------------------------------------------------------------- keyboard

function insertText(text) {
    const current = algebraEntry.get_text();
    const pos = algebraEntry.get_position();
    algebraEntry.set_text(current.slice(0, pos) + text + current.slice(pos));
    algebraEntry.set_position(pos + text.length);
    algebraEntry.grab_focus();
}

function backspace() {
    const current = algebraEntry.get_text();
    const pos = algebraEntry.get_position();
    if (pos > 0) {
        algebraEntry.set_text(current.slice(0, pos - 1) + current.slice(pos));
        algebraEntry.set_position(pos - 1);
    }
    algebraEntry.grab_focus();
}

function key(label, action) {
    const button = new Gtk.Button({ label });
    button.set_size_request(44, 40);
    button.connect('clicked', () => {
        if (typeof action === 'string') {
            insertText(action);
        } else {
            action();
        }
    });
    return button;
}

function keyboardRow(keys) {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6, homogeneous: true });
    for (const [label, action] of keys) {
        row.append(key(label, action));
    }
    return row;
}

function buildKeyboard() {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 12,
        margin_end: 12,
    });
    box.append(keyboardRow([
        ['x', 'x'], ['y', 'y'], ['z', 'z'], ['π', 'pi'], ['7', '7'], ['8', '8'], ['9', '9'], ['×', '*'], ['÷', '/'],
    ]));
    box.append(keyboardRow([
        ['x²', '^2'], ['√', 'sqrt('], ['(', '('], [')', ')'], ['4', '4'], ['5', '5'], ['6', '6'], ['+', '+'], ['−', '-'],
    ]));
    box.append(keyboardRow([
        ['≤', '<='], ['≥', '>='], ['<', '<'], ['>', '>'], ['1', '1'], ['2', '2'], ['3', '3'], ['=', '='], ['⌫', backspace],
    ]));
    box.append(keyboardRow([
        ['ans', 'ans'], [',', ','], ['.', '.'], ['←', () => algebraEntry.set_position(Math.max(0, algebraEntry.get_position() - 1))],
        ['→', () => algebraEntry.set_position(algebraEntry.get_position() + 1)],
        ['↵', submitInput],
    ]));
    return box;
}

// ---------------------------------------------------------------------- shell

function toolButton(iconName, tooltip, mode) {
    const button = new Gtk.ToggleButton({ icon_name: iconName, tooltip_text: tooltip });
    button.add_css_class('flat');
    button.connect('clicked', () => GgbApp.setMode(mode));
    return button;
}

function buildUI() {
    // --- top toolbar (like the official app) ---
    const header = new Adw.HeaderBar();
    header.add_css_class('flat');

    const tools = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 0 });
    tools.add_css_class('linked');
    for (const [icon, tip, mode] of TOOLS) {
        tools.append(toolButton(icon, tip, mode));
    }
    header.pack_start(tools);

    const menu = new Gio.Menu();
    menu.append('New', 'app.new');
    menu.append('Open…', 'app.open');
    menu.append('Save', 'app.save');
    menu.append('Save As…', 'app.save-as');
    menu.append('Zoom In', 'app.zoom-in');
    menu.append('Zoom Out', 'app.zoom-out');
    menu.append('Reset View', 'app.reset');
    menu.append('Undo', 'app.undo');
    menu.append('Redo', 'app.redo');
    menu.append('About GeoGebra', 'app.about');
    const menuButton = new Gtk.MenuButton({
        icon_name: 'open-menu-symbolic',
        menu_model: menu,
        tooltip_text: 'Menu',
    });
    menuButton.add_css_class('flat');
    header.pack_end(menuButton);

    const redoButton = new Gtk.Button({ icon_name: 'edit-redo-symbolic', tooltip_text: 'Redo' });
    redoButton.add_css_class('flat');
    redoButton.connect('clicked', () => { GgbApp.redo(); refreshAlgebra(); redraw(); });
    header.pack_end(redoButton);

    const undoButton = new Gtk.Button({ icon_name: 'edit-undo-symbolic', tooltip_text: 'Undo' });
    undoButton.add_css_class('flat');
    undoButton.connect('clicked', () => { GgbApp.undo(); refreshAlgebra(); redraw(); });
    header.pack_end(undoButton);

    const keyboardButton = new Gtk.ToggleButton({ icon_name: 'input-keyboard-symbolic', tooltip_text: 'Keyboard' });
    keyboardButton.add_css_class('flat');
    header.pack_end(keyboardButton);

    // --- algebra panel (input on top, object list below) ---
    const inputRow = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 4,
        margin_top: 6,
        margin_bottom: 6,
        margin_start: 8,
        margin_end: 8,
    });
    const plus = new Gtk.Label({ label: '+', width_chars: 2 });
    plus.add_css_class('title-4');
    algebraEntry = new Gtk.Entry({ hexpand: true, has_frame: false, placeholder_text: 'Input…' });
    algebraEntry.connect('activate', submitInput);
    inputRow.append(plus);
    inputRow.append(algebraEntry);

    listBox = new Gtk.ListBox({ selection_mode: Gtk.SelectionMode.NONE });
    listBox.add_css_class('navigation-sidebar');
    const scrolled = new Gtk.ScrolledWindow({ vexpand: true });
    scrolled.set_child(listBox);

    const algebraBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    algebraBox.append(inputRow);
    algebraBox.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }));
    algebraBox.append(scrolled);

    // --- graphics view + zoom buttons ---
    area = new Gtk.DrawingArea();
    area.set_hexpand(true);
    area.set_vexpand(true);
    area.set_draw_func((widget, cr, width, height) => {
        GgbApp.setSize(width, height);
        GgbApp.drawOn(contextForCr(cr, width, height), width, height);
    });

    const zoomBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        margin_end: 10,
    });
    zoomBox.add_css_class('linked');
    const zoomIn = new Gtk.Button({ icon_name: 'zoom-in-symbolic', tooltip_text: 'Zoom in' });
    zoomIn.connect('clicked', () => { GgbApp.zoomIn(); redraw(); });
    const zoomOut = new Gtk.Button({ icon_name: 'zoom-out-symbolic', tooltip_text: 'Zoom out' });
    zoomOut.connect('clicked', () => { GgbApp.zoomOut(); redraw(); });
    const fullscreen = new Gtk.Button({ icon_name: 'view-fullscreen-symbolic', tooltip_text: 'Reset view' });
    fullscreen.connect('clicked', () => { GgbApp.resetView(); redraw(); });
    zoomBox.append(zoomIn);
    zoomBox.append(zoomOut);
    zoomBox.append(fullscreen);

    const overlay = new Gtk.Overlay();
    overlay.set_child(area);
    overlay.add_overlay(zoomBox);

    // interaction: press / drag / release
    let start = [0, 0];
    const drag = new Gtk.GestureDrag();
    drag.connect('drag-begin', (g, x, y) => {
        start = [x, y];
        GgbApp.mouseDown(x, y, 1, false, false, false, false, 1);
    });
    drag.connect('drag-update', (g, ox, oy) => {
        GgbApp.mouseDrag(start[0] + ox, start[1] + oy, false, false, false, false);
        redraw();
    });
    drag.connect('drag-end', (g, ox, oy) => {
        GgbApp.mouseUp(start[0] + ox, start[1] + oy, 1, false, false, false, false);
        refreshAlgebra();
        redraw();
    });
    area.add_controller(drag);

    let last = [0, 0];
    const motion = new Gtk.EventControllerMotion();
    motion.connect('motion', (c, x, y) => {
        last = [x, y];
        GgbApp.mouseMove(x, y, false, false, false, false);
    });
    area.add_controller(motion);

    const scroll = new Gtk.EventControllerScroll({
        flags: Gtk.EventControllerScrollFlags.VERTICAL,
    });
    scroll.connect('scroll', (c, dx, dy) => {
        GgbApp.mouseWheel(last[0], last[1], dy, false, false);
        redraw();
        return true;
    });
    area.add_controller(scroll);

    const split = new Adw.OverlaySplitView();
    split.set_show_sidebar(true);
    split.set_sidebar_width_fraction(0.3);
    const sidebar = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    sidebar.set_size_request(320, -1);
    sidebar.append(algebraBox);
    split.set_sidebar(sidebar);
    split.set_content(overlay);

    // --- math keyboard (bottom, toggleable) ---
    keyboardRevealer = new Gtk.Revealer({ transition_type: Gtk.RevealerTransitionType.SLIDE_UP });
    keyboardRevealer.set_child(buildKeyboard());
    keyboardButton.connect('toggled', () => keyboardRevealer.set_reveal_child(keyboardButton.get_active()));

    const toolbarView = new Adw.ToolbarView();
    toolbarView.add_top_bar(header);
    toolbarView.set_content(split);
    toolbarView.add_bottom_bar(keyboardRevealer);

    toastOverlay = new Adw.ToastOverlay();
    toastOverlay.set_child(toolbarView);

    win = new Adw.ApplicationWindow({
        application: app,
        title: 'GeoGebra',
        default_width: 1100,
        default_height: 720,
    });
    win.set_content(toastOverlay);
    win.present();

    // canvas is transparent so the libadwaita background shows through; only
    // axes/grid colours follow the theme
    const styleManager = Adw.StyleManager.get_default();
    const applyTheme = () => {
        GgbApp.setTransparent(true);
        if (styleManager.get_dark()) {
            GgbApp.setAxesColor(208, 208, 208, 255);
            GgbApp.setGridColor(58, 58, 58, 255);
        } else {
            GgbApp.setAxesColor(0, 0, 0, 255);
            GgbApp.setGridColor(192, 192, 192, 255);
        }
        redraw();
    };
    styleManager.connect('notify::dark', applyTheme);
    applyTheme();

    refreshAlgebra();
}

// ----------------------------------------------------------------- file I/O

function doNew() {
    GgbApp.newConstruction();
    currentPath = null;
    updateTitle();
    refreshAlgebra();
    redraw();
}

function ggbFileFilter() {
    const filter = new Gtk.FileFilter({ name: 'GeoGebra files' });
    filter.add_pattern('*.ggb');
    filter.add_pattern('*.xml');
    return filter;
}

function doOpen() {
    const dialog = new Gtk.FileDialog({ title: 'Open GeoGebra File' });
    const filter = ggbFileFilter();
    const filters = new Gio.ListStore({ item_type: Gtk.FileFilter.$gtype });
    filters.append(filter);
    dialog.set_filters(filters);
    dialog.set_default_filter(filter);
    dialog.open(win, null, (source, result) => {
        try {
            const path = source.open_finish(result).get_path();
            const status = GgbApp.setXML(readGgb(path));
            if (status.startsWith('error')) {
                toast(status);
                return;
            }
            currentPath = path;
            updateTitle();
            refreshAlgebra();
            redraw();
        } catch (e) {
            if (!/dismiss|cancel/i.test(String(e))) {
                toast('Open failed: ' + e.message);
            }
        }
    });
}

function doSaveAs() {
    const dialog = new Gtk.FileDialog({
        title: 'Save GeoGebra File',
        initial_name: 'construction.ggb',
    });
    dialog.save(win, null, (source, result) => {
        try {
            let path = source.save_finish(result).get_path();
            if (!/\.(ggb|xml)$/i.test(path)) {
                path += '.ggb';
            }
            writeGgb(path, GgbApp.getXML());
            currentPath = path;
            updateTitle();
            toast('Saved ' + GLib.path_get_basename(path));
        } catch (e) {
            if (!/dismiss|cancel/i.test(String(e))) {
                toast('Save failed: ' + e.message);
            }
        }
    });
}

function doSave() {
    if (!currentPath) {
        doSaveAs();
        return;
    }
    try {
        writeGgb(currentPath, GgbApp.getXML());
        toast('Saved ' + GLib.path_get_basename(currentPath));
    } catch (e) {
        toast('Save failed: ' + e.message);
    }
}

function addAction(name, callback) {
    const action = new Gio.SimpleAction({ name });
    action.connect('activate', callback);
    app.add_action(action);
}

app.connect('activate', buildUI);

addAction('new', doNew);
addAction('open', doOpen);
addAction('save', doSave);
addAction('save-as', doSaveAs);
addAction('zoom-in', () => { GgbApp.zoomIn(); redraw(); });
addAction('zoom-out', () => { GgbApp.zoomOut(); redraw(); });
addAction('reset', () => { GgbApp.resetView(); redraw(); });
addAction('undo', () => { GgbApp.undo(); refreshAlgebra(); redraw(); });
addAction('redo', () => { GgbApp.redo(); refreshAlgebra(); redraw(); });
addAction('about', () => {
    const about = new Adw.AboutWindow({
        application_name: 'GeoGebra (GJS)',
        application_icon: 'accessories-calculator-symbolic',
        version: '0.1',
        comments: 'GeoGebra kernel running natively in GJS, rendered with Cairo.',
    });
    about.present();
});

app.set_accels_for_action('app.new', ['<Control>n']);
app.set_accels_for_action('app.open', ['<Control>o']);
app.set_accels_for_action('app.save', ['<Control>s']);
app.set_accels_for_action('app.save-as', ['<Control><Shift>s']);

app.run(ARGV);
