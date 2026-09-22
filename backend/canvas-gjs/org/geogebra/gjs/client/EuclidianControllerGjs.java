package org.geogebra.gjs.client;

import org.geogebra.common.euclidian.EuclidianController;
import org.geogebra.common.kernel.Kernel;
import org.geogebra.common.main.App;

/**
 * GTK controller. Everything is inherited from the platform-independent
 * {@link EuclidianController}; the only abstract hook is the tooltip manager.
 *
 * <p>The shell calls the inherited public entry points directly:
 * {@code wrapMousePressed}, {@code wrapMouseDragged}, {@code wrapMouseReleased},
 * {@code wrapMouseMoved}, {@code wrapMouseWheelMoved}.
 */
public class EuclidianControllerGjs extends EuclidianController {

	public EuclidianControllerGjs(App app, Kernel kernel) {
		super(app);
		this.kernel = kernel;
	}

	@Override
	protected void resetToolTipManager() {
		// no tooltips yet
	}
}
