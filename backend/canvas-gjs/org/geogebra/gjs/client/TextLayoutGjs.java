package org.geogebra.gjs.client;

import org.geogebra.common.awt.AwtFactory;
import org.geogebra.common.awt.GRectangle2D;

import com.himamis.retex.renderer.share.platform.font.TextLayout;
import com.himamis.retex.renderer.share.platform.graphics.Graphics2DInterface;

/** JLaTeXMath text layout; metrics come from the host (Pango), drawing from the graphics. */
public class TextLayoutGjs implements TextLayout {

	private final String text;
	private final FontGjs font;

	public TextLayoutGjs(String text, FontGjs font) {
		this.text = text == null ? "" : text;
		this.font = font;
	}

	@Override
	public GRectangle2D getBounds() {
		double width = 0;
		double ascent = font.getSize() * 0.8;
		double descent = font.getSize() * 0.2;
		if (HostGraphics.available()) {
			String metrics = HostGraphics.measureText(font.getFamilyName(), font.getStyle(),
					font.getSize(), text);
			String[] parts = metrics.split(",");
			if (parts.length >= 3) {
				width = parse(parts[0], width);
				ascent = parse(parts[1], ascent);
				descent = parse(parts[2], descent);
			}
		}
		GRectangle2D bounds = AwtFactory.getPrototype().newRectangle2D();
		bounds.setRect(0, -ascent, width, ascent + descent);
		return bounds;
	}

	private static double parse(String value, double fallback) {
		try {
			return Double.parseDouble(value);
		} catch (NumberFormatException e) {
			return fallback;
		}
	}

	@Override
	public void draw(Graphics2DInterface graphics, int x, int y) {
		char[] data = text.toCharArray();
		graphics.drawChars(data, 0, data.length, x, y);
	}
}
