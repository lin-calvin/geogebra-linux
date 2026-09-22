package org.geogebra.gjs.client;

import org.geogebra.common.awt.AwtFactory;
import org.geogebra.common.awt.GAffineTransform;
import org.geogebra.common.awt.GAlphaComposite;
import org.geogebra.common.awt.GBasicStroke;
import org.geogebra.common.awt.GBufferedImage;
import org.geogebra.common.awt.GColor;
import org.geogebra.common.awt.GComposite;
import org.geogebra.common.awt.GFont;
import org.geogebra.common.awt.GFontRenderContext;
import org.geogebra.common.awt.GGraphics2D;
import org.geogebra.common.awt.GPaint;
import org.geogebra.common.awt.GPathIterator;
import org.geogebra.common.awt.GRectangle2D;
import org.geogebra.common.awt.GShape;
import org.geogebra.common.awt.MyImage;
import org.geogebra.ggbjdk.java.awt.geom.GeneralPath;
import org.geogebra.ggbjdk.java.awt.geom.Path2D;
import org.geogebra.ggbjdk.java.awt.geom.Shape;

/**
 * {@link GGraphics2D} implementation on top of a host-provided Cairo surface.
 *
 * <p>Shape geometry comes from {@code org.geogebra.ggbjdk} (upstream, platform
 * independent); only the actual drawing calls go to {@link HostContext}. This keeps
 * the backend free of any {@code org.geogebra.web} or DOM dependency.
 */
public class GGraphics2DGjs implements GGraphics2D {

	private static final double ROUND_K = 4.0 / 3 * (Math.sqrt(2) - 1);

	private final HostContext ctx;
	private final int offsetWidth;
	private final int offsetHeight;
	private final double[] coords = new double[6];

	private GColor color = GColor.newColor(255, 255, 255, 255);
	private GFont font = new GFontGjs("normal");
	private GComposite composite = new GAlphaCompositeGjs(1);
	private double lineWidth = 1;
	private boolean clipSaved;

	public GGraphics2DGjs(HostContext ctx, int width, int height) {
		this.ctx = ctx;
		this.offsetWidth = width;
		this.offsetHeight = height;
		if (ctx != null) {
			ctx.setLineWidth(lineWidth);
			updateCanvasColor();
		}
	}

	// ---------------------------------------------------------------- shapes

	private void buildPath(GShape shape) {
		ctx.beginPath();
		GPathIterator it = shape.getPathIterator(null);
		while (!it.isDone()) {
			int seg = it.currentSegment(coords);
			switch (seg) {
			case GPathIterator.SEG_MOVETO:
				ctx.moveTo(coords[0], coords[1]);
				break;
			case GPathIterator.SEG_LINETO:
				ctx.lineTo(coords[0], coords[1]);
				break;
			case GPathIterator.SEG_QUADTO:
				ctx.quadraticCurveTo(coords[0], coords[1], coords[2], coords[3]);
				break;
			case GPathIterator.SEG_CUBICTO:
				ctx.bezierCurveTo(coords[0], coords[1], coords[2], coords[3],
						coords[4], coords[5]);
				break;
			case GPathIterator.SEG_CLOSE:
				ctx.closePath();
				break;
			default:
				break;
			}
			it.next();
		}
	}

	@Override
	public void draw(GShape shape) {
		if (shape == null || ctx == null) {
			return;
		}
		buildPath(shape);
		ctx.stroke();
	}

	@Override
	public void fill(GShape shape) {
		if (shape == null || ctx == null) {
			return;
		}
		buildPath(shape);
		if (shape instanceof GeneralPath
				&& ((GeneralPath) shape).getWindingRule() == Path2D.WIND_EVEN_ODD) {
			ctx.fillEvenOdd();
		} else {
			ctx.fill();
		}
	}

	// ------------------------------------------------------------- primitives

	@Override
	public void drawLine(int x1, int y1, int x2, int y2) {
		if (ctx == null) {
			return;
		}
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.closePath();
		ctx.stroke();
	}

	@Override
	public void drawStraightLine(double x1, double y1, double x2, double y2) {
		if (ctx == null) {
			return;
		}
		int width = (int) lineWidth;
		ctx.beginPath();
		if (isOdd(width)) {
			ctx.moveTo(Math.floor(x1) + 0.5, Math.floor(y1) + 0.5);
			ctx.lineTo(Math.floor(x2) + 0.5, Math.floor(y2) + 0.5);
		} else {
			ctx.moveTo(Math.round(x1), Math.round(y1));
			ctx.lineTo(Math.round(x2), Math.round(y2));
		}
		ctx.stroke();
	}

	private static boolean isOdd(int value) {
		return (value & 1) != 0;
	}

	@Override
	public void drawRect(int x, int y, int width, int height) {
		if (ctx == null) {
			return;
		}
		ctx.beginPath();
		ctx.rect(x, y, width, height);
		ctx.stroke();
	}

	@Override
	public void fillRect(int x, int y, int w, int h) {
		if (ctx != null) {
			ctx.fillRect(x, y, w, h);
		}
	}

	@Override
	public void clearRect(int x, int y, int w, int h) {
		if (ctx != null) {
			ctx.clearRect(x, y, w, h);
		}
	}

	@Override
	public void drawRoundRect(int x, int y, int width, int height, int arcWidth, int arcHeight) {
		if (ctx == null) {
			return;
		}
		roundRect(x, y, width, height, arcWidth / 2.0);
		ctx.stroke();
	}

	@Override
	public void fillRoundRect(int x, int y, int width, int height, int arcWidth, int arcHeight) {
		if (ctx == null) {
			return;
		}
		roundRect(x, y, width, height, arcHeight / 2d);
		ctx.fillEvenOdd();
	}

	private void roundRect(double x, double y, double w, double h, double r) {
		double right = x + w;
		double bottom = y + h;
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(right - r, y);
		ctx.bezierCurveTo(right + r * (ROUND_K - 1), y, right, y + r * (1 - ROUND_K), right, y + r);
		ctx.lineTo(right, bottom - r);
		ctx.bezierCurveTo(right, bottom + r * (ROUND_K - 1), right + r * (ROUND_K - 1), bottom,
				right - r, bottom);
		ctx.lineTo(x + r, bottom);
		ctx.bezierCurveTo(x + r * (1 - ROUND_K), bottom, x, bottom + r * (ROUND_K - 1), x,
				bottom - r);
		ctx.lineTo(x, y + r);
		ctx.bezierCurveTo(x, y + r * (1 - ROUND_K), x + r * (1 - ROUND_K), y, x + r, y);
		ctx.closePath();
	}

	@Override
	public void startGeneralPath() {
		if (ctx != null) {
			ctx.beginPath();
		}
	}

	@Override
	public void addStraightLineToGeneralPath(double x1, double y1, double x2, double y2) {
		if (ctx == null) {
			return;
		}
		if (isOdd((int) lineWidth)) {
			ctx.moveTo(Math.floor(x1) + 0.5, Math.floor(y1) + 0.5);
			ctx.lineTo(Math.floor(x2) + 0.5, Math.floor(y2) + 0.5);
		} else {
			ctx.moveTo(Math.round(x1), Math.round(y1));
			ctx.lineTo(Math.round(x2), Math.round(y2));
		}
	}

	@Override
	public void endAndDrawGeneralPath() {
		if (ctx != null) {
			ctx.stroke();
		}
	}

	// ------------------------------------------------------------------ text

	@Override
	public void drawString(String str, int x, int y) {
		drawString(str, (double) x, y);
	}

	@Override
	public void drawString(String str, double x, double y) {
		if (ctx == null || str == null) {
			return;
		}
		ctx.setFont(font instanceof GFontGjs ? ((GFontGjs) font).getFullFontString() : "12px sans");
		ctx.fillText(str, x, y);
	}

	@Override
	public void setFont(GFont font) {
		if (font != null) {
			this.font = font;
		}
	}

	@Override
	public GFont getFont() {
		return font;
	}

	@Override
	public GFontRenderContext getFontRenderContext() {
		return new GFontRenderContextGjs();
	}

	// ----------------------------------------------------------------- color

	@Override
	public void setColor(GColor fillColor) {
		if (fillColor == null || fillColor.equals(color)) {
			return;
		}
		this.color = fillColor;
		updateCanvasColor();
	}

	@Override
	public GColor getColor() {
		return color;
	}

	@Override
	public GColor getBackground() {
		return GColor.WHITE;
	}

	@Override
	public void updateCanvasColor() {
		if (ctx == null || color == null) {
			return;
		}
		String css = "rgba(" + color.getRed() + "," + color.getGreen() + "," + color.getBlue()
				+ "," + (color.getAlpha() / 255d) + ")";
		ctx.setStrokeStyle(css);
		ctx.setFillStyle(css);
	}

	@Override
	public void setPaint(GPaint paint) {
		if (paint instanceof GColor) {
			setColor((GColor) paint);
		} else if (paint instanceof GGradientPaintGjs) {
			setColor(((GGradientPaintGjs) paint).getColor1());
		} else if (paint instanceof GTexturePaintGjs) {
			// texture patterns are not wired to the host yet
			HostGraphics.log("texture paint not supported by gjs backend yet");
		}
	}

	// ---------------------------------------------------------------- stroke

	@Override
	public void setStroke(GBasicStroke stroke) {
		if (stroke == null || ctx == null) {
			return;
		}
		this.lineWidth = stroke.getLineWidth();
		ctx.setLineWidth(lineWidth);
		ctx.setLineCap(endCapString(stroke.getEndCap()));
		ctx.setLineJoin(lineJoinString(stroke.getLineJoin()));
		double[] dash = stroke.getDashArray();
		ctx.setLineDash(dash == null ? new double[0] : dash);
	}

	private static String endCapString(int cap) {
		switch (cap) {
		case GBasicStroke.CAP_ROUND:
			return "round";
		case GBasicStroke.CAP_SQUARE:
			return "square";
		default:
			return "butt";
		}
	}

	private static String lineJoinString(int join) {
		switch (join) {
		case GBasicStroke.JOIN_ROUND:
			return "round";
		case GBasicStroke.JOIN_BEVEL:
			return "bevel";
		default:
			return "miter";
		}
	}

	@Override
	public void setRenderingHint(int hintKey, int hintValue) {
		// no-op
	}

	@Override
	public void setAntialiasing() {
		// host always antialiases
	}

	@Override
	public void setTransparent() {
		setComposite(new GAlphaCompositeGjs(1));
	}

	@Override
	public Object setInterpolationHint(boolean needsInterpolationRenderingHint) {
		return null;
	}

	@Override
	public void resetInterpolationHint(Object oldInterpolationHint) {
		// no-op
	}

	// ------------------------------------------------------------ composite

	@Override
	public void setComposite(GComposite comp) {
		this.composite = comp;
		if (ctx != null && comp instanceof GAlphaCompositeGjs) {
			ctx.setGlobalAlpha(((GAlphaCompositeGjs) comp).getAlpha());
		}
	}

	@Override
	public GComposite getComposite() {
		return ctx == null ? composite : new GAlphaCompositeGjs(ctx.getGlobalAlpha());
	}

	// -------------------------------------------------------------- transform

	@Override
	public void translate(double tx, double ty) {
		if (ctx != null) {
			ctx.translate2(tx, ty);
		}
	}

	@Override
	public void scale(double sx, double sy) {
		if (ctx != null) {
			ctx.scale2(sx, sy);
		}
	}

	@Override
	public void transform(GAffineTransform tx) {
		if (ctx != null) {
			ctx.transform2(tx.getScaleX(), tx.getShearY(), tx.getShearX(), tx.getScaleY(),
					tx.getTranslateX(), tx.getTranslateY());
		}
	}

	@Override
	public void saveTransform() {
		if (ctx != null) {
			ctx.saveTransform();
		}
	}

	@Override
	public void restoreTransform() {
		if (ctx != null) {
			ctx.restoreTransform();
		}
	}

	// ------------------------------------------------------------------ clip

	@Override
	public void setClip(GShape shape) {
		doSetClip(shape, true);
	}

	@Override
	public void setClip(double x, double y, double width, double height) {
		setClip(x, y, width, height, true);
	}

	@Override
	public void setClip(double x, double y, double width, double height, boolean saveContext) {
		GRectangle2D rect = AwtFactory.getPrototype().newRectangle2D();
		rect.setRect(x, y, width, height);
		doSetClip(rect, saveContext);
	}

	private void doSetClip(GShape shape, boolean saveContext) {
		if (ctx == null) {
			return;
		}
		if (shape == null) {
			resetClip();
			return;
		}
		if (saveContext) {
			ctx.saveTransform();
			clipSaved = true;
		}
		buildPath(shape);
		ctx.clip();
	}

	@Override
	public void resetClip() {
		if (ctx == null) {
			return;
		}
		ctx.resetClip();
		if (clipSaved) {
			ctx.restoreTransform();
			clipSaved = false;
		}
	}

	// ---------------------------------------------------------------- images

	@Override
	public void drawImage(GBufferedImage img, int x, int y) {
		if (ctx != null && img instanceof GBufferedImageGjs) {
			ctx.drawImage(((GBufferedImageGjs) img).getContext(), x, y);
		}
	}

	@Override
	public void drawImage(MyImage img, int x, int y) {
		// image objects are not wired to the host yet
	}

	@Override
	public void drawImage(MyImage img, int dx, int dy, int dw, int dh) {
		// image objects are not wired to the host yet
	}

	@Override
	public void drawImage(MyImage img, int sx, int sy, int sw, int sh,
			int dx, int dy, int dw, int dh) {
		// image objects are not wired to the host yet
	}

	// ---------------------------------------------------------------- extras

	/** @return width of the surface in pixels */
	public int getOffsetWidth() {
		return offsetWidth;
	}

	/** @return height of the surface in pixels */
	public int getOffsetHeight() {
		return offsetHeight;
	}
}
