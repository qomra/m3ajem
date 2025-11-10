import type { SQLiteDatabase } from 'expo-sqlite';
import type { Conversation, ConversationWithStats } from '@/types/chat';
import type { APIProvider } from '@services/storage/apiKeyStorage';

/**
 * Conversation Repository
 * Handles all conversation-related database operations
 */
export class ConversationRepository {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Create a new conversation
   */
  async create(id: string, title: string, provider: APIProvider): Promise<Conversation> {
    const now = Date.now();
    const conversation: Conversation = {
      id,
      title,
      provider,
      created_at: now,
      updated_at: now,
    };

    await this.db.runAsync(
      'INSERT INTO conversations (id, title, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [conversation.id, conversation.title, conversation.provider, conversation.created_at, conversation.updated_at]
    );

    return conversation;
  }

  /**
   * Get a conversation by ID
   */
  async getById(id: string): Promise<Conversation | null> {
    const row = await this.db.getFirstAsync<Conversation>(
      'SELECT * FROM conversations WHERE id = ?',
      [id]
    );

    return row || null;
  }

  /**
   * Get all conversations with stats
   */
  async getAllWithStats(): Promise<ConversationWithStats[]> {
    const rows = await this.db.getAllAsync<Conversation>(
      'SELECT * FROM conversations ORDER BY updated_at DESC'
    );

    const conversationsWithStats: ConversationWithStats[] = [];

    for (const conversation of rows) {
      const statsRow = await this.db.getFirstAsync<{
        message_count: number;
        last_message: string | null;
      }>(
        `SELECT
          COUNT(*) as message_count,
          (SELECT content FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 1) as last_message
        FROM messages
        WHERE conversation_id = ?`,
        [conversation.id, conversation.id]
      );

      conversationsWithStats.push({
        ...conversation,
        messageCount: statsRow?.message_count || 0,
        lastMessage: statsRow?.last_message || undefined,
      });
    }

    return conversationsWithStats;
  }

  /**
   * Update conversation's updated_at timestamp
   */
  async touch(id: string): Promise<void> {
    const now = Date.now();
    await this.db.runAsync('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, id]);
  }

  /**
   * Update conversation title
   */
  async updateTitle(id: string, title: string): Promise<void> {
    const now = Date.now();
    await this.db.runAsync(
      'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
      [title, now, id]
    );
  }

  /**
   * Delete a conversation
   */
  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM conversations WHERE id = ?', [id]);
  }

  /**
   * Delete all conversations
   */
  async deleteAll(): Promise<void> {
    await this.db.runAsync('DELETE FROM conversations');
  }
}
