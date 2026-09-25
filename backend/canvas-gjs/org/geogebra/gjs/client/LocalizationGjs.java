package org.geogebra.gjs.client;

import org.geogebra.common.main.App;
import org.geogebra.common.main.Localization;
import org.geogebra.common.util.lang.Language;

/**
 * Minimal English-only localization. Upstream's JRE localization uses
 * {@code java.util.ResourceBundle}, which GWT does not emulate, so the GJS backend
 * provides its own.
 */
public class LocalizationGjs extends Localization {

	private boolean commandChanged;
	private boolean commandNull = true;
	private App app;

	public LocalizationGjs() {
		super(1, 6);
	}

	public void setApp(App application) {
		this.app = application;
	}

	@Override
	public String getLanguageTag() {
		return "en";
	}

	@Override
	public String getCommand(String key) {
		return key;
	}

	/**
	 * The English bundle is loaded from the host (see {@code backend/host/strings.js});
	 * LocalizationI.getMenu() falls back to the key itself when this returns "".
	 */
	@Override
	public String getMenuDefault(String key, String default0) {
		if (key != null && HostStrings.available()) {
			String value = HostStrings.get(key);
			if (value != null && !value.isEmpty()) {
				return value;
			}
		}
		return default0;
	}

	@Override
	public String getSymbol(int key) {
		return "";
	}

	@Override
	public Language getLanguage() {
		return Language.English_US;
	}

	@Override
	public Language getLanguageEnum() {
		return Language.English_US;
	}

	@Override
	public String getSymbolTooltip(int key) {
		return "";
	}

	@Override
	public void initCommand() {
		commandNull = false;
	}

	@Override
	protected boolean isCommandChanged() {
		return commandChanged;
	}

	@Override
	protected void setCommandChanged(boolean changed) {
		this.commandChanged = changed;
	}

	@Override
	protected boolean isCommandNull() {
		return commandNull;
	}
}
