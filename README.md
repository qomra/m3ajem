# م3اجم (M3ajem) - Arabic Dictionary App

A comprehensive Arabic dictionary mobile application built with React Native and Expo.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## 📱 Features

- **المعاجم (Dictionaries)**: Browse and search across 8 Arabic dictionaries
- **المفهرس (Indexed)**: Search indexed words with root grouping
- **صوتي (Audio)**: Audio playback for dictionary entries
- **ذكي (Smart)**: AI-powered chat assistant
- **الإعدادات (Settings)**: Theme, font size, and app configuration

## 🏗️ Project Structure

```
m3ajem/
├── app/                  # Expo Router pages
│   ├── (tabs)/          # Tab navigation screens
│   └── _layout.tsx      # Root layout
├── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # Screen components
│   ├── hooks/           # Custom React hooks
│   ├── store/           # Zustand state management
│   ├── locales/         # i18n translations (ar.json)
│   ├── theme/           # Theme system
│   ├── types/           # TypeScript types
│   ├── services/        # Business logic
│   └── utils/           # Utility functions
├── assets/              # Static assets
│   └── data/            # Dictionary data
└── docs/                # Documentation
    ├── GUIDELINES.md    # Development guidelines
    ├── ARCHITECTURE.md  # Architecture decisions
    └── SETUP.md         # Setup instructions
```

## 📖 Documentation

- **[GUIDELINES.md](docs/GUIDELINES.md)** - Development rules and best practices
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical architecture
- **[SETUP.md](docs/SETUP.md)** - Detailed setup guide
- **[CLAUDE.md](CLAUDE.md)** - Quick reference for AI agents

## 🎨 Tech Stack

- **React Native** - Mobile framework
- **Expo** - Development platform
- **TypeScript** - Type safety
- **Zustand** - State management
- **Expo Router** - File-based routing
- **FlashList** - High-performance lists

## 🌐 Internationalization

All text is stored in `src/locales/ar.json`. No hardcoded text in components!

```typescript
// ✅ CORRECT
const { t } = useTranslation();
<Text>{t('common.search')}</Text>

// ❌ WRONG
<Text>ابحث</Text>
```

## 🎨 Theme System

All colors come from the theme system. No hardcoded colors!

```typescript
// ✅ CORRECT
const { colors } = useTheme();
<View style={{ backgroundColor: colors.background }} />

// ❌ WRONG
<View style={{ backgroundColor: '#ffffff' }} />
```

## 📊 Data

Dictionary data is stored in `assets/data/optimized/`:
- `maajem-optimized.json.gz` (18.89 MB) - 8 dictionaries
- `index-optimized.json.gz` (1.04 MB) - Indexed words
- `search-index.json.gz` (6.00 MB) - Pre-built search indexes

Total bundle: **~26 MB**

## 🚦 Development Status

✅ Project initialized
✅ Folder structure created
✅ Theme system implemented
✅ i18n system implemented
✅ Base navigation working
⏳ Tab 1: المعاجم (in development)
⏳ Tab 2: المفهرس (pending)
⏳ Tab 3: صوتي (pending)
⏳ Tab 4: ذكي (pending)
⏳ Tab 5: الإعدادات (pending)

## 🛠️ Scripts

```bash
npm start                   # Start Expo dev server
npm run android             # Run on Android
npm run ios                 # Run on iOS
npm run web                 # Run on web
npm run build:ios           # Build iOS (Debug) + configure signing + open Xcode
npm run build:ios-release   # Build iOS (Release) + configure signing + open Xcode
npm run build:ios-no-xcode  # Build iOS without opening Xcode
npm run lint                # Lint code
npm run lint:fix            # Fix linting issues
npm run type-check          # TypeScript type checking
```

### 🍎 iOS Build Process

For iOS development, use the automated build script instead of manual prebuild:

```bash
# Debug build (default, for development)
npm run build:ios

# Release build (optimized, for testing production builds)
npm run build:ios-release
```

This script automatically:
1. Cleans and rebuilds iOS project (`expo prebuild --clean`)
2. Patches AppDelegate.swift with RTL support
3. Configures Info.plist (CFBundleDevelopmentRegion: ar)
4. Sets Arabic as primary localization
5. Installs CocoaPods dependencies
6. Configures automatic code signing
7. Sets up Xcode schemes
8. Opens Xcode workspace

Then in Xcode:
1. **Set your Development Team** (Signing & Capabilities tab)
2. Select your device/simulator
3. For Release builds: Edit Scheme → Run → Build Configuration → Release
4. Click Run (⌘R)
5. Test on device

**Note:** The first time you build, you'll need to set your Apple Developer Team in Xcode under the "Signing & Capabilities" tab. The script configures automatic signing, so Xcode will handle provisioning profiles automatically.

## 📝 License

[Add license here]

## 👨‍💻 Contributing

See [GUIDELINES.md](docs/GUIDELINES.md) for development guidelines.

## 📞 Support

[Add contact/support information]