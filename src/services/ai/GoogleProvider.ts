import { BaseProvider, ProviderMessage, ProviderResponse } from './BaseProvider';
import type { APIProvider } from '@services/storage/apiKeyStorage';
import type { Tool, ToolCall } from '@/agents/tools/types';

/**
 * Google Provider implementation
 * Supports Gemini 2.5 Pro model
 */
export class GoogleProvider extends BaseProvider {
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  getProviderType(): APIProvider {
    return 'google';
  }

  validateApiKey(): boolean {
    return this.apiKey.length > 20;
  }

  async sendMessage(messages: ProviderMessage[]): Promise<ProviderResponse> {
    if (!this.validateApiKey()) {
      throw new Error('Invalid Google API key format');
    }

    try {
      // Convert messages to Gemini format
      const contents = messages
        .filter(m => m.role !== 'system') // Gemini doesn't support system messages in the same way
        .map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));

      // Add system message as first user message if present
      const systemMessage = messages.find(m => m.role === 'system');
      if (systemMessage) {
        contents.unshift({
          role: 'user',
          parts: [{ text: `System instructions: ${systemMessage.content}` }],
        });
      }

      const url = `${this.apiUrl}/${this.model}:generateContent?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: this.temperature,
            maxOutputTokens: this.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Google API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();

      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text || '';

      return {
        content,
        finishReason: candidate?.finishReason === 'STOP' ? 'stop' : 'length',
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        },
      };
    } catch (error) {
      console.error('Google Provider error:', error);
      throw error;
    }
  }

  async sendMessageWithTools(messages: ProviderMessage[], tools: Tool[]): Promise<ProviderResponse> {
    if (!this.validateApiKey()) {
      throw new Error('Invalid Google API key format');
    }

    try {
      // Convert messages to Gemini format
      const contents: any[] = [];
      const systemMessage = messages.find(m => m.role === 'system');

      // Add system message as first user message if present
      if (systemMessage) {
        contents.push({
          role: 'user',
          parts: [{ text: `System instructions: ${systemMessage.content}` }],
        });
      }

      // Process regular messages
      messages
        .filter(m => m.role !== 'system')
        .forEach(msg => {
          if (msg.role === 'tool') {
            // Function response message
            contents.push({
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    name: msg.tool_call_id, // Use as name reference
                    response: { result: msg.content },
                  },
                },
              ],
            });
          } else if (msg.role === 'assistant' && msg.tool_calls) {
            // Assistant message with function calls
            const parts: any[] = [];
            if (msg.content) {
              parts.push({ text: msg.content });
            }
            msg.tool_calls.forEach(tc => {
              parts.push({
                functionCall: {
                  name: tc.name,
                  args: tc.arguments,
                },
              });
            });
            contents.push({
              role: 'model',
              parts,
            });
          } else {
            // Regular message
            contents.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }],
            });
          }
        });

      // Convert tools to Gemini format
      const geminiTools = [
        {
          functionDeclarations: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      ];

      const url = `${this.apiUrl}/${this.model}:generateContent?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          tools: geminiTools,
          generationConfig: {
            temperature: this.temperature,
            maxOutputTokens: this.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Google API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];

      // Parse response
      let content = '';
      let toolCalls: ToolCall[] | undefined;

      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            content += part.text;
          } else if (part.functionCall) {
            if (!toolCalls) toolCalls = [];
            toolCalls.push({
              id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, // Generate ID
              name: part.functionCall.name,
              arguments: part.functionCall.args,
            });
          }
        }
      }

      return {
        content,
        toolCalls,
        finishReason: candidate?.finishReason === 'STOP' ? 'stop' :
                     toolCalls ? 'tool_calls' : 'length',
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        },
      };
    } catch (error) {
      console.error('Google Provider error (with tools):', error);
      throw error;
    }
  }
}
