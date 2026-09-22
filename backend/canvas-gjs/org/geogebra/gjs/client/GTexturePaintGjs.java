package org.geogebra.gjs.client;

import org.geogebra.common.awt.GBufferedImage;
import org.geogebra.common.awt.GRectangle;
import org.geogebra.common.awt.GTexturePaint;

/** Texture (image pattern) paint. */
public class GTexturePaintGjs implements GTexturePaint {

	private final GBufferedImage image;
	private final GRectangle anchor;

	public GTexturePaintGjs(GBufferedImage image, GRectangle anchor) {
		this.image = image;
		this.anchor = anchor;
	}

	public GBufferedImage getImage() {
		return image;
	}

	public GRectangle getAnchor() {
		return anchor;
	}
}
