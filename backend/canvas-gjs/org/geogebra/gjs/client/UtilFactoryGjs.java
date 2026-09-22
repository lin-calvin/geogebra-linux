package org.geogebra.gjs.client;

import org.geogebra.common.factories.UtilFactory;
import org.geogebra.common.kernel.prover.AbstractProverReciosMethod;
import org.geogebra.common.move.ggtapi.models.AjaxCallback;
import org.geogebra.common.util.GTimer;
import org.geogebra.common.util.GTimerListener;
import org.geogebra.common.util.HttpRequest;
import org.geogebra.common.util.Prover;
import org.geogebra.common.util.Reflection;
import org.geogebra.common.util.URLEncoder;

/** Platform utilities. Network, reflection and proving are stubbed for now. */
public class UtilFactoryGjs extends UtilFactory {

	@Override
	public HttpRequest newHttpRequest() {
		return new HttpRequestGjs();
	}

	@Override
	public URLEncoder newURLEncoder() {
		return new URLEncoderGjs();
	}

	@Override
	public Prover newProver() {
		return new ProverGjs();
	}

	@Override
	public double getMillisecondTime() {
		return System.currentTimeMillis();
	}

	@Override
	public Reflection newReflection(Class clazz) {
		return new ReflectionGjs();
	}

	@Override
	public GTimer newTimer(GTimerListener listener, int delay) {
		return new GTimerGjs(listener, delay);
	}

	private static final class HttpRequestGjs extends HttpRequest {
		@Override
		public void sendRequestPost(String method, String url, String content,
				AjaxCallback callback) {
			// no networking in the GJS backend yet
		}
	}

	private static final class URLEncoderGjs implements URLEncoder {
		@Override
		public String encode(String urlComponent) {
			return urlComponent;
		}
	}

	private static final class ProverGjs extends Prover {
		@Override
		protected ProofResult openGeoProver(ProverEngine pe) {
			return ProofResult.UNKNOWN;
		}

		@Override
		protected AbstractProverReciosMethod getNewReciosProver() {
			return null;
		}
	}

	private static final class ReflectionGjs implements Reflection {
		@Override
		public void call(Object object, String methodName, Object[] parameters) {
			// no reflection in GWT
		}
	}

	private static final class GTimerGjs implements GTimer {
		private final GTimerListener listener;
		private int delay;
		private boolean running;

		GTimerGjs(GTimerListener listener, int delay) {
			this.listener = listener;
			this.delay = delay;
		}

		@Override
		public void start() {
			// timers are driven by the host; not wired yet
		}

		@Override
		public void startRepeat() {
			// timers are driven by the host; not wired yet
		}

		@Override
		public void stop() {
			running = false;
		}

		@Override
		public boolean isRunning() {
			return running;
		}

		@Override
		public void setDelay(int newDelay) {
			this.delay = newDelay;
		}
	}
}
