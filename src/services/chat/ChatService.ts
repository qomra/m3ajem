import { ChatRepository } from '@services/database/ChatRepository';
import { ConversationManager } from './ConversationManager';
import { ContextManager } from './ContextManager';
import { ProviderFactory } from '@services/ai/ProviderFactory';
import { AgentRegistry } from '@/agents/AgentRegistry';
import type { Message, MessageWithContexts, ChatContext } from '@/types/chat';
import type { APIConfig } from '@services/storage/apiKeyStorage';
import type { BaseAgent } from '@/agents/BaseAgent';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Chat Service
 * Main service orchestrating all chat functionality
 */
export class ChatService {
  public conversationManager: ConversationManager;
  public contextManager: ContextManager;
  private repository: ChatRepository;
  private db: SQLiteDatabase;

  constructor(repository: ChatRepository, db: SQLiteDatabase) {
    this.repository = repository;
    this.db = db;
    this.conversationManager = new ConversationManager(repository);
    this.contextManager = new ContextManager(repository);
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(
    conversationId: string,
    userMessageContent: string,
    apiConfig: APIConfig,
    contextIds: string[] = [],
    onThoughtUpdate?: (thought: any) => void
  ): Promise<{ userMessage: Message; assistantMessage: MessageWithContexts }> {
    // 1. Create and save user message immediately
    const userMessage: Message = {
      id: this.generateMessageId(),
      conversation_id: conversationId,
      role: 'user',
      content: userMessageContent,
      timestamp: Date.now(),
    };

    await this.repository.createMessage(userMessage);

    // 2. Link contexts to user message if provided
    for (const contextId of contextIds) {
      await this.repository.addContextToMessage(userMessage.id, contextId);
    }

    try {
      // 3. Get message history
      const messageHistory = await this.repository.getMessagesByConversation(conversationId);

      // 4. Get contexts for this message
      const contexts = contextIds.length > 0
        ? await this.repository.getContextsByMessage(userMessage.id)
        : [];

      // 5. Create provider and agent (using dictionary tool agent)
      const provider = ProviderFactory.createProvider(apiConfig);
      const agent = AgentRegistry.getDictionaryAgent(provider, this.db);

      // 6. Process message with agent
      const response = await agent.processMessage({
        conversationId,
        userMessage: userMessageContent,
        messageHistory: messageHistory.slice(0, -1), // Exclude the just-added user message
        contexts,
        apiConfig, // Pass API config for semantic search tool
        onThoughtUpdate, // Pass through the thought streaming callback
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to get response from AI');
      }

      // 7. Create and save assistant message
      const assistantMessage: MessageWithContexts = {
        id: this.generateMessageId(),
        conversation_id: conversationId,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        sources: response.sources || [], // Attach sources from agent (المصادر)
        relatedSources: response.relatedSources || [], // Attach related sources (أنظر أيضاً)
        thoughts: response.thoughts, // Attach thoughts from agent (saved to DB)
        duration: response.duration, // Attach duration from agent (saved to DB)
      };

      await this.repository.createMessage(assistantMessage);

      console.log(
        `Saved assistant message with ${assistantMessage.sources?.length || 0} sources, ` +
        `${assistantMessage.relatedSources?.length || 0} related sources, ` +
        `${assistantMessage.thoughts?.length || 0} thoughts, ` +
        `duration: ${assistantMessage.duration}ms`
      );

      return { userMessage, assistantMessage };
    } catch (error) {
      console.error('ChatService: Error sending message:', error);

      // Extract readable error message
      let errorContent = '';
      if (error instanceof Error) {
        // Extract the meaningful part from provider errors
        // Format: "Provider API error: STATUS - MESSAGE"
        const match = error.message.match(/:\s*\d+\s*-\s*(.+)/);
        if (match && match[1]) {
          errorContent = match[1].trim();
        } else {
          errorContent = error.message;
        }
      } else {
        errorContent = String(error);
      }

      // Create error message
      const errorMessage: Message = {
        id: this.generateMessageId(),
        conversation_id: conversationId,
        role: 'assistant',
        content: `⚠️ ${errorContent}`,
        timestamp: Date.now(),
      };

      await this.repository.createMessage(errorMessage);

      return { userMessage, assistantMessage: errorMessage };
    }
  }

  /**
   * Get all messages for a conversation
   */
  async getConversationMessages(conversationId: string): Promise<MessageWithContexts[]> {
    return await this.repository.getMessagesByConversation(conversationId);
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.repository.deleteMessage(messageId);
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
