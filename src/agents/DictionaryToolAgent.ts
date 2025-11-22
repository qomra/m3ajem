import { BaseAgent, AgentRequest, AgentResponse, AgentThought } from './BaseAgent';
import type { BaseProvider, ProviderMessage } from '@services/ai/BaseProvider';
import { dictionarySearchTool } from './tools/dictionaryTools';
import { searchAllDictionariesTool } from './tools/allDictionariesTools';
import { searchWordByMeaningTool } from './tools/semanticTools';
import { webSearchTool } from './tools/webSearchTools';
import { DictionaryToolExecutor } from './tools/DictionaryToolExecutor';
import { AllDictionariesToolExecutor } from './tools/AllDictionariesToolExecutor';
import { SemanticToolExecutor } from './tools/SemanticToolExecutor';
import { WebSearchToolExecutor } from './tools/WebSearchToolExecutor';
import { getSystemPrompt } from '@/prompts/system/dynamicPrompts';
import { ResourceManager, ResourceType } from '@services/resources/ResourceManager';
import { SerpAPIStorage } from '@services/storage/serpApiStorage';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { APIConfig } from '@services/storage/apiKeyStorage';
import type { Tool, ToolExecutionResult } from './tools/types';
import type { Source } from '@/types/sources';

/**
 * Dictionary Tool Agent
 * Agent with tool calling capabilities for dictionary search
 */
export class DictionaryToolAgent extends BaseAgent {
  private dictionaryExecutor: DictionaryToolExecutor;
  private allDictionariesExecutor: AllDictionariesToolExecutor;
  private semanticExecutor: SemanticToolExecutor | null = null;
  private webSearchExecutor: WebSearchToolExecutor | null = null;
  private db: SQLiteDatabase;

  constructor(provider: BaseProvider, db: SQLiteDatabase) {
    super(provider);
    this.db = db;
    this.dictionaryExecutor = new DictionaryToolExecutor(db);
    this.allDictionariesExecutor = new AllDictionariesToolExecutor(db);
  }

  /**
   * Initialize semantic executor with API config
   */
  private initSemanticExecutor(apiConfig: APIConfig): void {
    if (!this.semanticExecutor) {
      this.semanticExecutor = new SemanticToolExecutor(this.db, apiConfig);
    }
  }

  /**
   * Initialize web search executor with SerpAPI key
   */
  private initWebSearchExecutor(serpApiKey: string): void {
    if (!this.webSearchExecutor) {
      this.webSearchExecutor = new WebSearchToolExecutor(serpApiKey);
    }
  }

  getName(): string {
    return 'dictionary-tool';
  }

  getDescription(): string {
    return 'Agent with dictionary search and semantic meaning search capabilities';
  }

  async processMessage(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now(); // Track start time for duration

    try {
      // Check available features
      const hasSemanticSearch = request.apiConfig
        ? await ResourceManager.canUseResource(
            ResourceType.SEMANTIC_EMBEDDINGS,
            request.apiConfig.provider
          )
        : { canUse: false };

      const serpConfig = await SerpAPIStorage.getConfig();
      const hasWebSearch = serpConfig !== null && serpConfig.enabled;

      console.log('Tool availability:', {
        dictionary: true,
        semantic: hasSemanticSearch.canUse,
        webSearch: hasWebSearch,
      });

      // Initialize executors based on availability
      if (hasSemanticSearch.canUse && request.apiConfig) {
        this.initSemanticExecutor(request.apiConfig);
      }

      if (hasWebSearch && serpConfig) {
        this.initWebSearchExecutor(serpConfig.apiKey);
      }

      // Build tools array conditionally
      const tools: Tool[] = [dictionarySearchTool, searchAllDictionariesTool];
      if (hasSemanticSearch.canUse) {
        tools.push(searchWordByMeaningTool);
      }
      if (hasWebSearch) {
        tools.push(webSearchTool);
      }

      console.log(`Available tools: ${tools.map((t) => t.name).join(', ')}`);

      // Get appropriate system prompt based on available tools
      const systemPrompt = getSystemPrompt({
        hasDictionary: true,
        hasSemanticSearch: hasSemanticSearch.canUse,
        hasWebSearch,
      });

      // Build conversation history with dynamic system prompt
      const messages: ProviderMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...request.messageHistory,
        {
          role: 'user',
          content: request.userMessage,
        },
      ];

      // Initial LLM call with tools
      let response = await this.provider.sendMessageWithTools(messages, tools);

      // Tool calling loop
      const MAX_ITERATIONS = 20; // Allow deeper research for complex questions
      let iteration = 0;
      const allSources: Source[] = []; // Collect sources from all iterations
      const thoughts: AgentThought[] = []; // Collect LLM reasoning steps

      while (response.toolCalls && response.toolCalls.length > 0 && iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`Tool calling iteration ${iteration}:`, response.toolCalls);

        // Capture LLM's thought/reasoning for this iteration
        if (response.content && response.content.trim()) {
          const thought = {
            iteration,
            content: response.content,
            toolCalls: response.toolCalls.map((tc) => tc.name),
            timestamp: Date.now(),
          };
          thoughts.push(thought);

          // Call the callback to stream thought in real-time
          if (request.onThoughtUpdate) {
            request.onThoughtUpdate(thought);
          }
        }

        // Execute all tool calls
        const toolResults = await Promise.all(
          response.toolCalls.map(async (toolCall) => {
            try {
              // Route to appropriate executor based on tool name
              let executionResult: ToolExecutionResult;
              if (toolCall.name === 'search_dictionary') {
                executionResult = await this.dictionaryExecutor.execute(toolCall.arguments);
              } else if (toolCall.name === 'search_all_dictionaries') {
                executionResult = await this.allDictionariesExecutor.execute(toolCall.arguments);
              } else if (toolCall.name === 'search_word_by_meaning' && this.semanticExecutor) {
                executionResult = await this.semanticExecutor.execute(toolCall.arguments);
              } else if (toolCall.name === 'search_web' && this.webSearchExecutor) {
                executionResult = await this.webSearchExecutor.execute(toolCall.arguments);
              } else {
                executionResult = {
                  text: `خطأ: أداة غير معروفة أو غير متاحة: ${toolCall.name}`,
                  sources: [],
                };
              }

              // Collect sources
              if (executionResult.sources && executionResult.sources.length > 0) {
                allSources.push(...executionResult.sources);
              }

              return {
                tool_call_id: toolCall.id,
                name: toolCall.name,
                result: executionResult.text,
                sources: executionResult.sources,
              };
            } catch (error) {
              console.error(`Error executing tool ${toolCall.name}:`, error);
              return {
                tool_call_id: toolCall.id,
                name: toolCall.name,
                result: `خطأ في تنفيذ الأداة: ${error instanceof Error ? error.message : String(error)}`,
                sources: [],
              };
            }
          })
        );

        // Add assistant message with tool calls to history
        messages.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.toolCalls,
        });

        // Add tool results to history
        toolResults.forEach((result) => {
          messages.push({
            role: 'tool',
            tool_call_id: result.tool_call_id,
            content: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
          });
        });

        // Send back to LLM with tool results
        response = await this.provider.sendMessageWithTools(messages, tools);
      }

      if (iteration >= MAX_ITERATIONS) {
        console.warn('Max tool calling iterations reached');
      }

      const duration = Date.now() - startTime;

      console.log(`Collected ${allSources.length} sources from ${iteration} tool iterations`);
      console.log(`Captured ${thoughts.length} reasoning steps, total duration: ${duration}ms`);

      return {
        success: true,
        content: response.content,
        sources: allSources,
        thoughts,
        duration,
      };
    } catch (error) {
      console.error('DictionaryToolAgent error:', error);
      const duration = Date.now() - startTime;
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : String(error),
        sources: [],
        thoughts: [],
        duration,
      };
    }
  }
}
