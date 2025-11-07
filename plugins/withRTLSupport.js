const { withAppDelegate, withMainApplication, withInfoPlist } = require('@expo/config-plugins');

/**
 * Config plugin to enable RTL support in native iOS and Android code
 */
const withRTLSupport = (config) => {
  // iOS: Add RTL support to AppDelegate
  config = withAppDelegate(config, (config) => {
    const contents = config.modResults.contents;

    // Check if already added
    if (contents.includes('semanticContentAttribute') || contents.includes('RCTI18nUtil.sharedInstance().allowRTL')) {
      return config;
    }

    // Find the didFinishLaunchingWithOptions method and add RTL support
    const pattern = /(didFinishLaunchingWithOptions[^{]*{\s*)/;
    if (contents.match(pattern)) {
      config.modResults.contents = contents.replace(
        pattern,
        '$1// Enable RTL support\n    RCTI18nUtil.sharedInstance().allowRTL(true)\n    // Force RTL at UIView level\n    UIView.appearance().semanticContentAttribute = .forceRightToLeft\n\n    '
      );
    }

    return config;
  });

  // Android: Add allowRTL to MainApplication
  config = withMainApplication(config, (config) => {
    const contents = config.modResults.contents;

    // Check if already added
    if (contents.includes('I18nUtil.getInstance()')) {
      return config;
    }

    // Add import
    if (!contents.includes('import com.facebook.react.modules.i18nmanager.I18nUtil')) {
      config.modResults.contents = contents.replace(
        /(import com\.facebook\.react\.defaults\.DefaultReactNativeHost)/,
        '$1\nimport com.facebook.react.modules.i18nmanager.I18nUtil'
      );
    }

    // Add allowRTL in onCreate
    const pattern = /(override fun onCreate\(\) {\s*super\.onCreate\(\))/;
    if (config.modResults.contents.match(pattern)) {
      config.modResults.contents = config.modResults.contents.replace(
        pattern,
        '$1\n\n    // Allow RTL layout\n    val sharedI18nUtilInstance = I18nUtil.getInstance()\n    sharedI18nUtilInstance.allowRTL(applicationContext, true)'
      );
    }

    return config;
  });

  // iOS: Add localization support for Arabic in Info.plist
  config = withInfoPlist(config, (config) => {
    // Add CFBundleAllowMixedLocalizations to allow multiple localizations
    config.modResults.CFBundleAllowMixedLocalizations = true;

    // Add CFBundleLocalizations to include Arabic
    if (!config.modResults.CFBundleLocalizations) {
      config.modResults.CFBundleLocalizations = [];
    }

    const localizations = config.modResults.CFBundleLocalizations;
    if (!localizations.includes('en')) {
      localizations.push('en');
    }
    if (!localizations.includes('ar')) {
      localizations.push('ar');
    }

    return config;
  });

  return config;
};

module.exports = withRTLSupport;
