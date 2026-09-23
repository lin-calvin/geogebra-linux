package org.geogebra.gjs.client;

import org.geogebra.common.awt.GFont;

/** Platform-independent font description; the host resolves the family. */
public class GFontGjs implements GFont {

	private final String name;
	private final int style;
	private final double size;

	public GFontGjs(String name) {
		this(name, GFont.PLAIN, 12);
	}

	public GFontGjs(String name, int style, double size) {
		this.name = name;
		this.style = style;
		this.size = size;
	}

	@Override
	public int getStyle() {
		return style;
	}

	@Override
	public double getSize() {
		return size;
	}

	@Override
	public boolean isItalic() {
		return (style & GFont.ITALIC) != 0;
	}

	@Override
	public boolean isBold() {
		return (style & GFont.BOLD) != 0;
	}

	@Override
	public int canDisplayUpTo(String str) {
		return -1;
	}

	@Override
	public GFont deriveFont(int newStyle, int fontSize) {
		return new GFontGjs(name, newStyle, fontSize);
	}

	@Override
	public GFont deriveFont(int newStyle, double fontSize) {
		return new GFontGjs(name, newStyle, fontSize);
	}

	@Override
	public GFont deriveFont(int newStyle) {
		return new GFontGjs(name, newStyle, size);
	}

	@Override
	public String getFontName() {
		return name;
	}

	/**
	 * @return a Pango font description, e.g. {@code Sans Bold Italic 14px}. The family
	 *         has to come first and the size has to be in pixels: Pango parses the
	 *         string as {@code family style size}, and a bare number is read as
	 *         points, which would render every glyph 4/3 too large for the metrics
	 *         JLaTeXMath lays out with.
	 */
	public String getFullFontString() {
		return name + (isBold() ? " Bold" : "") + (isItalic() ? " Italic" : "")
				+ " " + (int) Math.round(size) + "px";
	}

	@Override
	public String toString() {
		return getFullFontString();
	}
}
