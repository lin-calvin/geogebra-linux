package org.geogebra.gjs.client;

import com.himamis.retex.renderer.share.platform.graphics.GraphicsFactory;
import com.himamis.retex.renderer.share.platform.graphics.Image;

/** JLaTeXMath graphics factory for the GTK/Cairo backend. */
public class GraphicsFactoryGjs extends GraphicsFactory {

	@Override
	public Image createImage(int width, int height, int type) {
		return new ImageGjs(width, height, type);
	}
}
