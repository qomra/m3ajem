import { BaseAgent, AgentRequest, AgentResponse, AgentThought } from './BaseAgent';
import type { BaseProvider, ProviderMessage } from '@services/ai/BaseProvider';
import { discoverWordsTool, getEntryTool } from './tools/smartDictionaryTools';
import { webSearchTool } from './tools/webSearchTools';
import { SmartDictionaryToolExecutor } from './tools/SmartDictionaryToolExecutor';
import { WebSearchToolExecutor } from './tools/WebSearchToolExecutor';
import { buildSmartDictionaryPrompt } from '@/prompts/system/smartDictionaryPrompt';
import { SerpAPIStorage } from '@services/storage/serpApiStorage';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Tool, ToolExecutionResult } from './tools/types';
import { SourceType, type Source, type DictionarySource, type IndexedSource, type WebSource } from '@/types/sources';

/**
 * Smart Dictionary Agent
 * Uses optimized 2-tool system: discover_words + get_entry (ID-based)
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

  // Cache for discovered entries: id -> {dictionary, root}
  private discoveredEntries: Map<number, { dictionary: string; root: string }> = new Map();

  /**
   * Get user-friendly label for a tool (shown in مخطط البحث)
   */
  private getToolLabel(toolName: string, args: Record<string, any>): string {
    if (toolName === 'discover_words') {
      return 'استكشاف المعاجم';
    } else if (toolName === 'get_entry') {
      // Look up from discovered entries cache for friendly name
      const entry = this.discoveredEntries.get(args.id);
      if (entry) {
        return `قراءة من ${entry.dictionary}`;
      }
      return `قراءة مدخل`;
    } else if (toolName === 'get_word_segments') {
      // Legacy
      const dict = args.dictionary || '';
      return `قراءة من ${dict}`;
    } else if (toolName === 'search_web') {
      return 'بحث في الإنترنت';
    }
    return 'معالجة';
  }

  /**
   * Parse discover_words output to extract entry IDs and metadata
   */
  private parseDiscoveredEntries(text: string): void {
    // Pattern: [ID] DictionaryName - Root
    const pattern = /\[(\d+)\]\s+([^\-\n]+)\s*-\s*([^\n\(]+)/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const id = parseInt(match[1]);
      const dictionary = match[2].trim();
      const root = match[3].trim();
      this.discoveredEntries.set(id, { dictionary, root });
    }
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
      } else if (tc.name === 'get_entry') {
        const entry = this.discoveredEntries.get(tc.arguments.id);
        if (entry) {
          return `قراءة تعريف "${entry.root}" من ${entry.dictionary}...`;
        }
        return `قراءة المحتوى...`;
      } else if (tc.name === 'get_word_segments') {
        // Legacy
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
    if (toolName === 'discover_words' || toolName === 'get_entry' || toolName === 'get_word_segments') {
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

  async processMessage(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    // Clear caches for new request
    this.discoveredEntries.clear();
    const readIds = new Set<number>();

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
      const tools: Tool[] = [discoverWordsTool, getEntryTool];
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

              // Parse discover_words output to cache entry metadata
              if (toolCall.name === 'discover_words') {
                this.parseDiscoveredEntries(result.text);
              }

              // Track read IDs from get_entry calls
              if (toolCall.name === 'get_entry' && toolCall.arguments.id) {
                readIds.add(toolCall.arguments.id);
              }

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

      // ID-based source tracking
      // Cited = all sources from get_entry calls (they were read)
      // Related = discovered but not read entries (see also)
      const citedSources = allSources;

      // Build related sources from discovered but unread entries
      const relatedSources: Source[] = [];
      for (const [id, entry] of this.discoveredEntries) {
        if (!readIds.has(id)) {
          // This entry was discovered but not read - add to "see also"
          const relatedSource: DictionarySource = {
            id: `discovered-${id}`,
            type: SourceType.DICTIONARY,
            title: `${entry.root} - ${entry.dictionary}`,
            snippet: 'مصدر ذو صلة',
            dictionaryName: entry.dictionary,
            root: entry.root,
            definition: '',
          };
          relatedSources.push(relatedSource);
        }
      }

      const duration = Date.now() - startTime;

      console.log(`SmartDictionaryAgent: ${citedSources.length} cited, ${relatedSources.length} related, ${duration}ms`);

      return {
        success: true,
        content: response.content || '',
        sources: citedSources,
        relatedSources: relatedSources.slice(0, 10), // Limit to 10 "see also" items
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
