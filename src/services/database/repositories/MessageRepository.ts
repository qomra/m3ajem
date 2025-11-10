import type { SQLiteDatabase } from 'expo-sqlite';
import type { Message, MessageWithContexts } from '@/types/chat';

/**
 * Message Repository
 * Handles all message-related database operations
 */
export class MessageRepository {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Create a new message
   */
  async create(message: Message): Promise<Message> {
    await this.db.runAsync(
      'INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      [message.id, message.conversation_id, message.role, message.content, message.timestamp]
    );

    return message;
  }

  /**
   * Get all messages for a conversation
   */
  async getByConversation(conversationId: string): Promise<MessageWithContexts[]> {
    const rows = await this.db.getAllAsync<Message>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
      [conversationId]
    );

    const messagesWithContexts: MessageWithContexts[] = [];

    for (const message of rows) {
      const contextRows = await this.db.getAllAsync<{ context_id: string }>(
        'SELECT context_id FROM message_contexts WHERE message_id = ?',
        [message.id]
      );

      messagesWithContexts.push({
        ...message,
        contextIds: contextRows.map(row => row.context_id),
      });
    }

    return messagesWithContexts;
  }

  /**
   * Get a message by ID
   */
  async getById(id: string): Promise<Message | null> {
    const row = await this.db.getFirstAsync<Message>(
      'SELECT * FROM messages WHERE id = ?',
      [id]
    );

    return row || null;
  }

  /**
   * Delete a message
   */
  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM messages WHERE id = ?', [id]);
  }
}
