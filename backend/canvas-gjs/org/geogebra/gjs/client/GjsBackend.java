package org.geogebra.gjs.client;

import org.geogebra.common.awt.AwtFactory;
import org.geogebra.common.awt.GColor;
import org.geogebra.common.awt.GBufferedImage;
import org.geogebra.common.awt.GFont;
import org.geogebra.common.awt.GGraphics2D;
import org.geogebra.common.awt.GBasicStroke;

import com.google.gwt.core.client.EntryPoint;

import jsinterop.annotations.JsMethod;
import jsinterop.annotations.JsPackage;
import jsinterop.annotations.JsType;

/**
 * Public entry point of the backend module. Everything the GJS shell needs to talk to
 * the kernel/backend goes through here.
 */
@JsType(namespace = JsPackage.GLOBAL, name = "GgbGjs")
public class GjsBackend implements EntryPoint {

	@Override
	public void onModuleLoad() {
		init();
	}

	/** Installs the GTK/Cairo {@link AwtFactory}. Idempotent. */
	@JsMethod
	public static void init() {
		AwtFactory.setPrototypeIfNull(new AwtFactoryGjs());
	}

	/** @return whether the backend factory is installed */
	@JsMethod
	public static boolean isReady() {
		return AwtFactory.getPrototype() instanceof AwtFactoryGjs;
	}

	/** @return the installed factory class name (diagnostics) */
	@JsMethod
	public static String factoryName() {
		AwtFactory f = AwtFactory.getPrototype();
		return f == null ? "null" : f.getClass().getName();
	}

	/**
	 * Draws a tiny scene through the backend. Returns a short status string; if the
	 * host is missing the drawing calls are dropped but no exception is thrown.
	 *
	 * @return status
	 */
	@JsMethod
	public static String drawDemo() {
		GBufferedImage image = AwtFactory.getPrototype().createBufferedImage(64, 64, true);
		GGraphics2D g = image.createGraphics();
		g.setColor(GColor.RED);
		g.setStroke(AwtFactory.getPrototype().newBasicStroke(2.0));
		g.drawLine(0, 0, 63, 63);
		g.fillRect(10, 10, 20, 20);
		return "ok " + image.getWidth() + "x" + image.getHeight();
	}

	/**
	 * Draws a small scene through the backend and writes it to a PNG via the host.
	 *
	 * @param path output file
	 * @return status
	 */
	@JsMethod
	public static String drawDemoToFile(String path) {
		GBufferedImage image = AwtFactory.getPrototype().createBufferedImage(240, 160, true);
		GGraphics2D g = image.createGraphics();

		g.setColor(GColor.WHITE);
		g.fillRect(0, 0, 240, 160);

		g.setColor(GColor.BLUE);
		g.setStroke(AwtFactory.getPrototype().newBasicStroke(3.0));
		g.drawLine(10, 10, 230, 150);

		g.setColor(GColor.RED);
		g.fillRect(50, 50, 80, 50);

		g.setColor(GColor.newColor(0, 128, 0, 128));
		g.fillRoundRect(120, 90, 90, 50, 20, 20);

		HostGraphics.writePng(((GBufferedImageGjs) image).getContext(), path);
		return "wrote " + path;
	}

	/**
	 * Draws a demo scene into a host context supplied by the shell (e.g. a
	 * GtkDrawingArea's cairo_t). This is the entry point a GTK4 shell would call.
	 *
	 * @param ctx host context
	 * @param width surface width
	 * @param height surface height
	 */
	@JsMethod
	public static void drawOn(HostContext ctx, int width, int height) {
		GGraphics2D g = new GGraphics2DGjs(ctx, width, height);

		g.setColor(GColor.WHITE);
		g.fillRect(0, 0, width, height);

		// grid
		g.setColor(GColor.newColor(230, 230, 230));
		g.setStroke(AwtFactory.getPrototype().newBasicStroke(1.0));
		for (int x = 0; x < width; x += 40) {
			g.drawLine(x, 0, x, height);
		}
		for (int y = 0; y < height; y += 40) {
			g.drawLine(0, y, width, y);
		}

		// axes
		g.setColor(GColor.newColor(120, 120, 120));
		g.drawLine(width / 2, 0, width / 2, height);
		g.drawLine(0, height / 2, width, height / 2);

		// y = sin(x)
		g.setColor(GColor.BLUE);
		g.setStroke(AwtFactory.getPrototype().newBasicStroke(2.5));
		int prevY = height / 2;
		for (int x = 1; x < width; x++) {
			double t = (x - width / 2) / 40.0;
			int y = (int) (height / 2 - Math.sin(t) * 60);
			g.drawStraightLine(x - 1, prevY, x, y);
			prevY = y;
		}

		// a point
		g.setColor(GColor.RED);
		double px = width / 2 + 40 * Math.PI / 2;
		double py = height / 2 - 60;
		g.fill(AwtFactory.getPrototype().newEllipse2DDouble(px - 6, py - 6, 12, 12));

		// label
		g.setColor(GColor.newColor(60, 60, 60));
		g.setFont(AwtFactory.getPrototype().newFont("Sans", GFont.PLAIN, 14));
		g.drawString("y = sin(x)   rendered by GtkDrawingArea + Cairo", 12, 24);
	}
}
