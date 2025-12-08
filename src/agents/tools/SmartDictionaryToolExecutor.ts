import type { ToolExecutor, ToolExecutionResult } from './types';
import { DiscoverWordsService } from '@services/dictionary/DiscoverWordsService';
import { WordSegmentsService } from '@services/dictionary/WordSegmentsService';
import { SourceType, type Source, type IndexedSource, type DictionarySource } from '@/types/sources';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Tool executor for smart dictionary tools
 * Handles: discover_words, get_word_segments
 */
export class SmartDictionaryToolExecutor implements ToolExecutor {
  private discoverService: DiscoverWordsService;
  private segmentsService: WordSegmentsService;
  private toolName: string;

  constructor(db: SQLiteDatabase, toolName: string) {
    this.discoverService = new DiscoverWordsService(db);
    this.segmentsService = new WordSegmentsService(db);
    this.toolName = toolName;
  }

  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    switch (this.toolName) {
      case 'discover_words':
        return this.executeDiscoverWords(args);
      case 'get_word_segments':
        return this.executeGetWordSegments(args);
      default:
        return {
          text: `أداة غير معروفة: ${this.toolName}`,
          sources: [],
        };
    }
  }

  /**
   * Execute discover_words tool
   */
  private async executeDiscoverWords(args: Record<string, any>): Promise<ToolExecutionResult> {
    const wordsParam = args.words;
    const rootsParam = args.roots;

    if (!wordsParam) {
      return {
        text: 'لم يتم تحديد كلمات للبحث',
        sources: [],
      };
    }

    // Normalize to arrays
    const words: string[] = Array.isArray(wordsParam) ? wordsParam : [wordsParam];
    const roots: string[] | undefined = rootsParam
      ? Array.isArray(rootsParam) ? rootsParam : [rootsParam]
      : undefined;

    if (words.length === 0) {
      return {
        text: 'قائمة الكلمات فارغة',
        sources: [],
      };
    }

    // Log what we're searching for
    console.log('discover_words:', {
      words,
      roots,
    });

    try {
      const results = await this.discoverService.discoverWords(words, roots);
      const text = this.discoverService.formatResultsForLLM(results);

      // Build sources from discovery results
      const sources: Source[] = [];
      let sourceIndex = 0;

      for (const result of results) {
        // Add indexed word sources (highest priority - direct scroll)
        for (const match of result.indexedMatches) {
          const source: IndexedSource = {
            id: `discover-indexed-${sourceIndex++}-${Date.now()}`,
            type: SourceType.INDEXED,
            title: match.word,
            snippet: `${match.dictionaryName} - جذر: ${match.root}`,
            word: match.word,
            root: match.root,
            dictionaryName: match.dictionaryName,
            definition: '', // Not fetched yet
            positions: [],
          };
          sources.push(source);
        }

        // Add root sources
        for (const match of result.rootMatches) {
          const source: DictionarySource = {
            id: `discover-root-${sourceIndex++}-${Date.now()}`,
            type: SourceType.DICTIONARY,
            title: `${match.root} - ${match.dictionaryName}`,
            snippet: `${match.definitionLength} حرف`,
            dictionaryName: match.dictionaryName,
            root: match.root,
            definition: '', // Not fetched yet
          };
          sources.push(source);
        }
      }

      return {
        text,
        sources,
      };
    } catch (error) {
      console.error('discover_words error:', error);
      return {
        text: `خطأ في البحث: ${error instanceof Error ? error.message : String(error)}`,
        sources: [],
      };
    }
  }

  /**
   * Execute get_word_segments tool
   */
  private async executeGetWordSegments(args: Record<string, any>): Promise<ToolExecutionResult> {
    const { root, dictionary, words, context_words } = args;

    if (!root || !dictionary) {
      return {
        text: 'يجب تحديد الجذر والمعجم',
        sources: [],
      };
    }

    // Parse context_words
    let contextWordsValue: number | 'full' = 40;
    if (context_words === 'full') {
      contextWordsValue = 'full';
    } else if (typeof context_words === 'number') {
      contextWordsValue = context_words;
    } else if (typeof context_words === 'string' && !isNaN(parseInt(context_words))) {
      contextWordsValue = parseInt(context_words);
    }

    try {
      const result = await this.segmentsService.getWordSegments(
        root,
        dictionary,
        words,
        contextWordsValue
      );

      if (!result) {
        return {
          text: `لم يتم العثور على الجذر "${root}" في معجم "${dictionary}"`,
          sources: [],
        };
      }

      const text = this.segmentsService.formatResultForLLM(result);

      // Build source for this result
      const sources: Source[] = [];

      if (result.segments && result.segments.length > 0) {
        // Add sources for each segment word
        for (const segment of result.segments) {
          const source: IndexedSource = {
            id: `segment-${segment.position}-${Date.now()}`,
            type: SourceType.INDEXED,
            title: segment.word,
            snippet: segment.context.substring(0, 100) + '...',
            word: segment.word,
            root: result.root,
            dictionaryName: result.dictionaryName,
            definition: result.content,
            positions: [segment.position],
          };
          sources.push(source);
        }
      } else {
        // Full definition - add as dictionary source
        const source: DictionarySource = {
          id: `full-def-${Date.now()}`,
          type: SourceType.DICTIONARY,
          title: `${result.root} - ${result.dictionaryName}`,
          snippet: result.content.substring(0, 100) + '...',
          dictionaryName: result.dictionaryName,
          root: result.root,
          definition: result.content,
        };
        sources.push(source);
      }

      return {
        text,
        sources,
      };
    } catch (error) {
      console.error('get_word_segments error:', error);
      return {
        text: `خطأ في جلب المقتطفات: ${error instanceof Error ? error.message : String(error)}`,
        sources: [],
      };
    }
  }
}

/**
 * Factory to create tool executors
 */
export function createSmartDictionaryExecutor(
  db: SQLiteDatabase,
  toolName: string
): SmartDictionaryToolExecutor {
  return new SmartDictionaryToolExecutor(db, toolName);
}
