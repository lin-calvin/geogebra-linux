package org.geogebra.gjs.client;

import com.himamis.retex.renderer.share.platform.font.Font;
import com.himamis.retex.renderer.share.platform.font.FontLoader;

/** Font loader; fonts are resolved by the host through fontconfig. */
public class FontLoaderGjs implements FontLoader {

	@Override
	public Font loadFont(String name) {
		// unit-size font, like the web backend (PIXELS_PER_POINT = 1); JLaTeXMath
		// scales it to the requested size when drawing
		return new FontGjs(name, Font.PLAIN, 1);
	}
}
