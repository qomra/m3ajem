import type { SQLiteDatabase } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_KEY = '@m3ajem/chat_data_migrated_to_userdb';

/**
 * One-time migration to move chat data from dictionary.db to user.db
 *
 * This migration handles existing users who have chat data in the old single-database
 * architecture. It checks if conversations table exists in dictionary.db, and if so,
 * migrates all chat data to the new user.db.
 */
export class OneTimeChatMigration {
  /**
   * Check if migration has already been completed
   */
  static async isMigrationComplete(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(MIGRATION_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Mark migration as complete
   */
  static async markMigrationComplete(): Promise<void> {
    try {
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
      console.log('✓ Migration marked as complete');
    } catch (error) {
      console.error('Error marking migration complete:', error);
      throw error;
    }
  }

  /**
   * Check if dictionary.db has chat tables (old schema)
   */
  static async hasChatTablesInDictionaryDb(dictionaryDb: SQLiteDatabase): Promise<boolean> {
    try {
      const result = await dictionaryDb.getFirstAsync<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='table' AND name='conversations'
      `);

      return (result?.count ?? 0) > 0;
    } catch (error) {
      console.error('Error checking for chat tables:', error);
      return false;
    }
  }

  /**
   * Export chat data from dictionary.db
   */
  static async exportChatData(dictionaryDb: SQLiteDatabase): Promise<{
    conversations: any[];
    messages: any[];
    contexts: any[];
    messageContexts: any[];
  }> {
    console.log('Exporting chat data from dictionary.db...');

    try {
      // Export conversations
      const conversations = await dictionaryDb.getAllAsync(`
        SELECT * FROM conversations
      `);

      // Export messages
      const messages = await dictionaryDb.getAllAsync(`
        SELECT * FROM messages
      `);

      // Export contexts
      const contexts = await dictionaryDb.getAllAsync(`
        SELECT * FROM contexts
      `);

      // Export message_contexts
      const messageContexts = await dictionaryDb.getAllAsync(`
        SELECT * FROM message_contexts
      `);

      console.log(`Exported ${conversations.length} conversations, ${messages.length} messages, ${contexts.length} contexts`);

      return {
        conversations,
        messages,
        contexts,
        messageContexts,
      };
    } catch (error) {
      console.error('Error exporting chat data:', error);
      throw error;
    }
  }

  /**
   * Import chat data into user.db
   */
  static async importChatData(
    userDb: SQLiteDatabase,
    data: {
      conversations: any[];
      messages: any[];
      contexts: any[];
      messageContexts: any[];
    }
  ): Promise<void> {
    console.log('Importing chat data into user.db...');

    try {
      // Import conversations
      for (const conv of data.conversations) {
        await userDb.runAsync(
          `INSERT OR IGNORE INTO conversations (id, title, provider, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [conv.id, conv.title, conv.provider, conv.created_at, conv.updated_at]
        );
      }

      // Import messages
      for (const msg of data.messages) {
        await userDb.runAsync(
          `INSERT OR IGNORE INTO messages (id, conversation_id, role, content, timestamp, sources)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [msg.id, msg.conversation_id, msg.role, msg.content, msg.timestamp, msg.sources]
        );
      }

      // Import contexts
      for (const ctx of data.contexts) {
        await userDb.runAsync(
          `INSERT OR IGNORE INTO contexts (id, conversation_id, type, content, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [ctx.id, ctx.conversation_id, ctx.type, ctx.content, ctx.metadata, ctx.created_at]
        );
      }

      // Import message_contexts
      for (const mc of data.messageContexts) {
        await userDb.runAsync(
          `INSERT OR IGNORE INTO message_contexts (message_id, context_id)
           VALUES (?, ?)`,
          [mc.message_id, mc.context_id]
        );
      }

      console.log(`✓ Imported ${data.conversations.length} conversations with all related data`);
    } catch (error) {
      console.error('Error importing chat data:', error);
      throw error;
    }
  }

  /**
   * Run the one-time migration
   *
   * @param dictionaryDb The dictionary database connection
   * @param userDb The user database connection
   * @returns true if migration was performed, false if skipped
   */
  static async migrate(dictionaryDb: SQLiteDatabase, userDb: SQLiteDatabase): Promise<boolean> {
    try {
      // Check if migration already completed
      const isComplete = await this.isMigrationComplete();
      if (isComplete) {
        console.log('Chat data migration already completed, skipping');
        return false;
      }

      // Check if dictionary.db has chat tables
      const hasChatTables = await this.hasChatTablesInDictionaryDb(dictionaryDb);
      if (!hasChatTables) {
        console.log('No chat tables found in dictionary.db (fresh install), skipping migration');
        await this.markMigrationComplete();
        return false;
      }

      // Export chat data from dictionary.db
      console.log('🔄 Starting one-time chat data migration...');
      const chatData = await this.exportChatData(dictionaryDb);

      // Check if there's any data to migrate
      if (chatData.conversations.length === 0 && chatData.messages.length === 0) {
        console.log('No chat data to migrate, marking as complete');
        await this.markMigrationComplete();
        return false;
      }

      // Import chat data into user.db
      await this.importChatData(userDb, chatData);

      // Mark migration as complete
      await this.markMigrationComplete();

      console.log('✅ One-time chat data migration completed successfully!');
      return true;
    } catch (error) {
      console.error('❌ Error during one-time migration:', error);
      throw error;
    }
  }
}
