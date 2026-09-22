package org.geogebra.gjs.client;

import org.geogebra.common.main.settings.DefaultSettings;

/** Default font sizes. */
public class DefaultSettingsGjs implements DefaultSettings {

	@Override
	public int getAppFontSize() {
		return 12;
	}

	@Override
	public int getGuiFontSize() {
		return 12;
	}
}
