import { ChatRepository } from '@services/database/ChatRepository';
import type { Conversation, ConversationWithStats } from '@/types/chat';
import type { APIProvider } from '@services/storage/apiKeyStorage';

/**
 * Conversation Manager
 * Handles conversation-related operations
 */
export class ConversationManager {
  constructor(private repository: ChatRepository) {}

  /**
   * Create a new conversation
   */
  async createConversation(title: string, provider: APIProvider): Promise<Conversation> {
    const id = this.generateId();
    return await this.repository.createConversation(id, title, provider);
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(id: string): Promise<Conversation | null> {
    return await this.repository.getConversation(id);
  }

  /**
   * Get all conversations with stats
   */
  async getAllConversations(): Promise<ConversationWithStats[]> {
    return await this.repository.getAllConversations();
  }

  /**
   * Update conversation title
   */
  async updateTitle(conversationId: string, title: string): Promise<void> {
    await this.repository.updateConversationTitle(conversationId, title);
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.repository.deleteConversation(conversationId);
  }

  /**
   * Delete all conversations
   */
  async deleteAllConversations(): Promise<void> {
    await this.repository.deleteAllConversations();
  }

  /**
   * Generate a conversation title from the first user message
   */
  generateTitle(firstMessage: string, maxLength: number = 50): string {
    // Clean and truncate the message
    const cleaned = firstMessage.trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    // Truncate and add ellipsis
    return cleaned.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate a unique ID for conversation
   */
  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
