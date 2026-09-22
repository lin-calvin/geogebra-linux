package org.geogebra.gjs.client;

import org.geogebra.common.awt.GPoint;
import org.geogebra.common.euclidian.event.AbstractEvent;
import org.geogebra.common.euclidian.event.PointerEventType;

/**
 * GTK event wrapped as a GeoGebra {@link AbstractEvent}. This is the whole platform
 * surface for input: 12 trivial getters. All interaction logic (hit detection,
 * dragging, snapping, tool behaviour, panning) lives in {@code common} and consumes
 * this type.
 */
public class AbstractEventGjs extends AbstractEvent {

	private final GPoint point;
	private final PointerEventType type;
	private boolean shift;
	private boolean control;
	private boolean alt;
	private boolean meta;
	private boolean right;
	private boolean middle;
	private boolean popup;
	private int clickCount = 1;

	public AbstractEventGjs(double x, double y, PointerEventType type) {
		this.point = new GPoint((int) Math.round(x), (int) Math.round(y));
		this.type = type;
	}

	public AbstractEventGjs withModifiers(boolean shiftDown, boolean controlDown,
			boolean altDown, boolean metaDown) {
		this.shift = shiftDown;
		this.control = controlDown;
		this.alt = altDown;
		this.meta = metaDown;
		return this;
	}

	public AbstractEventGjs withButton(int button, int clickCount) {
		this.right = button == 3;
		this.middle = button == 2;
		this.clickCount = Math.max(1, clickCount);
		return this;
	}

	@Override
	public GPoint getPoint() {
		return new GPoint(point.x, point.y);
	}

	@Override
	public int getX() {
		return point.x;
	}

	@Override
	public int getY() {
		return point.y;
	}

	@Override
	public boolean isShiftDown() {
		return shift;
	}

	@Override
	public boolean isControlDown() {
		return control;
	}

	@Override
	public boolean isAltDown() {
		return alt;
	}

	@Override
	public boolean isMetaDown() {
		return meta;
	}

	@Override
	public boolean isRightClick() {
		return right;
	}

	@Override
	public boolean isMiddleClick() {
		return middle;
	}

	@Override
	public boolean isPopupTrigger() {
		return popup;
	}

	@Override
	public int getClickCount() {
		return clickCount;
	}

	@Override
	public PointerEventType getType() {
		return type;
	}

	@Override
	public void release() {
		// nothing to release
	}
}
