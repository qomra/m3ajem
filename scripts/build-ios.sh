#!/bin/bash

# M3ajem iOS Build Script
# This script automates the iOS build process and applies all necessary patches

set -e  # Exit on error

echo "🚀 Starting iOS build process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

# Step 1: Clean prebuild
echo -e "${BLUE}📦 Running expo prebuild with clean...${NC}"
npx expo prebuild --platform ios --clean

# Step 2: Fix RTL support in Info.plist
echo -e "${BLUE}🔧 Configuring RTL support...${NC}"
/usr/libexec/PlistBuddy -c "Set :CFBundleDevelopmentRegion ar" ios/maajm/Info.plist
echo -e "${GREEN}✅ RTL configured${NC}"

# Step 3: Update CFBundleLocalizations to ensure Arabic is first
echo -e "${BLUE}🌐 Configuring localization preferences...${NC}"
/usr/libexec/PlistBuddy -c "Delete :CFBundleLocalizations" ios/maajm/Info.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations array" ios/maajm/Info.plist
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations:0 string ar" ios/maajm/Info.plist
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations:1 string en" ios/maajm/Info.plist
echo -e "${GREEN}✅ Localizations configured${NC}"

# Step 4: Install pods
echo -e "${BLUE}📚 Installing CocoaPods dependencies...${NC}"
cd ios && pod install && cd ..
echo -e "${GREEN}✅ Pods installed${NC}"

# Step 5: Summary
echo ""
echo -e "${GREEN}✨ Build process complete!${NC}"
echo -e "${YELLOW}📋 Summary:${NC}"
echo -e "  • iOS project rebuilt and cleaned"
echo -e "  • RTL support configured (CFBundleDevelopmentRegion: ar)"
echo -e "  • Arabic set as primary localization"
echo -e "  • CocoaPods dependencies installed"
echo ""

# Step 6: Open Xcode (optional)
if [ "$1" != "--no-xcode" ]; then
  echo -e "${BLUE}🔨 Opening Xcode...${NC}"
  open ios/maajm.xcworkspace
  echo -e "${GREEN}✅ Xcode opened${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo -e "  1. In Xcode, select your device or simulator"
  echo -e "  2. Click Run (Cmd+R) to build and install"
  echo -e "  3. Test the app on your device"
else
  echo -e "${YELLOW}Skipping Xcode (run without --no-xcode flag to open automatically)${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo -e "  1. Open ios/maajm.xcworkspace in Xcode"
  echo -e "  2. Select your device or simulator"
  echo -e "  3. Click Run (Cmd+R) to build and install"
fi

echo ""
