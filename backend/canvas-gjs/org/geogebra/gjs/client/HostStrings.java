package org.geogebra.gjs.client;

import jsinterop.annotations.JsPackage;
import jsinterop.annotations.JsType;

/**
 * Entry point into the host's string bundle (English {@code menu.properties}).
 * GWT has no {@code java.util.ResourceBundle}, so {@link LocalizationGjs} reads
 * its strings from here; see {@code backend/host/strings.js}.
 */
@JsType(isNative = true, namespace = JsPackage.GLOBAL, name = "ggbStrings")
public class HostStrings {

	private HostStrings() {
	}

	/** @return whether a bundle was loaded */
	public static native boolean available();

	/**
	 * @param key string key
	 * @return whether the bundle has an entry for the key
	 */
	public static native boolean has(String key);

	/**
	 * @param key string key
	 * @return the translation, or an empty string when the key is unknown
	 */
	public static native String get(String key);
}
