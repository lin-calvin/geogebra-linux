package org.geogebra.gjs.client;

import org.geogebra.common.cas.CASparser;
import org.geogebra.common.factories.CASFactory;
import org.geogebra.common.kernel.CASGenericInterface;
import org.geogebra.common.kernel.Kernel;

/**
 * Supplies the GJS Giac CAS. Without this the kernel falls back to
 * {@code CASFactoryDummy}, which answers "?" to every CAS command and makes
 * {@code Derivative} degrade to its numeric variant.
 */
public class CASFactoryGjs extends CASFactory {

	@Override
	public CASGenericInterface newGiac(CASparser parser, Kernel kernel) {
		return new CASgiacGjs(parser);
	}
}
