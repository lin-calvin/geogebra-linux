package org.geogebra.gjs.client;

import org.geogebra.common.awt.MyImage;
import org.geogebra.common.kernel.geos.GeoElementGraphicsAdapter;

/**
 * Minimal image adapter. Every {@code GeoElement} needs a non-null
 * {@link GeoElementGraphicsAdapter}; without it, creating e.g. a conic crashes in
 * {@code GeoElement.setColorVisualStyle} on
 * {@code graphicsadapter.setImageFileName(...)}.
 *
 * <p>Image storage is not wired to the host yet, so fill images stay {@code null}.
 */
public class GeoElementGraphicsAdapterGjs extends GeoElementGraphicsAdapter {

	private final AppGjs app;

	public GeoElementGraphicsAdapterGjs(AppGjs app) {
		this.app = app;
	}

	@Override
	public MyImage getFillImage() {
		if (image == null) {
			image = app.getExternalImageAdapter(imageFileName, 0, 0);
		}
		return image;
	}

	@Override
	public void setImageFileName(String fileName) {
		if (fileName == null || fileName.equals(imageFileName)) {
			return;
		}
		setImageFileNameOnly(fileName);
		image = app.getExternalImageAdapter(imageFileName, 0, 0);
	}

	@Override
	public void convertToSaveableFormat() {
		// no image storage yet
	}
}
