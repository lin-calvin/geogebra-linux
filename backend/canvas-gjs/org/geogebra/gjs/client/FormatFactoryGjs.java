package org.geogebra.gjs.client;

import org.geogebra.common.factories.FormatFactory;
import org.geogebra.common.util.NumberFormatAdapter;
import org.geogebra.common.util.ScientificFormatAdapter;

/** Number formatting without java.text. */
public class FormatFactoryGjs extends FormatFactory {

	@Override
	public ScientificFormatAdapter getScientificFormat(int sigDigit, int maxWidth,
			boolean sciNote) {
		return new ScientificFormatGjs(sciNote, maxWidth, sigDigit);
	}

	@Override
	public NumberFormatAdapter getNumberFormat(int digits) {
		return new NumberFormatGjs(digits);
	}

	@Override
	public NumberFormatAdapter getNumberFormat(String pattern, int digits) {
		return new NumberFormatGjs(digits);
	}

	private static String round(double value, int digits) {
		if (Double.isNaN(value) || Double.isInfinite(value)) {
			return String.valueOf(value);
		}
		double factor = Math.pow(10, Math.max(0, digits));
		double rounded = Math.round(value * factor) / factor;
		String s = String.valueOf(rounded);
		if (s.endsWith(".0")) {
			s = s.substring(0, s.length() - 2);
		}
		return s;
	}

	private static final class NumberFormatGjs implements NumberFormatAdapter {
		private final int digits;

		NumberFormatGjs(int digits) {
			this.digits = digits;
		}

		@Override
		public int getMaximumFractionDigits() {
			return digits;
		}

		@Override
		public String format(double value) {
			return round(value, digits);
		}
	}

	private static final class ScientificFormatGjs extends ScientificFormatAdapter {
		ScientificFormatGjs(boolean sciNote, int maxWidth, int sigDigits) {
			super(sciNote, Math.max(3, maxWidth));
			setSigDigits(Math.max(1, sigDigits));
		}

		@Override
		public String format(double d) {
			return round(d, getSigDigits());
		}
	}
}
