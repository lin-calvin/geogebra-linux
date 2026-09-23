// GeoGebra on GTK4 + libadwaita (GJS).
// The kernel runs natively in GJS; drawing goes to Cairo; the chrome is native Adw.
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { installBrowserShim } from './shim.js';
import { installCairoHost, contextForCr } from './cairo-host.js';

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
const MODE = { MOVE: 0, POINT: 1, LINE: 2, PARALLEL: 3, ORTHOGONAL: 4,
    INTERSECT: 5, DELETE: 6, SEGMENT: 15, POLYGON: 16, MIDPOINT: 19, ANGLE: 36 };

const app = new Adw.Application({ application_id: 'org.geogebra.gjs' });

let area = null;
let listBox = null;
let toastOverlay = null;
let entry = null;

function redraw() {
    if (area) {
        area.queue_draw();
    }
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
        const [label, value, visible] = line.split('\t');
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
        const valueWidget = new Gtk.Label({
            label: value === undefined ? '' : value,
            xalign: 0,
            hexpand: true,
            ellipsize: 3,
        });
        if (visible === '0') {
            valueWidget.set_opacity(0.5);
        }
        box.append(labelWidget);
        box.append(valueWidget);
        row.set_child(box);
        listBox.append(row);
    }
}

function addAction(name, callback) {
    const action = new Gio.SimpleAction({ name });
    action.connect('activate', callback);
    app.add_action(action);
}

function toolButton(header, iconName, tooltip, mode) {
    const button = new Gtk.Button({ icon_name: iconName, tooltip_text: tooltip });
    button.connect('clicked', () => GgbApp.setMode(mode));
    header.pack_start(button);
    return button;
}

function buildUI() {
    const header = new Adw.HeaderBar();
    header.set_title_widget(new Adw.WindowTitle({ title: 'GeoGebra', subtitle: '' }));

    // tools
    toolButton(header, 'object-select-symbolic', 'Move', MODE.MOVE);
    toolButton(header, 'mark-location-symbolic', 'Point', MODE.POINT);
    toolButton(header, 'insert-object-symbolic', 'Line', MODE.LINE);
    toolButton(header, 'go-bottom-symbolic', 'Segment', MODE.SEGMENT);
    toolButton(header, 'view-grid-symbolic', 'Polygon', MODE.POLYGON);
    toolButton(header, 'edit-cut-symbolic', 'Intersect', MODE.INTERSECT);
    toolButton(header, 'go-top-symbolic', 'Angle', MODE.ANGLE);
    toolButton(header, 'user-trash-symbolic', 'Delete', MODE.DELETE);

    // menu
    const menu = new Gio.Menu();
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
    header.pack_end(menuButton);

    // algebra sidebar
    listBox = new Gtk.ListBox({ selection_mode: Gtk.SelectionMode.NONE });
    listBox.add_css_class('navigation-sidebar');
    const sidebar = new Gtk.ScrolledWindow({ hexpand: false });
    sidebar.set_child(listBox);
    sidebar.set_size_request(260, -1);

    // graphics area
    area = new Gtk.DrawingArea();
    area.set_hexpand(true);
    area.set_vexpand(true);
    area.set_draw_func((widget, cr, width, height) => {
        GgbApp.setSize(width, height);
        GgbApp.drawOn(contextForCr(cr, width, height), width, height);
    });

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

    // layout
    const split = new Adw.OverlaySplitView();
    split.set_show_sidebar(true);
    split.set_sidebar_width_fraction(0.28);
    split.set_sidebar(sidebar);
    split.set_content(area);

    const toolbarView = new Adw.ToolbarView();
    toolbarView.add_top_bar(header);
    toolbarView.set_content(split);

    // input bar
    const bottom = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
        margin_top: 6,
        margin_bottom: 6,
        margin_start: 6,
        margin_end: 6,
    });
    entry = new Gtk.Entry({ hexpand: true, placeholder_text: 'Input…  e.g.  B=(3,4)' });
    entry.connect('activate', () => {
        const text = entry.get_text().trim();
        if (!text) {
            return;
        }
        const result = GgbApp.evalCommand(text);
        entry.set_text('');
        if (result.startsWith('error') && toastOverlay) {
            toastOverlay.add_toast(new Adw.Toast({ title: result }));
        }
        refreshAlgebra();
        redraw();
    });
    bottom.append(entry);
    toolbarView.add_bottom_bar(bottom);

    toastOverlay = new Adw.ToastOverlay();
    toastOverlay.set_child(toolbarView);

    const win = new Adw.ApplicationWindow({
        application: app,
        title: 'GeoGebra',
        default_width: 1000,
        default_height: 680,
    });
    win.set_content(toastOverlay);
    win.present();

    // GeoGebra has no dark "theme", but the canvas can be transparent so the
    // libadwaita window background shows through; only axes/grid colours need to
    // follow the theme for contrast.
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

app.connect('activate', buildUI);

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

app.run(ARGV);
