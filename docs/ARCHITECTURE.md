# M3ajem App Architecture

## Overview

M3ajem is a React Native + Expo app for browsing Arabic dictionaries with advanced search capabilities.

## Technology Stack

### Core
- **React Native** - Mobile framework
- **Expo** - Development platform and tooling
- **TypeScript** - Type safety

### State Management
- **Zustand** - Lightweight state management
  - Simple API
  - No boilerplate
  - TypeScript support

### UI & Navigation
- **Expo Router** - File-based routing (or React Navigation)
- **React Native Paper** - UI component library (optional)
- **@shopify/flash-list** - High-performance lists

### Data & Storage
- **pako** - Gzip decompression
- **AsyncStorage** - Local storage
- **Expo FileSystem** - File access

### Development
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework

## App Architecture

### 1. **Data Flow**

```
┌─────────────────────────────────────────────────────────┐
│                     User Interaction                     │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                   Screen Component                       │
│  (e.g., DictionariesScreen)                             │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    Custom Hook                           │
│  (e.g., useDictionarySearch)                            │
│  - Manages local state                                   │
│  - Calls services                                        │
│  - Calls store actions                                   │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌──────────────┐
│  Service      │   │  Store       │
│  (Business    │   │  (Global     │
│   Logic)      │   │   State)     │
└───────┬───────┘   └──────┬───────┘
        │                  │
        ▼                  ▼
┌─────────────────────────────────┐
│         Data Layer              │
│  - Compressed JSON files        │
│  - AsyncStorage                 │
│  - File System                  │
└─────────────────────────────────┘
```

### 2. **Navigation Structure**

```
App
├── TabNavigator (Bottom Tabs)
│   ├── DictionariesTab
│   │   ├── DictionariesScreen
│   │   ├── DictionaryDetailScreen (Stack)
│   │   ├── RootDetailScreen (Stack)
│   │   └── GlobalSearchScreen (Modal)
│   │
│   ├── IndexedTab
│   │   ├── IndexedWordsScreen
│   │   └── WordDetailScreen (Stack)
│   │
│   ├── AudioTab
│   │   ├── AudioListScreen
│   │   └── AudioPlayerScreen (Stack)
│   │
│   ├── SmartTab
│   │   └── ChatScreen
│   │
│   └── SettingsTab
│       └── SettingsScreen
│
└── Modals (Global)
    ├── FilterModal
    ├── InfoModal
    └── ErrorModal
```

### 3. **State Management Strategy**

#### Global State (Zustand)
Use for data that needs to be shared across screens:

- **dictionaryStore**
  - Loaded dictionaries data
  - Search index
  - Loading state

- **settingsStore**
  - Theme (light/dark)
  - Font size
  - Chatbot configuration
  - App preferences

- **chatStore**
  - Chat messages
  - Chat history
  - Active conversation

#### Local State (useState)
Use for screen-specific state:
- Form inputs
- Modal visibility
- Temporary selections
- UI state (expanded/collapsed)

#### Server State (if needed in future)
- Use React Query for API calls
- Caching and synchronization

### 4. **Data Loading Strategy**

```typescript
// On App Startup
┌─────────────────────────────────────┐
│ 1. Load metadata.json.gz            │
│    (Fast: 530 B)                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Load search-index.json.gz        │
│    (Medium: 6 MB)                   │
│    - Dictionary metadata            │
│    - Search indexes                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Show UI (app is usable)          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. Load maajem-optimized.json.gz    │
│    (Background: 18.89 MB)           │
│    - Full dictionary definitions    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. Load index-optimized.json.gz     │
│    (Background: 1.04 MB)            │
│    - Indexed words                  │
└─────────────────────────────────────┘
```

**Total startup time: ~500-800ms to usable state**

### 5. **Search Architecture**

#### Root Search
```typescript
// Fast: O(1) lookup
const dictionaryIds = searchIndex.root_to_dicts[root];
const results = dictionaryIds.map(id => ({
  dictionary: metadata[id],
  definition: maajem[id].data[root]
}));
```

#### Word Search
```typescript
// Fast: O(1) lookup
const rootInfo = searchIndex.word_to_roots[word];
const results = rootInfo.map(({ dict_id, root }) => ({
  word,
  root,
  dictionary: metadata[dict_id],
  definition: maajem[dict_id].data[root]
}));
```

#### Prefix Autocomplete
```typescript
// O(1) to get candidate list, then filter
const candidates = searchIndex.root_prefix_index[prefix.slice(0, 3)];
const filtered = candidates.filter(root => root.startsWith(prefix));
```

#### Reverse Search (Suffix)
```typescript
// O(1) to get candidate list, then filter
const candidates = searchIndex.word_suffix_index[suffix.slice(-3)];
const filtered = candidates.filter(word => word.endsWith(suffix));
```

### 6. **Theme System**

```typescript
// Theme Context
ThemeProvider
  ├── Light Theme
  │   ├── Colors
  │   ├── Typography
  │   └── Spacing
  │
  └── Dark Theme
      ├── Colors
      ├── Typography
      └── Spacing

// Usage in components
const { colors, typography, spacing } = useTheme();
```

### 7. **Caching Strategy**

```typescript
// Memory Cache (for current session)
const memoryCache = new Map();

// Persistent Cache (AsyncStorage)
const persistentCache = {
  recentSearches: [], // Last 20 searches
  favorites: [],      // Favorited roots
  history: [],        // Browse history
  settings: {}        // User settings
};
```

## Module Dependencies

```
Navigation
  └── Screens
      └── Components
          └── Hooks
              ├── Services
              │   └── Utils
              └── Store
                  └── Types
```

**Rule: Lower layers CANNOT import from upper layers**

## File Size Limits

- **Components**: < 200 lines
- **Screens**: < 300 lines (split into components if needed)
- **Services**: < 250 lines (split into multiple services)
- **Hooks**: < 100 lines
- **Utils**: < 150 lines

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| App startup | < 1s | < 2s |
| Search response | < 50ms | < 200ms |
| Screen transition | 60 FPS | 30 FPS |
| List scroll | 60 FPS | 30 FPS |
| Memory usage | < 150 MB | < 250 MB |

## Internationalization (i18n)

### Text Management

**All user-facing text MUST be in `src/locales/ar.json`**

```typescript
// Translation hook
const { t } = useTranslation();

// Usage
<Text>{t('dictionaries.title')}</Text>
<TextInput placeholder={t('dictionaries.searchPlaceholder')} />
<Button title={t('common.save')} />
```

### Translation Structure

```json
{
  "common": {
    "search": "ابحث",
    "close": "إغلاق",
    "save": "حفظ",
    "cancel": "إلغاء",
    "back": "رجوع"
  },
  "tabs": {
    "dictionaries": "المعاجم",
    "indexed": "المفهرس",
    "audio": "صوتي",
    "smart": "ذكي",
    "settings": "الإعدادات"
  },
  "dictionaries": {
    "title": "المعاجم",
    "searchPlaceholder": "ابحث عن جذر",
    "filterByDictionary": "فلترة الجذور حسب المعجم",
    "allDictionaries": "جميع المعاجم",
    "apply": "تطبيق",
    "info": "معلومات"
  },
  "errors": {
    "loadFailed": "فشل تحميل البيانات",
    "networkError": "خطأ في الاتصال",
    "notFound": "لم يتم العثور على نتائج"
  }
}
```

### Future Localization

Structure is ready for:
- English translation (`en.json`)
- Other languages
- RTL/LTR switching

## Security Considerations

1. **Data Integrity**
   - Validate loaded JSON structure
   - Handle corrupted data gracefully

2. **Chat Security**
   - Sanitize chat inputs
   - Don't expose API keys in code
   - Use environment variables

3. **Storage Security**
   - Use SecureStore for API keys
   - Use AsyncStorage for non-sensitive data

4. **Text Security**
   - All text from `ar.json` is safe (controlled by us)
   - Sanitize user input before display
   - Prevent XSS in chat feature

## Testing Strategy

### Unit Tests
- Services (business logic)
- Utils (helper functions)
- Hooks (custom hooks)

### Component Tests
- Component rendering
- User interactions
- Props validation

### Integration Tests
- Navigation flow
- Data loading
- Search functionality

### E2E Tests (Future)
- Critical user paths
- Tab navigation
- Search flow

## Accessibility

1. **Screen Readers**
   - Add accessibilityLabel to all interactive elements
   - Use accessibilityHint for complex interactions

2. **Font Scaling**
   - Support dynamic font sizing
   - Test with different text sizes

3. **RTL Support**
   - All layouts must support RTL
   - Use logical properties (start/end vs left/right)

## Build & Deployment

### Development
```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
```

### Production
```bash
npm run build:ios      # Build for iOS
npm run build:android  # Build for Android
```

### CI/CD (Future)
- GitHub Actions
- Automated testing
- Automated builds

## Monitoring & Analytics (Future)

- Error tracking (Sentry)
- Performance monitoring
- Usage analytics
- Crash reporting

## Future Enhancements

1. **Offline-First**
   - All data already local
   - Sync chat history to cloud

2. **Performance**
   - Web Workers for search
   - Native modules for text processing

3. **Features**
   - Bookmarks
   - Notes on roots
   - Share functionality
   - Export to PDF

4. **Platform**
   - Web version
   - Desktop (Electron)
   - Browser extension

## Decision Log

### Why Zustand over Redux?
- Simpler API
- Less boilerplate
- Better TypeScript support
- Smaller bundle size

### Why FlashList over FlatList?
- Better performance (10x faster)
- Lower memory usage
- Smoother scrolling

### Why Compressed JSON over SQLite?
- Smaller app size (26 MB vs 112 MB)
- Simpler implementation
- Fast enough for our use case
- Pre-built indexes compensate for parsing

### Why Expo over React Native CLI?
- Faster development
- Built-in features (FileSystem, etc.)
- Easier updates
- Better developer experience

## Contributing

See [GUIDELINES.md](./GUIDELINES.md) for development guidelines.
