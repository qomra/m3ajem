import { ChatRepository } from '@services/database/ChatRepository';
import type { ChatContext, ContextType, ContextMetadata } from '@/types/chat';

/**
 * Context Manager
 * Handles context-related operations (definitions, roots, words)
 */
export class ContextManager {
  constructor(private repository: ChatRepository) {}

  /**
   * Create a context from a definition
   */
  async createDefinitionContext(
    conversationId: string,
    definition: string,
    root: string,
    dictionaryName: string
  ): Promise<ChatContext> {
    const context: ChatContext = {
      id: this.generateId(),
      conversation_id: conversationId,
      type: 'definition',
      content: definition,
      metadata: {
        root,
        dictionaryName,
      },
      created_at: Date.now(),
    };

    return await this.repository.createContext(context);
  }

  /**
   * Create a context from a root
   */
  async createRootContext(
    conversationId: string,
    root: string,
    dictionaryName: string
  ): Promise<ChatContext> {
    const context: ChatContext = {
      id: this.generateId(),
      conversation_id: conversationId,
      type: 'root',
      content: root,
      metadata: {
        root,
        dictionaryName,
      },
      created_at: Date.now(),
    };

    return await this.repository.createContext(context);
  }

  /**
   * Create a context from a word
   */
  async createWordContext(
    conversationId: string,
    word: string,
    root: string,
    dictionaryName: string
  ): Promise<ChatContext> {
    const context: ChatContext = {
      id: this.generateId(),
      conversation_id: conversationId,
      type: 'word',
      content: word,
      metadata: {
        word,
        root,
        dictionaryName,
      },
      created_at: Date.now(),
    };

    return await this.repository.createContext(context);
  }

  /**
   * Link a context to a message
   */
  async linkContextToMessage(messageId: string, contextId: string): Promise<void> {
    await this.repository.addContextToMessage(messageId, contextId);
  }

  /**
   * Get all contexts for a conversation
   */
  async getConversationContexts(conversationId: string): Promise<ChatContext[]> {
    return await this.repository.getContextsByConversation(conversationId);
  }

  /**
   * Get contexts for a specific message
   */
  async getMessageContexts(messageId: string): Promise<ChatContext[]> {
    return await this.repository.getContextsByMessage(messageId);
  }

  /**
   * Remove a context from a message
   */
  async unlinkContextFromMessage(messageId: string, contextId: string): Promise<void> {
    await this.repository.removeContextFromMessage(messageId, contextId);
  }

  /**
   * Delete a context
   */
  async deleteContext(contextId: string): Promise<void> {
    await this.repository.deleteContext(contextId);
  }

  /**
   * Delete all contexts for a conversation
   */
  async deleteConversationContexts(conversationId: string): Promise<void> {
    await this.repository.deleteContextsByConversation(conversationId);
  }

  /**
   * Generate a unique ID for context
   */
  private generateId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
