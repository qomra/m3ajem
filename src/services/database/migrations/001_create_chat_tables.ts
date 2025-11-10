import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration: Create chat tables
 *
 * This migration creates the following tables:
 * - conversations: stores conversation metadata
 * - messages: stores individual chat messages
 * - contexts: stores context items (definitions, roots, words)
 * - message_contexts: junction table linking messages to contexts
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  console.log('Running migration 001: Create chat tables');

  // Create conversations table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      provider TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Create messages table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  // Create contexts table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS contexts (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('definition', 'root', 'word')),
      content TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  // Create message_contexts junction table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS message_contexts (
      message_id TEXT NOT NULL,
      context_id TEXT NOT NULL,
      PRIMARY KEY (message_id, context_id),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
    );
  `);

  // Create indexes for performance
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON messages(conversation_id);
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp
    ON messages(timestamp);
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_contexts_conversation_id
    ON contexts(conversation_id);
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
    ON conversations(updated_at DESC);
  `);

  console.log('✓ Migration 001 completed: Chat tables created');
}

/**
 * Rollback migration
 */
export async function down(db: SQLiteDatabase): Promise<void> {
  console.log('Rolling back migration 001: Drop chat tables');

  await db.execAsync('DROP TABLE IF EXISTS message_contexts;');
  await db.execAsync('DROP TABLE IF EXISTS contexts;');
  await db.execAsync('DROP TABLE IF EXISTS messages;');
  await db.execAsync('DROP TABLE IF EXISTS conversations;');

  console.log('✓ Migration 001 rolled back');
}
