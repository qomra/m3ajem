import { WebSearchService } from '@services/web/WebSearchService';
import type { ToolExecutionResult } from './types';
import { SourceType, type WebSource } from '@/types/sources';

/**
 * Web Search Tool Executor
 * Handles execution of web search tool calls
 */
export class WebSearchToolExecutor {
  private searchService: WebSearchService;

  constructor(serpApiKey: string) {
    this.searchService = new WebSearchService(serpApiKey);
  }

  /**
   * Execute web search tool call
   */
  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    try {
      const query = args.query as string;
      const numResults = (args.num_results as number) || 5;

      if (!query) {
        return {
          text: 'خطأ: يجب تقديم query للبحث',
          sources: [],
        };
      }

      // Limit to 10 results max
      const limitedResults = Math.min(numResults, 10);

      console.log(`Web search: "${query}" (${limitedResults} results)`);

      // Perform search
      const response = await this.searchService.search(query, limitedResults);

      // Build sources from results
      const sources: WebSource[] = response.organic_results?.map((result: any, index: number) => ({
        id: `web-${Date.now()}-${index}`,
        type: SourceType.WEB,
        title: result.title || 'نتيجة بحث',
        url: result.link || '',
        snippet: result.snippet || '',
        favicon: result.favicon,
      })) || [];

      // Format results
      const text = this.searchService.formatResults(response);

      return {
        text,
        sources,
      };
    } catch (error) {
      console.error('Error executing web search:', error);
      return {
        text: `خطأ في البحث على الإنترنت: ${error instanceof Error ? error.message : String(error)}`,
        sources: [],
      };
    }
  }
}
