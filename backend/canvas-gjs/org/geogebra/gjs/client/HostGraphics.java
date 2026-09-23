package org.geogebra.gjs.client;

import jsinterop.annotations.JsPackage;
import jsinterop.annotations.JsType;

/**
 * Entry point into the native host. The host (GJS + Cairo) implements the global
 * {@code ggbHost} object.
 *
 * <p>This is the only place where our backend talks to the platform; everything else
 * goes through {@link HostContext}, which mirrors a small canvas-like drawing API that
 * maps 1:1 onto Cairo.
 */
@JsType(isNative = true, namespace = JsPackage.GLOBAL, name = "ggbHost")
public class HostGraphics {

	private HostGraphics() {
	}

	/** Creates an offscreen drawing surface of the given pixel size. */
	public static native HostContext createContext(int width, int height);

	/** Host-side logging (optional). */
	public static native void log(String message);

	/** @return whether the host is present */
	public static native boolean available();

	/** Writes the surface behind {@code context} to a PNG file. */
	public static native void writePng(HostContext context, String path);

	/** Measures text via the host; returns {@code "width,ascent,descent"}. */
	public static native String measureText(String name, int style, double size, String text);
}
