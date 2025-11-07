# M3ajem App Development Guidelines

## 🚨 CRITICAL RULES - READ FIRST

### Agent Actions Rules

1. **NEVER COMMIT WITHOUT ASKING**
   - Always ask the user before running `git commit`
   - Always ask the user before running `git push`
   - Present changes first and wait for approval

2. **NEVER CHANGE WITHOUT HISTORY**
   - Before modifying ANY file, ALWAYS read it first
   - Understand the existing code and architecture
   - Ask questions if the purpose is unclear
   - Document why you're making changes

3. **NEVER RUN EXPO SERVER**
   - The user runs `npm start` / `expo start`
   - The user tests the app on their device
   - Wait for user feedback before continuing

4. **NO GIANT FILES**
   - Maximum file size: ~200 lines of code
   - Split into smaller modules if exceeding
   - Each file should have ONE clear responsibility
   - Use folders to organize related files

5. **NO HARDCODED TEXT**
   - ALL text and labels must be in `src/locales/ar.json`
   - Use `useTranslation()` hook or `t()` function
   - Never write Arabic text directly in components
   - Never write UI labels directly in code
   - This includes: buttons, labels, placeholders, error messages, tooltips, etc.

6. **ALWAYS ASK BEFORE MAJOR CHANGES**
   - New dependencies
   - Architecture changes
   - File structure changes
   - Breaking changes to existing features

## 📁 Project Structure

```
m3ajem/
├── docs/                          # Documentation
│   ├── GUIDELINES.md             # This file
│   ├── ARCHITECTURE.md           # Architecture decisions
│   └── API.md                    # Internal API documentation
│
├── assets/                       # Static assets
│   └── data/                     # Dictionary data
│       ├── optimized/            # Processed data for app
│       └── preprocess_data.py    # Data processing scripts
│
├── src/                          # Source code
│   ├── components/               # Reusable UI components
│   │   ├── common/              # Generic components (Button, Card, etc.)
│   │   ├── dictionary/          # Dictionary-specific components
│   │   ├── search/              # Search-related components
│   │   └── index.ts             # Export all components
│   │
│   ├── screens/                 # Screen components (one per tab/route)
│   │   ├── DictionariesScreen/  # Tab 1: المعاجم
│   │   ├── IndexedScreen/       # Tab 2: المفهرس
│   │   ├── AudioScreen/         # Tab 3: صوتي
│   │   ├── SmartScreen/         # Tab 4: ذكي
│   │   └── SettingsScreen/      # Tab 5: الإعدادات
│   │
│   ├── navigation/              # Navigation configuration
│   │   ├── TabNavigator.tsx    # Bottom tabs
│   │   ├── StackNavigator.tsx  # Stack navigation
│   │   └── index.ts
│   │
│   ├── services/                # Business logic & data access
│   │   ├── dictionary/         # Dictionary data service
│   │   │   ├── loader.ts       # Load and decompress data
│   │   │   ├── search.ts       # Search functionality
│   │   │   └── cache.ts        # Caching logic
│   │   ├── storage/            # Local storage
│   │   └── api/                # External APIs (chatbot, etc.)
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useDictionary.ts
│   │   ├── useSearch.ts
│   │   ├── useTheme.ts
│   │   └── useTranslation.ts   # Translation hook
│   │
│   ├── store/                   # State management (Zustand)
│   │   ├── dictionaryStore.ts
│   │   ├── settingsStore.ts
│   │   └── chatStore.ts
│   │
│   ├── locales/                 # Internationalization
│   │   ├── ar.json             # Arabic translations (ALL TEXT HERE)
│   │   ├── en.json             # English translations (future)
│   │   └── index.ts            # Translation utilities
│   │
│   ├── theme/                   # Theming
│   │   ├── colors.ts           # Color palette
│   │   ├── typography.ts       # Font styles
│   │   ├── spacing.ts          # Spacing system
│   │   └── index.ts
│   │
│   ├── types/                   # TypeScript types
│   │   ├── dictionary.ts
│   │   ├── search.ts
│   │   └── navigation.ts
│   │
│   ├── utils/                   # Utility functions
│   │   ├── arabic.ts           # Arabic text utilities
│   │   ├── compression.ts      # Data decompression
│   │   └── formatting.ts       # Text formatting
│   │
│   └── constants/               # App constants
│       ├── config.ts
│       └── settings.ts
│
├── app/                         # Expo Router (if using) or App.tsx
├── package.json
├── tsconfig.json
└── README.md
```

## 🏗️ Architecture Principles

### 1. **Separation of Concerns**
- **Components**: UI only, no business logic
- **Services**: Business logic, data fetching
- **Hooks**: Bridge between components and services
- **Store**: Global state management

### 2. **Component Structure**

Each component file should follow this pattern:

```typescript
// src/components/dictionary/DictionaryCard.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

// Props interface
interface DictionaryCardProps {
  name: string;
  description: string;
  onPress: () => void;
}

// Component (max 50 lines)
export const DictionaryCard: React.FC<DictionaryCardProps> = ({
  name,
  description,
  onPress
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Text style={[styles.name, { color: colors.text }]}>
        {name}
      </Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {description}
      </Text>
    </View>
  );
};

// Styles (separate from component)
const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    marginTop: 4,
  },
});
```

### 3. **Screen Structure**

Each screen should be in its own folder:

```
src/screens/DictionariesScreen/
├── index.tsx              # Main screen component
├── components/            # Screen-specific components
│   ├── DictionaryList.tsx
│   ├── SearchBar.tsx
│   └── FilterModal.tsx
├── hooks/                 # Screen-specific hooks
│   └── useDictionarySearch.ts
└── types.ts              # Screen-specific types
```

### 4. **Service Structure**

Services should be pure functions or classes:

```typescript
// src/services/dictionary/search.ts

import { SearchIndex, Dictionary } from '@/types/dictionary';

export class DictionarySearchService {
  private searchIndex: SearchIndex;

  constructor(searchIndex: SearchIndex) {
    this.searchIndex = searchIndex;
  }

  // Find dictionaries by root
  findByRoot(root: string): Dictionary[] {
    const dictIds = this.searchIndex.root_to_dicts[root] || [];
    return dictIds.map(id => this.searchIndex.dictionary_metadata[id]);
  }

  // Autocomplete roots
  autocompleteRoots(prefix: string): string[] {
    return this.searchIndex.root_prefix_index[prefix] || [];
  }

  // Search with filters
  search(query: string, filters?: SearchFilters): SearchResult[] {
    // Implementation
  }
}
```

### 5. **State Management**

Use Zustand for global state:

```typescript
// src/store/dictionaryStore.ts

import create from 'zustand';
import { Dictionary, SearchIndex } from '@/types/dictionary';

interface DictionaryStore {
  // State
  dictionaries: Dictionary[];
  searchIndex: SearchIndex | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadDictionaries: () => Promise<void>;
  loadSearchIndex: () => Promise<void>;
  reset: () => void;
}

export const useDictionaryStore = create<DictionaryStore>((set) => ({
  dictionaries: [],
  searchIndex: null,
  isLoading: false,
  error: null,

  loadDictionaries: async () => {
    set({ isLoading: true, error: null });
    try {
      // Load data
      const data = await loadDictionaryData();
      set({ dictionaries: data, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // ... other actions
}));
```

## 🎨 Theming System

### No Hardcoded Colors!

```typescript
// ❌ WRONG
<View style={{ backgroundColor: '#ffffff' }}>

// ✅ CORRECT
const { colors } = useTheme();
<View style={{ backgroundColor: colors.background }}>
```

## 🌐 Internationalization (i18n)

### No Hardcoded Text!

All text must be in `src/locales/ar.json`:

```json
{
  "common": {
    "search": "ابحث",
    "close": "إغلاق",
    "save": "حفظ",
    "cancel": "إلغاء"
  },
  "dictionaries": {
    "title": "المعاجم",
    "searchPlaceholder": "ابحث عن جذر",
    "noDictionaries": "لا توجد معاجم"
  },
  "errors": {
    "loadFailed": "فشل تحميل البيانات",
    "networkError": "خطأ في الاتصال"
  }
}
```

### Using Translations in Components

```typescript
// ❌ WRONG
<Text>ابحث عن جذر</Text>
<Button title="إغلاق" />

// ✅ CORRECT
import { useTranslation } from '@/hooks/useTranslation';

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <>
      <Text>{t('dictionaries.searchPlaceholder')}</Text>
      <Button title={t('common.close')} />
    </>
  );
};
```

### Translation File Structure

```
src/locales/
├── ar.json          # Arabic translations (main)
├── en.json          # English translations (future)
└── index.ts         # Export translations
```

**Organize by feature:**

```json
{
  "common": { ... },
  "dictionaries": { ... },
  "indexed": { ... },
  "audio": { ... },
  "smart": { ... },
  "settings": { ... }
}
```

### Theme Structure

```typescript
// src/theme/colors.ts

export const lightTheme = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  primary: '#2E7D32',
  // ... more colors
};

export const darkTheme = {
  background: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  primary: '#66BB6A',
  // ... more colors
};
```

## 📝 Naming Conventions

### Files
- Components: `PascalCase.tsx` (e.g., `DictionaryCard.tsx`)
- Hooks: `camelCase.ts` (e.g., `useDictionary.ts`)
- Services: `camelCase.ts` (e.g., `searchService.ts`)
- Types: `camelCase.ts` (e.g., `dictionary.ts`)
- Utils: `camelCase.ts` (e.g., `arabicUtils.ts`)

### Code
- Components: `PascalCase` (e.g., `DictionaryCard`)
- Functions: `camelCase` (e.g., `searchDictionary`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RESULTS`)
- Interfaces/Types: `PascalCase` (e.g., `DictionaryProps`)
- Enums: `PascalCase` with `UPPER_SNAKE_CASE` values

### Arabic-Specific
- Use English names for code (variables, functions, files)
- Keep Arabic ONLY in `src/locales/ar.json`
- NEVER hardcode Arabic text in components
- Use translation keys for all user-facing text

## 🔍 TypeScript Guidelines

### 1. **Always Use Types**

```typescript
// ❌ WRONG
const searchDictionary = (query, filters) => { ... }

// ✅ CORRECT
const searchDictionary = (
  query: string,
  filters?: SearchFilters
): Promise<SearchResult[]> => { ... }
```

### 2. **Define Interfaces for Props**

```typescript
// ❌ WRONG
export const Card = (props) => { ... }

// ✅ CORRECT
interface CardProps {
  title: string;
  description?: string;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ title, description, onPress }) => {
  // ...
};
```

### 3. **Use Type Inference Where Appropriate**

```typescript
// ✅ Type is inferred
const name = "لسان العرب"; // string
const count = 42; // number

// ✅ Explicit type needed
const results: Dictionary[] = [];
```

## 🎯 Performance Best Practices

### 1. **Memoization**

```typescript
import React, { memo, useMemo, useCallback } from 'react';

// Memoize expensive components
export const ExpensiveComponent = memo(({ data }) => {
  // Component code
});

// Memoize expensive calculations
const filteredResults = useMemo(() => {
  return results.filter(r => r.matches(query));
}, [results, query]);

// Memoize callbacks
const handlePress = useCallback(() => {
  navigation.navigate('Details');
}, [navigation]);
```

### 2. **List Virtualization**

```typescript
import { FlashList } from '@shopify/flash-list';

// ✅ Use FlashList for long lists
<FlashList
  data={items}
  renderItem={({ item }) => <ItemComponent item={item} />}
  estimatedItemSize={100}
/>
```

### 3. **Lazy Loading**

```typescript
// Load data only when needed
const loadDictionary = async (dictionaryId: number) => {
  if (cache.has(dictionaryId)) {
    return cache.get(dictionaryId);
  }

  const data = await fetch(`dictionary-${dictionaryId}.json`);
  cache.set(dictionaryId, data);
  return data;
};
```

## 🧪 Testing Guidelines

### Component Tests

```typescript
// __tests__/DictionaryCard.test.tsx

import { render, fireEvent } from '@testing-library/react-native';
import { DictionaryCard } from '@/components/dictionary/DictionaryCard';

describe('DictionaryCard', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <DictionaryCard name="لسان العرب" description="معجم..." />
    );

    expect(getByText('لسان العرب')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <DictionaryCard
        name="لسان العرب"
        onPress={onPress}
        testID="card"
      />
    );

    fireEvent.press(getByTestId('card'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

## 📚 Import Order

```typescript
// 1. React imports
import React, { useState, useEffect } from 'react';

// 2. React Native imports
import { View, Text, StyleSheet } from 'react-native';

// 3. Third-party libraries
import { FlashList } from '@shopify/flash-list';
import create from 'zustand';

// 4. Internal imports (use path aliases)
import { DictionaryCard } from '@/components/dictionary';
import { useDictionary } from '@/hooks/useDictionary';
import { searchService } from '@/services/dictionary';
import { Dictionary } from '@/types/dictionary';

// 5. Relative imports (avoid if possible)
import { LocalComponent } from './LocalComponent';
```

## 🚀 Git Workflow

### Branch Naming
- Feature: `feature/tab-1-dictionaries`
- Fix: `fix/search-crash`
- Refactor: `refactor/components-structure`

### Commit Messages
```
feat: add dictionary list component
fix: resolve search index loading issue
refactor: split DictionariesScreen into smaller components
docs: update architecture guidelines
style: format code with prettier
```

### Before Committing
1. ✅ Test the feature
2. ✅ Run linter: `npm run lint`
3. ✅ Run tests: `npm test`
4. ✅ Check no console.logs left
5. ✅ Ask user for approval

## 📱 RTL Support

All UI must support RTL (Right-to-Left) for Arabic:

```typescript
import { I18nManager } from 'react-native';

// Check if RTL
const isRTL = I18nManager.isRTL;

// Use flexDirection
<View style={{
  flexDirection: isRTL ? 'row-reverse' : 'row'
}}>
```

## 🔐 Security Guidelines

1. **Never commit secrets**
   - API keys go in `.env` (not committed)
   - Use environment variables

2. **Validate user input**
   - Sanitize search queries
   - Validate chat input

3. **Secure storage**
   - Use SecureStore for sensitive data
   - Use AsyncStorage for non-sensitive data

## 📖 Documentation Requirements

### Code Documentation

```typescript
/**
 * Searches dictionaries by root
 *
 * @param root - Arabic root to search for
 * @param dictionaryIds - Optional array of dictionary IDs to filter
 * @returns Array of dictionaries containing the root
 *
 * @example
 * const results = searchByRoot('كتب', [0, 1]);
 */
export function searchByRoot(
  root: string,
  dictionaryIds?: number[]
): Dictionary[] {
  // Implementation
}
```

### README.md in Each Major Directory

Each major directory should have a README explaining:
- Purpose of the directory
- How files are organized
- How to add new files
- Examples

## 🛠️ Development Workflow

### Starting a New Feature

1. **Read the guidelines** (this file)
2. **Read existing code** related to the feature
3. **Plan the structure** (which files, components)
4. **Ask questions** if anything is unclear
5. **Implement incrementally** (small, testable pieces)
6. **Test frequently** with user feedback
7. **Document** as you go

### Making Changes

1. **Read the file first** - understand current implementation
2. **Understand why** it was written that way
3. **Plan the change** - how to modify without breaking
4. **Test the change** - ensure nothing breaks
5. **Ask for review** before committing

## ❌ Common Mistakes to Avoid

1. **Giant files** - Split into smaller modules
2. **Hardcoded colors** - Use theme system
3. **Hardcoded text** - Use translation system (ar.json)
4. **No types** - Always use TypeScript types
5. **Direct state mutation** - Use immutable updates
6. **Unnecessary re-renders** - Use memo, useMemo, useCallback
7. **No error handling** - Always handle errors gracefully
8. **Inline styles** - Use StyleSheet.create
9. **Magic numbers** - Use named constants
10. **Deep nesting** - Extract components
11. **No comments on complex logic** - Document why, not what

## 🎓 Learning Resources

- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Hooks](https://react.dev/reference/react)
- [Zustand Docs](https://github.com/pmndrs/zustand)

## 📞 When in Doubt

- Ask the user
- Check existing code for patterns
- Refer to these guidelines
- Keep it simple and modular
