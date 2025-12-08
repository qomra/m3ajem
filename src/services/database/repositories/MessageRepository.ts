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
  async create(message: MessageWithContexts): Promise<Message> {
    // Serialize sources as JSON if present
    const sourcesJson = message.sources ? JSON.stringify(message.sources) : null;

    // Serialize related sources as JSON if present (أنظر أيضاً)
    const relatedSourcesJson = message.relatedSources ? JSON.stringify(message.relatedSources) : null;

    // Serialize thoughts as JSON if present
    const thoughtsJson = message.thoughts ? JSON.stringify(message.thoughts) : null;

    // Duration (can be null)
    const duration = message.duration ?? null;

    await this.db.runAsync(
      'INSERT INTO messages (id, conversation_id, role, content, timestamp, sources, related_sources, thoughts, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [message.id, message.conversation_id, message.role, message.content, message.timestamp, sourcesJson, relatedSourcesJson, thoughtsJson, duration]
    );

    return message;
  }

  /**
   * Get all messages for a conversation
   */
  async getByConversation(conversationId: string): Promise<MessageWithContexts[]> {
    const rows = await this.db.getAllAsync<Message & { sources: string | null; related_sources: string | null; thoughts: string | null; duration: number | null }>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
      [conversationId]
    );

    const messagesWithContexts: MessageWithContexts[] = [];

    for (const message of rows) {
      const contextRows = await this.db.getAllAsync<{ context_id: string }>(
        'SELECT context_id FROM message_contexts WHERE message_id = ?',
        [message.id]
      );

      // Parse sources from JSON if present (المصادر)
      let sources = undefined;
      if (message.sources) {
        try {
          sources = JSON.parse(message.sources);
        } catch (error) {
          console.error('Error parsing sources JSON:', error);
          sources = undefined;
        }
      }

      // Parse related sources from JSON if present (أنظر أيضاً)
      let relatedSources = undefined;
      if (message.related_sources) {
        try {
          relatedSources = JSON.parse(message.related_sources);
        } catch (error) {
          console.error('Error parsing related_sources JSON:', error);
          relatedSources = undefined;
        }
      }

      // Parse thoughts from JSON if present
      let thoughts = undefined;
      if (message.thoughts) {
        try {
          thoughts = JSON.parse(message.thoughts);
        } catch (error) {
          console.error('Error parsing thoughts JSON:', error);
          thoughts = undefined;
        }
      }

      // Duration is already a number or null
      const duration = message.duration ?? undefined;

      messagesWithContexts.push({
        ...message,
        sources,
        relatedSources,
        thoughts,
        duration,
        contextIds: contextRows.map(row => row.context_id),
      });
    }

    return messagesWithContexts;
  }

  /**
   * Get a message by ID
   */
  async getById(id: string): Promise<MessageWithContexts | null> {
    const row = await this.db.getFirstAsync<Message & { sources: string | null; related_sources: string | null; thoughts: string | null; duration: number | null }>(
      'SELECT * FROM messages WHERE id = ?',
      [id]
    );

    if (!row) {
      return null;
    }

    // Parse sources from JSON if present (المصادر)
    let sources = undefined;
    if (row.sources) {
      try {
        sources = JSON.parse(row.sources);
      } catch (error) {
        console.error('Error parsing sources JSON:', error);
        sources = undefined;
      }
    }

    // Parse related sources from JSON if present (أنظر أيضاً)
    let relatedSources = undefined;
    if (row.related_sources) {
      try {
        relatedSources = JSON.parse(row.related_sources);
      } catch (error) {
        console.error('Error parsing related_sources JSON:', error);
        relatedSources = undefined;
      }
    }

    // Parse thoughts from JSON if present
    let thoughts = undefined;
    if (row.thoughts) {
      try {
        thoughts = JSON.parse(row.thoughts);
      } catch (error) {
        console.error('Error parsing thoughts JSON:', error);
        thoughts = undefined;
      }
    }

    // Duration is already a number or null
    const duration = row.duration ?? undefined;

    return {
      ...row,
      sources,
      relatedSources,
      thoughts,
      duration,
    };
  }

  /**
   * Delete a message
   */
  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM messages WHERE id = ?', [id]);
  }
}
