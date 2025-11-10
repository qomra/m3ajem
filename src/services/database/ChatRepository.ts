import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Conversation,
  Message,
  ChatContext,
  ConversationWithStats,
  MessageWithContexts,
} from '@/types/chat';
import type { APIProvider } from '@services/storage/apiKeyStorage';
import { ConversationRepository } from './repositories/ConversationRepository';
import { MessageRepository } from './repositories/MessageRepository';
import { ContextRepository } from './repositories/ContextRepository';

/**
 * ChatRepository - Main repository composing all chat-related repositories
 * Provides unified access to conversations, messages, and contexts
 */
export class ChatRepository {
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;
  private contextRepo: ContextRepository;

  constructor(private db: SQLiteDatabase) {
    this.conversationRepo = new ConversationRepository(db);
    this.messageRepo = new MessageRepository(db);
    this.contextRepo = new ContextRepository(db);
  }

  // ============================================================================
  // CONVERSATIONS
  // ============================================================================

  async createConversation(
    id: string,
    title: string,
    provider: APIProvider
  ): Promise<Conversation> {
    return this.conversationRepo.create(id, title, provider);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversationRepo.getById(id);
  }

  async getAllConversations(): Promise<ConversationWithStats[]> {
    return this.conversationRepo.getAllWithStats();
  }

  async touchConversation(id: string): Promise<void> {
    return this.conversationRepo.touch(id);
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    return this.conversationRepo.updateTitle(id, title);
  }

  async deleteConversation(id: string): Promise<void> {
    return this.conversationRepo.delete(id);
  }

  async deleteAllConversations(): Promise<void> {
    return this.conversationRepo.deleteAll();
  }

  // ============================================================================
  // MESSAGES
  // ============================================================================

  async createMessage(message: Message): Promise<Message> {
    const result = await this.messageRepo.create(message);
    await this.conversationRepo.touch(message.conversation_id);
    return result;
  }

  async getMessagesByConversation(conversationId: string): Promise<MessageWithContexts[]> {
    return this.messageRepo.getByConversation(conversationId);
  }

  async getMessage(id: string): Promise<Message | null> {
    return this.messageRepo.getById(id);
  }

  async deleteMessage(id: string): Promise<void> {
    return this.messageRepo.delete(id);
  }

  // ============================================================================
  // CONTEXTS
  // ============================================================================

  async createContext(context: ChatContext): Promise<ChatContext> {
    return this.contextRepo.create(context);
  }

  async addContextToMessage(messageId: string, contextId: string): Promise<void> {
    return this.contextRepo.linkToMessage(messageId, contextId);
  }

  async getContextsByConversation(conversationId: string): Promise<ChatContext[]> {
    return this.contextRepo.getByConversation(conversationId);
  }

  async getContextsByMessage(messageId: string): Promise<ChatContext[]> {
    return this.contextRepo.getByMessage(messageId);
  }

  async removeContextFromMessage(messageId: string, contextId: string): Promise<void> {
    return this.contextRepo.unlinkFromMessage(messageId, contextId);
  }

  async deleteContext(id: string): Promise<void> {
    return this.contextRepo.delete(id);
  }

  async deleteContextsByConversation(conversationId: string): Promise<void> {
    return this.contextRepo.deleteByConversation(conversationId);
  }
}
