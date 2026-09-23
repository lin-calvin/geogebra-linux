package org.geogebra.gjs.client;

import org.geogebra.common.cas.CASparser;
import org.geogebra.common.cas.giac.CASgiac;
import org.geogebra.common.util.debug.Log;

/**
 * Giac CAS backed by the host's WebAssembly Giac (see {@link HostCas}) - the same
 * engine the web build uses, just reached through GJS instead of elemental2.
 *
 * <p>Mirrors upstream's {@code CASgiacW}, which cannot be reused because it lives in
 * {@code org.geogebra.web} and depends on {@code elemental2}. Only the transport
 * differs: {@code caseval(...)} here goes through {@link HostCas}.
 */
public class CASgiacGjs extends CASgiac {

	/**
	 * @param casParser
	 *            parser
	 */
	public CASgiacGjs(CASparser casParser) {
		super(casParser);
	}

	@Override
	public String evaluateCAS(String exp) {
		if (!HostCas.loaded()) {
			return "?";
		}
		try {
			// replace Unicode before it crosses into JavaScript
			String processedExp = CASparser.replaceIndices(exp, true);
			// GeoGebra's own Giac commands (ggbfactor, ggblimvans, ...) have to be
			// defined before the command runs, on this path too
			setup(processedExp);
			return postProcess(HostCas.caseval(processedExp));
		} catch (Throwable t) {
			Log.debug("evaluateGiac: " + t.getMessage());
			return "?";
		}
	}

	@Override
	protected synchronized String evaluate(String exp, long timeoutMilliseconds) {
		if (!HostCas.loaded()) {
			return "?";
		}
		setup(exp);
		return HostCas.caseval(wrapInevalfa(exp));
	}

	/**
	 * Puts Giac into GeoGebra mode and defines only the custom functions this
	 * command might need - the same preamble upstream's web CAS sends before every
	 * evaluation.
	 *
	 * @param exp Giac command about to be evaluated
	 */
	private void setup(String exp) {
		HostCas.caseval(initStringWeb);

		CustomFunctions[] init = CustomFunctions.values();
		CustomFunctions.setDependencies();
		for (CustomFunctions function : init) {
			boolean foundInInput = false;
			if (function.functionName == null
					|| (foundInInput = exp.contains(function.functionName))) {
				HostCas.caseval(function.definitionString);
				if (foundInInput) {
					for (CustomFunctions dep : CustomFunctions.prereqs(function)) {
						Log.debug(function + " implicitly loads " + dep);
						HostCas.caseval(dep.definitionString);
					}
				}
			}
		}

		HostCas.caseval("caseval(\"timeout " + (getTimeoutMilliseconds() / 1000) + "\")");
		HostCas.caseval("caseval(\"ckevery 20\")");
		HostCas.caseval("srand(" + getSeed(exp) + ")");
		HostCas.caseval("angle_radian:=1");
	}

	@Override
	public void clearResult() {
		// nothing is cached on this side
	}

	@Override
	public boolean isLoaded() {
		return HostCas.loaded();
	}

	@Override
	public boolean externalCAS() {
		return false;
	}
}
