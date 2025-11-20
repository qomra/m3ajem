import type { ToolExecutor, ToolExecutionResult } from './types';
import { DictionaryLookupService } from '@services/dictionary/DictionaryLookupService';
import { SourceType, type DictionarySource, type IndexedSource, type Source } from '@/types/sources';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Executes dictionary search tool calls
 */
export class DictionaryToolExecutor implements ToolExecutor {
  private lookupService: DictionaryLookupService;

  constructor(db: SQLiteDatabase) {
    this.lookupService = new DictionaryLookupService(db);
  }

  /**
   * Execute dictionary search
   * @param args - Tool arguments { words: string | string[] }
   * @returns Formatted search results for LLM with sources
   */
  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    // Extract words parameter (can be string or array)
    const wordsParam = args.words;

    if (!wordsParam) {
      return {
        text: 'لم يتم تحديد كلمات للبحث',
        sources: [],
      };
    }

    // Normalize to array
    const words: string[] = Array.isArray(wordsParam) ? wordsParam : [wordsParam];

    if (words.length === 0) {
      return {
        text: 'قائمة الكلمات فارغة',
        sources: [],
      };
    }

    try {
      // Search for all words
      const results = await this.lookupService.searchWords(words);

      // Build sources from results (deduplicate by word for indexed sources)
      const sources: Source[] = [];
      const seenWords = new Set<string>(); // Track unique words for indexed sources
      let sourceIndex = 0;

      for (const result of results) {
        if (result.found && result.results) {
          // Check if this word appears in indexed dictionaries (has positions)
          const hasIndexedOccurrence = result.results.some(occ => occ.positions && occ.positions.length > 0);

          if (hasIndexedOccurrence) {
            // Create INDEXED source - points to the word page
            // Get first occurrence for snippet
            const firstOcc = result.results[0];

            // Use the actual word with diacritics from the first snippet
            const actualWord = firstOcc.snippets && firstOcc.snippets.length > 0
              ? firstOcc.snippets[0].word
              : result.word;

            if (!seenWords.has(actualWord)) {
              seenWords.add(actualWord);

              sources.push({
                id: `indexed-${actualWord}-${Date.now()}-${sourceIndex++}`,
                type: SourceType.INDEXED,
                title: actualWord,
                snippet: firstOcc.definition.substring(0, 100) + '...',
                word: actualWord, // Use word WITH diacritics
                root: firstOcc.root,
                dictionaryName: firstOcc.dictionaryName,
                definition: firstOcc.definition,
                positions: firstOcc.positions,
              });
            }
          } else {
            // Create DICTIONARY sources - points to dictionary root pages
            for (const occurrence of result.results) {
              // Create unique key for deduplication
              const sourceKey = `${occurrence.dictionaryName}:${occurrence.root}`;

              // Skip if we've already added this root+dictionary combination
              if (seenWords.has(sourceKey)) {
                continue;
              }

              seenWords.add(sourceKey);

              sources.push({
                id: `dict-${occurrence.dictionaryName}-${occurrence.root}-${occurrence.rootId}-${Date.now()}-${sourceIndex++}`,
                type: SourceType.DICTIONARY,
                title: `${occurrence.root} - ${occurrence.dictionaryName}`,
                snippet: occurrence.definition.substring(0, 100) + '...',
                dictionaryName: occurrence.dictionaryName,
                root: occurrence.root,
                definition: occurrence.definition,
              });
            }
          }
        }
      }

      // Format results for LLM
      const text = this.lookupService.formatResultsForLLM(results);

      return {
        text,
        sources,
      };
    } catch (error) {
      console.error('DictionaryToolExecutor error:', error);
      return {
        text: `خطأ في البحث: ${error instanceof Error ? error.message : String(error)}`,
        sources: [],
      };
    }
  }
}
