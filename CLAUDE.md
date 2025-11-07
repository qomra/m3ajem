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

## 🌐 Internationalization

**ALL text must be in `src/locales/ar.json`:**

```typescript
// ❌ WRONG
<Text>ابحث عن جذر</Text>

// ✅ CORRECT
const { t } = useTranslation();
<Text>{t('dictionaries.searchPlaceholder')}</Text>
```

## 📁 Project Structure

```
src/
├── locales/          # ar.json - ALL TEXT HERE!
├── components/       # UI components (no hardcoded text)
├── screens/          # Screen components
├── hooks/            # useTranslation, useTheme, etc.
└── ...
```