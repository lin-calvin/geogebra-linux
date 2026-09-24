// GeoGebra on GTK4 + libadwaita (GJS), laid out like the official Calculator Suite:
//   header (menu + title + perspective) / icon rail + panel / graphics view
// Only the Graphing perspective is implemented; other perspectives are stubs.
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { installBrowserShim } from './shim.js';
import { installCairoHost, contextForCr } from './cairo-host.js';
import { readGgb, writeGgb } from './ggbfile.js';
import { loadFunctions } from './functions.js';
import { loadCas } from './cas.js';

const modulePath = ARGV[0];
if (!modulePath) {
    printerr('usage: gjs -m gtk-app.js <ggbcanvas.nocache.js>');
    imports.system.exit(1);
}

// --- Giac CAS (WebAssembly) -------------------------------------------------
// Loaded before the kernel starts, so CAS commands work from the first
// evaluation; the backend reaches it through the global `ggbCas`.
const hostDir = GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]);
const casGlue = GLib.getenv('GJSGEBRA_CAS_GLUE') || hostDir + '/giac-glue.js';
const casWasm = GLib.getenv('GJSGEBRA_CAS_WASM') || hostDir + '/giac.wasm';
let casReady = false;
try {
    casReady = loadCas(casGlue, casWasm);
} catch (e) {
    printerr('cas: unavailable (' + e.message + '); CAS commands stay numeric');
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
// only turn CAS on once we know there is an engine behind it: without one the
// kernel would answer "?" instead of falling back to the numeric variant
GgbApp.setCasEnabled(casReady);
GgbApp.evalCommand('A=(1,2)');
GgbApp.evalCommand('f(x)=x^2');
GgbApp.evalCommand('s=Line(A,(3,1))');

const FUNCTIONS = loadFunctions(import.meta.url);

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
    application_id: 'io.github.lin_calvin.gjsgebra',
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});

let win = null;
let area = null;
let listBox = null;
let algebraEntry = null;
let stack = null;
let mainStack = null;
let toastOverlay = null;
let currentPath = null;
let calcEntry = null;
let historyBox = null;
let historyScroll = null;
let lastResult = '';

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

// ------------------------------------------------------------- gesture debug
// GJSGEBRA_GESTURE_DEBUG=1 prints every gesture event, so touchpad / touchscreen
// problems can be diagnosed from a real machine.
const GESTURE_DEBUG = GLib.getenv('GJSGEBRA_GESTURE_DEBUG') === '1';
function dbg(...args) {
    if (GESTURE_DEBUG) {
        print('[gesture] ' + args.join(' '));
    }
}

/** Short name of a GdkEvent type, for the gesture trace. */
function evName(event) {
    if (!event) {
        return 'no-event';
    }
    const type = event.get_event_type();
    if (type === Gdk.EventType.TOUCHPAD_PINCH) {
        return 'touchpad-pinch';
    }
    if (type === Gdk.EventType.TOUCH_UPDATE) {
        return 'touch-update';
    }
    if (type === Gdk.EventType.TOUCH_BEGIN) {
        return 'touch-begin';
    }
    return 'event-' + type;
}

// GJSGEBRA_FRAME_DEBUG=1 reports canvas frame times: how long the kernel paint
// takes and how often the frame clock actually calls us.
const FRAME_DEBUG = GLib.getenv('GJSGEBRA_FRAME_DEBUG') === '1';
// GJSGEBRA_NO_COALESCE=1 applies every input event immediately instead of once
// per frame; only useful for A/B profiling the view-change coalescing.
const NO_COALESCE = GLib.getenv('GJSGEBRA_NO_COALESCE') === '1';
const frame = { last: 0, count: 0, paint: 0, worst: 0, windowStart: 0, applied: 0 };

function frameDone(paintMs) {
    if (!FRAME_DEBUG) {
        return;
    }
    const now = GLib.get_monotonic_time();
    if (frame.windowStart === 0) {
        frame.windowStart = now;
        frame.last = now;
    }
    frame.count++;
    frame.paint += paintMs;
    frame.worst = Math.max(frame.worst, paintMs);
    if (now - frame.windowStart >= 1000000) {
        const seconds = (now - frame.windowStart) / 1e6;
        print(`[frame] ${(frame.count / seconds).toFixed(1)} fps  ` +
            `paint ${(frame.paint / frame.count).toFixed(2)} ms  ` +
            `worst ${frame.worst.toFixed(1)} ms  ` +
            `applied ${(frame.applied / seconds).toFixed(1)}/s  (${frame.count} frames / ${seconds.toFixed(1)} s)`);
        frame.count = 0;
        frame.paint = 0;
        frame.worst = 0;
        frame.applied = 0;
        frame.windowStart = now;
    }
}

function updateTitle() {
    if (win) {
        win.set_title(currentPath
            ? GLib.path_get_basename(currentPath) + ' — GJSGebra'
            : 'GJSGebra');
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

function textColor() {
    return Adw.StyleManager.get_default().get_dark() ? [230, 230, 230] : [0, 0, 0];
}

function latexWidget(latex, size, rgb) {
    const parts = GgbApp.measureLatex(latex, size).split(',').map(Number);
    const width = Math.max(1, Math.ceil(parts[0]));
    const height = Math.max(1, Math.ceil(parts[1]));
    const area = new Gtk.DrawingArea({
        width_request: width + 4,
        height_request: height + 8,
    });
    area.set_valign(Gtk.Align.CENTER);
    area.set_draw_func((widget, cr, w, h) => {
        GgbApp.drawLatex(contextForCr(cr, w, h), latex, size, 2, 2,
            rgb[0], rgb[1], rgb[2]);
    });
    return area;
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
        const [label, , visible, color, latex] = line.split('\t');
        const row = new Gtk.ListBoxRow();
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 6,
            margin_end: 6,
        });
        const labelWidget = new Gtk.Label({ label: label, width_chars: 3, xalign: 0 });
        labelWidget.add_css_class('heading');
        const formula = latexWidget(latex || label, 15, textColor());
        formula.set_hexpand(true);
        formula.set_halign(Gtk.Align.START);
        const eye = new Gtk.ToggleButton({
            icon_name: visible === '0' ? 'view-hidden-symbolic' : 'view-visible-symbolic',
            active: visible !== '0',
            has_frame: false,
        });
        eye.connect('toggled', () => {
            GgbApp.setVisible(label, eye.get_active());
            redraw();
        });
        box.append(colorDot(color || '#000000'));
        box.append(labelWidget);
        box.append(formula);
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

// ------------------------------------------------------------------- panels

function buildAlgebraPanel() {
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
    inputRow.append(buildFunctionSelector((name) => insertInto(algebraEntry, name + '(')));

    listBox = new Gtk.ListBox({ selection_mode: Gtk.SelectionMode.NONE });
    listBox.add_css_class('navigation-sidebar');
    const scrolled = new Gtk.ScrolledWindow({ vexpand: true });
    scrolled.set_child(listBox);

    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    box.append(inputRow);
    box.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }));
    box.append(scrolled);
    return box;
}

function buildToolsPanel() {
    const flow = new Gtk.FlowBox({
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 8,
        margin_end: 8,
        row_spacing: 6,
        column_spacing: 6,
        selection_mode: Gtk.SelectionMode.NONE,
        max_children_per_line: 3,
    });
    for (const [icon, label, mode] of TOOLS) {
        const button = new Gtk.Button();
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
        box.append(new Gtk.Image({ icon_name: icon, pixel_size: 24 }));
        box.append(new Gtk.Label({ label, wrap: true, justify: Gtk.Justification.CENTER }));
        button.set_child(box);
        button.set_size_request(84, 72);
        button.connect('clicked', () => GgbApp.setMode(mode));
        flow.append(button);
    }
    const scrolled = new Gtk.ScrolledWindow({ vexpand: true });
    scrolled.set_child(flow);
    return scrolled;
}

function railButton(iconName, label) {
    const button = new Gtk.ToggleButton();
    button.add_css_class('flat');
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2,
        margin_top: 6,
        margin_bottom: 6,
    });
    box.append(new Gtk.Image({ icon_name: iconName, pixel_size: 20 }));
    const text = new Gtk.Label({ label });
    text.add_css_class('caption');
    box.append(text);
    button.set_child(box);
    button.set_tooltip_text(label);
    return button;
}

// ------------------------------------------------------------- calculator

function appendHistory(expression, result) {
    const item = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2,
        margin_top: 6,
        margin_bottom: 6,
        margin_start: 12,
        margin_end: 12,
    });
    const expressionWidget = latexWidget(GgbApp.toLatex(expression), 18, [128, 128, 128]);
    expressionWidget.set_halign(Gtk.Align.END);
    item.append(expressionWidget);
    if (result === 'error') {
        const errorLabel = new Gtk.Label({ label: '?', xalign: 1 });
        errorLabel.add_css_class('error');
        item.append(errorLabel);
    } else {
        const resultWidget = latexWidget(result, 18, textColor());
        resultWidget.set_halign(Gtk.Align.END);
        item.append(resultWidget);
    }
    historyBox.append(item);
}

function scrollHistoryToBottom() {
    // GJS wants the priority as the first argument
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        if (historyScroll) {
            const adjustment = historyScroll.get_vadjustment();
            adjustment.set_value(adjustment.get_upper() - adjustment.get_page_size());
        }
        return GLib.SOURCE_REMOVE;
    });
}

function submitRepl() {
    const text = calcEntry.get_text().trim();
    if (!text) {
        return;
    }
    const expression = text.replace(/\bans\b/g, lastResult || '0');
    const result = GgbApp.evaluateRepl(expression);
    if (result !== 'error') {
        lastResult = result;
    }
    appendHistory(text, result);
    calcEntry.set_text('');
    scrollHistoryToBottom();
}

function buildCalculator() {
    historyBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
    historyScroll = new Gtk.ScrolledWindow({ vexpand: true, hexpand: true });
    historyScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    historyScroll.set_child(historyBox);

    calcEntry = new Gtk.Entry({
        placeholder_text: 'Enter an expression…   e.g.  sin(30)+2^3',
        hexpand: true,
    });
    calcEntry.connect('activate', submitRepl);

    const calcInputRow = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
        margin_top: 8,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12,
    });
    calcInputRow.append(calcEntry);
    calcInputRow.append(buildFunctionSelector((name) => insertInto(calcEntry, name + '(')));

    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
    box.append(historyScroll);
    box.append(calcInputRow);
    const clamp = new Adw.Clamp({ maximum_size: 760, tightening_threshold: 600 });
    clamp.set_child(box);
    return clamp;
}

// ------------------------------------------------------ function selector

function buildFunctionSelector(onPick) {
    const listBox = new Gtk.ListBox({ selection_mode: Gtk.SelectionMode.NONE });
    const names = new Map();
    const search = new Gtk.SearchEntry({ placeholder_text: 'Search functions…' });
    const scrolled = new Gtk.ScrolledWindow({ vexpand: true });
    scrolled.set_child(listBox);
    scrolled.set_size_request(380, 340);

    const fill = (filter) => {
        let child;
        while ((child = listBox.get_first_child())) {
            listBox.remove(child);
        }
        names.clear();
        const lower = (filter || '').toLowerCase();
        for (const entry of FUNCTIONS) {
            if (lower && !entry.name.toLowerCase().includes(lower)) {
                continue;
            }
            const row = new Gtk.ListBoxRow();
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 10,
                margin_top: 3,
                margin_bottom: 3,
                margin_start: 8,
                margin_end: 8,
            });
            const nameLabel = new Gtk.Label({ label: entry.name, width_chars: 16, xalign: 0 });
            nameLabel.add_css_class('heading');
            const syntaxLabel = new Gtk.Label({
                label: entry.syntaxes[0] || '',
                xalign: 0,
                hexpand: true,
                ellipsize: 3,
            });
            syntaxLabel.add_css_class('dim-label');
            box.append(nameLabel);
            box.append(syntaxLabel);
            row.set_child(box);
            names.set(row, entry.name);
            listBox.append(row);
            if (names.size >= 300) {
                break;
            }
        }
    };
    fill('');

    search.connect('search-changed', () => fill(search.get_text()));
    search.connect('activate', () => {
        const first = listBox.get_row_at_index(0);
        if (first) {
            onPick(names.get(first));
        }
    });
    listBox.connect('row-activated', (lb, row) => onPick(names.get(row)));

    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 });
    box.append(search);
    box.append(scrolled);
    const popover = new Gtk.Popover();
    popover.set_child(box);

    const button = new Gtk.MenuButton({ tooltip_text: 'Functions' });
    const label = new Gtk.Label({ label: 'ƒx' });
    label.add_css_class('heading');
    button.set_child(label);
    button.add_css_class('flat');
    button.set_popover(popover);
    button.connect('notify::active', () => {
        if (button.get_active()) {
            search.grab_focus();
        }
    });
    return button;
}

function insertInto(entry, text) {
    const current = entry.get_text();
    const pos = entry.get_position();
    entry.set_text(current.slice(0, pos) + text + current.slice(pos));
    entry.set_position(pos + text.length);
    entry.grab_focus();
}

// ---------------------------------------------------------------------- shell

function buildUI() {
    const header = new Adw.HeaderBar();
    header.add_css_class('flat');

    // left: main menu
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
    menu.append('About GJSGebra', 'app.about');
    const menuButton = new Gtk.MenuButton({
        icon_name: 'open-menu-symbolic',
        menu_model: menu,
        tooltip_text: 'Menu',
    });
    menuButton.add_css_class('flat');
    header.pack_start(menuButton);

    // centre: the perspectives as an inline segmented switcher (GNOME style, icon
    // + label per segment). The stack itself is attached further down, once built.
    const switcher = new Adw.InlineViewSwitcher({
        display_mode: Adw.InlineViewSwitcherDisplayMode.BOTH,
        can_shrink: false,
    });
    header.set_title_widget(switcher);

    // --- rail + panel stack ---
    stack = new Gtk.Stack({
        transition_type: Gtk.StackTransitionType.CROSSFADE,
        hexpand: true,
        vexpand: true,
    });
    stack.add_named(buildAlgebraPanel(), 'algebra');
    stack.add_named(buildToolsPanel(), 'tools');

    const rail = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
    rail.add_css_class('toolbar');
    rail.set_size_request(72, -1);
    const railItems = [
        ['view-grid-symbolic', 'Algebra', 'algebra'],
        ['applications-science-symbolic', 'Tools', 'tools'],
    ];
    let firstRailButton = null;
    for (const [icon, label, name] of railItems) {
        const button = railButton(icon, label);
        if (firstRailButton === null) {
            firstRailButton = button;
        } else {
            button.set_group(firstRailButton);
        }
        button.connect('toggled', () => {
            if (button.get_active()) {
                stack.set_visible_child_name(name);
            }
        });
        rail.append(button);
    }
    firstRailButton.set_active(true);

    const sidebar = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
    sidebar.set_size_request(400, -1);
    sidebar.append(rail);
    sidebar.append(new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL }));
    sidebar.append(stack);

    // --- graphics view ---
    area = new Gtk.DrawingArea();
    area.set_hexpand(true);
    area.set_vexpand(true);
    area.set_draw_func((widget, cr, width, height) => {
        const started = FRAME_DEBUG ? GLib.get_monotonic_time() : 0;
        GgbApp.setSize(width, height);
        GgbApp.drawOn(contextForCr(cr, width, height), width, height);
        if (FRAME_DEBUG) {
            frameDone((GLib.get_monotonic_time() - started) / 1000);
        }
    });
    // let the kernel ask for a redraw instead of every call site remembering to
    GgbApp.setRedrawRequest(() => redraw());

    const overlay = new Gtk.Overlay();
    overlay.set_child(area);

    // settings gear (top right)
    const gearPopover = new Gtk.Popover();
    const gearBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 8,
        margin_end: 8,
    });
    const gridToggle = new Gtk.CheckButton({ label: 'Show grid', active: true });
    gridToggle.connect('toggled', () => {
        GgbApp.evalCommand('ShowGrid(' + gridToggle.get_active() + ')');
        redraw();
    });
    const axesToggle = new Gtk.CheckButton({ label: 'Show axes', active: true });
    axesToggle.connect('toggled', () => {
        GgbApp.evalCommand('ShowAxes(' + axesToggle.get_active() + ')');
        redraw();
    });
    const resetButton = new Gtk.Button({ label: 'Reset view' });
    resetButton.connect('clicked', () => {
        GgbApp.resetView();
        redraw();
        gearPopover.popdown();
    });
    gearBox.append(gridToggle);
    gearBox.append(axesToggle);
    gearBox.append(resetButton);
    gearPopover.set_child(gearBox);
    const gearButton = new Gtk.MenuButton({ icon_name: 'emblem-system-symbolic', tooltip_text: 'Settings' });
    gearButton.set_popover(gearPopover);
    gearButton.add_css_class('flat');
    gearButton.set_halign(Gtk.Align.END);
    gearButton.set_valign(Gtk.Align.START);
    gearButton.set_margin_top(8);
    gearButton.set_margin_end(10);
    overlay.add_overlay(gearButton);

    // zoom buttons (right, centred)
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
    const resetView = new Gtk.Button({ icon_name: 'view-fullscreen-symbolic', tooltip_text: 'Reset view' });
    resetView.connect('clicked', () => { GgbApp.resetView(); redraw(); });
    zoomBox.append(zoomIn);
    zoomBox.append(zoomOut);
    zoomBox.append(resetView);
    overlay.add_overlay(zoomBox);

    // interaction: the kernel decides whether a drag pans the view (empty space)
    // or moves an object, so drags still go through its mouse pipeline
    let start = [0, 0];
    let dragging = false;
    let pinching = false;

    // --- coalescing --------------------------------------------------------
    // Changing the coordinate system is a full update of every drawable, which
    // costs milliseconds; a touchpad or a mouse delivers far more events per
    // second than we have frames. Accumulate the deltas and apply at most one
    // view change per frame, otherwise the event stream starves the frame clock.
    let pendingPan = [0, 0];
    let pendingZoom = 1;
    let pendingZoomAt = null;
    let pendingDrag = null;
    let flushTick = 0;

    const applyViewChanges = () => {
        if (FRAME_DEBUG) {
            frame.applied++;
        }
        if (pendingDrag) {
            GgbApp.mouseDrag(pendingDrag[0], pendingDrag[1], false, false, false, false);
            pendingDrag = null;
        }
        if (pendingPan[0] !== 0 || pendingPan[1] !== 0) {
            GgbApp.panBy(pendingPan[0], pendingPan[1]);
            pendingPan = [0, 0];
        }
        if (pendingZoom !== 1) {
            const [zx, zy] = pendingZoomAt || anchor();
            GgbApp.zoomAt(zx, zy, pendingZoom);
            pendingZoom = 1;
            pendingZoomAt = null;
        }
    };

    const scheduleViewChange = () => {
        if (NO_COALESCE) {
            applyViewChanges();
            redraw();
            return;
        }
        if (flushTick) {
            return;
        }
        flushTick = area.add_tick_callback(() => {
            flushTick = 0;
            applyViewChanges();
            redraw();
            return false; // one shot; the next event schedules again
        });
    };

    const panBy = (dx, dy) => {
        pendingPan[0] += dx;
        pendingPan[1] += dy;
        scheduleViewChange();
    };

    const zoomAt = (factor, x, y) => {
        pendingZoom *= factor;
        pendingZoomAt = [x, y];
        scheduleViewChange();
    };

    const endKernelDrag = (x, y) => {
        if (dragging) {
            dragging = false;
            GgbApp.mouseUp(x, y, 1, false, false, false, false);
            refreshAlgebra();
            redraw();
        }
    };

    const drag = new Gtk.GestureDrag();
    drag.connect('drag-begin', (g, x, y) => {
        if (pinching) {
            return;
        }
        start = [x, y];
        dragging = true;
        dbg('drag-begin', x.toFixed(1), y.toFixed(1));
        GgbApp.mouseDown(x, y, 1, false, false, false, false, 1);
    });
    drag.connect('drag-update', (g, ox, oy) => {
        if (pinching || !dragging) {
            return;
        }
        // keep only the latest position: the kernel derives its own delta from
        // the previous one, so intermediate positions add nothing
        pendingDrag = [start[0] + ox, start[1] + oy];
        scheduleViewChange();
    });
    drag.connect('drag-end', (g, ox, oy) => {
        if (pinching) {
            return;
        }
        // apply the last delta before releasing, otherwise it is dropped
        pendingDrag = [start[0] + ox, start[1] + oy];
        applyViewChanges();
        endKernelDrag(start[0] + ox, start[1] + oy);
    });
    area.add_controller(drag);

    let last = [0, 0];
    const motion = new Gtk.EventControllerMotion();
    motion.connect('motion', (c, x, y) => {
        last = [x, y];
        GgbApp.mouseMove(x, y, false, false, false, false);
    });
    area.add_controller(motion);

    // Zoom anchor: the pointer while it is over the canvas, else the centre.
    const anchor = () => {
        const w = area.get_width();
        const h = area.get_height();
        if (last[0] > 0 && last[0] < w && last[1] > 0 && last[1] < h) {
            return last;
        }
        return [w / 2, h / 2];
    };

    // Scroll. A two-finger touchpad scroll pans the view (GNOME-style); every
    // other device - mouse wheel, smooth-scrolling mouse, trackpoint - keeps the
    // classic zoom, so a desktop without a touchpad behaves exactly as before.
    // Ctrl/Meta always zooms, Shift always pans.
    const scroll = new Gtk.EventControllerScroll({
        flags: Gtk.EventControllerScrollFlags.BOTH_AXES,
    });
    scroll.connect('scroll', (c, dx, dy) => {
        const device = c.get_current_event_device();
        const source = device ? device.get_source() : Gdk.InputSource.MOUSE;
        const state = c.get_current_event_state();
        const zoomMod = (state & (Gdk.ModifierType.CONTROL_MASK
            | Gdk.ModifierType.META_MASK)) !== 0;
        const panMod = (state & Gdk.ModifierType.SHIFT_MASK) !== 0;
        const touchpad = source === Gdk.InputSource.TOUCHPAD;
        dbg('scroll', 'source=' + source, 'unit=' + c.get_unit(),
            'dx=' + dx.toFixed(3), 'dy=' + dy.toFixed(3),
            'ctrl=' + zoomMod, 'shift=' + panMod);
        if (panMod || (touchpad && !zoomMod)) {
            panBy(-dx, -dy);
        } else {
            const [ax, ay] = anchor();
            zoomAt(Math.pow(1.1, -dy), ax, ay);
        }
        return true;
    });
    area.add_controller(scroll);

    // Pinch-to-zoom. One gesture covers both sources: GtkGestureZoom tracks two
    // touch sequences on a touchscreen, and GTK feeds it GDK_TOUCHPAD_PINCH for a
    // touchpad (gtk_gesture_zoom_filter_event lets those through). Its scale is
    // cumulative from the start of the gesture, so only the ratio between two
    // consecutive reports may be applied.
    let pinchScale = 1;
    const pinch = new Gtk.GestureZoom();
    area.add_controller(pinch);
    // grouped with the drag, otherwise the drag claims the first finger and the
    // pinch never sees both sequences
    pinch.group(drag);
    pinch.connect('begin', () => {
        pinching = true;
        pinchScale = 1;
        const [x, y] = anchor();
        endKernelDrag(x, y);
        dbg('pinch-begin', evName(pinch.get_current_event()));
    });
    pinch.connect('end', () => {
        if (pinching) {
            pinching = false;
            pinchScale = 1;
            dbg('pinch-end');
        }
    });
    pinch.connect('cancel', () => {
        if (pinching) {
            pinching = false;
            pinchScale = 1;
            dbg('pinch-cancel');
        }
    });
    pinch.connect('scale-changed', (g, scale) => {
        const factor = scale / pinchScale;
        pinchScale = scale;
        const [found, cx, cy] = g.get_bounding_box_center();
        const [ax, ay] = found ? [cx, cy] : anchor();
        dbg('pinch-scale', 'scale=' + scale.toFixed(4), 'factor=' + factor.toFixed(4),
            evName(g.get_current_event()), found ? 'anchor=gesture' : 'anchor=pointer');
        zoomAt(factor, ax, ay);
    });

    const split = new Adw.OverlaySplitView();
    split.set_show_sidebar(true);
    split.set_sidebar_width_fraction(0.36);
    split.set_sidebar(sidebar);
    split.set_content(overlay);

    const toolbarView = new Adw.ToolbarView();
    toolbarView.add_top_bar(header);
    // AdwViewStack, because AdwInlineViewSwitcher only drives that one
    mainStack = new Adw.ViewStack();
    mainStack.add_titled_with_icon(split, 'graphing', 'Graphing', 'view-grid-symbolic');
    mainStack.add_titled_with_icon(buildCalculator(), 'calculator', 'Calculator',
        'accessories-calculator-symbolic');
    switcher.set_stack(mainStack);
    toolbarView.set_content(mainStack);

    toastOverlay = new Adw.ToastOverlay();
    toastOverlay.set_child(toolbarView);

    win = new Adw.ApplicationWindow({
        application: app,
        title: 'GJSGebra',
        default_width: 1180,
        default_height: 760,
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
addAction('perspective-graphing', () => {
    if (mainStack) {
        mainStack.set_visible_child_name('graphing');
    }
});
addAction('perspective-calculator', () => {
    if (mainStack) {
        mainStack.set_visible_child_name('calculator');
    }
    if (calcEntry) {
        calcEntry.grab_focus();
    }
});
addAction('about', () => {
    const about = new Adw.AboutWindow({
        application_name: 'GJSGebra',
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
