import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration: Create spectrum vectors table (DICTIONARY DATABASE)
 *
 * This migration creates a virtual table for semantic search using sqlite-vec.
 * Note: This requires sqlite-vec extension, not available in Expo Go.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  console.log('Running dictionary migration 001: Creating spectrum vectors table...');

  try {
    await db.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS spectrum_vectors USING vec0(
        root TEXT PRIMARY KEY,
        embedding float[1536]
      );
    `);
    console.log('✓ Dictionary migration 001 completed: Spectrum vectors table created');
  } catch (error: any) {
    if (error.message && error.message.includes('no such module: vec0')) {
      console.log('⚠ Skipping dictionary migration 001: sqlite-vec extension not available');
      console.log('  Rebuild app with sqlite-vec support to enable semantic search');
      return;
    }
    throw error;
  }
}

/**
 * Rollback migration
 */
export async function down(db: SQLiteDatabase): Promise<void> {
  console.log('Rolling back dictionary migration 001: Drop spectrum vectors table');

  try {
    await db.execAsync('DROP TABLE IF EXISTS spectrum_vectors;');
    console.log('✓ Dictionary migration 001 rolled back');
  } catch (error: any) {
    // Ignore if table doesn't exist
    console.log('⚠ Spectrum vectors table not found, skipping rollback');
  }
}
