module.exports = {
  expo: {
    name: "معاجم",
    slug: "m3ajem",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme: "m3ajem",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    newArchEnabled: true,
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.m3ajem.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.m3ajem.app"
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    plugins: [
      "expo-router",
      "expo-asset",
      "expo-secure-store",
      ["expo-sqlite", { "withSQLiteVecExtension": true }]
    ],
    experiments: {
      typedRoutes: true
    }
  }
};
