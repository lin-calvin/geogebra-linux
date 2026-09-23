package org.geogebra.gjs.client;

import jsinterop.annotations.JsPackage;
import jsinterop.annotations.JsType;

/**
 * Entry point into the host's Giac CAS. The GJS host exposes a global
 * {@code ggbCas} object wrapping the emscripten {@code caseval} function of the
 * Giac WebAssembly module.
 *
 * <p>This is the CAS counterpart of {@link HostGraphics}: the only place where the
 * backend talks to the platform about CAS.
 */
@JsType(isNative = true, namespace = JsPackage.GLOBAL, name = "ggbCas")
public class HostCas {

	private HostCas() {
	}

	/** @return whether the Giac WebAssembly module has finished loading */
	public static native boolean loaded();

	/**
	 * Evaluates a Giac command.
	 *
	 * @param command Giac syntax
	 * @return Giac output
	 */
	public static native String caseval(String command);
}
