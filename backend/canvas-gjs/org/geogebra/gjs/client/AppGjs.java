package org.geogebra.gjs.client;

import org.geogebra.common.GeoGebraConstants.Platform;
import org.geogebra.common.awt.AwtFactory;
import org.geogebra.common.awt.GFont;
import org.geogebra.common.awt.MyImage;
import org.geogebra.common.euclidian.DrawEquation;
import org.geogebra.common.euclidian.EuclidianController;
import org.geogebra.common.euclidian.EuclidianView;
import org.geogebra.common.factories.CASFactory;
import org.geogebra.common.factories.CASFactoryDummy;
import org.geogebra.common.factories.Factory;
import org.geogebra.common.factories.FormatFactory;
import org.geogebra.common.factories.UtilFactory;
import org.geogebra.common.gui.view.algebra.AlgebraView;
import org.geogebra.common.io.MyXMLio;
import org.geogebra.common.kernel.Construction;
import org.geogebra.common.kernel.Kernel;
import org.geogebra.common.kernel.commands.CommandDispatcher;
import org.geogebra.common.kernel.geos.GeoElement;
import org.geogebra.common.kernel.geos.GeoElementGraphicsAdapter;
import org.geogebra.common.main.App;
import org.geogebra.common.main.DialogManager;
import org.geogebra.common.main.FontManager;
import org.geogebra.common.main.GlobalKeyDispatcher;
import org.geogebra.common.main.GuiManagerInterface;
import org.geogebra.common.main.Localization;
import org.geogebra.common.main.SpreadsheetTableModel;
import org.geogebra.common.main.settings.DefaultSettings;
import org.geogebra.common.main.settings.config.AppConfigGraphing;
import org.geogebra.common.main.undo.DefaultUndoManager;
import org.geogebra.common.main.undo.UndoManager;
import org.geogebra.common.plugin.GgbAPI;
import org.geogebra.common.plugin.ScriptManager;
import org.geogebra.common.sound.SoundManager;
import org.geogebra.common.util.GTimer;
import org.geogebra.common.util.GTimerListener;
import org.geogebra.common.util.ImageManager;
import org.geogebra.common.util.StringUtil;
import org.geogebra.common.util.debug.Log;

/**
 * Headless GeoGebra app wired to the GTK/Cairo backend.
 *
 * <p>Implements the {@link App} / AppInterface surface with GWT-safe code. Upstream's
 * {@code common-jre} headless wiring cannot be reused because its localization depends
 * on {@code java.util.ResourceBundle}, which GWT does not emulate.
 */
public class AppGjs extends App {

	private final LocalizationGjs localization = new LocalizationGjs();
	private final CASFactory casFactory = new CASFactoryDummy();
	private GFont plainFont;

	public AppGjs() {
		super(Platform.ANDROID);
		this.appConfig = new AppConfigGraphing();
		AwtFactory.setPrototypeIfNull(new AwtFactoryGjs());
		FormatFactory.setPrototypeIfNull(new FormatFactoryGjs());
		UtilFactory.setPrototypeIfNull(new UtilFactoryGjs());
		StringUtil.setPrototypeIfNull(new StringUtil());
		// the web app does this in AppW; without it RegExp.compile() NPEs
		org.geogebra.regexp.shared.RegExpFactory.setPrototypeIfNull(
				new org.geogebra.regexp.client.NativeRegExpFactory());
		Log.setLogger(new Log() {
			@Override
			public void print(Log.Level level, Object logEntry) {
				HostGraphics.log("[" + level + "] " + logEntry);
				if (logEntry instanceof Throwable) {
					for (StackTraceElement element : ((Throwable) logEntry).getStackTrace()) {
						HostGraphics.log("    at " + element);
					}
				}
			}
		});
		initKernel();
		localization.setApp(this);
		initLocalization();
		getLocalization().initTranslateCommand();
		initSettings();
		initEuclidianViews();
	}

	// ------------------------------------------------------------ required core

	@Override
	public Localization getLocalization() {
		return localization;
	}

	@Override
	public DefaultSettings getDefaultSettings() {
		return new DefaultSettingsGjs();
	}

	@Override
	protected void showErrorDialog(String msg) {
		// no UI
	}

	@Override
	protected void initGuiManager() {
		// no UI
	}

	@Override
	protected EuclidianView newEuclidianView(boolean[] showAxes1, boolean showGrid1) {
		getSettings().getEuclidian(1)
				.setPreferredSize(AwtFactory.getPrototype().newDimension(800, 600));
		return new EuclidianViewGjs(getEuclidianController(), 1, getSettings().getEuclidian(1));
	}

	@Override
	public EuclidianController newEuclidianController(Kernel kernel) {
		return new EuclidianControllerGjs(this, kernel);
	}

	@Override
	public FontManager getFontManager() {
		return new FontManagerGjs();
	}

	@Override
	protected int getWindowWidth() {
		return 800;
	}

	@Override
	protected int getWindowHeight() {
		return 600;
	}

	@Override
	public CommandDispatcher newCommandDispatcher(Kernel kernel) {
		return new CommandDispatcherGjs(kernel);
	}

	@Override
	public EuclidianView getActiveEuclidianView() {
		return euclidianView;
	}

	@Override
	public boolean hasEuclidianView2EitherShowingOrNot(int idx) {
		return false;
	}

	@Override
	public boolean isShowingEuclidianView2(int idx) {
		return false;
	}

	@Override
	public EuclidianView createEuclidianView() {
		return null;
	}

	// ------------------------------------------------------------ app interface

	@Override
	public DrawEquation getDrawEquation() {
		return new DrawEquationGjs();
	}

	@Override
	public CASFactory getCASFactory() {
		return casFactory;
	}

	@Override
	public Factory getFactory() {
		return null;
	}

	@Override
	public MyImage getExternalImageAdapter(String filename, int width, int height) {
		return null;
	}

	@Override
	public MyImage getInternalImageAdapter(String filename, int width, int height) {
		return null;
	}

	@Override
	public MyXMLio createXMLio(Construction cons) {
		return new MyXMLioGjs(getKernel(), cons);
	}

	@Override
	public UndoManager getUndoManager(Construction cons) {
		return new DefaultUndoManager(cons);
	}

	@Override
	public ScriptManager newScriptManager() {
		return new ScriptManager(this) {
			@Override
			public void ggbOnInit() {
				// no JS
			}
		};
	}

	@Override
	public GTimer newTimer(GTimerListener listener, int delay) {
		return UtilFactory.getPrototype().newTimer(listener, delay);
	}

	@Override
	public void invokeLater(Runnable runnable) {
		runnable.run();
	}

	@Override
	public boolean isApplet() {
		return false;
	}

	@Override
	public boolean isUsingFullGui() {
		return false;
	}

	@Override
	public boolean isHTML5Applet() {
		return false;
	}

	@Override
	public boolean isSelectionRectangleAllowed() {
		return true;
	}

	@Override
	public boolean freeMemoryIsCritical() {
		return false;
	}

	@Override
	public long freeMemory() {
		return 0;
	}

	@Override
	public boolean showView(int view) {
		return true;
	}

	@Override
	public boolean showAlgebraInput() {
		return true;
	}

	@Override
	public boolean clearConstruction() {
		return true;
	}

	@Override
	public void storeUndoInfo() {
		// no undo yet
	}

	@Override
	public void closePopups() {
		// no popups
	}

	@Override
	public void reset() {
		// nothing to reset
	}

	@Override
	public void resetUniqueId() {
		// nothing to reset
	}

	@Override
	public void setActiveView(int evID) {
		// single view
	}

	@Override
	public void setWaitCursor() {
		// no cursor
	}

	@Override
	public void updateStyleBars() {
		// no style bars
	}

	@Override
	public void updateDynamicStyleBars() {
		// no style bars
	}

	@Override
	public void set1rstMode() {
		// no toolbar
	}

	@Override
	public void updateMenubar() {
		// no menubar
	}

	@Override
	public void updateUI() {
		// no UI
	}

	@Override
	public void updateApplicationLayout() {
		// no UI
	}

	@Override
	public void showURLinBrowser(String string) {
		// no browser
	}

	@Override
	public void fileNew() {
		// not implemented
	}

	@Override
	public void copyGraphicsViewToClipboard() {
		// not implemented
	}

	@Override
	public void exitAll() {
		// nothing to exit
	}

	@Override
	public void showCustomizeToolbarGUI() {
		// no UI
	}

	@Override
	public void showError(String localizedError) {
		// no UI
	}

	@Override
	public void showError(String string, String str) {
		// no UI
	}

	@Override
	public void evalJavaScript(App app, String script, String arg) {
		// no JS
	}

	@Override
	public void callAppletJavaScript(String string, String args) {
		// no JS
	}

	@Override
	public void runScripts(GeoElement geo, String script) {
		// no scripting
	}

	@Override
	public void setXML(String xml, boolean clearAll) {
		// not implemented
	}

	@Override
	public GFont getPlainFontCommon() {
		if (plainFont == null) {
			plainFont = getFontManager().getFontCanDisplay("", false, GFont.PLAIN, 12);
		}
		return plainFont;
	}

	@Override
	public double getWidth() {
		return getWindowWidth();
	}

	@Override
	public double getHeight() {
		return getWindowHeight();
	}

	@Override
	public AlgebraView getAlgebraView() {
		return null;
	}

	@Override
	public ImageManager getImageManager() {
		return null;
	}

	@Override
	public GuiManagerInterface getGuiManager() {
		return null;
	}

	@Override
	public DialogManager getDialogManager() {
		return null;
	}

	@Override
	public SpreadsheetTableModel getSpreadsheetTableModel() {
		return null;
	}

	@Override
	public GeoElementGraphicsAdapter newGeoElementGraphicsAdapter() {
		return new GeoElementGraphicsAdapterGjs(this);
	}

	@Override
	public GgbAPI getGgbApi() {
		return null;
	}

	@Override
	public SoundManager getSoundManager() {
		return null;
	}

	@Override
	public GlobalKeyDispatcher getGlobalKeyDispatcher() {
		return null;
	}
}
