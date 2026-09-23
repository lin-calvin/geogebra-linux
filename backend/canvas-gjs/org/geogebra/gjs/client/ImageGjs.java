package org.geogebra.gjs.client;

import org.geogebra.common.awt.GBufferedImage;

import com.himamis.retex.renderer.share.platform.graphics.Graphics2DInterface;
import com.himamis.retex.renderer.share.platform.graphics.Image;

/** JLaTeXMath image backed by an offscreen Cairo surface. */
public class ImageGjs implements Image {

	private final GBufferedImageGjs image;

	public ImageGjs(int width, int height, int type) {
		this.image = new GBufferedImageGjs(width, height, 1);
	}

	@Override
	public int getWidth() {
		return image.getWidth();
	}

	@Override
	public int getHeight() {
		return image.getHeight();
	}

	@Override
	public Graphics2DInterface createGraphics2D() {
		return new Graphics2DInterfaceGjs((GGraphics2DGjs) image.createGraphics());
	}

	public GBufferedImage getBufferedImage() {
		return image;
	}
}
