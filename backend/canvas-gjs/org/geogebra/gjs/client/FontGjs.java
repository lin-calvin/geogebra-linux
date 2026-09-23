package org.geogebra.gjs.client;

import java.util.Map;

import com.himamis.retex.renderer.share.platform.font.Font;
import com.himamis.retex.renderer.share.platform.font.TextAttribute;

/** JLaTeXMath {@link Font} backed by a font name/style/size resolved by the host. */
public class FontGjs implements Font {

	private final String name;
	private final int style;
	private final int size;

	public FontGjs(String name, int style, int size) {
		this.name = name;
		this.style = style;
		this.size = size;
	}

	@Override
	public Font deriveFont(Map<TextAttribute, Object> map) {
		return this;
	}

	@Override
	public Font deriveFont(int type) {
		return new FontGjs(name, type, size);
	}

	@Override
	public boolean isEqual(Font f) {
		return f instanceof FontGjs
				&& name.equals(((FontGjs) f).name)
				&& style == ((FontGjs) f).style
				&& size == ((FontGjs) f).size;
	}

	@Override
	public int getScale() {
		return 1;
	}

	public String getName() {
		return name;
	}

	/**
	 * @return the fontconfig family name, e.g. {@code fonts/base/jlm_cmmi10.ttf} to
	 *         {@code jlm_cmmi10}
	 */
	public String getFamilyName() {
		String base = name;
		int slash = base.lastIndexOf('/');
		if (slash >= 0) {
			base = base.substring(slash + 1);
		}
		if (base.toLowerCase().endsWith(".ttf")) {
			base = base.substring(0, base.length() - 4);
		}
		return base;
	}

	public int getStyle() {
		return style;
	}

	public int getSize() {
		return size;
	}

	/** @return the GeoGebra font for the Cairo graphics */
	public GFontGjs toGFont() {
		return new GFontGjs(getFamilyName(), style, size);
	}
}
