// Real host for the GTK/Cairo backend: maps the HostContext drawing API onto Cairo.
import cairo from 'cairo';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';

function parseColor(css) {
    const m = /rgba?\(([^)]+)\)/.exec(String(css));
    if (!m) {
        return [0, 0, 0, 1];
    }
    const p = m[1].split(',').map((s) => parseFloat(s.trim()));
    return [(p[0] || 0) / 255, (p[1] || 0) / 255, (p[2] || 0) / 255,
        p.length > 3 ? p[3] : 1];
}

const CAPS = { butt: cairo.LineCap.BUTT, round: cairo.LineCap.ROUND, square: cairo.LineCap.SQUARE };
const JOINS = { miter: cairo.LineJoin.MITER, round: cairo.LineJoin.ROUND, bevel: cairo.LineJoin.BEVEL };

class CairoContext {
    constructor(width, height, cr) {
        this.width = width;
        this.height = height;
        if (cr) {
            // wrap an existing cairo_t (e.g. GtkDrawingArea's draw callback)
            this.cr = cr;
            this.surface = null;
        } else {
            this.surface = new cairo.ImageSurface(cairo.Format.ARGB32, width, height);
            this.cr = new cairo.Context(this.surface);
        }
        this.alpha = 1;
        this.strokeRGBA = [0, 0, 0, 1];
        this.fillRGBA = [0, 0, 0, 1];
        this.font = null;
        this.cx = 0;
        this.cy = 0;
        this.cr.setLineWidth(1);
    }

    _strokeSource() {
        const [r, g, b, a] = this.strokeRGBA;
        this.cr.setSourceRGBA(r, g, b, a * this.alpha);
    }

    _fillSource() {
        const [r, g, b, a] = this.fillRGBA;
        this.cr.setSourceRGBA(r, g, b, a * this.alpha);
    }

    beginPath() { this.cr.newPath(); }
    moveTo(x, y) { this.cr.moveTo(x, y); this.cx = x; this.cy = y; }
    lineTo(x, y) { this.cr.lineTo(x, y); this.cx = x; this.cy = y; }

    quadraticCurveTo(cpx, cpy, x, y) {
        const c1x = this.cx + (2 / 3) * (cpx - this.cx);
        const c1y = this.cy + (2 / 3) * (cpy - this.cy);
        const c2x = x + (2 / 3) * (cpx - x);
        const c2y = y + (2 / 3) * (cpy - y);
        this.cr.curveTo(c1x, c1y, c2x, c2y, x, y);
        this.cx = x;
        this.cy = y;
    }

    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
        this.cr.curveTo(c1x, c1y, c2x, c2y, x, y);
        this.cx = x;
        this.cy = y;
    }

    closePath() { this.cr.closePath(); }
    rect(x, y, w, h) { this.cr.rectangle(x, y, w, h); }

    stroke() { this._strokeSource(); this.cr.stroke(); }

    fill() {
        this._fillSource();
        this.cr.setFillRule(cairo.FillRule.WINDING);
        this.cr.fill();
    }

    fillEvenOdd() {
        this._fillSource();
        this.cr.setFillRule(cairo.FillRule.EVEN_ODD);
        this.cr.fill();
        this.cr.setFillRule(cairo.FillRule.WINDING);
    }

    clip() { this.cr.clip(); }
    resetClip() { this.cr.resetClip(); }
    saveTransform() { this.cr.save(); }
    restoreTransform() { this.cr.restore(); }
    translate2(x, y) { this.cr.translate(x, y); }
    scale2(sx, sy) { this.cr.scale(sx, sy); }
    transform2(a, b, c, d, e, f) { this.cr.transform(new cairo.Matrix(a, b, c, d, e, f)); }

    setStrokeStyle(css) { this.strokeRGBA = parseColor(css); }
    setFillStyle(css) { this.fillRGBA = parseColor(css); }
    setLineWidth(w) { this.cr.setLineWidth(w); }
    setLineCap(cap) { this.cr.setLineCap(CAPS[cap] ?? cairo.LineCap.BUTT); }
    setLineJoin(join) { this.cr.setLineJoin(JOINS[join] ?? cairo.LineJoin.MITER); }
    setLineDash(dash) { this.cr.setDash(Array.from(dash || []), 0); }
    getGlobalAlpha() { return this.alpha; }
    setGlobalAlpha(a) { this.alpha = a; }
    setFont(font) { this.font = String(font); }

    fillText(text, x, y) {
        this._fillSource();
        const desc = Pango.FontDescription.from_string(this.font || "Sans 12");
        const layout = PangoCairo.create_layout(this.cr);
        layout.set_font_description(desc);
        layout.set_text(String(text), -1);
        this.cr.save();
        this.cr.moveTo(x, y);
        PangoCairo.show_layout(this.cr, layout);
        this.cr.restore();
    }

    fillRect(x, y, w, h) {
        this._fillSource();
        this.cr.rectangle(x, y, w, h);
        this.cr.fill();
    }

    clearRect(x, y, w, h) {
        this.cr.save();
        this.cr.setOperator(cairo.Operator.CLEAR);
        this.cr.rectangle(x, y, w, h);
        this.cr.fill();
        this.cr.restore();
    }

    drawImage(image, ...args) {
        // image is another CairoContext
        if (!image || !image.surface) {
            return;
        }
        const pattern = new cairo.SurfacePattern(image.surface);
        if (args.length >= 8) {
            const [sx, sy, sw, sh, dx, dy, dw, dh] = args;
            this.cr.save();
            this.cr.translate(dx, dy);
            this.cr.scale(dw / sw, dh / sh);
            this.cr.translate(-sx, -sy);
            this.cr.setSource(pattern);
            this.cr.rectangle(dx, dy, dw, dh);
            this.cr.fill();
            this.cr.restore();
        } else {
            const [dx, dy] = args;
            this.cr.setSource(pattern);
            this.cr.paint();
        }
    }

    dispose() { this.surface.flush(); }
}

export function installCairoHost() {
    const log = [];
    globalThis.ggbHost = {
        available: () => true,
        log: (m) => {
            print("[host] " + m);
            log.push("log: " + m);
        },
        createContext: (w, h) => new CairoContext(w, h),
        writePng: (ctx, path) => {
            ctx.surface.writeToPNG(path);
            log.push("writePng " + path);
        },
    };
    return { log, CairoContext };
}

/** Wraps an existing cairo_t (e.g. a GtkDrawingArea draw callback). */
export function contextForCr(cr, width, height) {
    return new CairoContext(width, height, cr);
}
