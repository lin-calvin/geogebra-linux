package org.geogebra.gjs.client;

import org.geogebra.common.awt.AwtFactory;
import org.geogebra.common.awt.GFont;
import org.geogebra.common.awt.GGraphics2D;
import org.geogebra.common.awt.GRectangle2D;
import org.geogebra.common.awt.font.GTextLayout;

/** Very small text layout: enough for measurement and drawing. */
public class GTextLayoutGjs implements GTextLayout {

	private static final double WIDTH_FACTOR = 0.6;

	private final String text;
	private final GFont font;

	public GTextLayoutGjs(String text, GFont font) {
		this.text = text == null ? "" : text;
		this.font = font;
	}

	@Override
	public double getAdvance() {
		return text.length() * font.getSize() * WIDTH_FACTOR;
	}

	@Override
	public GRectangle2D getBounds() {
		GRectangle2D bounds = AwtFactory.getPrototype().newRectangle2D();
		bounds.setRect(0, -getAscent(), getAdvance(), getAscent() + getDescent());
		return bounds;
	}

	@Override
	public double getAscent() {
		return font.getSize() * 0.8;
	}

	@Override
	public void draw(GGraphics2D g2, int x, int y) {
		g2.setFont(font);
		g2.drawString(text, x, y);
	}

	@Override
	public double getDescent() {
		return font.getSize() * 0.2;
	}
}
