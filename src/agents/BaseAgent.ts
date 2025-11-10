import type { BaseProvider } from '@services/ai/BaseProvider';
import type { Message, ChatContext } from '@/types/chat';

/**
 * Request for processing a message
 */
export interface AgentRequest {
  conversationId: string;
  userMessage: string;
  messageHistory: Message[];
  contexts?: ChatContext[];
}

/**
 * Response from agent processing
 */
export interface AgentResponse {
  content: string;
  success: boolean;
  error?: string;
}

/**
 * Base abstract class for chat agents
 * Agents handle the logic of processing user messages and generating responses
 */
export abstract class BaseAgent {
  protected provider: BaseProvider;

  constructor(provider: BaseProvider) {
    this.provider = provider;
  }

  /**
   * Get agent name
   */
  abstract getName(): string;

  /**
   * Get agent description
   */
  abstract getDescription(): string;

  /**
   * Process a user message and generate a response
   */
  abstract processMessage(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Update the provider instance
   */
  updateProvider(provider: BaseProvider): void {
    this.provider = provider;
  }

  /**
   * Get the current provider
   */
  getProvider(): BaseProvider {
    return this.provider;
  }
}
