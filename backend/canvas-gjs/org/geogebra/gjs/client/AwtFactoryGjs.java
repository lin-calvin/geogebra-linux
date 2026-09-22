package org.geogebra.gjs.client;

import org.geogebra.common.awt.GBufferedImage;
import org.geogebra.common.awt.GColor;
import org.geogebra.common.awt.GFont;
import org.geogebra.common.awt.GFontRenderContext;
import org.geogebra.common.awt.GGraphics2D;
import org.geogebra.common.awt.GGradientPaint;
import org.geogebra.common.awt.GPaint;
import org.geogebra.common.awt.GRectangle;
import org.geogebra.common.awt.MyImage;
import org.geogebra.common.awt.font.GTextLayout;
import org.geogebra.ggbjdk.factories.AwtFactoryHeadless;

/**
 * GTK/Cairo backend. Extends the upstream {@code AwtFactoryHeadless}, which already
 * provides every piece of platform-independent geometry (paths, rectangles, strokes,
 * transforms, areas). Only the drawing/text/image parts are overridden.
 */
public class AwtFactoryGjs extends AwtFactoryHeadless {

	@Override
	public GBufferedImage newBufferedImage(int pixelWidth, int pixelHeight, double pixelRatio) {
		return new GBufferedImageGjs(pixelWidth, pixelHeight, pixelRatio);
	}

	@Override
	public GBufferedImage newBufferedImage(int pixelWidth, int pixelHeight, GGraphics2D g2) {
		return new GBufferedImageGjs(pixelWidth, pixelHeight, 1);
	}

	@Override
	public GBufferedImage createBufferedImage(int width, int height, boolean transparency) {
		return new GBufferedImageGjs(width, height, 1);
	}

	@Override
	public GTextLayout newTextLayout(String string, GFont fontLine, GFontRenderContext frc) {
		return new GTextLayoutGjs(string, fontLine);
	}

	@Override
	public GAlphaCompositeGjs newAlphaComposite(double alpha) {
		return new GAlphaCompositeGjs(alpha);
	}

	@Override
	public GGradientPaint newGradientPaint(double x1, double y1, GColor color1,
			double x2, double y2, GColor color2) {
		return new GGradientPaintGjs(x1, y1, color1, x2, y2, color2);
	}

	@Override
	public GPaint newTexturePaint(GBufferedImage subimage, GRectangle rect) {
		return new GTexturePaintGjs(subimage, rect);
	}

	@Override
	public GPaint newTexturePaint(MyImage subimage, GRectangle rect) {
		return new GTexturePaintGjs(new GBufferedImageGjs(1, 1, 1), rect);
	}

	@Override
	public GFont newFont(String name, int style, double size) {
		return new GFontGjs(name, style, size);
	}
}
