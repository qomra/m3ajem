import type { APIProvider } from '@services/storage/apiKeyStorage';
import type { Tool, ToolCall } from '@/agents/tools/types';

/**
 * Message format for AI providers
 */
export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string; // For tool result messages
  tool_calls?: ToolCall[]; // For assistant messages with tool calls
}

/**
 * Response from AI provider
 */
export interface ProviderResponse {
  content: string;
  toolCalls?: ToolCall[]; // Tool calls requested by the model
  finishReason?: 'stop' | 'length' | 'error' | 'tool_calls';
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Configuration for provider requests
 */
export interface ProviderConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Base abstract class for AI providers
 * Each provider (OpenAI, Anthropic, etc.) extends this class
 */
export abstract class BaseProvider {
  protected apiKey: string;
  protected model: string;
  protected temperature: number;
  protected maxTokens: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4000;
  }

  /**
   * Get provider type
   */
  abstract getProviderType(): APIProvider;

  /**
   * Send messages to the AI provider and get a response
   */
  abstract sendMessage(messages: ProviderMessage[]): Promise<ProviderResponse>;

  /**
   * Send messages with tool definitions (for function calling)
   * @param messages - Conversation messages
   * @param tools - Available tools/functions
   * @returns Response with potential tool calls
   */
  abstract sendMessageWithTools(
    messages: ProviderMessage[],
    tools: Tool[]
  ): Promise<ProviderResponse>;

  /**
   * Validate API key format
   */
  abstract validateApiKey(): boolean;

  /**
   * Get model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProviderConfig>): void {
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.model !== undefined) this.model = config.model;
    if (config.temperature !== undefined) this.temperature = config.temperature;
    if (config.maxTokens !== undefined) this.maxTokens = config.maxTokens;
  }
}
