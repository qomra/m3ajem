module.exports = {
  expo: {
    name: "المعجم",
    slug: "m3ajem",
    owner: "jalalirsh",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme: "m3ajem",
    extra: {
      googleReversedClientId: "com.googleusercontent.apps.865313393887-8d4jvuj4i85p53g5149ln400adfupe21"
    },
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0C2B19"
    },
    backgroundColor: "#0C2B19",
    newArchEnabled: true,
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.jalalirs.maajm",
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "m3ajem",
              "com.googleusercontent.apps.865313393887-8d4jvuj4i85p53g5149ln400adfupe21"
            ]
          }
        ],
        UIBackgroundModes: ["audio"]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0C2B19"
      },
      package: "com.jalalirs.maajm"
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    plugins: [
      "expo-router",
      "expo-asset",
      "expo-secure-store",
      ["expo-sqlite", { "withSQLiteVecExtension": true }],
      "expo-web-browser",
      "expo-apple-authentication"
    ],
    experiments: {
      typedRoutes: true
    }
  }
};
