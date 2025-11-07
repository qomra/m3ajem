# M3ajem Dictionary Data Processing

This directory contains the raw dictionary data and preprocessing scripts for the M3ajem app.

## Directory Structure

```
assets/data/
├── maajem.json              # Raw dictionary data (73 MB)
├── index.json               # Raw indexed words data (6.5 MB)
├── preprocess_data.py       # Preprocessing script
├── analyze_data.py          # Data analysis script
├── README.md                # This file
└── optimized/               # Generated optimized files (created by preprocess_data.py)
    ├── maajem-optimized.json.gz      # Optimized dictionary data (18.89 MB)
    ├── index-optimized.json.gz       # Optimized indexed words (1.04 MB)
    ├── search-index.json.gz          # Pre-built search indexes (6.00 MB)
    └── metadata.json.gz              # Statistics and metadata (530 B)
```

## Data Structure

### maajem.json

Array of dictionary objects:

```json
[
  {
    "name": "اسم المعجم",
    "description": "وصف المعجم وتاريخه ومؤلفه",
    "data": {
      "جذر1": "تعريف الجذر...",
      "جذر2": "تعريف الجذر..."
    }
  }
]
```

### index.json

Dictionary of indexed words by root:

```json
{
  "اسم المعجم": {
    "جذر1": ["كلمة1", "كلمة2", "كلمة3"],
    "جذر2": ["كلمة4", "كلمة5"]
  }
}
```

### search-index.json (Generated)

Pre-built search indexes for fast lookups:

```json
{
  "dictionary_metadata": [
    {
      "id": 0,
      "name": "اسم المعجم",
      "description": "وصف المعجم",
      "root_count": 1234
    }
  ],
  "root_to_dicts": {
    "جذر": [0, 1, 2]  // Dictionary IDs that have this root
  },
  "word_to_roots": {
    "كلمة": [
      {"dict_id": 0, "root": "جذر"}
    ]
  },
  "root_prefix_index": {
    "جذ": ["جذر1", "جذر2"]  // For autocomplete
  },
  "word_prefix_index": {
    "كل": ["كلمة1", "كلمة2"]  // For word autocomplete
  },
  "word_suffix_index": {
    "ون": ["يأكلون", "يلعبون"]  // For reverse search
  }
}
```

## Preprocessing Workflow

### When to Run Preprocessing

Run the preprocessing script **every time** you:
- Add a new dictionary to maajem.json
- Update existing dictionary data
- Add new indexed words to index.json
- Modify any dictionary descriptions

### How to Run

```bash
cd assets/data
python3 preprocess_data.py
```

This will:
1. ✅ Validate the JSON structure
2. ⚙️  Load and parse the data
3. 🔍 Build search indexes (prefix, suffix, inverted)
4. 💾 Save optimized files with compression
5. 📊 Generate statistics and metadata

**Processing time:** ~20 seconds
**Output:** 25.93 MB total (compressed)

### Output Files

All optimized files are saved to `./optimized/` directory:

| File | Size (Compressed) | Purpose |
|------|------------------|---------|
| `maajem-optimized.json.gz` | 18.89 MB | Dictionary definitions (minified) |
| `index-optimized.json.gz` | 1.04 MB | Indexed words by root |
| `search-index.json.gz` | 6.00 MB | Pre-built search indexes |
| `metadata.json.gz` | 530 B | Statistics and build info |

**Total bundle size: 25.93 MB**

## Using in React Native App

### 1. Copy optimized files to app

```bash
cp optimized/*.gz ../../../app/assets/data/
```

### 2. Load in app

```javascript
import * as FileSystem from 'expo-file-system';
import pako from 'pako'; // For gzip decompression

async function loadDictionaryData() {
  // Load compressed file
  const compressed = await FileSystem.readAsStringAsync(
    'maajem-optimized.json.gz',
    { encoding: FileSystem.EncodingType.Base64 }
  );

  // Decompress
  const decompressed = pako.ungzip(
    Uint8Array.from(atob(compressed), c => c.charCodeAt(0)),
    { to: 'string' }
  );

  // Parse JSON
  const data = JSON.parse(decompressed);
  return data;
}
```

### 3. Use search indexes

```javascript
// Load search index
const searchIndex = await loadSearchIndex();

// Find dictionaries that have a root
function findDictionariesByRoot(root) {
  const dictIds = searchIndex.root_to_dicts[root] || [];
  return dictIds.map(id => searchIndex.dictionary_metadata[id]);
}

// Find roots by word
function findRootsByWord(word) {
  return searchIndex.word_to_roots[word] || [];
}

// Autocomplete roots
function autocompleteRoots(prefix) {
  return searchIndex.root_prefix_index[prefix] || [];
}

// Reverse search (words ending with suffix)
function reverseSearch(suffix) {
  return searchIndex.word_suffix_index[suffix] || [];
}
```

## Data Analysis

To analyze the data structure and size:

```bash
python3 analyze_data.py
```

This generates:
- File size analysis
- Compression ratios
- Structure statistics
- SQLite size estimation
- Recommendations for storage and search

Output saved to: `analysis_results.json`

## Search Index Details

### Root Prefix Index
- Indexes 2-char and 3-char prefixes
- Total: 12,390 prefixes
- Use for: Root autocomplete in search

### Word Prefix Index
- Indexes 2-char and 3-char prefixes
- Total: 9,739 prefixes
- Use for: Word autocomplete

### Word Suffix Index
- Indexes 2-char, 3-char, and 4-char suffixes
- Total: 62,774 suffixes
- Use for: Reverse search (e.g., find words ending with "ون")

### Word-to-Roots Mapping
- Maps 242,344 unique words to their roots
- Each entry includes dictionary ID and root
- Use for: Quick word lookup in المفهرس tab

### Root-to-Dictionaries Mapping
- Maps 55,234 unique roots to dictionary IDs
- Use for: Global search across all dictionaries

## Optimization Details

### Compression
- **maajem.json**: 73.0 MB → 18.89 MB (73.8% reduction)
- **index.json**: 6.5 MB → 1.04 MB (77.8% reduction)
- **search-index.json**: 37.4 MB → 6.00 MB (84.0% reduction)

### Minification
- Removes all whitespace
- Uses shortest JSON separators (`,` `:`)
- No pretty-printing

### Performance
- Load time: ~300-500ms on modern devices
- Parse time: ~200-300ms
- Total startup: <1 second

## Adding New Dictionaries

### 1. Update maajem.json

Add a new dictionary object to the array:

```json
{
  "name": "اسم المعجم الجديد",
  "description": "وصف المعجم ومؤلفه وتاريخه",
  "data": {
    "جذر1": "التعريف...",
    "جذر2": "التعريف..."
  }
}
```

### 2. Update index.json (optional)

If you want to index words for this dictionary:

```json
{
  "اسم المعجم الجديد": {
    "جذر1": ["كلمة1", "كلمة2"],
    "جذر2": ["كلمة3", "كلمة4"]
  }
}
```

### 3. Run preprocessing

```bash
python3 preprocess_data.py
```

### 4. Deploy to app

Copy new optimized files to the app and rebuild.

## Validation

The preprocessing script validates:
- ✅ JSON structure is correct
- ✅ All dictionaries have `name` and `data` fields
- ⚠️  Warns if `description` is missing
- ✅ All roots have string definitions
- ✅ All indexed words are arrays

If validation fails, the script will report errors and exit.

## Statistics (Current Data)

- **Dictionaries**: 8
- **Total roots**: 69,674
- **Total definition characters**: 40,692,604
- **Indexed dictionaries**: 1 (لسان العرب)
- **Total indexed words**: 253,374
- **Unique words**: 242,344
- **Bundle size**: 25.93 MB (compressed)

## Future Enhancements

### Content-Level Search
To enable full-text search within definitions:

1. Build inverted index of definition words
2. Use tokenization for Arabic text
3. Add to search-index.json
4. Estimated additional size: ~8-10 MB compressed

### On-Demand Dictionary Loading
To reduce initial bundle size:

1. Split each dictionary into separate files
2. Load only selected dictionaries
3. Keep search index for all dictionaries
4. Initial size: ~15 MB (core + لسان العرب)

### Audio Integration
For the صوتي tab:

1. Store audio file URLs in metadata
2. Download on-demand
3. Cache locally
4. Estimated size per root: ~50-100 KB

## Troubleshooting

### "File not found" error
Make sure you're in the `assets/data/` directory:
```bash
cd assets/data
python3 preprocess_data.py
```

### "Invalid JSON structure" error
Check that:
- maajem.json is a valid JSON array
- Each dictionary has `name` and `data` fields
- index.json is a valid JSON object

### Out of memory error
The preprocessing script loads all data into memory. Ensure:
- Available RAM: ~2 GB
- Python has enough heap space

### Compression fails
Ensure the `gzip` module is available:
```bash
python3 -c "import gzip"
```

## Contact

For questions or issues, please refer to the main project documentation.
