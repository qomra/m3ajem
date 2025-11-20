import type { ToolExecutor, ToolExecutionResult } from './types';
import { AllDictionariesSearchService } from '@services/dictionary/AllDictionariesSearchService';
import { SourceType, type Source } from '@/types/sources';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Executes comprehensive dictionary search across all 14 dictionaries
 */
export class AllDictionariesToolExecutor implements ToolExecutor {
  private searchService: AllDictionariesSearchService;

  constructor(db: SQLiteDatabase) {
    this.searchService = new AllDictionariesSearchService(db);
  }

  /**
   * Execute comprehensive dictionary search
   * @param args - Tool arguments { words: string[], roots?: string[] }
   * @returns Formatted search results for LLM with sources
   */
  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    // Extract parameters
    const wordsParam = args.words;
    const rootsParam = args.roots;

    if (!wordsParam) {
      return {
        text: 'خطأ: يجب تحديد كلمات للبحث (words)',
        sources: [],
      };
    }

    // Normalize to arrays
    const words: string[] = Array.isArray(wordsParam) ? wordsParam : [wordsParam];
    const roots: string[] | undefined = rootsParam
      ? Array.isArray(rootsParam)
        ? rootsParam
        : [rootsParam]
      : undefined;

    if (words.length === 0) {
      return {
        text: 'قائمة الكلمات فارغة',
        sources: [],
      };
    }

    // Validate roots length matches words length if provided
    if (roots && roots.length !== words.length) {
      return {
        text: 'خطأ: يجب أن يكون عدد الجذور مساوياً لعدد الكلمات',
        sources: [],
      };
    }

    try {
      // Search across all dictionaries
      const results = await this.searchService.searchMultiple(words, roots);

      // Build sources from results
      const sources: Source[] = [];
      const seenKeys = new Set<string>(); // Track unique dictionary+root combinations
      let sourceIndex = 0;

      for (const result of results) {
        if (result.found && result.results) {
          for (const match of result.results) {
            // Create unique key for deduplication
            const sourceKey = `${match.dictionaryName}:${match.root}`;

            // Skip if we've already added this root+dictionary combination
            if (seenKeys.has(sourceKey)) {
              continue;
            }

            seenKeys.add(sourceKey);

            // Create DICTIONARY source (non-indexed dictionaries don't have positions)
            sources.push({
              id: `dict-all-${match.dictionaryName}-${match.root}-${match.rootId}-${Date.now()}-${sourceIndex++}`,
              type: SourceType.DICTIONARY,
              title: `${match.root} - ${match.dictionaryName}`,
              snippet: match.definition.substring(0, 100) + '...',
              dictionaryName: match.dictionaryName,
              root: match.root,
              definition: match.definition,
            });
          }
        }
      }

      // Format results for LLM
      const text = this.searchService.formatResultsForLLM(results);

      return {
        text,
        sources,
      };
    } catch (error) {
      console.error('AllDictionariesToolExecutor error:', error);
      return {
        text: `خطأ في البحث الشامل: ${error instanceof Error ? error.message : String(error)}`,
        sources: [],
      };
    }
  }
}
