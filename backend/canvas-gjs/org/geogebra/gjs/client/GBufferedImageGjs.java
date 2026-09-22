package org.geogebra.gjs.client;

import org.geogebra.common.awt.GBufferedImage;
import org.geogebra.common.awt.GGraphics2D;

/**
 * Offscreen surface. In this backend an image is simply a host context (a Cairo
 * surface) plus its pixel size.
 */
public class GBufferedImageGjs implements GBufferedImage {

	private final int width;
	private final int height;
	private final HostContext context;

	public GBufferedImageGjs(int width, int height, double pixelRatio) {
		this.width = Math.max(1, (int) (width * pixelRatio));
		this.height = Math.max(1, (int) (height * pixelRatio));
		this.context = HostGraphics.available()
				? HostGraphics.createContext(this.width, this.height)
				: null;
	}

	@Override
	public int getWidth() {
		return width;
	}

	@Override
	public int getHeight() {
		return height;
	}

	@Override
	public GGraphics2D createGraphics() {
		return new GGraphics2DGjs(context, width, height);
	}

	@Override
	public GBufferedImage getSubimage(int x, int y, int w, int h) {
		return new GBufferedImageGjs(w, h, 1);
	}

	@Override
	public void flush() {
		if (context != null) {
			context.dispose();
		}
	}

	@Override
	public String getBase64() {
		// PNG export is not wired up yet.
		return "";
	}

	/** @return the underlying host surface (may be {@code null}) */
	public HostContext getContext() {
		return context;
	}
}
