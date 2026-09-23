package org.geogebra.gjs.client;

import org.geogebra.common.awt.AwtFactory;
import org.geogebra.common.awt.GColor;
import org.geogebra.common.awt.GDimension;
import org.geogebra.common.awt.GFont;
import org.geogebra.common.awt.GGraphics2D;
import org.geogebra.common.euclidian.CoordSystemAnimation;
import org.geogebra.common.euclidian.EuclidianController;
import org.geogebra.common.euclidian.EuclidianCursor;
import org.geogebra.common.euclidian.EuclidianStyleBar;
import org.geogebra.common.euclidian.EuclidianView;
import org.geogebra.common.euclidian.EuclidianViewCompanion;
import org.geogebra.common.euclidian.ScreenReaderAdapter;
import org.geogebra.common.euclidian.ScreenReaderSilent;
import org.geogebra.common.euclidian.SymbolicEditor;
import org.geogebra.common.geogebra3D.euclidianFor3D.EuclidianViewFor3DCompanion;
import org.geogebra.common.main.settings.EuclidianSettings;

/**
 * GTK view. Drawing of all objects, axes, grid, hit detection etc. is inherited from
 * {@link EuclidianView} in {@code common}; this class only supplies the platform bits
 * and forwards painting into the host (Cairo) graphics.
 *
 * <p>Modelled on the upstream {@code EuclidianViewNoGui}, which already renders into a
 * {@link GGraphics2D}.
 */
public class EuclidianViewGjs extends EuclidianView {

	private GColor backgroundColor = GColor.WHITE;
	private boolean transparent = true;
	private GDimension dim = AwtFactory.getPrototype().newDimension(800, 600);
	private final GFont font;
	private final GGraphics2D tempGraphics;
	private GGraphics2D currentGraphics;
	private Runnable redrawRequest;
	private ScreenReaderAdapter screenReader = ScreenReaderSilent.INSTANCE;

	public EuclidianViewGjs(EuclidianController ec, int viewNo, EuclidianSettings settings) {
		super(ec, viewNo, settings);
		setAxesColor(GColor.BLACK);
		setGridColor(GColor.GRAY);
		ec.setView(this);
		settings.addListener(this);
		font = AwtFactory.getPrototype().newFont("Sans", GFont.PLAIN, 12);
		tempGraphics = AwtFactory.getPrototype().newBufferedImage(5, 5, 1).createGraphics();
		ec.getApplication().getKernel().attach(this);
		updateFonts();
		settingsChanged(settings);
	}

	// ------------------------------------------------------------ shell hooks

	/** Called by the shell; requests a GTK redraw instead of painting directly. */
	public void setRedrawRequest(Runnable request) {
		this.redrawRequest = request;
	}

	/** Sets the graphics bound to the current GTK draw callback. */
	public void setGraphics(GGraphics2D graphics) {
		this.currentGraphics = graphics;
	}

	/** Paints into the graphics previously set via {@link #setGraphics}. */
	public void paintView() {
		if (currentGraphics != null) {
			updateBackgroundIfNecessary();
			paint(currentGraphics);
		}
	}

	@Override
	public void repaint() {
		// The shell re-renders inside the GtkDrawingArea draw callback; painting here
		// would use a stale cairo_t. redrawRequest (when set) just schedules a redraw.
		if (redrawRequest != null) {
			redrawRequest.run();
		}
	}

	// ------------------------------------------------------- inherited hooks

	@Override
	public final GColor getBackgroundCommon() {
		return backgroundColor;
	}

	/**
	 * When transparent, the canvas is cleared instead of filled, so the GTK /
	 * libadwaita theme background shows through.
	 */
	@Override
	protected boolean isTransparent() {
		return transparent;
	}

	/** @param transparent whether the view background should be transparent */
	public void setTransparent(boolean transparent) {
		this.transparent = transparent;
	}

	@Override
	public final void setBackground(GColor bgColor) {
		if (bgColor != null) {
			backgroundColor = GColor.newColor(
					bgColor.getRed(), bgColor.getGreen(), bgColor.getBlue(), bgColor.getAlpha());
		}
	}

	@Override
	public boolean hitAnimationButton(int x, int y) {
		return false;
	}

	@Override
	public void setCursor(EuclidianCursor cursor) {
		// no cursor handling yet
	}

	@Override
	public void setToolTipText(String plainTooltip) {
		// no tooltips yet
	}

	@Override
	public boolean hasFocus() {
		return true;
	}

	@Override
	public void requestFocus() {
		// no-op
	}

	@Override
	public void closeDropdowns() {
		// no-op
	}

	@Override
	public int getWidth() {
		return dim.getWidth();
	}

	@Override
	public int getHeight() {
		return dim.getHeight();
	}

	@Override
	public EuclidianController getEuclidianController() {
		return euclidianController;
	}

	@Override
	public boolean suggestRepaint() {
		return false;
	}

	@Override
	public void clearView() {
		resetLists();
		updateBackgroundImage();
		removeTextField();
	}

	@Override
	public boolean isShowing() {
		return app.showView(getViewID());
	}

	@Override
	public GGraphics2D getTempGraphics2D(GFont fontForGraphics) {
		return tempGraphics;
	}

	@Override
	public GFont getFont() {
		return font;
	}

	@Override
	protected void initCursor() {
		// no-op
	}

	@Override
	protected void setStyleBarMode(int mode) {
		// no-op
	}

	@Override
	protected void updateSizeKeepDrawables() {
		// no-op
	}

	@Override
	public boolean requestFocusInWindow() {
		return true;
	}

	@Override
	public void paintBackground(GGraphics2D g) {
		// background is painted by the host
	}

	@Override
	protected void drawResetIcon(GGraphics2D g) {
		// no reset icon
	}

	@Override
	public void setPreferredSize(GDimension preferredSize) {
		this.dim = preferredSize;
	}

	@Override
	protected CoordSystemAnimation newZoomer() {
		// No platform timer yet: run the zoom animation synchronously to completion,
		// like the upstream EuclidianViewNoGui does.
		return new CoordSystemAnimation(this) {
			private boolean running;

			@Override
			protected void stopTimer() {
				running = false;
			}

			@Override
			protected void startTimer() {
				running = true;
				while (running) {
					step();
				}
			}

			@Override
			protected boolean hasTimer() {
				return true;
			}
		};
	}

	@Override
	protected EuclidianStyleBar newEuclidianStyleBar() {
		return null;
	}

	@Override
	public ScreenReaderAdapter getScreenReader() {
		return screenReader;
	}

	@Override
	protected EuclidianStyleBar newDynamicStyleBar() {
		return null;
	}

	@Override
	protected void addDynamicStylebarToEV(EuclidianStyleBar dynamicStylebar) {
		// no-op
	}

	@Override
	protected EuclidianViewCompanion newEuclidianViewCompanion() {
		return new EuclidianViewFor3DCompanion(this);
	}

	public void setSymbolicEditor(SymbolicEditor editor) {
		this.symbolicEditor = editor;
	}
}
