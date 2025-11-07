/**
 * Dictionary metadata
 */
export interface DictionaryMetadata {
  id: number;
  name: string;
  description: string;
  root_count: number;
}

/**
 * Root definition in a dictionary
 */
export interface RootDefinition {
  root: string;
  definition: string;
  dictionaryId: number;
  dictionaryName: string;
}

/**
 * Indexed word entry
 */
export interface IndexedWord {
  word: string;
  root: string;
  dictionaryId: number;
}

/**
 * Search index structure (from search-index.json)
 */
export interface SearchIndex {
  dictionary_metadata: DictionaryMetadata[];
  root_to_dicts: Record<string, number[]>;
  word_to_roots: Record<string, Array<{ dict_id: number; root: string }>>;
  root_prefix_index: Record<string, string[]>;
  word_prefix_index: Record<string, string[]>;
  word_suffix_index: Record<string, string[]>;
}

/**
 * Full dictionary data (from maajem-optimized.json)
 */
export interface DictionaryData {
  name: string;
  description: string;
  data: Record<string, string>; // root -> definition
}

/**
 * Index data (from index-optimized.json)
 */
export type IndexData = Record<string, Record<string, string[]>>; // dict name -> root -> words[]

/**
 * Search result
 */
export interface SearchResult {
  root: string;
  definition: string;
  dictionaryId: number;
  dictionaryName: string;
}

/**
 * Word search result
 */
export interface WordSearchResult {
  word: string;
  root: string;
  definition: string;
  dictionaryId: number;
  dictionaryName: string;
}
