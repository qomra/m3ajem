# M3ajem Project Setup Guide

## Initial Setup

### 1. Initialize Expo Project

```bash
# Navigate to project root
cd /home/jalalirs/Documents/code/m3ajem

# Create Expo app with TypeScript template
npx create-expo-app@latest . --template blank-typescript
```

### 2. Install Dependencies

```bash
# Core dependencies
npm install zustand
npm install @shopify/flash-list
npm install pako
npm install @types/pako --save-dev
npm install @react-navigation/native
npm install @react-navigation/bottom-tabs
npm install @react-navigation/native-stack
npm install react-native-screens
npm install react-native-safe-area-context

# Expo packages
npx expo install expo-file-system
npx expo install expo-asset
npx expo install @react-native-async-storage/async-storage
npx expo install expo-secure-store

# Development dependencies
npm install --save-dev @typescript-eslint/eslint-plugin
npm install --save-dev @typescript-eslint/parser
npm install --save-dev prettier
npm install --save-dev eslint-config-prettier
npm install --save-dev eslint-plugin-react
npm install --save-dev eslint-plugin-react-hooks
```

### 3. Create Folder Structure

```bash
# Create main directories
mkdir -p src/{components,screens,navigation,services,hooks,store,locales,theme,types,utils,constants}

# Create subdirectories for components
mkdir -p src/components/{common,dictionary,search,audio,chat}

# Create subdirectories for screens
mkdir -p src/screens/{DictionariesScreen,IndexedScreen,AudioScreen,SmartScreen,SettingsScreen}

# Create subdirectories for services
mkdir -p src/services/{dictionary,storage,api}

# Create subdirectories for theme
mkdir -p src/theme
```

### 4. Configuration Files

Create the following configuration files:

- `tsconfig.json` - TypeScript configuration
- `.eslintrc.js` - ESLint configuration
- `.prettierrc` - Prettier configuration
- `app.json` - Expo configuration

### 5. Path Aliases

Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@screens/*": ["src/screens/*"],
      "@services/*": ["src/services/*"],
      "@hooks/*": ["src/hooks/*"],
      "@store/*": ["src/store/*"],
      "@theme/*": ["src/theme/*"],
      "@types/*": ["src/types/*"],
      "@utils/*": ["src/utils/*"],
      "@constants/*": ["src/constants/*"]
    }
  }
}
```

## Project Structure

```
m3ajem/
├── assets/
│   ├── data/
│   │   ├── optimized/
│   │   │   ├── maajem-optimized.json.gz
│   │   │   ├── index-optimized.json.gz
│   │   │   ├── search-index.json.gz
│   │   │   └── metadata.json.gz
│   │   ├── preprocess_data.py
│   │   └── analyze_data.py
│   ├── fonts/
│   └── images/
│
├── docs/
│   ├── GUIDELINES.md
│   ├── ARCHITECTURE.md
│   └── SETUP.md (this file)
│
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── dictionary/
│   │   │   ├── DictionaryCard.tsx
│   │   │   ├── DictionaryList.tsx
│   │   │   ├── RootCard.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── search/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── SearchResults.tsx
│   │   │   ├── FilterChips.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts
│   │
│   ├── screens/
│   │   ├── DictionariesScreen/
│   │   │   ├── index.tsx
│   │   │   ├── components/
│   │   │   │   ├── DictionaryList.tsx
│   │   │   │   ├── SearchModal.tsx
│   │   │   │   └── FilterModal.tsx
│   │   │   └── hooks/
│   │   │       └── useDictionarySearch.ts
│   │   │
│   │   ├── IndexedScreen/
│   │   ├── AudioScreen/
│   │   ├── SmartScreen/
│   │   └── SettingsScreen/
│   │
│   ├── navigation/
│   │   ├── TabNavigator.tsx
│   │   ├── RootNavigator.tsx
│   │   └── index.ts
│   │
│   ├── services/
│   │   ├── dictionary/
│   │   │   ├── loader.ts
│   │   │   ├── search.ts
│   │   │   ├── cache.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── storage/
│   │   │   ├── asyncStorage.ts
│   │   │   └── secureStorage.ts
│   │   │
│   │   └── index.ts
│   │
│   ├── hooks/
│   │   ├── useDictionary.ts
│   │   ├── useSearch.ts
│   │   ├── useTheme.ts
│   │   └── index.ts
│   │
│   ├── store/
│   │   ├── dictionaryStore.ts
│   │   ├── settingsStore.ts
│   │   ├── chatStore.ts
│   │   └── index.ts
│   │
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   ├── index.ts
│   │   └── ThemeProvider.tsx
│   │
│   ├── types/
│   │   ├── dictionary.ts
│   │   ├── search.ts
│   │   ├── navigation.ts
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── arabic.ts
│   │   ├── compression.ts
│   │   ├── formatting.ts
│   │   └── index.ts
│   │
│   └── constants/
│       ├── config.ts
│       └── settings.ts
│
├── App.tsx
├── app.json
├── package.json
├── tsconfig.json
├── .eslintrc.js
├── .prettierrc
├── .gitignore
└── README.md
```

## Development Workflow

### 1. Start Development

```bash
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on physical device

### 2. Running Tests

```bash
npm test
```

### 3. Linting

```bash
npm run lint
npm run lint:fix
```

### 4. Type Checking

```bash
npm run type-check
```

## Environment Variables

Create `.env` file (not committed to git):

```env
# API Keys (if needed for chatbot)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# App Configuration
API_BASE_URL=https://api.example.com
```

## Data Setup

### Copy Optimized Data Files

```bash
# Copy optimized dictionary data to assets
cp assets/data/optimized/*.gz assets/data/

# Or create symbolic link
ln -s assets/data/optimized assets/data-optimized
```

## Build Configuration

### App.json

```json
{
  "expo": {
    "name": "معاجم",
    "slug": "m3ajem",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.m3ajem.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.m3ajem.app"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-asset",
      "expo-file-system"
    ]
  }
}
```

## Git Ignore

Ensure `.gitignore` includes:

```gitignore
# Expo
.expo/
dist/
web-build/

# Node
node_modules/
npm-debug.log
yarn-error.log

# macOS
.DS_Store

# Environment
.env
.env.local

# IDE
.vscode/
.idea/

# Build
*.ipa
*.apk
*.aab

# Testing
coverage/

# Temporary
*.tmp
*.temp
```

## Troubleshooting

### Module Resolution Issues

If you encounter "Cannot find module" errors:

```bash
# Clear cache
npx expo start -c

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

```bash
# Reset Expo
rm -rf node_modules .expo
npm install
npx expo start -c
```

### Type Errors

```bash
# Check TypeScript configuration
npx tsc --noEmit

# Generate types
npm run type-check
```

## Next Steps

1. ✅ Read GUIDELINES.md
2. ✅ Read ARCHITECTURE.md
3. ⏳ Initialize Expo project
4. ⏳ Set up folder structure
5. ⏳ Create base components
6. ⏳ Implement Tab 1 (المعاجم)
7. ⏳ Implement Tab 2 (المفهرس)
8. ⏳ Implement Tab 3 (صوتي)
9. ⏳ Implement Tab 4 (ذكي)
10. ⏳ Implement Tab 5 (الإعدادات)

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Zustand](https://github.com/pmndrs/zustand)
- [TypeScript](https://www.typescriptlang.org/)
