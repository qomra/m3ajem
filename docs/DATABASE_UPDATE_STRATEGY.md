# Database Update Strategy

## Current Architecture Problem

**Current**: Single database `dictionary.db` contains:
- Dictionary data (dictionaries, roots, words) 
- User data (conversations, messages, contexts, message_contexts)
- Chat data (spectrum_vectors for semantic search)

**Problem**: App updates that ship new dictionary.db will overwrite user's chat history!

## Solution: Two-Database Architecture

### Database 1: `dictionary.db` (Read-Only, Shipped with App)
**Location**: `assets/data/optimized/dictionary.db`
**Updated**: Every app release
**Contains**:
- `dictionaries` table
- `roots` table  
- `words` table
- `spectrum_vectors` table (optional semantic search)

**Update Strategy**:
- Bundled with app binary
- Replaced completely on app updates
- Users get new/updated dictionaries automatically
- No user data risk

### Database 2: `user.db` (User Data, Never Replaced)
**Location**: App's persistent storage (SQLite directory)
**Updated**: Only through migrations
**Contains**:
- `conversations` table
- `messages` table
- `contexts` table
- `message_contexts` table
- User settings/preferences

**Update Strategy**:
- Created on first app launch
- Persists across app updates
- Migrated when schema changes
- Backed up with device backups

## Implementation Plan

### Phase 1: Split Migration Files
1. Create `migrations/dictionary/` - for dictionary.db migrations
2. Create `migrations/user/` - for user.db migrations  
3. Move chat tables to user migrations

### Phase 2: Update Database Service
1. Open TWO database connections:
   - `dictionaryDb` (read-only)
   - `userDb` (read-write)
2. Update `DictionaryLookupService` to use `dictionaryDb`
3. Update `ChatRepository` to use `userDb`

### Phase 3: Build Process
1. `build_database.py` only creates `dictionary.db`
2. Ship `dictionary.db` in assets
3. `user.db` created by app on first launch

### Phase 4: Future Updates
**Adding New Dictionary**:
1. Add to `maajim.json`
2. Run `build_database.py`
3. Ship new `dictionary.db` with app update
4. Users automatically get new dictionary

**Updating Existing Dictionary**:
1. Update in `new_resources.json` or `maajim.json`
2. Run `build_database.py`
3. Ship updated `dictionary.db`
4. No user data affected

**Chat Schema Changes**:
1. Add migration to `migrations/user/`
2. Migration runs on app launch
3. User data preserved

## Migration Path (For Existing Users)

For users with existing `dictionary.db` containing chat data:

```typescript
async function migrateToTwoDatabases() {
  // 1. Check if migration needed
  const needsMigration = await checkIfChatTablesInDictionaryDb();
  
  if (!needsMigration) return;
  
  // 2. Create new user.db
  const userDb = await createUserDatabase();
  
  // 3. Export chat data from dictionary.db
  const chatData = await exportChatData(dictionaryDb);
  
  // 4. Import into user.db
  await importChatData(userDb, chatData);
  
  // 5. Drop chat tables from dictionary.db (optional cleanup)
  // Keep for safety on first release
  
  // 6. Mark migration complete
  await AsyncStorage.setItem('@migration/two_databases', 'true');
}
```

## Benefits

✅ **Safe Updates**: Dictionary updates never touch user data
✅ **Smaller Updates**: Only dictionary.db changes, user.db stays same
✅ **Backup Friendly**: User can backup just user.db for chat history
✅ **Flexible**: Can update dictionaries independently of chat features
✅ **Performance**: Separate indexes, no contention
✅ **Clear Separation**: Dictionary = content, User = data

## File Structure

```
assets/data/optimized/
├── dictionary.db          # Shipped with app (147 MB)
├── maajim.json           # Source data
├── dataset.json          # Index data
├── new_resources.json    # New roots to merge
└── build_database.py     # Builds dictionary.db only

App Storage:
└── SQLite/
    └── user.db           # Created on first launch
```

## Version Management

**dictionary.db version**:
- Stored in app's `package.json` version
- Users get latest when they update app

**user.db version**:
- Tracked in migrations table
- Incremented when schema changes
- Migrated automatically on app launch
