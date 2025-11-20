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

// Index data: dict name -> root -> word data with positions
interface WordPositionData {
  word: string;
  position: number; // Character position of first occurrence in definition
}

type IndexData = Record<string, Record<string, WordPositionData[]>>;

// Processed index data for quick access
interface ProcessedIndexWord {
  word: string;
  root: string;
  dictionaryName: string;
  firstOccurrencePos: number;
}

interface ProcessedIndexRoot {
  root: string;
  dictionaryName: string;
  words: string[];
  wordCount: number;
  firstOccurrencePos: number; // Position of earliest word in this root
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

const CACHE_VERSION = '2.0.0-uncompressed'; // Increment this when data format changes

async function loadGzippedJSON<T>(
  assetModule: number,
  onProgress?: (progress: number) => void
): Promise<T> {
  try {
    onProgress?.(10);

    // Load the asset
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Failed to download asset - no localUri');
    }

    onProgress?.(30);

    // Read file using new File API
    const file = new File(asset.localUri);

    // Read as bytes (binary data)
    const bytes = await file.arrayBuffer();
    const uint8Array = new Uint8Array(bytes);

    onProgress?.(50);

    // Decompress using pako
    const decompressed = pako.ungzip(uint8Array, { to: 'string' });

    onProgress?.(80);

    // Parse JSON (no caching - this is the key optimization)
    const data = JSON.parse(decompressed) as T;

    onProgress?.(100);

    return data;
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

  // Check if extraction is needed (only on first launch)
  checkExtractionNeeded: async () => {
    try {
      const extracted = await AsyncStorage.getItem(CACHE_KEYS.extracted);
      const cachedVersion = await AsyncStorage.getItem(CACHE_KEYS.version);

      // Force clear cache if version doesn't match
      if (cachedVersion !== CACHE_VERSION) {
        console.log('Version mismatch, clearing cache...');
        await AsyncStorage.multiRemove([
          CACHE_KEYS.metadata,
          CACHE_KEYS.searchIndex,
          CACHE_KEYS.dictionaries,
          CACHE_KEYS.index,
          CACHE_KEYS.extracted,
          CACHE_KEYS.version,
        ]);
      }

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

  // Load metadata
  loadMetadata: async (onProgress?: (progress: number) => void) => {
    set({ isLoadingMetadata: true, metadataError: null });
    try {
      const data = await loadGzippedJSON<{
        maajem_stats: {
          dictionaries: Record<string, DictionaryMetadata>;
        };
      }>(ASSET_MODULES.metadata, onProgress);

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

  // Load search index
  loadSearchIndex: async (onProgress?: (progress: number) => void) => {
    set({ isLoadingSearchIndex: true, searchIndexError: null });
    try {
      const data = await loadGzippedJSON<SearchIndex>(ASSET_MODULES.searchIndex, onProgress);

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

  // Load dictionaries
  loadDictionaries: async (onProgress?: (progress: number) => void) => {
    set({ isLoadingDictionaries: true, dictionariesError: null });
    try {
      const data = await loadGzippedJSON<Dictionary[]>(ASSET_MODULES.maajem, onProgress);

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

  // Load index data
  loadIndex: async (onProgress?: (progress: number) => void) => {
    set({ isLoadingIndex: true, indexError: null });
    try {
      const data = await loadGzippedJSON<IndexData>(ASSET_MODULES.index, onProgress);

      // Process data into flat arrays for quick access
      const words: ProcessedIndexWord[] = [];
      const roots: ProcessedIndexRoot[] = [];

      Object.entries(data).forEach(([dictName, rootsData]) => {
        Object.entries(rootsData).forEach(([root, wordDataList]) => {
          // Extract just the word strings for the root
          const wordStrings = wordDataList.map(wd => wd.word);

          // Find the earliest position among all words in this root
          const positions = wordDataList.map(wd => wd.position);
          const firstRootPosition = Math.min(...positions);

          // Add to roots array
          roots.push({
            root,
            dictionaryName: dictName,
            words: wordStrings,
            wordCount: wordStrings.length,
            firstOccurrencePos: firstRootPosition,
          });

          // Add each word to words array with its position
          wordDataList.forEach(({ word, position }) => {
            words.push({
              word,
              root,
              dictionaryName: dictName,
              firstOccurrencePos: position,
            });
          });
        });
      });

      // Sort roots by first occurrence position
      roots.sort((a, b) => {
        const posCompare = a.firstOccurrencePos - b.firstOccurrencePos;
        if (posCompare !== 0) return posCompare;
        return a.root.localeCompare(b.root, 'ar');
      });

      // Create root position lookup for efficient sorting
      const rootPositionMap = new Map<string, number>();
      roots.forEach((r, index) => {
        rootPositionMap.set(`${r.dictionaryName}:${r.root}`, index);
      });

      // Sort words: first by root position, then by word position within that root
      words.sort((a, b) => {
        // First, group by root (using the root's sorted position)
        const aRootPos = rootPositionMap.get(`${a.dictionaryName}:${a.root}`) ?? 0;
        const bRootPos = rootPositionMap.get(`${b.dictionaryName}:${b.root}`) ?? 0;

        if (aRootPos !== bRootPos) {
          return aRootPos - bRootPos;
        }

        // Within same root, sort by word position
        const wordPosCompare = a.firstOccurrencePos - b.firstOccurrencePos;
        if (wordPosCompare !== 0) return wordPosCompare;

        // Fall back to alphabetical
        return a.word.localeCompare(b.word, 'ar');
      });

      // Use same sorted list for navigation
      const wordsGrouped = words;

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
