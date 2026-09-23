package org.geogebra.gjs.client;

import com.himamis.retex.renderer.share.platform.font.Font;
import com.himamis.retex.renderer.share.platform.font.FontFactory;
import com.himamis.retex.renderer.share.platform.font.FontLoader;
import com.himamis.retex.renderer.share.platform.font.FontRenderContext;
import com.himamis.retex.renderer.share.platform.font.TextAttributeProvider;
import com.himamis.retex.renderer.share.platform.font.TextLayout;

/** JLaTeXMath font factory for the GTK/Cairo backend. */
public class FontFactoryGjs extends FontFactory {

	@Override
	public Font createFont(String name, int style, int size) {
		return new FontGjs(name, style, size);
	}

	@Override
	public TextLayout createTextLayout(String string, Font font,
			FontRenderContext fontRenderContext) {
		return new TextLayoutGjs(string, (FontGjs) font);
	}

	@Override
	public TextAttributeProvider createTextAttributeProvider() {
		return new TextAttributeProviderGjs();
	}

	@Override
	public FontLoader createFontLoader() {
		return new FontLoaderGjs();
	}

	@Override
	public int getFontScaleFactor() {
		return 1;
	}
}
