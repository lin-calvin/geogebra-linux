package org.geogebra.gjs.client;

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

import org.geogebra.common.awt.AwtFactory;
import org.geogebra.common.awt.GColor;
import org.geogebra.common.awt.GGraphics2D;
import org.geogebra.common.euclidian.EuclidianController;
import org.geogebra.common.euclidian.EuclidianView;
import org.geogebra.common.euclidian.event.PointerEventType;
import org.geogebra.common.kernel.Construction;
import org.geogebra.common.kernel.Kernel;
import org.geogebra.common.kernel.StringTemplate;
import org.geogebra.common.kernel.arithmetic.ValidExpression;
import org.geogebra.common.kernel.commands.EvalInfo;
import org.geogebra.common.kernel.geos.GeoElement;
import org.geogebra.common.kernel.geos.GeoNumeric;
import org.geogebra.common.kernel.kernelND.GeoElementND;
import org.geogebra.common.main.App;
import org.geogebra.common.main.error.ErrorHandler;

import jsinterop.annotations.JsFunction;
import jsinterop.annotations.JsMethod;
import jsinterop.annotations.JsPackage;
import jsinterop.annotations.JsType;

/**
 * Bootstrap + public API of the GJS app: what the GTK4/libadwaita shell calls.
 */
@JsType(namespace = JsPackage.GLOBAL, name = "GgbApp")
public class GjsApp {

	/** Callback the shell hands us so the view can ask for a GTK redraw. */
	@JsFunction
	public interface RedrawRequest {
		void run();
	}

	/** Scale step applied by the zoom in / out buttons. */
	private static final double ZOOM_STEP = 1.25;

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
		// JLaTeXMath renders through our Cairo backend (not the web canvas one).
		com.himamis.retex.renderer.share.platform.FactoryProvider factoryProvider =
				com.himamis.retex.renderer.share.platform.FactoryProvider.getInstance();
		if (factoryProvider == null) {
			com.himamis.retex.renderer.share.platform.FactoryProvider
					.setInstance(new FactoryProviderGjs());
		}
		app();
	}

	/** @return whether the app exists */
	@JsMethod
	public static boolean isReady() {
		return app != null;
	}

	/**
	 * Registers the shell's redraw callback, so that anything the kernel repaints
	 * on its own (coordinate system changes, object updates) reaches the canvas
	 * without the caller having to remember to ask for a redraw.
	 *
	 * @param request callback that schedules a GTK redraw
	 */
	@JsMethod
	public static void setRedrawRequest(RedrawRequest request) {
		view().setRedrawRequest(() -> request.run());
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
					.append(colorHex(geo.getObjectColor())).append('\t')
					.append(geo.toLaTeXString(false, StringTemplate.latexTemplate));
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
		ErrorHandler handler = errorHandler(error);
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

	/**
	 * Evaluates a self-contained expression and returns its numeric value, without
	 * adding anything to the construction (calculator mode).
	 *
	 * @param expression expression, e.g. {@code sin(30)+2^3}
	 * @return value string, or {@code "error"}
	 */
	@JsMethod
	public static String evaluate(String expression) {
		Kernel kernel = app().getKernel();
		Construction cons = kernel.getConstruction();
		// snapshot so we only delete objects created by *this* evaluation
		Set<GeoElement> before =
				Collections.newSetFromMap(new IdentityHashMap<>());
		before.addAll(cons.getGeoSetConstructionOrder());
		try {
			ValidExpression ve = kernel.getParser().parseGeoGebraExpression(expression);
			EvalInfo info = kernel.getAlgebraProcessor().getEvalInfo(false, true);
			GeoElementND[] result = kernel.getAlgebraProcessor()
					.processAlgebraCommandNoExceptionHandling(ve, false,
							errorHandler(new StringBuilder()), null, info);
			if (result == null || result.length == 0) {
				return "error";
			}
			GeoElementND last = result[result.length - 1];
			String value = last instanceof GeoNumeric
					? formatNumber(((GeoNumeric) last).getDouble())
					: last.toValueString(StringTemplate.editorTemplate);
			for (GeoElementND geo : result) {
				if (geo != null && !before.contains(geo.toGeoElement())) {
					geo.toGeoElement().remove();
				}
			}
			return value;
		} catch (Throwable t) {
			return "error";
		}
	}

	/**
	 * REPL evaluation: assignments ({@code a=1}, {@code f(x)=x^2}) are kept in the
	 * construction so later inputs can use them; plain expressions are evaluated
	 * transiently (nothing added).
	 *
	 * @param input user input
	 * @return value string, or {@code "error"}
	 */
	@JsMethod
	public static String evaluateRepl(String input) {
		String trimmed = input == null ? "" : input.trim();
		boolean assignment =
				trimmed.matches("[a-zA-Z][a-zA-Z0-9_]*\\s*=\\s*[^=].*")
						|| trimmed.matches("[a-zA-Z][a-zA-Z0-9_]*\\([^)]*\\)\\s*=\\s*[^=].*");
		if (!assignment) {
			return evaluate(trimmed);
		}
		Kernel kernel = app().getKernel();
		try {
			ValidExpression ve = kernel.getParser().parseGeoGebraExpression(trimmed);
			EvalInfo info = kernel.getAlgebraProcessor().getEvalInfo(false, true);
			GeoElementND[] result = kernel.getAlgebraProcessor()
					.processAlgebraCommandNoExceptionHandling(ve, true,
							errorHandler(new StringBuilder()), null, info);
			if (result == null || result.length == 0) {
				return "error";
			}
			GeoElementND last = result[result.length - 1];
			return last instanceof GeoNumeric
					? formatNumber(((GeoNumeric) last).getDouble())
					: last.toValueString(StringTemplate.editorTemplate);
		} catch (Throwable t) {
			return "error";
		}
	}

	private static String formatNumber(double value) {
		if (Double.isInfinite(value)) {
			return value > 0 ? "∞" : "-∞";
		}
		if (value == Math.rint(value) && Math.abs(value) < 1e15) {
			return String.valueOf((long) value);
		}
		return String.valueOf(value);
	}

	private static ErrorHandler errorHandler(StringBuilder error) {
		return new ErrorHandler() {
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
	}

	/** Sets the view size. */
	@JsMethod
	public static void setSize(int width, int height) {
		EuclidianViewGjs view = view();
		view.setPreferredSize(AwtFactory.getPrototype().newDimension(width, height));
		view.updateSize();
	}

	/**
	 * Spike: renders a LaTeX formula to a PNG via JLaTeXMath + Cairo.
	 *
	 * @param latex LaTeX source
	 * @param size font size
	 * @param path output PNG
	 * @return status
	 */
	@JsMethod
	public static String renderFormulaToFile(String latex, int size, String path) {
		try {
			com.himamis.retex.renderer.share.TeXFormula formula =
					new com.himamis.retex.renderer.share.TeXFormula(latex);
			com.himamis.retex.renderer.share.TeXIcon icon = formula.createTeXIcon(
					com.himamis.retex.renderer.share.TeXConstants.STYLE_DISPLAY, size);
			int width = Math.max(1, icon.getIconWidth()) + 40;
			int height = Math.max(1, icon.getIconHeight()) + 40;
			ImageGjs image = new ImageGjs(width, height,
					com.himamis.retex.renderer.share.platform.graphics.Image.TYPE_INT_ARGB);
			com.himamis.retex.renderer.share.platform.graphics.Graphics2DInterface g =
					image.createGraphics2D();
			g.setColor(GColor.WHITE);
			g.fillRect(0, 0, width, height);
			icon.paintIcon(
					new com.himamis.retex.renderer.share.platform.graphics.HasForegroundColor() {
						@Override
						public GColor getForegroundColor() {
							return GColor.BLACK;
						}
					}, g, 20, 20);
			HostGraphics.writePng(
					((GBufferedImageGjs) image.getBufferedImage()).getContext(), path);
			return "ok " + width + "x" + height;
		} catch (Throwable t) {
			return "error: " + t;
		}
	}

	/**
	 * Renders a LaTeX formula into a host context (typeset with JLaTeXMath + Cairo).
	 *
	 * @param ctx host context
	 * @param latex LaTeX source
	 * @param size point size
	 * @param x baseline origin x
	 * @param y baseline origin y
	 * @param r red
	 * @param g green
	 * @param b blue
	 */
	@JsMethod
	public static void drawLatex(HostContext ctx, String latex, double size, double x, double y,
			int r, int g, int b) {
		GGraphics2DGjs graphics = new GGraphics2DGjs(ctx, 1000, 1000);
		com.himamis.retex.renderer.share.platform.graphics.Graphics2DInterface gi =
				new Graphics2DInterfaceGjs(graphics);
		com.himamis.retex.renderer.share.TeXFormula formula =
				new com.himamis.retex.renderer.share.TeXFormula(latex);
		com.himamis.retex.renderer.share.TeXIcon icon = formula.createTeXIcon(
				com.himamis.retex.renderer.share.TeXConstants.STYLE_DISPLAY, size);
		icon.paintIcon(
				new com.himamis.retex.renderer.share.platform.graphics.HasForegroundColor() {
					@Override
					public GColor getForegroundColor() {
						return GColor.newColor(r, g, b);
					}
				}, gi, x, y);
	}

	/**
	 * @param latex LaTeX source
	 * @param size point size
	 * @return {@code "width,height"} of the typeset formula
	 */
	@JsMethod
	public static String measureLatex(String latex, double size) {
		try {
			com.himamis.retex.renderer.share.TeXFormula formula =
					new com.himamis.retex.renderer.share.TeXFormula(latex);
			com.himamis.retex.renderer.share.TeXIcon icon = formula.createTeXIcon(
					com.himamis.retex.renderer.share.TeXConstants.STYLE_DISPLAY, size);
			return icon.getIconWidth() + "," + icon.getIconHeight();
		} catch (Throwable t) {
			return "0,0";
		}
	}

	/**
	 * @param input user expression
	 * @return LaTeX for the expression, or the input unchanged if it cannot be parsed
	 */
	@JsMethod
	public static String toLatex(String input) {
		try {
			ValidExpression ve = app().getKernel().getParser().parseGeoGebraExpression(input);
			return ve.toLaTeXString(true, StringTemplate.latexTemplate);
		} catch (Throwable t) {
			return input;
		}
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

	/**
	 * Turns CAS-backed commands on/off. With CAS off (the default, matching
	 * {@code AppConfigGraphing}) {@code Derivative(f)} is compiled as the numeric
	 * variant and shows up as {@code NDerivative(f)}.
	 *
	 * @param enabled whether CAS commands are allowed
	 */
	@JsMethod
	public static void setCasEnabled(boolean enabled) {
		app().getSettings().getCasSettings().setEnabled(enabled);
	}

	/** Zooms in around the centre of the view. */
	@JsMethod
	public static void zoomIn() {
		zoomAroundCentre(ZOOM_STEP);
	}

	/** Zooms out around the centre of the view. */
	@JsMethod
	public static void zoomOut() {
		zoomAroundCentre(1 / ZOOM_STEP);
	}

	private static void zoomAroundCentre(double factor) {
		EuclidianView view = view();
		view.zoom(view.getWidth() / 2.0, view.getHeight() / 2.0, factor, 4, false);
		app().setUnsaved();
	}

	/** Resets the view to the standard coordinate system. */
	@JsMethod
	public static void resetView() {
		view().setStandardView(true);
	}

	/**
	 * Translates the view by a screen-space offset, without going through the mouse
	 * event pipeline. Used by the shell's native pan gestures (touchpad two-finger
	 * scroll, touch drag inertia).
	 *
	 * @param dx
	 *            horizontal offset in pixels (positive = content moves right)
	 * @param dy
	 *            vertical offset in pixels (positive = content moves down)
	 */
	@JsMethod
	public static void panBy(double dx, double dy) {
		EuclidianView view = view();
		view.setCoordSystem(view.getXZero() + dx, view.getYZero() + dy,
				view.getXscale(), view.getYscale());
		app().setUnsaved();
	}

	/**
	 * Scales the view around a screen point, without going through the mouse event
	 * pipeline. Used by native pinch / ctrl+scroll.
	 *
	 * @param px
	 *            x of the point that stays fixed
	 * @param py
	 *            y of the point that stays fixed
	 * @param factor
	 *            scale factor (&gt; 1 zooms in)
	 */
	@JsMethod
	public static void zoomAt(double px, double py, double factor) {
		if (factor > 0 && factor != 1) {
			view().zoom(px, py, factor, 1, false);
			app().setUnsaved();
		}
	}

	/**
	 * @return the view coordinate system as {@code "xZero,yZero,xscale,yscale"};
	 *         mainly for tests and gesture tuning
	 */
	@JsMethod
	public static String getViewState() {
		EuclidianView view = view();
		return view.getXZero() + "," + view.getYZero() + ","
				+ view.getXscale() + "," + view.getYscale();
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
