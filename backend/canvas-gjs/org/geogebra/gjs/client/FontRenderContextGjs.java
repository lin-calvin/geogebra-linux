package org.geogebra.gjs.client;

import com.himamis.retex.renderer.share.platform.font.Font;
import com.himamis.retex.renderer.share.platform.font.FontRenderContext;

/** JLaTeXMath font render context. */
public class FontRenderContextGjs implements FontRenderContext {

	private final Font font;

	public FontRenderContextGjs(Font font) {
		this.font = font;
	}

	@Override
	public Font getFont() {
		return font;
	}
}
