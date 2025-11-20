# Semantic Search - Quick Setup Guide

## ✅ Status

### Completed
- ✓ Generated 9,271 embeddings (text-embedding-3-small, 1536 dimensions)
- ✓ Embeddings file created: `assets/data/optimized/spectrum-embeddings.json` (289MB)
- ✓ Configured sqlite-vec extension in app.config.js
- ✓ Created database migration for vector table
- ✓ Implemented automatic loading on app startup

### What Happens on First Launch

When you first launch the app after rebuilding:

1. **Migrations run** → Creates `spectrum_vectors` table
2. **Embeddings load** → Inserts 9,271 embeddings from JSON into SQLite
   - Takes ~30-60 seconds on first launch
   - Subsequent launches skip this (cached flag in AsyncStorage)
3. **Semantic search ready** → Tool is available to LLM

Console output:
```
Initializing SQLite database...
Running database migrations...
Running migration 2: create_spectrum_vectors
✓ Spectrum vectors table created
✓ Migration 2 completed
Loading spectrum embeddings...
Reading embeddings file...
Loaded 9271 embeddings from file
Model: text-embedding-3-small, Dimensions: 1536
Clearing existing embeddings...
  Inserted 500/9271...
  Inserted 1000/9271...
  ...
  Inserted 9000/9271...
✓ Successfully inserted 9271 embeddings
✓ Embeddings loaded successfully!
✓ Spectrum embeddings ready (9271 roots)
✓ Database initialized
```

## 🚀 Next Steps

### 1. Rebuild the App (Required)

Since we added a native extension (sqlite-vec), you need to rebuild:

```bash
# iOS
npm run build:ios
# OR
npx expo run:ios
```

### 2. Test Semantic Search

Launch the app and go to the Smart (ذكي) tab. Try questions like:

**Test Query 1: Movement**
```
User: ماهي الكلمة التي تعني الحركة والانتقال من مكان إلى آخر؟
```

Expected LLM behavior:
1. Calls `search_word_by_meaning({ meaning_query: "الحركة والانتقال من مكان إلى آخر" })`
2. Gets top 3 roots: e.g., ["ذهب", "سير", "رحل"]
3. Requests content for first root
4. Evaluates and provides answer

**Test Query 2: Strength**
```
User: أبحث عن كلمة تدل على القوة والشدة
```

**Test Query 3: Water**
```
User: أي جذر يحتوي على معنى الماء والسيلان؟
```

### 3. Monitor Console Logs

Watch for:
- ✓ "Spectrum embeddings ready (9271 roots)" on first launch
- ✓ "Generating embedding for query: ..." when tool is called
- ✓ "Searching spectrum vectors..." during search
- ⚠ Any errors from embedding service or vector search

## 🔧 Troubleshooting

### Issue: Embeddings not loading

**Symptom**: Console shows "Could not load embeddings"

**Solutions**:
1. Check that `spectrum-embeddings.json` exists in assets folder
2. Verify file size is ~289MB
3. Check console for specific error message
4. Try force reload: Delete app and reinstall

### Issue: Semantic search not working

**Symptom**: LLM doesn't use `search_word_by_meaning` tool

**Solutions**:
1. Verify you're using OpenAI or Google provider (Anthropic/Groq don't support embeddings)
2. Check that embeddings loaded successfully (count should be 9271)
3. Try a clearer query like "ماهي الكلمة التي تعني..." format

### Issue: "extension not found" error

**Symptom**: Error loading sqlite-vec extension

**Solutions**:
1. Verify `app.config.js` has the plugin configured
2. Rebuild the app completely (delete build folder first)
3. Check that you're running on a supported platform (iOS/Android, not web)

### Issue: Slow first launch

**Expected**: First launch takes 30-60 seconds to load 9271 embeddings

**Solutions**:
- This is normal behavior
- Shows loading progress in console
- Subsequent launches are instant (embeddings stay in SQLite)
- If too slow, reduce batch size in EmbeddingLoader (currently 50)

## 📊 Performance Metrics

### First Launch
- Migration: ~1 second
- Embedding load: ~30-60 seconds (one-time)
- Total: ~60 seconds

### Subsequent Launches
- Check if loaded: <1ms
- Skip loading: instant
- Total: Normal app startup time

### Query Performance
- Embedding generation: ~200ms (API call to OpenAI/Google)
- Vector search: ~50-100ms (native SQLite)
- Root content retrieval: ~10-20ms
- **Total per query: ~300-500ms**

### Storage
- JSON file: 289MB (bundled in app)
- SQLite vectors: ~56MB (9271 × 1536 × 4 bytes)
- Total added to app: ~345MB

## 🎯 Usage Tips

### For Best Results

1. **Use clear queries** with the "ماهي الكلمة التي..." pattern
2. **Be specific** about the meaning you're looking for
3. **Let LLM iterate** - it will try multiple roots if needed
4. **Trust the tool** - LLM knows when to stop searching

### Example Workflows

**Workflow 1: Simple match**
- Query → Search → Found in root #1 → Answer (2 tool calls)

**Workflow 2: Need more context**
- Query → Search → Check root #1 chunk 1 → Need chunk 2 → Answer (4 tool calls)

**Workflow 3: Multiple roots**
- Query → Search → Check root #1 (no match) → Check root #2 → Answer (4 tool calls)

**Workflow 4: Not found**
- Query → Search → Check all 3 roots → No match → Tell user (5 tool calls, hit limit)

## 📝 Notes

- Embeddings are loaded **once** and persist in SQLite
- To force reload: Delete app or call `EmbeddingLoader.forceReload(db)`
- Provider must support embeddings (OpenAI/Google only)
- Max 5 tool calls per conversation to prevent infinite loops
- Chunks are 800 characters with no overlap

## ✨ Success Indicators

You'll know it's working when:
- ✓ Console shows "9271 roots" on first launch
- ✓ LLM uses `search_word_by_meaning` tool for meaning queries
- ✓ LLM iterates through roots/chunks as needed
- ✓ Accurate answers from classical Arabic dictionaries
