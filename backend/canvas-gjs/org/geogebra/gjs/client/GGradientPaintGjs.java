package org.geogebra.gjs.client;

import org.geogebra.common.awt.GColor;
import org.geogebra.common.awt.GGradientPaint;

/** Linear gradient paint. Applied by {@link GGraphics2DGjs} through the host. */
public class GGradientPaintGjs implements GGradientPaint {

	private final double x1;
	private final double y1;
	private final GColor color1;
	private final double x2;
	private final double y2;
	private final GColor color2;

	public GGradientPaintGjs(double x1, double y1, GColor color1,
			double x2, double y2, GColor color2) {
		this.x1 = x1;
		this.y1 = y1;
		this.color1 = color1;
		this.x2 = x2;
		this.y2 = y2;
		this.color2 = color2;
	}

	public double getX1() {
		return x1;
	}

	public double getY1() {
		return y1;
	}

	public double getX2() {
		return x2;
	}

	public double getY2() {
		return y2;
	}

	public GColor getColor1() {
		return color1;
	}

	public GColor getColor2() {
		return color2;
	}
}
