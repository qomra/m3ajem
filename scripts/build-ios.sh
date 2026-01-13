#!/bin/bash
#
# build-ios.sh - Build M3ajem iOS app for Xcode
#
# Usage:
#   ./scripts/build-ios.sh              # Prebuild + pod install (for Xcode)
#   ./scripts/build-ios.sh simulator    # Build for iOS Simulator
#   ./scripts/build-ios.sh device       # Build for iOS Device
#   ./scripts/build-ios.sh release      # Build release archive
#   ./scripts/build-ios.sh clean        # Clean and rebuild
#   ./scripts/build-ios.sh nuke         # Nuclear clean (removes everything)
#   ./scripts/build-ios.sh deploy       # Build Release + deploy to device
#   ./scripts/build-ios.sh xcode        # Open in Xcode
#   ./scripts/build-ios.sh pods         # Just install pods
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Project names
WORKSPACE_NAME="almajm"
SCHEME_NAME="almajm"
APP_NAME="almajm"

# Apple Developer Team ID and device name (from environment or .env.local)
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    source "$PROJECT_ROOT/.env.local" 2>/dev/null || true
fi
TEAM_ID="${APPLE_TEAM_ID:-}"
DEVICE_NAME="${APPLE_DEVICE_NAME:-iPhone}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

cd "$PROJECT_ROOT"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    if ! command -v npx &> /dev/null; then
        log_error "npx is not installed"
        exit 1
    fi

    if ! command -v pod &> /dev/null; then
        log_error "CocoaPods is not installed. Run: sudo gem install cocoapods"
        exit 1
    fi

    if ! command -v xcodebuild &> /dev/null; then
        log_error "Xcode command line tools not installed. Run: xcode-select --install"
        exit 1
    fi

    log_success "All prerequisites met"
}

# Install dependencies if needed
install_deps() {
    if [ ! -d "node_modules" ]; then
        log_info "Installing npm dependencies..."
        npm install
        patch_boost
    fi
}

# Patch boost podspec to use working URL (jfrog is broken)
patch_boost() {
    local boost_spec="node_modules/react-native/third-party-podspecs/boost.podspec"
    if [ -f "$boost_spec" ]; then
        log_info "Patching boost podspec..."
        sed -i '' 's|https://boostorg.jfrog.io/artifactory/main/release|https://archives.boost.io/release|g' "$boost_spec"
    fi
}

# Configure localization (Arabic as primary)
configure_localization() {
    local plist="ios/$APP_NAME/Info.plist"
    if [ -f "$plist" ]; then
        log_info "Configuring localization preferences..."
        /usr/libexec/PlistBuddy -c "Delete :CFBundleLocalizations" "$plist" 2>/dev/null || true
        /usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations array" "$plist"
        /usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations:0 string ar" "$plist"
        /usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations:1 string en" "$plist"
        log_success "Localizations configured (Arabic as primary)"
    fi
}

# Prebuild iOS
prebuild_ios() {
    local clean=$1

    if [ "$clean" = "clean" ]; then
        log_info "Cleaning and prebuilding iOS..."
        npx expo prebuild --platform ios --clean --non-interactive
    else
        log_info "Prebuilding iOS..."
        npx expo prebuild --platform ios --non-interactive
    fi

    # Configure localization after prebuild
    configure_localization
}

# Install CocoaPods
install_pods() {
    log_info "Installing CocoaPods dependencies..."
    cd ios
    pod install
    cd ..
}

# Build for simulator
build_simulator() {
    log_info "Building for iOS Simulator..."
    cd ios
    xcodebuild \
        -workspace "$WORKSPACE_NAME.xcworkspace" \
        -scheme "$SCHEME_NAME" \
        -configuration Debug \
        -sdk iphonesimulator \
        -derivedDataPath build \
        | xcpretty || xcodebuild \
        -workspace "$WORKSPACE_NAME.xcworkspace" \
        -scheme "$SCHEME_NAME" \
        -configuration Debug \
        -sdk iphonesimulator \
        -derivedDataPath build
    cd ..
    log_success "Simulator build complete! App located in ios/build/"
}

# Build for device
build_device() {
    log_info "Building for iOS Device..."
    cd ios
    xcodebuild \
        -workspace "$WORKSPACE_NAME.xcworkspace" \
        -scheme "$SCHEME_NAME" \
        -configuration Debug \
        -sdk iphoneos \
        -derivedDataPath build \
        | xcpretty || xcodebuild \
        -workspace "$WORKSPACE_NAME.xcworkspace" \
        -scheme "$SCHEME_NAME" \
        -configuration Debug \
        -sdk iphoneos \
        -derivedDataPath build
    cd ..
    log_success "Device build complete! App located in ios/build/"
}

# Build release archive
build_release() {
    log_info "Building Release Archive..."
    cd ios
    xcodebuild \
        -workspace "$WORKSPACE_NAME.xcworkspace" \
        -scheme "$SCHEME_NAME" \
        -configuration Release \
        -sdk iphoneos \
        -archivePath "build/$APP_NAME.xcarchive" \
        archive \
        | xcpretty || xcodebuild \
        -workspace "$WORKSPACE_NAME.xcworkspace" \
        -scheme "$SCHEME_NAME" \
        -configuration Release \
        -sdk iphoneos \
        -archivePath "build/$APP_NAME.xcarchive" \
        archive
    cd ..
    log_success "Release archive created at ios/build/$APP_NAME.xcarchive"
    log_info "To export IPA, open the archive in Xcode Organizer"
}

# Open in Xcode
open_xcode() {
    log_info "Opening project in Xcode..."
    open "ios/$WORKSPACE_NAME.xcworkspace"
}

# Build and deploy to device
deploy_to_device() {
    # Check for Team ID
    if [ -z "$TEAM_ID" ]; then
        log_error "APPLE_TEAM_ID not set. Add it to .env.local:"
        echo "  APPLE_TEAM_ID=your_team_id"
        exit 1
    fi

    log_info "Building Release and deploying to $DEVICE_NAME..."

    # Check for ios-deploy
    if ! command -v ios-deploy &> /dev/null; then
        log_error "ios-deploy is not installed. Run: brew install ios-deploy"
        exit 1
    fi

    cd ios

    # Clean previous build
    log_info "Cleaning previous build..."
    rm -rf "build/Build/Products/Release-iphoneos"

    # Build with automatic signing
    log_info "Building Release configuration..."
    xcodebuild \
        -workspace "$WORKSPACE_NAME.xcworkspace" \
        -scheme "$SCHEME_NAME" \
        -configuration Release \
        -sdk iphoneos \
        -derivedDataPath build \
        -allowProvisioningUpdates \
        DEVELOPMENT_TEAM="$TEAM_ID" \
        CODE_SIGN_STYLE=Automatic \
        CODE_SIGN_IDENTITY="Apple Development" \
        build \
        | xcpretty || xcodebuild \
        -workspace "$WORKSPACE_NAME.xcworkspace" \
        -scheme "$SCHEME_NAME" \
        -configuration Release \
        -sdk iphoneos \
        -derivedDataPath build \
        -allowProvisioningUpdates \
        DEVELOPMENT_TEAM="$TEAM_ID" \
        CODE_SIGN_STYLE=Automatic \
        CODE_SIGN_IDENTITY="Apple Development" \
        build

    log_success "Build complete!"

    # Find the app bundle (check both possible capitalization)
    APP_PATH="build/Build/Products/Release-iphoneos/$APP_NAME.app"
    if [ ! -d "$APP_PATH" ]; then
        # Try with capitalized name
        APP_PATH="build/Build/Products/Release-iphoneos/Almajm.app"
    fi
    if [ ! -d "$APP_PATH" ]; then
        log_error "App bundle not found"
        log_info "Looking for .app in build folder..."
        find build -name "*.app" -type d 2>/dev/null
        exit 1
    fi

    # Deploy to device
    log_info "Deploying to $DEVICE_NAME..."
    cd ..
    ios-deploy --bundle "ios/$APP_PATH" --debug 2>&1 || ios-deploy --bundle "ios/$APP_PATH"

    log_success "Deployed to $DEVICE_NAME!"
}

# Nuclear clean - remove everything and rebuild from scratch
nuke_and_rebuild() {
    log_warn "Nuclear clean - removing everything..."

    # Remove Xcode DerivedData for this project
    log_info "Removing Xcode DerivedData..."
    rm -rf ~/Library/Developer/Xcode/DerivedData/${WORKSPACE_NAME}-*
    rm -rf ~/Library/Developer/Xcode/DerivedData/${APP_NAME}-*

    # Remove ios folder
    log_info "Removing ios folder..."
    rm -rf ios

    # Remove Expo and Metro cache
    log_info "Removing Expo and Metro cache..."
    rm -rf .expo
    rm -rf node_modules/.cache

    # Remove node_modules and package-lock.json
    log_info "Removing node_modules and package-lock.json..."
    rm -rf node_modules package-lock.json

    # Clear CocoaPods cache
    log_info "Clearing CocoaPods cache..."
    pod cache clean --all 2>/dev/null || true

    # Reinstall npm dependencies
    log_info "Installing npm dependencies..."
    npm install

    # Patch boost (jfrog URL is broken)
    patch_boost

    # Prebuild with clean
    log_info "Running expo prebuild --clean..."
    npx expo prebuild --platform ios --clean --non-interactive

    # Configure localization
    configure_localization

    # Install pods
    log_info "Installing CocoaPods..."
    cd ios && pod install && cd ..

    log_success "Nuclear rebuild complete!"
    log_info "Open Xcode with: ./scripts/build-ios.sh xcode"
}

# Show help
show_help() {
    echo "M3ajem iOS Build Script"
    echo ""
    echo "Usage: ./scripts/build-ios.sh [command]"
    echo ""
    echo "Commands:"
    echo "  (none)      Prebuild + pod install (prepares for Xcode)"
    echo "  simulator   Build for iOS Simulator"
    echo "  device      Build for iOS Device (Debug)"
    echo "  release     Build release archive"
    echo "  clean       Clean prebuild and reinstall"
    echo "  nuke        Nuclear clean (removes everything)"
    echo "  deploy      Build Release + deploy to device"
    echo "  xcode       Open project in Xcode"
    echo "  pods        Just install CocoaPods"
    echo "  help        Show this help message"
    echo ""
    echo "Environment variables (can be set in .env.local):"
    echo "  APPLE_TEAM_ID      Your Apple Developer Team ID (required for deploy)"
    echo "  APPLE_DEVICE_NAME  Device name for deploy (default: iPhone)"
}

# Main
case "${1:-}" in
    "simulator")
        check_prerequisites
        install_deps
        prebuild_ios
        install_pods
        build_simulator
        ;;
    "device")
        check_prerequisites
        install_deps
        prebuild_ios
        install_pods
        build_device
        ;;
    "release")
        check_prerequisites
        install_deps
        prebuild_ios
        install_pods
        build_release
        ;;
    "clean")
        check_prerequisites
        install_deps
        prebuild_ios "clean"
        install_pods
        log_success "Clean prebuild complete!"
        log_info "Open Xcode with: ./scripts/build-ios.sh xcode"
        ;;
    "nuke")
        check_prerequisites
        nuke_and_rebuild
        ;;
    "deploy")
        check_prerequisites
        install_deps
        if [ ! -d "ios" ]; then
            prebuild_ios
            install_pods
        fi
        deploy_to_device
        ;;
    "xcode")
        if [ ! -d "ios" ]; then
            log_warn "iOS folder not found. Running prebuild first..."
            check_prerequisites
            install_deps
            prebuild_ios
            install_pods
        fi
        open_xcode
        ;;
    "pods")
        install_pods
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        check_prerequisites
        install_deps
        prebuild_ios
        install_pods
        log_success "iOS prebuild complete!"
        echo ""
        echo "Next steps:"
        echo "  1. Open in Xcode:  ./scripts/build-ios.sh xcode"
        echo "  2. Or build:       ./scripts/build-ios.sh simulator"
        echo "  3. Or release:     ./scripts/build-ios.sh release"
        echo "  4. Or deploy:      ./scripts/build-ios.sh deploy"
        ;;
esac
