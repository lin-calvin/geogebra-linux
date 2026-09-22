package org.geogebra.web.spike;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.google.gwt.core.client.EntryPoint;

import jsinterop.annotations.JsMethod;
import jsinterop.annotations.JsPackage;
import jsinterop.annotations.JsType;

/**
 * Minimal GWT exported library used to test whether GWT output can run inside a
 * non-browser JS engine (GJS / SpiderMonkey).
 */
@JsType(namespace = JsPackage.GLOBAL, name = "GgbSpike")
public class GgbSpike implements EntryPoint {

	@Override
	public void onModuleLoad() {
		// marker so the loader can tell the entry point actually ran
		setLoaded(true);
	}

	private static boolean loaded;

	@JsMethod
	public static boolean isLoaded() {
		return loaded;
	}

	@JsMethod
	public static void setLoaded(boolean value) {
		loaded = value;
	}

	@JsMethod
	public static int add(int a, int b) {
		return a + b;
	}

	@JsMethod
	public static double hypot(double a, double b) {
		return Math.sqrt(a * a + b * b);
	}

	@JsMethod
	public static String list() {
		List<String> items = new ArrayList<>();
		items.add("alpha");
		items.add("beta");
		return items.toString();
	}

	@JsMethod
	public static String map() {
		Map<String, Integer> map = new HashMap<>();
		map.put("one", 1);
		map.put("two", 2);
		return map.get("one") + "," + map.get("two");
	}
}
