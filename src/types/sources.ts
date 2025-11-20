/**
 * Source Types
 * Defines different types of sources that can be referenced in chat messages
 */

export enum SourceType {
  DICTIONARY = 'dictionary',
  INDEXED = 'indexed',
  WEB = 'web',
  SEMANTIC = 'semantic',
}

/**
 * Base source interface
 */
export interface BaseSource {
  id: string;
  type: SourceType;
  title: string;
  snippet?: string; // Short preview text
}

/**
 * Dictionary source - from dictionary search
 */
export interface DictionarySource extends BaseSource {
  type: SourceType.DICTIONARY;
  dictionaryName: string;
  root: string;
  definition: string;
}

/**
 * Indexed source - from indexed word search
 */
export interface IndexedSource extends BaseSource {
  type: SourceType.INDEXED;
  word: string;
  root: string;
  dictionaryName: string;
  definition: string;
  positions: number[]; // Highlighting positions
}

/**
 * Web source - from web search
 */
export interface WebSource extends BaseSource {
  type: SourceType.WEB;
  url: string;
  snippet: string;
  favicon?: string;
}

/**
 * Semantic source - from semantic search
 */
export interface SemanticSource extends BaseSource {
  type: SourceType.SEMANTIC;
  root: string;
  meaning: string;
  similarity: number; // 0-1 similarity score
}

/**
 * Union type for all sources
 */
export type Source = DictionarySource | IndexedSource | WebSource | SemanticSource;

/**
 * Sources attached to a message
 */
export interface MessageSources {
  sources: Source[];
  timestamp: number;
}
