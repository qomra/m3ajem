import { BaseProvider, ProviderMessage, ProviderResponse } from './BaseProvider';
import type { APIProvider } from '@services/storage/apiKeyStorage';
import type { Tool, ToolCall } from '@/agents/tools/types';

/**
 * OpenAI Provider implementation
 * Supports GPT-4.5 model
 */
export class OpenAIProvider extends BaseProvider {
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  getProviderType(): APIProvider {
    return 'openai';
  }

  validateApiKey(): boolean {
    return this.apiKey.startsWith('sk-');
  }

  async sendMessage(messages: ProviderMessage[]): Promise<ProviderResponse> {
    if (!this.validateApiKey()) {
      throw new Error('Invalid OpenAI API key format');
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();

      return {
        content: data.choices[0]?.message?.content || '',
        finishReason: data.choices[0]?.finish_reason === 'stop' ? 'stop' : 'length',
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    } catch (error) {
      console.error('OpenAI Provider error:', error);
      throw error;
    }
  }

  async sendMessageWithTools(messages: ProviderMessage[], tools: Tool[]): Promise<ProviderResponse> {
    if (!this.validateApiKey()) {
      throw new Error('Invalid OpenAI API key format');
    }

    try {
      // Convert messages to OpenAI format
      const openaiMessages = messages.map(msg => {
        if (msg.role === 'tool') {
          // Tool result message
          return {
            role: 'tool',
            tool_call_id: msg.tool_call_id,
            content: msg.content,
          };
        } else if (msg.role === 'assistant' && msg.tool_calls) {
          // Assistant message with tool calls
          return {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.tool_calls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          };
        } else {
          // Regular message
          return {
            role: msg.role,
            content: msg.content,
          };
        }
      });

      // Convert tools to OpenAI format
      const openaiTools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: openaiMessages,
          tools: openaiTools,
          tool_choice: 'auto',
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const choice = data.choices[0];
      const message = choice?.message;

      // Parse tool calls if present
      let toolCalls: ToolCall[] | undefined;
      if (message?.tool_calls && message.tool_calls.length > 0) {
        toolCalls = message.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        }));
      }

      return {
        content: message?.content || '',
        toolCalls,
        finishReason: choice?.finish_reason === 'tool_calls' ? 'tool_calls' :
                     choice?.finish_reason === 'stop' ? 'stop' : 'length',
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    } catch (error) {
      console.error('OpenAI Provider error (with tools):', error);
      throw error;
    }
  }
}
