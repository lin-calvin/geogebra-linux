package org.geogebra.gjs.client;

import java.io.IOException;
import java.io.StringReader;

import org.geogebra.common.io.MyXMLHandler;
import org.geogebra.common.io.MyXMLio;
import org.geogebra.common.io.QDParser;
import org.geogebra.common.io.XMLParseException;
import org.geogebra.common.io.file.ZipFile;
import org.geogebra.common.kernel.Construction;
import org.geogebra.common.kernel.Kernel;

/**
 * Core XML serialisation/parsing for the GJS backend.
 *
 * <p>GeoGebra's XML logic is platform independent ({@code MyXMLio} + {@code QDParser});
 * only the ZIP container and file bytes are platform specific. The shell reads/writes
 * the {@code .ggb} ZIP and passes {@code geogebra.xml} in and out via
 * {@code GgbApp.getXML()/setXML()}.
 */
public class MyXMLioGjs extends MyXMLio {

	private QDParser parser;

	public MyXMLioGjs(Kernel kernel, Construction cons) {
		super(kernel, cons);
	}

	@Override
	protected void createXMLParser() {
		parser = new QDParser();
	}

	@Override
	protected void resetXMLParser() {
		// nothing to reset
	}

	@Override
	protected void parseXML(MyXMLHandler xmlHandler, XMLStream stream)
			throws IOException, XMLParseException {
		parser.parse(xmlHandler, new StringReader(((XMLStreamStringGjs) stream).getString()));
	}

	@Override
	protected XMLStream createXMLStreamString(String str) {
		return new XMLStreamStringGjs(str);
	}

	@Override
	public void readZipFromString(ZipFile zipFile) {
		// ZIP handling lives in the GJS shell; it extracts geogebra.xml and calls
		// GgbApp.setXML().
	}

	private static final class XMLStreamStringGjs implements XMLStream {
		private final String str;

		XMLStreamStringGjs(String str) {
			this.str = str;
		}

		String getString() {
			return str;
		}
	}
}
