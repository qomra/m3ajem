import type { AIProvider, AIResponse, AIStreamResponse } from './types';
import { GatewayAuthService } from '@services/auth/GatewayAuthService';
import { GATEWAY_URL } from '@/config/gateway';

/**
 * Gateway Provider
 * Routes requests through the M3ajem gateway server instead of directly to AI providers
 */
export class GatewayProvider implements AIProvider {
  public provider: string = 'gateway';
  public model: string = 'gpt-5'; // Server decides actual model

  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
    tools?: any[]
  ): Promise<AIResponse> {
    console.log('GatewayProvider: Getting token...');
    const token = await GatewayAuthService.getToken();
    console.log('GatewayProvider: Token retrieved:', token ? `${token.substring(0, 20)}...` : 'NULL');

    if (!token) {
      throw new Error('Not authenticated. Please sign in with Google or Apple.');
    }

    const response = await fetch(`${GATEWAY_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversation_id: `conv-${Date.now()}`,
        message: messages[messages.length - 1].content,
        messages,
        system_prompt: systemPrompt,
        tools,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired
        await GatewayAuthService.clearToken();
        throw new Error('Session expired. Please sign in again.');
      }
      if (response.status === 429) {
        throw new Error('Daily rate limit exceeded (30 requests/day). Try again tomorrow.');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Gateway request failed');
    }

    const data = await response.json();

    return {
      content: data.content,
      toolCalls: data.tool_calls || [],
      thoughts: data.thoughts || [],
      sources: data.sources || [],
    };
  }

  async *streamResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
    tools?: any[]
  ): AsyncGenerator<AIStreamResponse, void, unknown> {
    // Gateway doesn't support streaming yet
    // For now, just return the full response
    const response = await this.generateResponse(messages, systemPrompt, tools);

    yield {
      type: 'content',
      content: response.content,
    };
  }

  supportsStreaming(): boolean {
    return false; // Gateway doesn't support streaming yet
  }

  supportsThinking(): boolean {
    return true; // Gateway returns thoughts
  }

  async executeToolCall(toolCall: any, toolExecutor: any): Promise<string> {
    // Tool execution happens on the server
    // This shouldn't be called for gateway provider
    throw new Error('Tool execution should happen on the gateway server');
  }

  async sendMessageWithTools(
    messages: Array<{ role: string; content: string }>,
    tools: any[]
  ): Promise<AIResponse> {
    // Gateway provider handles tools on the server side
    // Just call generateResponse with tools
    return this.generateResponse(messages, undefined, tools);
  }
}
