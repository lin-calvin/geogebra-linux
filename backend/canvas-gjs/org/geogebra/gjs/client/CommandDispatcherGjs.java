package org.geogebra.gjs.client;

import org.geogebra.common.kernel.Kernel;
import org.geogebra.common.kernel.commands.AdvancedCommandProcessorFactory;
import org.geogebra.common.kernel.commands.CASCommandProcessorFactory;
import org.geogebra.common.kernel.commands.CommandDispatcher;
import org.geogebra.common.kernel.commands.CommandProcessorFactory;
import org.geogebra.common.kernel.commands.DiscreteCommandProcessorFactory;
import org.geogebra.common.kernel.commands.ProverCommandProcessorFactory;
import org.geogebra.common.kernel.commands.ScriptingCommandProcessorFactory;
import org.geogebra.common.kernel.commands.StatsCommandProcessorFactory;

/** Command dispatcher with the standard processor factories. */
public class CommandDispatcherGjs extends CommandDispatcher {

	public CommandDispatcherGjs(Kernel kernel) {
		super(kernel);
	}

	@Override
	public CommandProcessorFactory getStatsCommandProcessorFactory() {
		if (statsFactory == null) {
			statsFactory = new StatsCommandProcessorFactory();
		}
		return statsFactory;
	}

	@Override
	public CommandProcessorFactory getDiscreteCommandProcessorFactory() {
		if (discreteFactory == null) {
			discreteFactory = new DiscreteCommandProcessorFactory();
		}
		return discreteFactory;
	}

	@Override
	public CommandProcessorFactory getCASCommandProcessorFactory() {
		if (casFactory == null) {
			casFactory = new CASCommandProcessorFactory();
		}
		return casFactory;
	}

	@Override
	public CommandProcessorFactory getScriptingCommandProcessorFactory() {
		if (scriptingFactory == null) {
			scriptingFactory = new ScriptingCommandProcessorFactory();
		}
		return scriptingFactory;
	}

	@Override
	public CommandProcessorFactory getAdvancedCommandProcessorFactory() {
		if (advancedFactory == null) {
			advancedFactory = new AdvancedCommandProcessorFactory();
		}
		return advancedFactory;
	}

	@Override
	public CommandProcessorFactory getProverCommandProcessorFactory() {
		if (proverFactory == null) {
			proverFactory = new ProverCommandProcessorFactory();
		}
		return proverFactory;
	}
}
