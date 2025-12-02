import { create } from 'zustand';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TwoDatabaseMigrationRunner } from '@services/database/TwoDatabaseMigrationRunner';

// Interfaces matching our SQLite schema
interface Dictionary {
  id: number;
  name: string;
  indexing_pattern: string;
}

interface Root {
  id: number;
  dictionary_id: number;
  root: string;
  definition: string;
  first_word_position: number;
}

interface Word {
  id: number;
  root_id: number;
  word: string;
  first_position: number;
  all_positions: string; // JSON array of positions
}

// Processed data for UI
interface ProcessedIndexWord {
  word: string;
  root: string;
  dictionaryName: string;
  rootId: number;
  allPositions: number[]; // Character positions where word appears in definition
}

interface ProcessedIndexRoot {
  root: string;
  dictionaryName: string;
  words: string[];
  wordCount: number;
}

interface DictionaryInfo {
  name: string;
  type?: string;
}

interface DictionaryMetadata {
  [dictionaryName: string]: {
    num_roots: number;
  };
}

interface DictionaryState {
  // Database
  db: SQLite.SQLiteDatabase | null;
  isInitialized: boolean;

  // Loading states
  isLoadingDictionaries: boolean;
  isLoadingMetadata: boolean;
  isLoadingMoraqmanDictionaries: boolean;
  isLoadingMoraqmanMetadata: boolean;
  isLoadingRoots: boolean;
  isLoadingWords: boolean;

  // Cached data (loaded on demand)
  dictionaries: DictionaryInfo[];
  metadata: DictionaryMetadata | null;
  moraqmanDictionaries: DictionaryInfo[];
  moraqmanMetadata: DictionaryMetadata | null;
  processedRoots: ProcessedIndexRoot[];
  processedWords: ProcessedIndexWord[];

  // Sorting state for indexed tab
  sortBy: 'alphabetical' | 'longest' | 'shortest' | 'random';
  randomSeed: number;

  // Actions
  initializeDatabase: () => Promise<void>;
  loadDictionaries: () => Promise<void>;
  loadMetadata: () => Promise<void>;
  loadMoraqmanDictionaries: () => Promise<void>;
  loadMoraqmanMetadata: () => Promise<void>;
  loadAllRoots: () => Promise<void>;
  loadAllWords: () => Promise<void>;
  getRootsForDictionary: (dictionaryName: string) => Promise<string[]>;
  searchRoot: (root: string) => Promise<{ dictionary: string; definition: string }[]>;
  searchRootInDictionary: (dictionaryName: string, root: string) => Promise<string | null>;
  getWordsForRoot: (rootId: number) => Promise<string[]>;
  setSortBy: (sortBy: 'alphabetical' | 'longest' | 'shortest' | 'random') => void;
}

const DB_NAME = 'dictionary.db';

export const useDictionaryStore = create<DictionaryState>((set, get) => ({
  // Initial state
  db: null,
  isInitialized: false,
  isLoadingDictionaries: false,
  isLoadingMetadata: false,
  isLoadingMoraqmanDictionaries: false,
  isLoadingMoraqmanMetadata: false,
  isLoadingRoots: false,
  isLoadingWords: false,
  dictionaries: [],
  metadata: null,
  moraqmanDictionaries: [],
  moraqmanMetadata: null,
  processedRoots: [],
  processedWords: [],
  sortBy: 'alphabetical',
  randomSeed: 0,

  // Initialize database
  initializeDatabase: async () => {
    console.log('Initializing SQLite database...');

    try {
      // Check if we've already initialized the database
      const dbVersion = await AsyncStorage.getItem('@m3ajem/db_version');
      const CURRENT_DB_VERSION = '7'; // Increment this when database structure changes

      if (dbVersion !== CURRENT_DB_VERSION) {
        console.log('First launch - copying database...');

        // Load database asset
        const asset = Asset.fromModule(require('../../assets/data/database/dictionary.db'));
        await asset.downloadAsync();

        if (!asset.localUri) {
          throw new Error('Failed to load database asset');
        }

        // Create SQLite directory if needed
        const dirPath = `${FileSystem.documentDirectory}SQLite`;
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
        }

        // Copy database to app directory
        console.log('Copying database file...');
        const dbPath = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;

        // Delete old database if exists
        const dbInfo = await FileSystem.getInfoAsync(dbPath);
        if (dbInfo.exists) {
          await FileSystem.deleteAsync(dbPath);
        }

        await FileSystem.copyAsync({
          from: asset.localUri,
          to: dbPath,
        });

        // Mark current version
        await AsyncStorage.setItem('@m3ajem/db_version', CURRENT_DB_VERSION);
        console.log('✓ Database copied');
      } else {
        console.log('Database already initialized (version ' + CURRENT_DB_VERSION + ')');
      }

      // Open database
      console.log('Opening database...');
      const database = await SQLite.openDatabaseAsync(DB_NAME);

      // Run dictionary migrations (spectrum_vectors for semantic search)
      console.log('Running dictionary database migrations...');
      await TwoDatabaseMigrationRunner.runDictionaryMigrations(database);

      // Note: Semantic embeddings are now optional resources
      // Users can download them from the Resources section
      // They will be loaded automatically when downloaded

      set({ db: database, isInitialized: true });
      console.log('✓ Database initialized');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  },

  // Load dictionaries list (lo3awi only)
  loadDictionaries: async () => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    set({ isLoadingDictionaries: true });

    try {
      console.log('Loading lo3awi dictionaries from database...');

      const rows = await db.getAllAsync<{ name: string }>(`
        SELECT name
        FROM dictionaries
        WHERE type = 'lo3awi'
        ORDER BY id ASC
      `);

      const dictionaries: DictionaryInfo[] = rows.map(row => ({ name: row.name }));

      set({ dictionaries, isLoadingDictionaries: false });
      console.log(`✓ Loaded ${dictionaries.length} lo3awi dictionaries`);
    } catch (error) {
      console.error('Error loading dictionaries:', error);
      set({ isLoadingDictionaries: false });
    }
  },

  // Load metadata (roots count per dictionary)
  loadMetadata: async () => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    set({ isLoadingMetadata: true });

    try {
      console.log('Loading metadata from database...');

      const rows = await db.getAllAsync<{ dictionary_name: string; num_roots: number }>(`
        SELECT d.name as dictionary_name, COUNT(r.id) as num_roots
        FROM dictionaries d
        LEFT JOIN roots r ON d.id = r.dictionary_id
        WHERE d.type = 'lo3awi'
        GROUP BY d.id, d.name
        ORDER BY d.id ASC
      `);

      const metadata: DictionaryMetadata = {};
      rows.forEach(row => {
        metadata[row.dictionary_name] = {
          num_roots: row.num_roots,
        };
      });

      set({ metadata, isLoadingMetadata: false });
      console.log('✓ Metadata loaded');
    } catch (error) {
      console.error('Error loading metadata:', error);
      set({ isLoadingMetadata: false });
    }
  },

  // Load moraqman dictionaries list
  loadMoraqmanDictionaries: async () => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    set({ isLoadingMoraqmanDictionaries: true });

    try {
      console.log('Loading moraqman dictionaries from database...');

      const rows = await db.getAllAsync<{ name: string; type: string }>(`
        SELECT name, type
        FROM dictionaries
        WHERE type = 'moraqman'
        ORDER BY id ASC
      `);

      const moraqmanDictionaries: DictionaryInfo[] = rows.map(row => ({ name: row.name, type: row.type }));

      set({ moraqmanDictionaries, isLoadingMoraqmanDictionaries: false });
      console.log(`✓ Loaded ${moraqmanDictionaries.length} moraqman dictionaries`);
    } catch (error) {
      console.error('Error loading moraqman dictionaries:', error);
      set({ isLoadingMoraqmanDictionaries: false });
    }
  },

  // Load moraqman metadata (roots count per dictionary)
  loadMoraqmanMetadata: async () => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    set({ isLoadingMoraqmanMetadata: true });

    try {
      console.log('Loading moraqman metadata from database...');

      const rows = await db.getAllAsync<{ dictionary_name: string; num_roots: number }>(`
        SELECT d.name as dictionary_name, COUNT(r.id) as num_roots
        FROM dictionaries d
        LEFT JOIN roots r ON d.id = r.dictionary_id
        WHERE d.type = 'moraqman'
        GROUP BY d.id, d.name
        ORDER BY d.id ASC
      `);

      const moraqmanMetadata: DictionaryMetadata = {};
      rows.forEach(row => {
        moraqmanMetadata[row.dictionary_name] = {
          num_roots: row.num_roots,
        };
      });

      set({ moraqmanMetadata, isLoadingMoraqmanMetadata: false });
      console.log('✓ Moraqman metadata loaded');
    } catch (error) {
      console.error('Error loading moraqman metadata:', error);
      set({ isLoadingMoraqmanMetadata: false });
    }
  },

  // Get roots for a specific dictionary
  getRootsForDictionary: async (dictionaryName: string) => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return [];
    }

    try {
      const rows = await db.getAllAsync<{ root: string }>(`
        SELECT r.root
        FROM roots r
        JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE d.name = ?
        ORDER BY r.root COLLATE NOCASE ASC
      `, [dictionaryName]);

      return rows.map(row => row.root);
    } catch (error) {
      console.error('Error getting roots for dictionary:', error);
      return [];
    }
  },

  // Load all roots (for indexed tab display)
  // ONLY loads roots with index data (first_word_position >= 0)
  loadAllRoots: async () => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    set({ isLoadingRoots: true });

    try {
      console.log('Loading indexed roots from database...');

      // Query ONLY indexed roots (where first_word_position >= 0)
      // Order by: dictionary, then root position within dictionary
      const rows = await db.getAllAsync<Root & { dictionary_name: string }>(`
        SELECT
          r.id,
          r.dictionary_id,
          r.root,
          r.definition,
          r.first_word_position,
          d.name as dictionary_name
        FROM roots r
        JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE r.first_word_position >= 0
        ORDER BY r.dictionary_id ASC, r.first_word_position ASC
      `);

      console.log(`Loaded ${rows.length} roots`);

      // For each root, get its words count
      const processedRoots: ProcessedIndexRoot[] = [];

      for (const row of rows) {
        // Get words for this root (ordered by first_position, then id for stable ordering)
        const wordRows = await db.getAllAsync<{ word: string }>(`
          SELECT word
          FROM words
          WHERE root_id = ?
          ORDER BY first_position ASC, id ASC
        `, [row.id]);

        const words = wordRows.map(w => w.word);

        processedRoots.push({
          root: row.root,
          dictionaryName: row.dictionary_name,
          words,
          wordCount: words.length,
        });
      }

      set({ processedRoots, isLoadingRoots: false });
      console.log('✓ Roots loaded');
    } catch (error) {
      console.error('Error loading roots:', error);
      set({ isLoadingRoots: false });
    }
  },

  // Load all words (for navigation)
  // ONLY loads words from indexed roots (first_word_position >= 0)
  loadAllWords: async () => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return;
    }

    set({ isLoadingWords: true });

    try {
      console.log('Loading words from indexed roots...');

      // Query ONLY words from indexed roots (where first_word_position >= 0)
      // Order by: dictionary, then root position within dictionary, then root ID (to group roots), then word first_position within root, then word ID for stable ordering
      const rows = await db.getAllAsync<{
        word: string;
        root: string;
        dictionary_name: string;
        root_id: number;
        root_position: number;
        word_position: number;
        dictionary_id: number;
        all_positions: string;
      }>(`
        SELECT
          w.word,
          w.first_position as word_position,
          w.all_positions,
          w.root_id,
          r.root,
          r.first_word_position as root_position,
          r.dictionary_id,
          d.name as dictionary_name
        FROM words w
        JOIN roots r ON w.root_id = r.id
        JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE r.first_word_position >= 0
        ORDER BY r.dictionary_id ASC, r.first_word_position ASC, r.id ASC, w.first_position ASC, w.id ASC
      `);

      console.log(`Loaded ${rows.length} words`);

      const processedWords: ProcessedIndexWord[] = rows.map(row => ({
        word: row.word,
        root: row.root,
        dictionaryName: row.dictionary_name,
        rootId: row.root_id,
        allPositions: JSON.parse(row.all_positions) as number[],
      }));

      set({ processedWords, isLoadingWords: false });
      console.log('✓ Words loaded');
    } catch (error) {
      console.error('Error loading words:', error);
      set({ isLoadingWords: false });
    }
  },

  // Search for a root across all dictionaries
  searchRoot: async (root: string) => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return [];
    }

    try {
      const rows = await db.getAllAsync<{ dictionary_name: string; definition: string }>(`
        SELECT d.name as dictionary_name, r.definition
        FROM roots r
        JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE r.root = ?
      `, [root]);

      return rows.map(row => ({
        dictionary: row.dictionary_name,
        definition: row.definition,
      }));
    } catch (error) {
      console.error('Error searching root:', error);
      return [];
    }
  },

  // Search for a root in a specific dictionary
  searchRootInDictionary: async (dictionaryName: string, root: string) => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return null;
    }

    try {
      const row = await db.getFirstAsync<{ definition: string }>(`
        SELECT r.definition
        FROM roots r
        JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE d.name = ? AND r.root = ?
      `, [dictionaryName, root]);

      return row?.definition || null;
    } catch (error) {
      console.error('Error searching root:', error);
      return null;
    }
  },

  // Get words for a specific root
  getWordsForRoot: async (rootId: number) => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return [];
    }

    try {
      const rows = await db.getAllAsync<{ word: string }>(`
        SELECT word
        FROM words
        WHERE root_id = ?
        ORDER BY first_position ASC, id ASC
      `, [rootId]);

      return rows.map(row => row.word);
    } catch (error) {
      console.error('Error getting words for root:', error);
      return [];
    }
  },

  // Check if a root exists in a dictionary (for safe source resolution)
  checkRootExists: async (dictionaryName: string, root: string): Promise<boolean> => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return false;
    }

    try {
      const row = await db.getFirstAsync<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM roots r
        JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE d.name = ? AND r.root = ?
      `, [dictionaryName, root]);

      return (row?.count ?? 0) > 0;
    } catch (error) {
      console.error('Error checking root exists:', error);
      return false;
    }
  },

  // Check if a word exists in indexed roots (for safe source resolution)
  checkWordExists: async (word: string): Promise<boolean> => {
    const { db } = get();
    if (!db) {
      console.error('Database not initialized');
      return false;
    }

    try {
      const row = await db.getFirstAsync<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM words w
        JOIN roots r ON w.root_id = r.id
        WHERE w.word = ? AND r.first_word_position >= 0
      `, [word]);

      return (row?.count ?? 0) > 0;
    } catch (error) {
      console.error('Error checking word exists:', error);
      return false;
    }
  },

  setSortBy: (sortBy: 'alphabetical' | 'longest' | 'shortest' | 'random') => {
    // If switching to random, increment seed for new shuffle
    if (sortBy === 'random') {
      set({ sortBy, randomSeed: get().randomSeed + 1 });
    } else {
      set({ sortBy });
    }
  },
}));
