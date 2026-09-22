package org.geogebra.gjs.client;

import org.geogebra.common.awt.AwtFactory;
import org.geogebra.common.awt.GColor;
import org.geogebra.common.awt.GDimension;
import org.geogebra.common.awt.GFont;
import org.geogebra.common.awt.GGraphics2D;
import org.geogebra.common.euclidian.DrawEquation;
import org.geogebra.common.kernel.kernelND.GeoElementND;
import org.geogebra.common.main.App;

import com.himamis.retex.renderer.share.platform.graphics.Image;

/** Stub equation renderer (LaTeX typesetting not wired to the host yet). */
public class DrawEquationGjs extends DrawEquation {

	@Override
	public GDimension drawEquation(App app, GeoElementND geo, GGraphics2D g2, int x, int y,
			String text, GFont font, boolean serif, GColor fgColor, GColor bgColor,
			boolean useCache, boolean updateAgain, Runnable callback) {
		return AwtFactory.getPrototype().newDimension(0, 0);
	}

	@Override
	public Image getCachedDimensions(String text, GeoElementND geo, GColor fgColor,
			GFont font, int style, int[] ret) {
		return null;
	}

	@Override
	public void checkFirstCall() {
		// nothing to initialise
	}

	@Override
	public GDimension measureEquation(App app, String text, GFont font, boolean serif) {
		return AwtFactory.getPrototype().newDimension(0, 0);
	}
}
