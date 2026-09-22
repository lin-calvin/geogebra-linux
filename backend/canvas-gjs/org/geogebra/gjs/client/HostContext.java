package org.geogebra.gjs.client;

import jsinterop.annotations.JsType;

/**
 * Native drawing context provided by the GJS/Cairo host. Deliberately shaped like a
 * small subset of the HTML canvas 2D API, because {@code GGraphics2D} was designed
 * against it and because each call maps directly onto Cairo.
 */
@JsType(isNative = true)
public interface HostContext {

	void beginPath();

	void moveTo(double x, double y);

	void lineTo(double x, double y);

	void quadraticCurveTo(double cpx, double cpy, double x, double y);

	void bezierCurveTo(double c1x, double c1y, double c2x, double c2y, double x, double y);

	void closePath();

	void rect(double x, double y, double w, double h);

	void stroke();

	void fill();

	void fillEvenOdd();

	void clip();

	void resetClip();

	void saveTransform();

	void restoreTransform();

	void translate2(double x, double y);

	void scale2(double sx, double sy);

	void transform2(double a, double b, double c, double d, double e, double f);

	void setStrokeStyle(String css);

	void setFillStyle(String css);

	void setLineWidth(double width);

	void setLineCap(String cap);

	void setLineJoin(String join);

	void setLineDash(double[] dash);

	double getGlobalAlpha();

	void setGlobalAlpha(double alpha);

	void setFont(String font);

	void fillText(String text, double x, double y);

	void fillRect(double x, double y, double w, double h);

	void clearRect(double x, double y, double w, double h);

	void drawImage(Object image, double dx, double dy);

	void drawImage(Object image, double sx, double sy, double sw, double sh,
			double dx, double dy, double dw, double dh);

	void dispose();
}
