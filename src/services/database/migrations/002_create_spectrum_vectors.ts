import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration 002: Create spectrum vectors table
 * Creates virtual table for vector search using sqlite-vec extension
 */

export async function up(db: SQLiteDatabase): Promise<void> {
  console.log('Running migration 002: Creating spectrum vectors table...');

  try {
    // Create virtual table for vector embeddings
    // Using text-embedding-3-small which has 1536 dimensions
    // Note: This requires sqlite-vec extension (app must be rebuilt with it)
    await db.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS spectrum_vectors USING vec0(
        root TEXT PRIMARY KEY,
        embedding float[1536]
      );
    `);

    console.log('✓ Spectrum vectors table created');
  } catch (error: any) {
    // If vec0 extension is not available, skip this migration
    // User needs to rebuild the app with sqlite-vec support
    if (error.message && error.message.includes('no such module: vec0')) {
      console.log('⚠ Skipping migration 002: sqlite-vec extension not available');
      console.log('  Rebuild app with sqlite-vec support to enable semantic search');
      return;
    }
    // Re-throw other errors
    throw error;
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  console.log('Rolling back migration 002...');

  await db.execAsync(`
    DROP TABLE IF EXISTS spectrum_vectors;
  `);

  console.log('✓ Migration 002 rolled back');
}
