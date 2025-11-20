import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration: Add thoughts and duration columns to messages table
 *
 * Adds:
 * - thoughts: JSON-serialized array of AgentThought objects
 * - duration: Response duration in milliseconds
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  console.log('Running user migration 002: Add thoughts and duration columns');

  // Add thoughts column (stores JSON)
  await db.execAsync(`
    ALTER TABLE messages ADD COLUMN thoughts TEXT;
  `);

  // Add duration column (stores milliseconds as INTEGER)
  await db.execAsync(`
    ALTER TABLE messages ADD COLUMN duration INTEGER;
  `);

  console.log('✓ User migration 002 completed: Added thoughts and duration columns');
}

/**
 * Rollback migration
 */
export async function down(db: SQLiteDatabase): Promise<void> {
  console.log('Rolling back user migration 002: Remove thoughts and duration columns');

  // SQLite doesn't support DROP COLUMN directly
  // We would need to recreate the table without these columns
  // For now, we'll just log a warning
  console.warn('⚠️  SQLite does not support DROP COLUMN. Manual intervention required.');

  console.log('✓ User migration 002 rolled back (columns remain but unused)');
}
