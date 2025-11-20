import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration: Add sources column to messages table
 *
 * This migration adds a sources column to store source references
 * (dictionary entries, web results, etc.) as JSON
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  console.log('Running migration 003: Add sources to messages table...');

  try {
    // Add sources column as TEXT (JSON)
    await db.execAsync(`
      ALTER TABLE messages
      ADD COLUMN sources TEXT;
    `);

    console.log('✓ Migration 003 completed: Added sources column');
  } catch (error: any) {
    if (error.message && error.message.includes('duplicate column name')) {
      console.log('⚠ Migration 003: sources column already exists, skipping');
      return;
    }
    throw error;
  }
}

/**
 * Rollback migration
 */
export async function down(db: SQLiteDatabase): Promise<void> {
  console.log('Rolling back migration 003: Remove sources column');

  // SQLite doesn't support DROP COLUMN directly, need to recreate table
  await db.execAsync(`
    CREATE TABLE messages_backup (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  await db.execAsync(`
    INSERT INTO messages_backup (id, conversation_id, role, content, timestamp)
    SELECT id, conversation_id, role, content, timestamp FROM messages;
  `);

  await db.execAsync('DROP TABLE messages;');
  await db.execAsync('ALTER TABLE messages_backup RENAME TO messages;');

  console.log('✓ Migration 003 rolled back');
}
