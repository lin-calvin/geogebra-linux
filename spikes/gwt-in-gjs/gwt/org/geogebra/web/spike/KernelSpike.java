package org.geogebra.web.spike;

import org.geogebra.common.kernel.arithmetic.MyDouble;
import org.geogebra.common.util.Util;

import com.google.gwt.core.client.EntryPoint;

import jsinterop.annotations.JsMethod;
import jsinterop.annotations.JsPackage;
import jsinterop.annotations.JsType;

/**
 * Stage 2 spike: pull the real GeoGebra kernel ({@code org.geogebra.Common}) into
 * the GWT output and call kernel code from a non-browser JS engine.
 *
 * <p>Also proves the reverse direction: kernel code (Java -&gt; JS) can call native
 * functions provided by the host (GJS). This is the seam a Cairo rendering backend
 * would use.
 */
@JsType(namespace = JsPackage.GLOBAL, name = "KernelSpike")
public class KernelSpike implements EntryPoint {

	@Override
	public void onModuleLoad() {
	}

	@JsMethod
	public static String processFilename(String name) {
		return Util.processFilename(name);
	}

	@JsMethod
	public static int validFontSize(int size) {
		return Util.getValidFontSize(size);
	}

	@JsMethod
	public static String myDoubleToString(double d) {
		return MyDouble.toString(d);
	}

	/** Calls a function implemented by the GJS host. */
	@JsMethod
	public static double hostAdd(double a, double b) {
		GgbHost.log("hostAdd(" + a + ", " + b + ")");
		return GgbHost.add(a, b);
	}

	@JsType(isNative = true, namespace = JsPackage.GLOBAL, name = "ggbHost")
	static class GgbHost {
		static native double add(double a, double b);

		static native void log(String message);
	}
}
