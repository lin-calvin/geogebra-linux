package org.geogebra.gjs.client;

import com.himamis.retex.renderer.share.platform.font.TextAttribute;
import com.himamis.retex.renderer.share.platform.font.TextAttributeProvider;

/** Text attribute provider; JLaTeXMath only needs this for font style maps. */
public class TextAttributeProviderGjs implements TextAttributeProvider {

	@Override
	public TextAttribute getTextAttribute(String name) {
		return null;
	}

	@Override
	public Integer getTextAttributeValue(String name) {
		return null;
	}
}
