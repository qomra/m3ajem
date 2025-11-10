import { BaseAgent, AgentRequest, AgentResponse } from './BaseAgent';
import type { BaseProvider, ProviderMessage } from '@services/ai/BaseProvider';
import { dictionaryAgentPrompt } from '@/prompts/system/dictionaryAgent';
import { dictionarySearchTool } from './tools/dictionaryTools';
import { DictionaryToolExecutor } from './tools/DictionaryToolExecutor';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Dictionary Tool Agent
 * Agent with tool calling capabilities for dictionary search
 */
export class DictionaryToolAgent extends BaseAgent {
  private toolExecutor: DictionaryToolExecutor;

  constructor(provider: BaseProvider, db: SQLiteDatabase) {
    super(provider);
    this.toolExecutor = new DictionaryToolExecutor(db);
  }

  async processMessage(request: AgentRequest): Promise<AgentResponse> {
    try {
      // Build conversation history with system prompt
      const messages: ProviderMessage[] = [
        {
          role: 'system',
          content: dictionaryAgentPrompt,
        },
        ...request.messageHistory,
        {
          role: 'user',
          content: request.userMessage,
        },
      ];

      // Initial LLM call with tools
      let response = await this.provider.sendMessageWithTools(messages, [dictionarySearchTool]);

      // Tool calling loop
      const MAX_ITERATIONS = 5; // Prevent infinite loops
      let iteration = 0;

      while (response.toolCalls && iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`Tool calling iteration ${iteration}:`, response.toolCalls);

        // Execute all tool calls
        const toolResults = await Promise.all(
          response.toolCalls.map(async (toolCall) => {
            try {
              const result = await this.toolExecutor.execute(toolCall.arguments);
              return {
                tool_call_id: toolCall.id,
                name: toolCall.name,
                result,
              };
            } catch (error) {
              console.error(`Error executing tool ${toolCall.name}:`, error);
              return {
                tool_call_id: toolCall.id,
                name: toolCall.name,
                result: `خطأ في تنفيذ الأداة: ${error instanceof Error ? error.message : String(error)}`,
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
        response = await this.provider.sendMessageWithTools(messages, [dictionarySearchTool]);
      }

      if (iteration >= MAX_ITERATIONS) {
        console.warn('Max tool calling iterations reached');
      }

      return {
        success: true,
        content: response.content,
      };
    } catch (error) {
      console.error('DictionaryToolAgent error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
