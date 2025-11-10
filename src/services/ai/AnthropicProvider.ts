import { BaseProvider, ProviderMessage, ProviderResponse } from './BaseProvider';
import type { APIProvider } from '@services/storage/apiKeyStorage';
import type { Tool, ToolCall } from '@/agents/tools/types';

/**
 * Anthropic Provider implementation
 * Supports Claude Sonnet 4.5 model
 */
export class AnthropicProvider extends BaseProvider {
  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';
  private readonly apiVersion = '2023-06-01';

  getProviderType(): APIProvider {
    return 'anthropic';
  }

  validateApiKey(): boolean {
    return this.apiKey.startsWith('sk-ant-');
  }

  async sendMessage(messages: ProviderMessage[]): Promise<ProviderResponse> {
    if (!this.validateApiKey()) {
      throw new Error('Invalid Anthropic API key format');
    }

    try {
      // Anthropic requires system messages to be separate
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model: this.model,
          messages: conversationMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          system: systemMessage?.content,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Anthropic API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();

      return {
        content: data.content[0]?.text || '',
        finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
        usage: {
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (error) {
      console.error('Anthropic Provider error:', error);
      throw error;
    }
  }

  async sendMessageWithTools(messages: ProviderMessage[], tools: Tool[]): Promise<ProviderResponse> {
    if (!this.validateApiKey()) {
      throw new Error('Invalid Anthropic API key format');
    }

    try {
      // Anthropic requires system messages to be separate
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      // Convert messages to Anthropic format
      const claudeMessages = conversationMessages.map(msg => {
        if (msg.role === 'tool') {
          // Tool result message
          return {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: msg.tool_call_id,
                content: msg.content,
              },
            ],
          };
        } else if (msg.role === 'assistant' && msg.tool_calls) {
          // Assistant message with tool calls
          const contentBlocks: any[] = [];
          if (msg.content) {
            contentBlocks.push({ type: 'text', text: msg.content });
          }
          msg.tool_calls.forEach(tc => {
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          });
          return {
            role: 'assistant',
            content: contentBlocks,
          };
        } else {
          // Regular message
          return {
            role: msg.role,
            content: msg.content,
          };
        }
      });

      // Convert tools to Anthropic format (uses input_schema instead of parameters)
      const claudeTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model: this.model,
          messages: claudeMessages,
          tools: claudeTools,
          system: systemMessage?.content,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Anthropic API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();

      // Parse response content
      let content = '';
      let toolCalls: ToolCall[] | undefined;

      if (data.content && Array.isArray(data.content)) {
        for (const block of data.content) {
          if (block.type === 'text') {
            content += block.text;
          } else if (block.type === 'tool_use') {
            if (!toolCalls) toolCalls = [];
            toolCalls.push({
              id: block.id,
              name: block.name,
              arguments: block.input,
            });
          }
        }
      }

      return {
        content,
        toolCalls,
        finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' :
                     data.stop_reason === 'end_turn' ? 'stop' : 'length',
        usage: {
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (error) {
      console.error('Anthropic Provider error (with tools):', error);
      throw error;
    }
  }
}
