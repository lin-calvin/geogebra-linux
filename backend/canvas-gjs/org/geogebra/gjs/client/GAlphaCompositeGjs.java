package org.geogebra.gjs.client;

import org.geogebra.common.awt.GAlphaComposite;

/** Alpha composite backed by a single alpha value. */
public class GAlphaCompositeGjs implements GAlphaComposite {

	private final double alpha;

	public GAlphaCompositeGjs(double alpha) {
		this.alpha = alpha;
	}

	public double getAlpha() {
		return alpha;
	}
}
