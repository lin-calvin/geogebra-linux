package org.geogebra.gjs.client;

import org.geogebra.common.kernel.commands.selector.CommandFilter;
import org.geogebra.common.kernel.commands.selector.CommandFilterFactory;
import org.geogebra.common.main.settings.config.AppConfigGraphing;

/**
 * Graphing config that also allows the CAS commands.
 *
 * <p>{@link AppConfigGraphing} composes {@code createNoCasCommandFilter()}, which
 * rejects every CAS-only command - {@code Limit}, {@code Factor}, {@code Simplify},
 * and so on. We ship a real Giac engine ({@link CASFactoryGjs}), so there is no
 * reason to hide them; the rest of the Graphing config (title, symbolic mode,
 * automatic labels) stays untouched.
 */
public class AppConfigGjs extends AppConfigGraphing {

	@Override
	public CommandFilter createCommandFilter() {
		return CommandFilterFactory.createCasCommandFilter();
	}
}
