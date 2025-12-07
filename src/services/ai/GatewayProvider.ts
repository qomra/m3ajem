import type { AIProvider, AIResponse, AIStreamResponse } from './types';
import { GatewayAuthService } from '@services/auth/GatewayAuthService';
import { GATEWAY_URL } from '@/config/gateway';

/**
 * Gateway Provider (Singleton)
 * Routes requests through the M3ajem gateway server instead of directly to AI providers
 * Uses singleton to maintain conversation ID across requests
 */
class GatewayProviderClass implements AIProvider {
  public provider: string = 'gateway';
  public model: string = 'gpt-5'; // Server decides actual model
  private conversationId: string | null = null;

  /**
   * Set the conversation ID for subsequent requests
   */
  setConversationId(id: string) {
    console.log('GatewayProvider: Setting conversation ID:', id);
    this.conversationId = id;
  }

  /**
   * Get or create a conversation ID
   */
  getConversationId(): string {
    if (!this.conversationId) {
      this.conversationId = `conv-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      console.log('GatewayProvider: Created new conversation ID:', this.conversationId);
    }
    return this.conversationId;
  }

  /**
   * Reset conversation ID (for starting new conversations)
   */
  resetConversationId() {
    console.log('GatewayProvider: Resetting conversation ID');
    this.conversationId = null;
  }

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

    const conversationId = this.getConversationId();
    console.log('GatewayProvider: Using conversation ID:', conversationId);

    const response = await fetch(`${GATEWAY_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
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
        throw new Error('Daily rate limit exceeded. Try again tomorrow.');
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
    // Execute tools locally (client-side) just like other providers
    // The server only forwards requests to OpenAI, it doesn't execute tools
    return await toolExecutor.executeToolCall(toolCall);
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

// Singleton instance
export const GatewayProvider = new GatewayProviderClass();

// For backward compatibility with ProviderFactory
export class GatewayProviderFactory {
  static getInstance(): GatewayProviderClass {
    return GatewayProvider;
  }
}
