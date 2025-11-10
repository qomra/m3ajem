import type { ToolExecutor } from './types';
import { DictionaryLookupService } from '@services/dictionary/DictionaryLookupService';
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
   * @returns Formatted search results for LLM
   */
  async execute(args: Record<string, any>): Promise<string> {
    // Extract words parameter (can be string or array)
    const wordsParam = args.words;

    if (!wordsParam) {
      return 'خطأ: لم يتم تحديد كلمات للبحث';
    }

    // Normalize to array
    const words: string[] = Array.isArray(wordsParam) ? wordsParam : [wordsParam];

    if (words.length === 0) {
      return 'خطأ: قائمة الكلمات فارغة';
    }

    try {
      // Search for all words
      const results = await this.lookupService.searchWords(words);

      // Format results for LLM
      return this.lookupService.formatResultsForLLM(results);
    } catch (error) {
      console.error('DictionaryToolExecutor error:', error);
      return `خطأ في البحث: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
