package org.geogebra.gjs.client;

import java.util.ArrayDeque;
import java.util.Deque;

import org.geogebra.common.awt.AwtFactory;
import org.geogebra.common.awt.GAffineTransform;
import org.geogebra.common.awt.GArc2D;
import org.geogebra.common.awt.GBasicStroke;
import org.geogebra.common.awt.GColor;
import org.geogebra.common.awt.GShape;

import com.himamis.retex.renderer.share.platform.font.Font;
import com.himamis.retex.renderer.share.platform.font.FontRenderContext;
import com.himamis.retex.renderer.share.platform.graphics.Graphics2DInterface;
import com.himamis.retex.renderer.share.platform.graphics.Image;

/**
 * JLaTeXMath {@link Graphics2DInterface} on top of our Cairo {@link GGraphics2DGjs}.
 * Since JLaTeXMath already expresses shapes/colours in GeoGebra's {@code common.awt}
 * types, most methods just delegate.
 */
public class Graphics2DInterfaceGjs implements Graphics2DInterface {

	private final GGraphics2DGjs g;
	private GBasicStroke stroke;
	private FontGjs font = new FontGjs("Sans", Font.PLAIN, 12);
	private final Deque<GAffineTransform> transformStack = new ArrayDeque<>();
	private GAffineTransform transform = AwtFactory.getPrototype().newAffineTransform();

	public Graphics2DInterfaceGjs(GGraphics2DGjs g) {
		this.g = g;
	}

	@Override
	public void setStroke(GBasicStroke s) {
		stroke = s;
		g.setStroke(s);
	}

	@Override
	public GBasicStroke getStroke() {
		return stroke;
	}

	@Override
	public void setColor(GColor color) {
		g.setColor(color);
	}

	@Override
	public GColor getColor() {
		return g.getColor();
	}

	@Override
	public GAffineTransform getTransform() {
		return transform;
	}

	@Override
	public void saveTransform() {
		g.saveTransform();
		transformStack.push(transform);
		GAffineTransform copy = AwtFactory.getPrototype().newAffineTransform();
		copy.setTransform(transform);
		transform = copy;
	}

	@Override
	public void restoreTransform() {
		g.restoreTransform();
		if (!transformStack.isEmpty()) {
			transform = transformStack.pop();
		}
	}

	@Override
	public Font getFont() {
		return font;
	}

	@Override
	public void setFont(Font f) {
		if (f instanceof FontGjs) {
			font = (FontGjs) f;
			g.setFont(font.toGFont());
		}
	}

	@Override
	public void fillRect(double x, double y, double width, double height) {
		g.fillRect((int) x, (int) y, (int) width, (int) height);
	}

	@Override
	public void fill(GShape shape) {
		g.fill(shape);
	}

	@Override
	public void draw(GShape shape) {
		g.draw(shape);
	}

	@Override
	public void drawChars(char[] data, int offset, int length, int x, int y) {
		g.setFont(font.toGFont());
		g.drawString(new String(data, offset, length), x, y);
	}

	@Override
	public void drawArc(int x, int y, int width, int height, int startAngle, int arcAngle) {
		GArc2D arc = AwtFactory.getPrototype().newArc2D();
		arc.setArc(x, y, width, height, startAngle, startAngle + arcAngle, GArc2D.OPEN);
		g.draw(arc);
	}

	@Override
	public void fillArc(int x, int y, int width, int height, int startAngle, int arcAngle) {
		GArc2D arc = AwtFactory.getPrototype().newArc2D();
		arc.setArc(x, y, width, height, startAngle, startAngle + arcAngle, GArc2D.PIE);
		g.fill(arc);
	}

	@Override
	public void translate(double x, double y) {
		g.translate(x, y);
		transform.translate(x, y);
	}

	@Override
	public void scale(double x, double y) {
		g.scale(x, y);
		transform.scale(x, y);
	}

	@Override
	public void rotate(double theta, double x, double y) {
		GAffineTransform t = AwtFactory.getPrototype().newAffineTransform();
		t.setToRotation(theta, x, y);
		g.transform(t);
		transform.concatenate(t);
	}

	@Override
	public void rotate(double theta) {
		GAffineTransform t = AwtFactory.getPrototype().newAffineTransform();
		t.setToRotation(theta);
		g.transform(t);
		transform.concatenate(t);
	}

	@Override
	public void drawImage(Image image, int x, int y) {
		if (image instanceof ImageGjs) {
			g.drawImage(((ImageGjs) image).getBufferedImage(), x, y);
		}
	}

	@Override
	public void drawImage(Image image, GAffineTransform t) {
		if (image instanceof ImageGjs) {
			g.saveTransform();
			g.transform(t);
			g.drawImage(((ImageGjs) image).getBufferedImage(), 0, 0);
			g.restoreTransform();
		}
	}

	@Override
	public FontRenderContext getFontRenderContext() {
		return new FontRenderContextGjs(font);
	}

	@Override
	public void setRenderingHint(int key, int value) {
		// antialiasing is always on
	}

	@Override
	public int getRenderingHint(int key) {
		return -1;
	}

	@Override
	public void dispose() {
		// nothing to dispose
	}
}
