import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration: Add related_sources column to messages table
 *
 * This migration adds a related_sources column to store "أنظر أيضاً"
 * items that were found but not directly cited in the response
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  console.log('Running user migration 003: Add related_sources to messages table...');

  try {
    await db.execAsync(`
      ALTER TABLE messages
      ADD COLUMN related_sources TEXT;
    `);

    console.log('✓ User migration 003 completed: Added related_sources column');
  } catch (error: any) {
    if (error.message && error.message.includes('duplicate column name')) {
      console.log('⚠ User migration 003: related_sources column already exists, skipping');
      return;
    }
    throw error;
  }
}

/**
 * Rollback migration
 */
export async function down(db: SQLiteDatabase): Promise<void> {
  console.log('Rolling back user migration 003: Remove related_sources column');

  // SQLite doesn't support DROP COLUMN directly in older versions
  // For newer SQLite (3.35+) we can use DROP COLUMN
  try {
    await db.execAsync(`
      ALTER TABLE messages
      DROP COLUMN related_sources;
    `);
    console.log('✓ User migration 003 rolled back');
  } catch (error) {
    console.log('⚠ Could not drop column directly, column may remain');
  }
}
