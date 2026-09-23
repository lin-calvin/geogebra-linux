package org.geogebra.gjs.client;

import com.himamis.retex.renderer.share.platform.FactoryProvider;
import com.himamis.retex.renderer.share.platform.font.FontFactory;
import com.himamis.retex.renderer.share.platform.graphics.GraphicsFactory;

/**
 * JLaTeXMath platform factory for the GTK/Cairo backend. Replaces
 * {@code FactoryProviderGWT} so formulas are typeset with Cairo instead of canvas.
 */
public class FactoryProviderGjs extends FactoryProvider {

	@Override
	protected FontFactory createFontFactory() {
		return new FontFactoryGjs();
	}

	@Override
	protected GraphicsFactory createGraphicsFactory() {
		return new GraphicsFactoryGjs();
	}
}
