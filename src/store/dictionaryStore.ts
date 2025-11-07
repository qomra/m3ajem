import { create } from 'zustand';
import { File } from 'expo-file-system';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pako from 'pako';

interface DictionaryMetadata {
  name: string;
  num_roots: number;
  total_chars: number;
}

interface SearchIndex {
  root_to_dicts: Record<string, string[]>;
  word_to_roots: Record<string, Array<{ dict_id: string; root: string }>>;
  root_prefix_index: Record<string, string[]>;
  word_prefix_index: Record<string, string[]>;
  word_suffix_index: Record<string, string[]>;
}

interface Dictionary {
  name: string;
  data: Record<string, string>; // root -> definition
}

// Index data: dict name -> root -> words[]
type IndexData = Record<string, Record<string, string[]>>;

// Processed index data for quick access
interface ProcessedIndexWord {
  word: string;
  root: string;
  dictionaryName: string;
}

interface ProcessedIndexRoot {
  root: string;
  dictionaryName: string;
  words: string[];
  wordCount: number;
}

interface DictionaryState {
  // Data
  dictionaries: Dictionary[];
  searchIndex: SearchIndex | null;
  metadata: Record<string, DictionaryMetadata> | null;
  indexData: IndexData | null;
  processedWords: ProcessedIndexWord[]; // Sorted alphabetically (for flatten view)
  processedWordsGrouped: ProcessedIndexWord[]; // Sorted by root first (for grouped view)
  processedRoots: ProcessedIndexRoot[];

  // Loading states
  isLoadingMetadata: boolean;
  isLoadingSearchIndex: boolean;
  isLoadingDictionaries: boolean;
  isLoadingIndex: boolean;

  // Error states
  metadataError: string | null;
  searchIndexError: string | null;
  dictionariesError: string | null;
  indexError: string | null;

  // Extraction states
  needsExtraction: boolean;
  isExtracting: boolean;
  extractionProgress: number;
  extractionStep: string;

  // Actions
  checkExtractionNeeded: () => Promise<void>;
  startExtraction: () => Promise<void>;
  loadMetadata: (onProgress?: (progress: number) => void) => Promise<void>;
  loadSearchIndex: (onProgress?: (progress: number) => void) => Promise<void>;
  loadDictionaries: (onProgress?: (progress: number) => void) => Promise<void>;
  loadIndex: (onProgress?: (progress: number) => void) => Promise<void>;
  searchRoot: (root: string) => Array<{ dictionary: string; definition: string }>;
  searchRootInDictionary: (dictionaryName: string, root: string) => string | null;
}

// Asset module numbers - these need to be determined from the bundled assets
const ASSET_MODULES = {
  metadata: require('../../assets/data/optimized/metadata.json.gz'),
  searchIndex: require('../../assets/data/optimized/search-index.json.gz'),
  maajem: require('../../assets/data/optimized/maajem-optimized.json.gz'),
  index: require('../../assets/data/optimized/index-optimized.json.gz'),
};

// Cache keys
const CACHE_KEYS = {
  metadata: '@m3ajem/metadata',
  searchIndex: '@m3ajem/searchIndex',
  dictionaries: '@m3ajem/dictionaries',
  index: '@m3ajem/index',
  version: '@m3ajem/version',
  extracted: '@m3ajem/extracted',
};

const CACHE_VERSION = '1.0.0'; // Increment this when data format changes

async function loadGzippedJSON<T>(
  assetModule: number,
  cacheKey: string,
  onProgress?: (progress: number) => void
): Promise<T> {
  try {
    // Check if cached version matches
    const cachedVersion = await AsyncStorage.getItem(CACHE_KEYS.version);

    if (cachedVersion === CACHE_VERSION) {
      // Try to load from cache
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        console.log('Loading from cache:', cacheKey);
        onProgress?.(100);
        return JSON.parse(cached) as T;
      }
    }

    console.log('Cache miss or version mismatch, loading from asset...');

    onProgress?.(10);

    // Load the asset
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Failed to download asset - no localUri');
    }

    console.log('Loading asset from:', asset.localUri);

    onProgress?.(30);

    // Read file using new File API
    const file = new File(asset.localUri);

    // Read as bytes (binary data)
    const bytes = await file.arrayBuffer();
    const uint8Array = new Uint8Array(bytes);

    console.log('Decompressing', uint8Array.length, 'bytes...');

    onProgress?.(50);

    // Decompress using pako
    const decompressed = pako.ungzip(uint8Array, { to: 'string' });

    console.log('Decompressed to', decompressed.length, 'characters');

    onProgress?.(80);

    // Cache the decompressed data
    console.log('Caching data for next launch...');
    await AsyncStorage.setItem(cacheKey, decompressed);
    await AsyncStorage.setItem(CACHE_KEYS.version, CACHE_VERSION);

    onProgress?.(100);

    // Parse JSON
    return JSON.parse(decompressed) as T;
  } catch (error) {
    console.error('Error loading gzipped JSON:', error);
    throw error;
  }
}

export const useDictionaryStore = create<DictionaryState>((set, get) => ({
  // Initial state
  dictionaries: [],
  searchIndex: null,
  metadata: null,
  indexData: null,
  processedWords: [],
  processedWordsGrouped: [],
  processedRoots: [],

  isLoadingMetadata: false,
  isLoadingSearchIndex: false,
  isLoadingDictionaries: false,
  isLoadingIndex: false,

  metadataError: null,
  searchIndexError: null,
  dictionariesError: null,
  indexError: null,

  needsExtraction: false,
  isExtracting: false,
  extractionProgress: 0,
  extractionStep: '',

  // Check if extraction is needed
  checkExtractionNeeded: async () => {
    try {
      const extracted = await AsyncStorage.getItem(CACHE_KEYS.extracted);
      const cachedVersion = await AsyncStorage.getItem(CACHE_KEYS.version);

      const needsExtraction = !extracted || cachedVersion !== CACHE_VERSION;
      set({ needsExtraction });
    } catch (error) {
      console.error('Error checking extraction:', error);
      set({ needsExtraction: true });
    }
  },

  // Start extraction process with progress tracking
  startExtraction: async () => {
    set({ isExtracting: true, extractionProgress: 0 });

    try {
      // Step 1: Load metadata (fast, contributes 5% to total progress)
      set({ extractionStep: 'جاري تحميل بيانات التعريف...' });
      await get().loadMetadata((progress) => {
        set({ extractionProgress: (progress * 0.05) });
      });

      // Step 2: Load search index (medium, contributes 30% to total progress)
      set({ extractionStep: 'جاري تحميل فهرس البحث...' });
      await get().loadSearchIndex((progress) => {
        set({ extractionProgress: 5 + (progress * 0.30) });
      });

      // Step 3: Load dictionaries (large, contributes 50% to total progress)
      set({ extractionStep: 'جاري تحميل المعاجم...' });
      await get().loadDictionaries((progress) => {
        set({ extractionProgress: 35 + (progress * 0.50) });
      });

      // Step 4: Load index (medium, contributes 15% to total progress)
      set({ extractionStep: 'جاري تحميل الفهرس...' });
      await get().loadIndex((progress) => {
        set({ extractionProgress: 85 + (progress * 0.15) });
      });

      // Mark extraction as complete
      await AsyncStorage.setItem(CACHE_KEYS.extracted, 'true');
      set({
        isExtracting: false,
        extractionProgress: 100,
        needsExtraction: false,
        extractionStep: '',
      });

      console.log('Extraction completed successfully');
    } catch (error) {
      console.error('Error during extraction:', error);
      set({
        isExtracting: false,
        extractionProgress: 0,
        extractionStep: '',
      });
      throw error;
    }
  },

  // Load metadata (fast, ~500B compressed)
  loadMetadata: async (onProgress?: (progress: number) => void) => {
    console.log('Starting metadata load...');
    set({ isLoadingMetadata: true, metadataError: null });
    try {
      const data = await loadGzippedJSON<{
        maajem_stats: {
          dictionaries: Record<string, DictionaryMetadata>;
        };
      }>(ASSET_MODULES.metadata, CACHE_KEYS.metadata, onProgress);

      console.log('Metadata loaded successfully:', Object.keys(data.maajem_stats.dictionaries).length, 'dictionaries');
      set({
        metadata: data.maajem_stats.dictionaries,
        isLoadingMetadata: false,
      });
    } catch (error) {
      console.error('Error loading metadata:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({
        metadataError: errorMessage,
        isLoadingMetadata: false,
      });
    }
  },

  // Load search index (medium, ~6MB compressed)
  loadSearchIndex: async (onProgress?: (progress: number) => void) => {
    console.log('Starting search index load...');
    set({ isLoadingSearchIndex: true, searchIndexError: null });
    try {
      const data = await loadGzippedJSON<SearchIndex>(ASSET_MODULES.searchIndex, CACHE_KEYS.searchIndex, onProgress);

      console.log('Search index loaded successfully');
      set({
        searchIndex: data,
        isLoadingSearchIndex: false,
      });
    } catch (error) {
      console.error('Error loading search index:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({
        searchIndexError: errorMessage,
        isLoadingSearchIndex: false,
      });
    }
  },

  // Load dictionaries (large, ~19MB compressed)
  loadDictionaries: async (onProgress?: (progress: number) => void) => {
    console.log('Starting dictionaries load...');
    set({ isLoadingDictionaries: true, dictionariesError: null });
    try {
      const data = await loadGzippedJSON<Dictionary[]>(ASSET_MODULES.maajem, CACHE_KEYS.dictionaries, onProgress);

      console.log('Dictionaries loaded successfully:', data.length, 'dictionaries');
      set({
        dictionaries: data,
        isLoadingDictionaries: false,
      });
    } catch (error) {
      console.error('Error loading dictionaries:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({
        dictionariesError: errorMessage,
        isLoadingDictionaries: false,
      });
    }
  },

  // Load index data (medium, ~1MB compressed)
  loadIndex: async (onProgress?: (progress: number) => void) => {
    console.log('Starting index load...');
    set({ isLoadingIndex: true, indexError: null });
    try {
      const data = await loadGzippedJSON<IndexData>(ASSET_MODULES.index, CACHE_KEYS.index, onProgress);

      console.log('Processing index data...');

      // Process data into flat arrays for quick access
      const words: ProcessedIndexWord[] = [];
      const roots: ProcessedIndexRoot[] = [];

      Object.entries(data).forEach(([dictName, rootsData]) => {
        Object.entries(rootsData).forEach(([root, wordList]) => {
          // Add to roots array
          roots.push({
            root,
            dictionaryName: dictName,
            words: wordList,
            wordCount: wordList.length,
          });

          // Add each word to words array
          wordList.forEach(word => {
            words.push({ word, root, dictionaryName: dictName });
          });
        });
      });

      // Sort arrays
      // Flatten view: sort by word alphabetically
      words.sort((a, b) => a.word.localeCompare(b.word, 'ar'));

      // Grouped view: sort by root first, then by word within each root
      const wordsGrouped = [...words].sort((a, b) => {
        const rootCompare = a.root.localeCompare(b.root, 'ar');
        if (rootCompare !== 0) return rootCompare;
        return a.word.localeCompare(b.word, 'ar');
      });

      roots.sort((a, b) => a.root.localeCompare(b.root, 'ar'));

      console.log('Index processed successfully:', words.length, 'words,', roots.length, 'roots');
      set({
        indexData: data,
        processedWords: words,
        processedWordsGrouped: wordsGrouped,
        processedRoots: roots,
        isLoadingIndex: false,
      });
    } catch (error) {
      console.error('Error loading index:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({
        indexError: errorMessage,
        isLoadingIndex: false,
      });
    }
  },

  // Search for a root across all dictionaries
  searchRoot: (root: string) => {
    const { dictionaries } = get();
    const results: Array<{ dictionary: string; definition: string }> = [];

    for (const dict of dictionaries) {
      const definition = dict.data[root];
      if (definition) {
        results.push({
          dictionary: dict.name,
          definition,
        });
      }
    }

    return results;
  },

  // Search for a root in a specific dictionary
  searchRootInDictionary: (dictionaryName: string, root: string) => {
    const { dictionaries } = get();
    const dictionary = dictionaries.find(d => d.name === dictionaryName);

    if (!dictionary) {
      return null;
    }

    return dictionary.data[root] || null;
  },
}));
