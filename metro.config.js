const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .db and .gz extensions to asset extensions
config.resolver.assetExts.push('db');
config.resolver.assetExts.push('gz');

module.exports = config;
