#!/usr/bin/env node

/**
 * Generate a simple splash screen
 * This creates a minimal splash that matches the app's theme
 */

const fs = require('fs');
const path = require('path');

console.log('📱 Generating minimal splash screen...');
console.log('');
console.log('⚠️  Note: For the native iOS splash, you can either:');
console.log('   1. Use a design tool (Figma, Canva) to create:');
console.log('      - Size: 1284x2778 pixels (iPhone 13/14 Pro Max)');
console.log('      - Content: Simple white/light background');
console.log('      - Optional: Just the word "المعجم" centered');
console.log('      - Save as: assets/splash.png');
console.log('');
console.log('   2. Or keep the current splash minimal since the React');
console.log('      splash screen (with the nice font) shows immediately after.');
console.log('');
console.log('The native splash is only visible for ~1 second during app launch,');
console.log('then your custom splash screen (from _layout.tsx) takes over.');
console.log('');
console.log('✅ To update: Replace assets/splash.png with your new design');
console.log('✅ Then run: npm run build:ios');
console.log('');
