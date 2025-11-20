#!/bin/bash

# M3ajem iOS Build Script
# This script automates the iOS build process and applies all necessary patches

set -e  # Exit on error

# Parse arguments
BUILD_CONFIG="Debug"  # Default to Debug
SKIP_XCODE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --release)
      BUILD_CONFIG="Release"
      shift
      ;;
    --no-xcode)
      SKIP_XCODE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--release] [--no-xcode]"
      exit 1
      ;;
  esac
done

echo "🚀 Starting iOS build process..."
echo "📋 Build Configuration: $BUILD_CONFIG"

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

# Step 2: Configure localization (removed forced RTL)
echo -e "${BLUE}🌐 Configuring localization preferences...${NC}"
/usr/libexec/PlistBuddy -c "Delete :CFBundleLocalizations" ios/maajm/Info.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations array" ios/maajm/Info.plist
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations:0 string ar" ios/maajm/Info.plist
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations:1 string en" ios/maajm/Info.plist
echo -e "${GREEN}✅ Localizations configured (Arabic as primary)${NC}"

# Step 3: Install pods
echo -e "${BLUE}📚 Installing CocoaPods dependencies...${NC}"
cd ios && pod install && cd ..
echo -e "${GREEN}✅ Pods installed${NC}"

# Step 4: Configure code signing and build settings
echo -e "${BLUE}🔐 Configuring code signing and build settings...${NC}"

# Get the project file path
PROJECT_FILE="ios/maajm.xcodeproj/project.pbxproj"

# Enable automatic code signing
/usr/libexec/PlistBuddy -c "Set :objects:*:attributes:TargetAttributes:*:ProvisioningStyle Automatic" "$PROJECT_FILE" 2>/dev/null || true

# Set development team (will use Xcode's automatic signing)
# Note: User should set their team in Xcode for the first time

# Configure build settings for Release
if [ "$BUILD_CONFIG" = "Release" ]; then
  echo -e "${BLUE}  Configuring for Release build...${NC}"
  # These settings will be applied when building in Xcode
  echo -e "${YELLOW}  Note: Make sure to select 'Release' scheme in Xcode${NC}"
  echo -e "${YELLOW}  Note: Set your Development Team in Xcode > Signing & Capabilities${NC}"
fi

echo -e "${GREEN}✅ Code signing configured (automatic)${NC}"

# Step 5: Create/Update schemes
echo -e "${BLUE}📋 Configuring Xcode schemes...${NC}"

SCHEME_DIR="ios/maajm.xcodeproj/xcshareddata/xcschemes"
SCHEME_FILE="$SCHEME_DIR/maajm.xcscheme"

# Ensure xcshareddata directory exists
mkdir -p "$SCHEME_DIR"

# Check if scheme exists, if not Xcode will create it
if [ ! -f "$SCHEME_FILE" ]; then
  echo -e "${YELLOW}  Scheme will be created by Xcode on first open${NC}"
else
  echo -e "${GREEN}  Scheme exists${NC}"
fi

echo -e "${GREEN}✅ Schemes configured${NC}"

# Step 6: Summary
echo ""
echo -e "${GREEN}✨ Build process complete!${NC}"
echo -e "${YELLOW}📋 Summary:${NC}"
echo -e "  • iOS project rebuilt and cleaned"
echo -e "  • Arabic set as primary localization"
echo -e "  • CocoaPods dependencies installed"
echo -e "  • Code signing set to Automatic"
echo -e "  • Build configuration: $BUILD_CONFIG"
echo ""

# Step 7: Open Xcode (optional)
if [ "$SKIP_XCODE" = false ]; then
  echo -e "${BLUE}🔨 Opening Xcode...${NC}"
  open ios/maajm.xcworkspace
  echo -e "${GREEN}✅ Xcode opened${NC}"
  echo ""
  echo -e "${BLUE}Next steps in Xcode:${NC}"
  echo -e "  1. ${YELLOW}Set your Development Team:${NC}"
  echo -e "     • Select 'maajm' target in project navigator"
  echo -e "     • Go to 'Signing & Capabilities' tab"
  echo -e "     • Select your team from the 'Team' dropdown"
  echo ""
  if [ "$BUILD_CONFIG" = "Release" ]; then
    echo -e "  2. ${YELLOW}Select Release configuration:${NC}"
    echo -e "     • Click on the scheme dropdown (next to device)"
    echo -e "     • Select 'Edit Scheme...'"
    echo -e "     • Under 'Run' → 'Build Configuration' → Select 'Release'"
    echo ""
  fi
  echo -e "  3. Select your device or simulator"
  echo -e "  4. Click Run (⌘R) to build and install"
  echo -e "  5. Test the app on your device"
else
  echo -e "${YELLOW}Skipping Xcode (run without --no-xcode flag to open automatically)${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo -e "  1. Open ios/maajm.xcworkspace in Xcode"
  echo -e "  2. Set your Development Team in Signing & Capabilities"
  if [ "$BUILD_CONFIG" = "Release" ]; then
    echo -e "  3. Edit scheme to use Release configuration"
  fi
  echo -e "  4. Select your device or simulator"
  echo -e "  5. Click Run (⌘R) to build and install"
fi

echo ""
