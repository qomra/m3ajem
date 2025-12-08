import { BaseAgent, AgentRequest, AgentResponse, AgentThought } from './BaseAgent';
import type { BaseProvider, ProviderMessage } from '@services/ai/BaseProvider';
import { discoverWordsTool, getWordSegmentsTool } from './tools/smartDictionaryTools';
import { webSearchTool } from './tools/webSearchTools';
import { SmartDictionaryToolExecutor } from './tools/SmartDictionaryToolExecutor';
import { WebSearchToolExecutor } from './tools/WebSearchToolExecutor';
import { buildSmartDictionaryPrompt } from '@/prompts/system/smartDictionaryPrompt';
import { SerpAPIStorage } from '@services/storage/serpApiStorage';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Tool, ToolExecutionResult } from './tools/types';
import type { Source, DictionarySource, IndexedSource, WebSource } from '@/types/sources';

/**
 * Smart Dictionary Agent
 * Uses optimized 2-tool system: discover_words + get_word_segments
 */
export class SmartDictionaryAgent extends BaseAgent {
  private db: SQLiteDatabase;
  private webSearchExecutor: WebSearchToolExecutor | null = null;
  private systemPrompt: string | null = null;

  constructor(provider: BaseProvider, db: SQLiteDatabase) {
    super(provider);
    this.db = db;
  }

  getName(): string {
    return 'smart-dictionary';
  }

  getDescription(): string {
    return 'Optimized dictionary agent with discover + segment tools';
  }

  /**
   * Initialize system prompt from database
   */
  private async initSystemPrompt(): Promise<string> {
    if (!this.systemPrompt) {
      try {
        this.systemPrompt = await buildSmartDictionaryPrompt(this.db);
        console.log('SmartDictionaryAgent: System prompt built from DB');
      } catch (error) {
        console.error('SmartDictionaryAgent: Error building prompt from DB, using fallback:', error);
        // Fallback to static prompt
        this.systemPrompt = this.getStaticPrompt();
      }
    }
    return this.systemPrompt;
  }

  /**
   * Static fallback prompt
   */
  private getStaticPrompt(): string {
    return `أنت مساعد خبير في اللغة العربية والمعاجم الكلاسيكية.

## الأدوات المتاحة

### 1. استكشاف الكلمات (discover_words)
استكشف ما هو متاح في المعاجم دون جلب المحتوى.
استخدمها أولاً دائماً.

### 2. جلب المقتطفات (get_word_segments)
جلب محتوى التعريف. حدد context_words:
- "full" للتعريفات القصيرة
- "40" للتعريفات الطويلة

## الاستراتيجية
1. discover_words أولاً
2. get_word_segments للتفاصيل
3. أرفق المصادر المستخدمة وذات الصلة

أجب بالعربية الفصحى. لا تذكر عملية البحث. اذكر المصادر.`;
  }

  /**
   * Initialize web search executor if available
   */
  private initWebSearchExecutor(serpApiKey: string): void {
    if (!this.webSearchExecutor) {
      this.webSearchExecutor = new WebSearchToolExecutor(serpApiKey);
    }
  }

  /**
   * Get user-friendly label for a tool (shown in مخطط البحث)
   */
  private getToolLabel(toolName: string, args: Record<string, any>): string {
    if (toolName === 'discover_words') {
      return 'استكشاف المعاجم';
    } else if (toolName === 'get_word_segments') {
      const dict = args.dictionary || '';
      return `قراءة من ${dict}`;
    } else if (toolName === 'search_web') {
      return 'بحث في الإنترنت';
    }
    return 'معالجة';
  }

  /**
   * Generate a human-readable summary of tool calls
   * Used when LLM returns tool calls without content
   * User-friendly descriptions without exposing internal tool names
   */
  private generateToolCallSummary(toolCalls: Array<{ name: string; arguments: Record<string, any> }>): string {
    const summaries = toolCalls.map((tc) => {
      if (tc.name === 'discover_words') {
        const words = tc.arguments.words || [];
        const wordList = Array.isArray(words) ? words.join('، ') : words;
        return `البحث عن "${wordList}" في المعاجم...`;
      } else if (tc.name === 'get_word_segments') {
        const { root, dictionary } = tc.arguments;
        return `قراءة تعريف "${root}" من ${dictionary}...`;
      } else if (tc.name === 'search_web') {
        return `البحث في الإنترنت عن "${tc.arguments.query}"...`;
      }
      return `جارٍ المعالجة...`;
    });
    return summaries.join('\n');
  }

  /**
   * Execute a tool call
   */
  private async executeTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<ToolExecutionResult> {
    // Smart dictionary tools
    if (toolName === 'discover_words' || toolName === 'get_word_segments') {
      const executor = new SmartDictionaryToolExecutor(this.db, toolName);
      return executor.execute(args);
    }

    // Web search
    if (toolName === 'search_web' && this.webSearchExecutor) {
      return this.webSearchExecutor.execute(args);
    }

    return {
      text: `أداة غير معروفة: ${toolName}`,
      sources: [],
    };
  }

  /**
   * Extract cited sources from response
   */
  private async extractCitedSources(
    responseContent: string,
    allSources: Source[]
  ): Promise<Source[]> {
    if (allSources.length === 0) {
      return [];
    }

    if (allSources.length <= 3) {
      return allSources;
    }

    try {
      const sourceList = allSources.map((source, index) => {
        let description = `[${index + 1}] ${source.title}`;
        if (source.type === 'dictionary' || source.type === 'indexed') {
          const dictSource = source as DictionarySource | IndexedSource;
          description += ` (${dictSource.dictionaryName})`;
        } else if (source.type === 'web') {
          const webSource = source as WebSource;
          description += ` - ${webSource.url}`;
        }
        return description;
      }).join('\n');

      const citationPrompt = `بناءً على إجابتك، حدد أرقام المصادر المستخدمة وذات الصلة.

المصادر:
${sourceList}

إجابتك:
${responseContent.substring(0, 1500)}${responseContent.length > 1500 ? '...' : ''}

أجب بأرقام المصادر مفصولة بفواصل (مثال: 1, 3, 5). المصادر المستخدمة أولاً ثم ذات الصلة.`;

      const citationResponse = await this.provider.sendMessage([
        { role: 'user', content: citationPrompt },
      ]);

      const responseText = citationResponse.content || '';

      if (responseText.includes('لا شيء') || responseText.toLowerCase().includes('none')) {
        return [];
      }

      const numbers = responseText.match(/\d+/g);
      if (!numbers || numbers.length === 0) {
        return allSources.slice(0, 5); // Fallback: top 5
      }

      const citedIndices = numbers
        .map((n) => parseInt(n, 10) - 1)
        .filter((i) => i >= 0 && i < allSources.length);

      const uniqueIndices = [...new Set(citedIndices)];
      return uniqueIndices.map((i) => allSources[i]);

    } catch (error) {
      console.error('Error extracting cited sources:', error);
      return allSources.slice(0, 5);
    }
  }

  async processMessage(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Initialize system prompt from DB
      const systemPrompt = await this.initSystemPrompt();

      // Check web search availability
      const serpConfig = await SerpAPIStorage.getConfig();
      const hasWebSearch = serpConfig !== null && serpConfig.enabled;

      if (hasWebSearch && serpConfig) {
        this.initWebSearchExecutor(serpConfig.apiKey);
      }

      // Build tools array
      const tools: Tool[] = [discoverWordsTool, getWordSegmentsTool];
      if (hasWebSearch) {
        tools.push(webSearchTool);
      }

      console.log(`SmartDictionaryAgent tools: ${tools.map((t) => t.name).join(', ')}`);

      // Build messages
      const messages: ProviderMessage[] = [
        { role: 'system', content: systemPrompt },
        ...request.messageHistory,
        { role: 'user', content: request.userMessage },
      ];

      // Initial LLM call
      let response = await this.provider.sendMessageWithTools(messages, tools);

      // Tool calling loop
      const MAX_ITERATIONS = 10;
      let iteration = 0;
      const allSources: Source[] = [];
      const thoughts: AgentThought[] = [];

      while (response.toolCalls && response.toolCalls.length > 0 && iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`Iteration ${iteration}:`, response.toolCalls.map((tc) => tc.name));

        // Always capture thought for tool calls (even if content is empty)
        // This provides visibility into what the LLM is doing
        const toolLabels = response.toolCalls.map((tc) => this.getToolLabel(tc.name, tc.arguments));
        const toolSummary = this.generateToolCallSummary(response.toolCalls);
        const thoughtContent = response.content?.trim() || toolSummary;

        const thought = {
          iteration,
          content: thoughtContent,
          toolCalls: toolLabels, // User-friendly labels, not internal names
          timestamp: Date.now(),
        };
        thoughts.push(thought);

        if (request.onThoughtUpdate) {
          request.onThoughtUpdate(thought);
        }

        // Execute tools
        const toolResults = await Promise.all(
          response.toolCalls.map(async (toolCall) => {
            try {
              const result = await this.executeTool(toolCall.name, toolCall.arguments);

              if (result.sources && result.sources.length > 0) {
                allSources.push(...result.sources);
              }

              return {
                tool_call_id: toolCall.id,
                name: toolCall.name,
                result: result.text,
                sources: result.sources,
              };
            } catch (error) {
              console.error(`Tool ${toolCall.name} error:`, error);
              return {
                tool_call_id: toolCall.id,
                name: toolCall.name,
                result: `خطأ: ${error instanceof Error ? error.message : String(error)}`,
                sources: [],
              };
            }
          })
        );

        // Add to message history
        messages.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.toolCalls,
        });

        toolResults.forEach((result) => {
          messages.push({
            role: 'tool',
            tool_call_id: result.tool_call_id,
            content: result.result,
          });
        });

        // Continue conversation
        response = await this.provider.sendMessageWithTools(messages, tools);
      }

      // Extract cited sources (المصادر)
      const citedSources = await this.extractCitedSources(
        response.content || '',
        allSources
      );

      // Get related sources that weren't cited (أنظر أيضاً)
      const citedIds = new Set(citedSources.map((s) => s.id));
      const relatedSources = allSources.filter((s) => !citedIds.has(s.id));

      const duration = Date.now() - startTime;

      console.log(`SmartDictionaryAgent: ${allSources.length} total, ${citedSources.length} cited, ${relatedSources.length} related, ${duration}ms`);

      return {
        success: true,
        content: response.content,
        sources: citedSources,
        relatedSources: relatedSources.slice(0, 10), // Limit to 10 related items
        thoughts,
        duration,
      };
    } catch (error) {
      console.error('SmartDictionaryAgent error:', error);
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
