import type { SQLiteDatabase } from 'expo-sqlite';
import type { ChatContext, ContextMetadata } from '@/types/chat';

/**
 * Context Repository
 * Handles all context-related database operations
 */
export class ContextRepository {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Create a new context
   */
  async create(context: ChatContext): Promise<ChatContext> {
    await this.db.runAsync(
      'INSERT INTO contexts (id, conversation_id, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        context.id,
        context.conversation_id,
        context.type,
        context.content,
        JSON.stringify(context.metadata),
        context.created_at,
      ]
    );

    return context;
  }

  /**
   * Link a context to a message
   */
  async linkToMessage(messageId: string, contextId: string): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO message_contexts (message_id, context_id) VALUES (?, ?)',
      [messageId, contextId]
    );
  }

  /**
   * Get all contexts for a conversation
   */
  async getByConversation(conversationId: string): Promise<ChatContext[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      conversation_id: string;
      type: string;
      content: string;
      metadata: string;
      created_at: number;
    }>(
      'SELECT * FROM contexts WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );

    return rows.map(row => ({
      ...row,
      type: row.type as ChatContext['type'],
      metadata: JSON.parse(row.metadata) as ContextMetadata,
    }));
  }

  /**
   * Get contexts for a specific message
   */
  async getByMessage(messageId: string): Promise<ChatContext[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      conversation_id: string;
      type: string;
      content: string;
      metadata: string;
      created_at: number;
    }>(
      `SELECT c.*
       FROM contexts c
       JOIN message_contexts mc ON c.id = mc.context_id
       WHERE mc.message_id = ?
       ORDER BY c.created_at ASC`,
      [messageId]
    );

    return rows.map(row => ({
      ...row,
      type: row.type as ChatContext['type'],
      metadata: JSON.parse(row.metadata) as ContextMetadata,
    }));
  }

  /**
   * Remove a context from a message
   */
  async unlinkFromMessage(messageId: string, contextId: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM message_contexts WHERE message_id = ? AND context_id = ?',
      [messageId, contextId]
    );
  }

  /**
   * Delete a context
   */
  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM contexts WHERE id = ?', [id]);
  }

  /**
   * Delete all contexts for a conversation
   */
  async deleteByConversation(conversationId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM contexts WHERE conversation_id = ?', [conversationId]);
  }
}
