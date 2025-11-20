import type { SQLiteDatabase } from 'expo-sqlite';
import { SemanticSearchService } from '@services/semantic/SemanticSearchService';
import { EmbeddingService } from '@services/semantic/EmbeddingService';
import type { APIConfig } from '@services/storage/apiKeyStorage';
import type { ToolExecutionResult } from './types';
import { SourceType } from '@/types/sources';
import type { Source } from '@/types/sources';

/**
 * Semantic Tool Executor
 * Handles execution of semantic search tool calls
 */
export class SemanticToolExecutor {
  private semanticSearch: SemanticSearchService;
  private apiConfig: APIConfig;

  constructor(db: SQLiteDatabase, apiConfig: APIConfig) {
    this.semanticSearch = new SemanticSearchService(db);
    this.apiConfig = apiConfig;
  }

  /**
   * Execute semantic search tool call
   */
  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    try {
      const meaningQuery = args.meaning_query as string;
      const root = args.root as string | undefined;
      const chunkNumber = args.chunk_number as number | undefined;

      if (!meaningQuery) {
        return {
          text: 'خطأ: يجب تقديم meaning_query',
          sources: [],
        };
      }

      // Case 1: Root and chunk specified - get specific chunk
      if (root && chunkNumber !== undefined) {
        return await this.getRootChunk(root, chunkNumber);
      }

      // Case 2: Root specified - get full content or first chunk
      if (root) {
        return await this.getRootContent(root);
      }

      // Case 3: Only query - perform semantic search
      return await this.searchByMeaning(meaningQuery);
    } catch (error) {
      console.error('Error executing semantic tool:', error);

      // Return error message with proper structure
      return {
        text: `خطأ في البحث الدلالي: ${error instanceof Error ? error.message : String(error)}`,
        sources: [],
      };
    }
  }

  /**
   * Search for roots by meaning
   */
  private async searchByMeaning(meaningQuery: string): Promise<ToolExecutionResult> {
    try {
      // Generate embedding for the query
      console.log('Generating embedding for query:', meaningQuery);
      let embedding = await EmbeddingService.generateEmbedding(meaningQuery, this.apiConfig);

      // Normalize to 1536 dimensions (matching text-embedding-3-small)
      embedding = EmbeddingService.normalizeEmbedding(embedding, 1536);

      // Search for similar roots
      console.log('Searching spectrum vectors...');
      const results = await this.semanticSearch.searchByMeaning(meaningQuery, embedding);

      // Create sources from results
      const sources: Source[] = results.map((result, index) => ({
        id: `semantic-${result.root}-${Date.now()}-${index}`,
        type: SourceType.SEMANTIC,
        title: `${result.root} (${(result.similarity * 100).toFixed(1)}%)`,
        root: result.root,
        meaning: meaningQuery,
        similarity: result.similarity,
      }));

      // Format and return results
      return {
        text: this.semanticSearch.formatSearchResults(results),
        sources,
      };
    } catch (error) {
      console.error('Error in searchByMeaning:', error);
      throw error;
    }
  }

  /**
   * Get full content or first chunk of a root
   */
  private async getRootContent(root: string): Promise<ToolExecutionResult> {
    try {
      const result = await this.semanticSearch.getRootContent(root);

      if (!result) {
        return {
          text: `لم يتم العثور على الجذر "${root}" في المعجم.`,
          sources: [],
        };
      }

      // Create source for this root
      const source: Source = {
        id: `semantic-${root}-${Date.now()}`,
        type: SourceType.SEMANTIC,
        title: `${root} - ${result.dictionaryName}`,
        root: result.root,
        meaning: root,
        similarity: 1.0, // Direct lookup has 100% match
      };

      return {
        text: this.semanticSearch.formatRootContent(result),
        sources: [source],
      };
    } catch (error) {
      console.error('Error in getRootContent:', error);
      throw error;
    }
  }

  /**
   * Get specific chunk of a root
   */
  private async getRootChunk(root: string, chunkNumber: number): Promise<ToolExecutionResult> {
    try {
      const result = await this.semanticSearch.getRootContent(root, chunkNumber);

      if (!result) {
        return {
          text: `لم يتم العثور على الجذر "${root}" في المعجم.`,
          sources: [],
        };
      }

      // Create source for this root chunk
      const source: Source = {
        id: `semantic-${root}-${chunkNumber}-${Date.now()}`,
        type: SourceType.SEMANTIC,
        title: `${root} - ${result.dictionaryName} (جزء ${chunkNumber})`,
        root: result.root,
        meaning: root,
        similarity: 1.0,
      };

      return {
        text: this.semanticSearch.formatRootContent(result),
        sources: [source],
      };
    } catch (error) {
      console.error('Error in getRootChunk:', error);
      throw error;
    }
  }
}
