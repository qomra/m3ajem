# Semantic Search System

## Overview

The semantic search system enables AI-powered search for Arabic word roots based on meaning descriptions. This is perfect for answering questions like "What word means movement and travel?" (ماهي الكلمة التي تعني الحركة والانتقال؟).

## Architecture

### Components

1. **Vector Database** (sqlite-vec)
   - Extension: `sqlite-vec` v0.1.6+
   - Table: `spectrum_vectors`
   - Dimensions: 1536 (text-embedding-3-small)

2. **Spectrum Data**
   - Source: `assets/data/optimized/spectrum.json`
   - Content: Semantic analysis (طيف دلالي) for each Arabic root
   - ~4,600 roots with rich semantic descriptions

3. **Services**
   - `SemanticSearchService`: Vector search and chunking
   - `EmbeddingService`: Generate embeddings via OpenAI/Google APIs
   - `DictionaryLookupService`: Retrieve root content from dictionary

4. **AI Agent Tool**
   - Tool: `search_word_by_meaning`
   - ReAct-style iterative refinement
   - Max 5 iterations to prevent infinite loops

## How It Works

### Flow

```
User: "ماهي الكلمة التي تعني الحركة والانتقال؟"
         ↓
1. Generate embedding for query
         ↓
2. Search spectrum vectors (cosine similarity)
         ↓
3. Return top 3 matching roots
         ↓
4. LLM requests content for root #1
         ↓
5. If content > 800 chars → chunk it
         ↓
6. LLM evaluates chunk: "Found answer?" or "Next chunk/root?"
         ↓
7. Continue until answer found or max iterations reached
```

### ReAct Pattern

The tool supports a **Reasoning + Acting** (ReAct) pattern:

- **Iteration 1**: Search by meaning → Get 3 candidate roots
- **Iteration 2**: Get content for root #1 → LLM evaluates
- **Iteration 3**: If not found → Get chunk 2 or try root #2
- **Iteration 4-5**: Continue refinement
- **Stop conditions**:
  - LLM finds answer
  - All roots exhausted
  - Max iterations (5) reached

## Setup Instructions

### 1. Configure sqlite-vec Extension

Already done in `app.config.js`:

```javascript
plugins: [
  ["expo-sqlite", { "withSQLiteVecExtension": true }],
  // ... other plugins
]
```

### 2. Generate Embeddings

```bash
cd scripts

# Generate embeddings (requires OpenAI API key)
python3 generate-spectrum-embeddings.py YOUR_OPENAI_API_KEY

# Output: assets/data/optimized/spectrum-embeddings.json
```

This will:
- Load all ~4,600 roots from spectrum.json
- Generate embeddings using `text-embedding-3-small`
- Process in batches of 100 with rate limiting
- Save to JSON file (~50MB)

### 3. Load Embeddings into Database

```bash
# Load embeddings into SQLite
python3 load-spectrum-embeddings.py

# This will:
# - Connect to assets/data/optimized/dictionary.db
# - Create spectrum_vectors table (if migration ran)
# - Insert all embeddings as binary blobs
```

### 4. Run Database Migration

The migration `002_create_spectrum_vectors.ts` creates the virtual table:

```sql
CREATE VIRTUAL TABLE spectrum_vectors USING vec0(
  root TEXT PRIMARY KEY,
  embedding float[1536]
);
```

This runs automatically on app startup via `MigrationRunner`.

### 5. Rebuild iOS/Android

Since we added a native extension, you need to rebuild:

```bash
# iOS
npm run build:ios

# OR for development pods
cd ios && pod install && cd ..
npx expo run:ios
```

## Usage Examples

### Example 1: Basic Meaning Search

**User**: ماهي الكلمة التي تعني الحركة والسفر؟

**LLM Tool Calls**:
1. `search_word_by_meaning({ meaning_query: "الحركة والسفر" })`
   - Returns: ["ذهب", "سير", "رحل"] with similarity scores
2. `search_word_by_meaning({ meaning_query: "...", root: "ذهب" })`
   - Returns: Full content or first chunk
3. LLM evaluates and responds with answer

### Example 2: Large Root with Chunking

**User**: أبحث عن كلمة تدل على الشدة والقوة

**LLM Tool Calls**:
1. Search → Returns ["شدد", "قوى", "صلب"]
2. Get content for "شدد" → 1500 chars → Chunk 1/2 returned
3. LLM: "Need more context"
4. Get chunk 2 → LLM finds answer

### Example 3: No Results Found

**User**: ماهي الكلمة التي تعني الطيران بالطائرة النفاثة؟

**LLM Tool Calls**:
1. Search → Returns 3 roots with low similarity scores
2. Check root #1 → No match
3. Check root #2 → No match
4. Check root #3 → No match
5. LLM: "لم أجد كلمة مناسبة في المعاجم الكلاسيكية"

## Technical Details

### Chunking Strategy

- **Threshold**: 800 characters
- **Chunk size**: 800 characters
- **Overlap**: None (sequential chunks)
- **Why**: Balance between context and API token limits

### Embedding Model

- **Model**: `text-embedding-3-small` (OpenAI)
- **Dimensions**: 1536
- **Alternative**: `text-embedding-004` (Google)
- **Note**: Anthropic and Groq don't have embedding APIs

### Vector Search

- **Algorithm**: Cosine similarity via sqlite-vec
- **Top-N**: 3 results
- **Normalization**: Embeddings normalized to 1536 dimensions

### Performance

- **Search latency**: ~50-100ms (native SQLite)
- **Embedding generation**: ~200ms per query (API call)
- **Total query time**: ~300-500ms

## Troubleshooting

### Error: "sqlite-vec extension not found"

The extension will be loaded at runtime. Make sure:
- `app.config.js` has the plugin configured
- You rebuilt the app after adding the plugin
- Check console logs for "✓ sqlite-vec extension loaded"

### Error: "spectrum_vectors table does not exist"

Run the migration:
- Delete the app and reinstall (migrations run on first launch)
- OR manually run the migration SQL in database

### Error: "no embeddings found"

Make sure you ran both scripts:
1. `generate-spectrum-embeddings.py`
2. `load-spectrum-embeddings.py`

Check that `spectrum-embeddings.json` exists (~50MB).

### Error: "Anthropic doesn't support embeddings"

Use OpenAI or Google provider for semantic search. The tool will show an error message if you try with Anthropic/Groq.

## Limitations

1. **Offline Mode**: Requires API call for embedding generation (can't work fully offline)
2. **Model Dependency**: Uses same provider as chat (OpenAI/Google only)
3. **Classical Arabic Only**: spectrum.json contains classical roots, not modern terms
4. **Context Window**: LLM must manage 5 tool calls wisely
5. **Chunking**: Large roots split into chunks may lose context

## Future Improvements

1. **Pre-computed Queries**: Cache embeddings for common questions
2. **Hybrid Search**: Combine semantic + keyword search
3. **Cross-root Search**: Search across multiple dictionaries simultaneously
4. **Relevance Ranking**: Use spectrum similarity + dictionary frequency
5. **Offline Embeddings**: Bundle pre-computed embeddings in app

## Files Reference

### Core Files
- `src/services/semantic/SemanticSearchService.ts` - Vector search logic
- `src/services/semantic/EmbeddingService.ts` - Embedding generation
- `src/agents/tools/SemanticToolExecutor.ts` - Tool execution
- `src/agents/tools/semanticTools.ts` - Tool definition

### Configuration
- `app.config.js` - sqlite-vec plugin
- `src/services/database/migrations/002_create_spectrum_vectors.ts` - Migration

### Data
- `assets/data/optimized/spectrum.json` - Semantic descriptions (source)
- `assets/data/optimized/spectrum-embeddings.json` - Generated embeddings (~50MB)
- `assets/data/optimized/dictionary.db` - SQLite with vectors

### Scripts
- `scripts/generate-spectrum-embeddings.py` - Generate embeddings
- `scripts/load-spectrum-embeddings.py` - Load into database
