// GeoGebra on GTK4 + libadwaita (GJS), laid out like the official Calculator Suite:
//   header (menu + title + perspective) / icon rail + panel / graphics view
// Only the Graphing perspective is implemented; other perspectives are stubs.
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { installBrowserShim } from './shim.js';
import { installCairoHost, contextForCr } from './cairo-host.js';
import { readGgb, writeGgb } from './ggbfile.js';
import { loadFunctions } from './functions.js';

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
    application_id: 'io.github.lin_calvin.GJSGebra',
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
let perspectiveLabel = null;
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
    GLib.idle_add(() => {
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
    // no centred title (the title lives on the left, next to the menu)
    header.set_title_widget(new Gtk.Box());

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

    // title + perspective
    const title = new Gtk.Label({ label: 'GJSGebra' });
    title.add_css_class('title-4');
    header.pack_start(title);

    const perspectiveMenu = new Gio.Menu();
    perspectiveMenu.append('Graphing', 'app.perspective-graphing');
    perspectiveMenu.append('Scientific Calculator', 'app.perspective-calculator');
    const perspectiveChild = new Gtk.Box({ spacing: 6 });
    perspectiveChild.append(new Gtk.Image({ icon_name: 'view-grid-symbolic', pixel_size: 16 }));
    perspectiveLabel = new Gtk.Label({ label: 'Graphing' });
    perspectiveChild.append(perspectiveLabel);
    perspectiveChild.append(new Gtk.Image({ icon_name: 'pan-down-symbolic', pixel_size: 14 }));
    const perspectiveButton = new Gtk.MenuButton({ menu_model: perspectiveMenu });
    perspectiveButton.set_child(perspectiveChild);
    perspectiveButton.add_css_class('pill');
    perspectiveButton.set_margin_start(12);
    header.pack_start(perspectiveButton);

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
        GgbApp.setSize(width, height);
        GgbApp.drawOn(contextForCr(cr, width, height), width, height);
    });

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
    split.set_sidebar_width_fraction(0.36);
    split.set_sidebar(sidebar);
    split.set_content(overlay);

    const toolbarView = new Adw.ToolbarView();
    toolbarView.add_top_bar(header);
    mainStack = new Gtk.Stack({ transition_type: Gtk.StackTransitionType.CROSSFADE });
    mainStack.add_named(split, 'graphing');
    mainStack.add_named(buildCalculator(), 'calculator');
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
    if (perspectiveLabel) {
        perspectiveLabel.set_label('Graphing');
    }
});
addAction('perspective-calculator', () => {
    if (mainStack) {
        mainStack.set_visible_child_name('calculator');
    }
    if (perspectiveLabel) {
        perspectiveLabel.set_label('Scientific Calculator');
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
