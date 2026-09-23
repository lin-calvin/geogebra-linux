package org.geogebra.gjs.client;

import org.geogebra.common.awt.AwtFactory;
import org.geogebra.common.awt.GColor;
import org.geogebra.common.awt.GGraphics2D;
import org.geogebra.common.euclidian.EuclidianController;
import org.geogebra.common.euclidian.event.PointerEventType;
import org.geogebra.common.kernel.Kernel;
import org.geogebra.common.kernel.StringTemplate;
import org.geogebra.common.kernel.geos.GeoElement;
import org.geogebra.common.kernel.kernelND.GeoElementND;
import org.geogebra.common.main.App;
import org.geogebra.common.main.error.ErrorHandler;

import jsinterop.annotations.JsMethod;
import jsinterop.annotations.JsPackage;
import jsinterop.annotations.JsType;

/**
 * Bootstrap + public API of the GJS app: what the GTK4/libadwaita shell calls.
 */
@JsType(namespace = JsPackage.GLOBAL, name = "GgbApp")
public class GjsApp {

	private static AppGjs app;

	private GjsApp() {
	}

	private static AppGjs app() {
		if (app == null) {
			app = new AppGjs();
		}
		return app;
	}

	/** Creates the app. Idempotent. */
	@JsMethod
	public static void init() {
		// Install our GTK/Cairo factory FIRST: FactoryProviderGWT.ensureLoaded() would
		// otherwise claim the AwtFactory prototype with the web canvas one.
		AwtFactory.setPrototypeIfNull(new AwtFactoryGjs());
		// JLaTeXMath's static initializers need its platform factory; the web build
		// does this in its entry points (FactoryProviderGWT.ensureLoaded()).
		com.himamis.retex.renderer.web.FactoryProviderGWT.ensureLoaded();
		app();
	}

	/** @return whether the app exists */
	@JsMethod
	public static boolean isReady() {
		return app != null;
	}

	/** @return number of objects in the construction */
	@JsMethod
	public static int objectCount() {
		return app().getKernel().getConstruction().getGeoSetConstructionOrder().size();
	}

	/** @return comma-separated labels of all objects */
	@JsMethod
	public static String objectLabels() {
		StringBuilder sb = new StringBuilder();
		for (GeoElement geo : app().getKernel().getConstruction().getGeoSetConstructionOrder()) {
			if (sb.length() > 0) {
				sb.append(", ");
			}
			sb.append(geo.getLabelSimple());
		}
		return sb.toString();
	}

	/**
	 * Algebra view rows: one object per line, tab-separated as
	 * {@code label \t value \t visible(0|1) \t #rrggbb}.
	 *
	 * @return rows
	 */
	@JsMethod
	public static String getObjectRows() {
		StringBuilder sb = new StringBuilder();
		for (GeoElement geo : app().getKernel().getConstruction().getGeoSetConstructionOrder()) {
			if (sb.length() > 0) {
				sb.append('\n');
			}
			sb.append(geo.getLabelSimple()).append('\t')
					.append(geo.toValueString(StringTemplate.defaultTemplate)).append('\t')
					.append(geo.isEuclidianVisible() ? "1" : "0").append('\t')
					.append(colorHex(geo.getObjectColor()));
		}
		return sb.toString();
	}

	private static String colorHex(GColor color) {
		if (color == null) {
			return "#000000";
		}
		String digits = "0123456789abcdef";
		StringBuilder hex = new StringBuilder("#");
		int[] channels = {color.getRed(), color.getGreen(), color.getBlue()};
		for (int channel : channels) {
			hex.append(digits.charAt((channel >> 4) & 0xf));
			hex.append(digits.charAt(channel & 0xf));
		}
		return hex.toString();
	}

	/**
	 * Evaluates a command / expression.
	 *
	 * @param command command
	 * @return status
	 */
	@JsMethod
	public static String evalCommand(String command) {
		Kernel kernel = app().getKernel();
		final StringBuilder error = new StringBuilder();
		ErrorHandler handler = new ErrorHandler() {
			@Override
			public void showError(String msg) {
				if (msg != null) {
					error.append(msg);
				}
			}

			@Override
			public void showCommandError(String cmd, String message) {
				error.append(message);
			}

			@Override
			public String getCurrentCommand() {
				return null;
			}

			@Override
			public boolean onUndefinedVariables(String string,
					org.geogebra.common.util.AsyncOperation<String[]> callback) {
				return false;
			}

			@Override
			public void resetError() {
				// nothing to reset
			}
		};
		try {
			GeoElementND[] result = kernel.getAlgebraProcessor()
					.processAlgebraCommandNoExceptionHandling(command, true, handler, false, null);
			if (result == null) {
				return error.length() > 0 ? "error: " + error : "null";
			}
			return "ok (" + result.length + ")";
		} catch (Throwable t) {
			return "error: " + t;
		}
	}

	/** Sets the view size. */
	@JsMethod
	public static void setSize(int width, int height) {
		EuclidianViewGjs view = view();
		view.setPreferredSize(AwtFactory.getPrototype().newDimension(width, height));
		view.updateSize();
	}

	/**
	 * Paints the view into a host context (a GtkDrawingArea's cairo_t).
	 *
	 * @param ctx host context
	 * @param width surface width
	 * @param height surface height
	 */
	@JsMethod
	public static void drawOn(HostContext ctx, int width, int height) {
		EuclidianViewGjs view = view();
		view.setPreferredSize(AwtFactory.getPrototype().newDimension(width, height));
		GGraphics2D g = new GGraphics2DGjs(ctx, width, height);
		view.setGraphics(g);
		view.paintView();
	}

	/** Sets the view background (dark mode). */
	@JsMethod
	public static void setBackground(int r, int g, int b, int a) {
		view().setBackground(GColor.newColor(r, g, b, a));
	}

	/** Makes the canvas transparent so the GTK theme background shows through. */
	@JsMethod
	public static void setTransparent(boolean transparent) {
		view().setTransparent(transparent);
	}

	/** Sets the axes colour. */
	@JsMethod
	public static void setAxesColor(int r, int g, int b, int a) {
		view().setAxesColor(GColor.newColor(r, g, b, a));
	}

	/** Sets the grid colour. */
	@JsMethod
	public static void setGridColor(int r, int g, int b, int a) {
		view().setGridColor(GColor.newColor(r, g, b, a));
	}

	/** Sets the active tool by mode number. */
	@JsMethod
	public static void setMode(int mode) {
		app().setMode(mode);
	}

	@JsMethod
	public static String zoomIn() {
		return evalCommand("ZoomIn(1)");
	}

	@JsMethod
	public static String zoomOut() {
		return evalCommand("ZoomOut(1)");
	}

	/** Resets the view to the standard coordinate system. */
	@JsMethod
	public static void resetView() {
		view().setStandardView(true);
	}

	/** @return the construction as {@code geogebra.xml} */
	@JsMethod
	public static String getXML() {
		return app().getXML();
	}

	/**
	 * Loads a construction from {@code geogebra.xml}.
	 *
	 * @param xml XML content
	 * @return status
	 */
	@JsMethod
	public static String setXML(String xml) {
		try {
			app().setActiveView(App.VIEW_EUCLIDIAN);
			app().getXMLio().processXMLString(xml, true, false);
			return "ok (" + objectCount() + ")";
		} catch (Throwable t) {
			return "error: " + t;
		}
	}

	/** Shows or hides an object in the graphics view. */
	@JsMethod
	public static void setVisible(String label, boolean visible) {
		GeoElement geo = app().getKernel().getConstruction().lookupLabel(label);
		if (geo != null) {
			geo.setEuclidianVisible(visible);
			geo.updateRepaint();
		}
	}

	/** Clears the construction (File > New). */
	@JsMethod
	public static void newConstruction() {
		app().getKernel().getConstruction().clearConstruction();
	}

	@JsMethod
	public static void undo() {
		app().getUndoManager(app().getKernel().getConstruction()).undo();
	}

	@JsMethod
	public static void redo() {
		app().getUndoManager(app().getKernel().getConstruction()).redo();
	}

	// ------------------------------------------------------------- interaction

	@JsMethod
	public static void mouseDown(double x, double y, int button, boolean shift,
			boolean control, boolean alt, boolean meta, int clickCount) {
		controller().wrapMousePressed(new AbstractEventGjs(x, y, PointerEventType.MOUSE)
				.withModifiers(shift, control, alt, meta).withButton(button, clickCount));
	}

	@JsMethod
	public static void mouseDrag(double x, double y, boolean shift, boolean control,
			boolean alt, boolean meta) {
		controller().wrapMouseDragged(new AbstractEventGjs(x, y, PointerEventType.MOUSE)
				.withModifiers(shift, control, alt, meta), true);
	}

	@JsMethod
	public static void mouseMove(double x, double y, boolean shift, boolean control,
			boolean alt, boolean meta) {
		controller().wrapMouseMoved(new AbstractEventGjs(x, y, PointerEventType.MOUSE)
				.withModifiers(shift, control, alt, meta));
	}

	@JsMethod
	public static void mouseUp(double x, double y, int button, boolean shift,
			boolean control, boolean alt, boolean meta) {
		controller().wrapMouseReleased(new AbstractEventGjs(x, y, PointerEventType.MOUSE)
				.withModifiers(shift, control, alt, meta).withButton(button, 1));
	}

	@JsMethod
	public static void mouseWheel(double x, double y, double delta, boolean shift,
			boolean alt) {
		controller().wrapMouseWheelMoved((int) Math.round(x), (int) Math.round(y),
				delta, shift, alt);
	}

	// --------------------------------------------------------------- internals

	private static EuclidianViewGjs view() {
		return (EuclidianViewGjs) app().getActiveEuclidianView();
	}

	private static EuclidianController controller() {
		return view().getEuclidianController();
	}
}
