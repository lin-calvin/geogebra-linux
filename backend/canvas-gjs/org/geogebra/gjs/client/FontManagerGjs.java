package org.geogebra.gjs.client;

import org.geogebra.common.awt.GFont;
import org.geogebra.common.main.FontManager;

/** Font creation; the host resolves the actual family. */
public class FontManagerGjs extends FontManager {

	@Override
	public GFont getFontCanDisplay(String testString, boolean serif, int fontStyle,
			double fontSize) {
		return new GFontGjs(serif ? "Serif" : "Sans", fontStyle, fontSize);
	}
}
