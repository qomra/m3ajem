import type { BaseProvider } from '@services/ai/BaseProvider';
import type { Message, ChatContext } from '@/types/chat';
import type { APIConfig } from '@services/storage/apiKeyStorage';
import type { Source } from '@/types/sources';

/**
 * Callback for streaming thoughts in real-time
 */
export type ThoughtCallback = (thought: AgentThought) => void;

/**
 * Request for processing a message
 */
export interface AgentRequest {
  conversationId: string;
  userMessage: string;
  messageHistory: Message[];
  contexts?: ChatContext[];
  apiConfig?: APIConfig; // Optional for agents that need API access (e.g., embeddings)
  onThoughtUpdate?: ThoughtCallback; // Optional callback for streaming thoughts
}

/**
 * Thought captured during tool calling
 */
export interface AgentThought {
  iteration: number;
  content: string; // LLM's explanation of what it's doing
  toolCalls: string[]; // Names of tools used in this iteration
  timestamp: number;
}

/**
 * Response from agent processing
 */
export interface AgentResponse {
  content: string;
  success: boolean;
  error?: string;
  sources?: Source[]; // Sources actually used/cited (المصادر)
  relatedSources?: Source[]; // Related sources not used (أنظر أيضاً)
  thoughts?: AgentThought[]; // LLM reasoning steps during tool calling
  duration?: number; // Total processing time in milliseconds
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
