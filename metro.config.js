const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .gz extension to asset extensions
config.resolver.assetExts.push('gz');

module.exports = config;
