import type { SQLiteDatabase } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { ResourceManager, ResourceType } from '@services/resources/ResourceManager';

const EMBEDDINGS_LOADED_KEY = '@m3ajem/embeddings_loaded';

/**
 * Embedding Loader Service
 * Loads pre-generated embeddings from bundled JSON file into database
 */
export class EmbeddingLoader {
  /**
   * Check if embeddings are already loaded
   */
  static async isLoaded(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(EMBEDDINGS_LOADED_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Error checking embeddings loaded status:', error);
      return false;
    }
  }

  /**
   * Mark embeddings as loaded
   */
  static async markAsLoaded(): Promise<void> {
    await AsyncStorage.setItem(EMBEDDINGS_LOADED_KEY, 'true');
  }

  /**
   * Parse compressed binary embeddings file
   */
  private static async parseCompressedBinary(uri: string): Promise<{
    roots: Array<{ root: string; embedding: number[] }>;
    dimensions: number;
  }> {
    // Read and decompress
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decompress using pako
    const pako = require('pako');
    const decompressed = pako.inflate(bytes);

    // Parse binary format
    const view = new DataView(decompressed.buffer);
    let offset = 0;

    // Read header
    const magic = String.fromCharCode(
      view.getUint8(offset++),
      view.getUint8(offset++),
      view.getUint8(offset++),
      view.getUint8(offset++)
    );
    if (magic !== 'SPEC') {
      throw new Error('Invalid embeddings file format');
    }

    const version = view.getUint32(offset, true);
    offset += 4;
    const dimensions = view.getUint32(offset, true);
    offset += 4;
    const count = view.getUint32(offset, true);
    offset += 4;

    console.log(`Binary format v${version}, ${dimensions}D, ${count} roots`);

    // Read roots
    const roots: Array<{ root: string; embedding: number[] }> = [];

    for (let i = 0; i < count; i++) {
      // Read root string
      const rootLength = view.getUint16(offset, true);
      offset += 2;

      const rootBytes = new Uint8Array(decompressed.buffer, offset, rootLength);
      const root = new TextDecoder('utf-8').decode(rootBytes);
      offset += rootLength;

      // Read embedding
      const embedding: number[] = [];
      for (let j = 0; j < dimensions; j++) {
        embedding.push(view.getFloat32(offset, true));
        offset += 4;
      }

      roots.push({ root, embedding });

      if ((i + 1) % 1000 === 0) {
        console.log(`  Parsed ${i + 1}/${count} embeddings...`);
      }
    }

    return { roots, dimensions };
  }

  /**
   * Load embeddings from downloaded resource file into database
   */
  static async loadEmbeddings(db: SQLiteDatabase): Promise<void> {
    try {
      console.log('Loading spectrum embeddings into database...');

      // Check if already loaded
      const alreadyLoaded = await this.isLoaded();
      if (alreadyLoaded) {
        console.log('✓ Embeddings already loaded, skipping');
        return;
      }

      // Check if resource is downloaded
      const isDownloaded = await ResourceManager.isDownloaded(ResourceType.SEMANTIC_EMBEDDINGS);
      if (!isDownloaded) {
        console.log('⚠ Semantic embeddings resource not downloaded');
        console.log('  User must download from Resources section first');
        return;
      }

      // Get resource path
      const resourcePath = ResourceManager.getResourcePath(ResourceType.SEMANTIC_EMBEDDINGS);
      console.log(`Reading embeddings from: ${resourcePath}`);

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(resourcePath);
      if (!fileInfo.exists) {
        console.error('✗ Embeddings file not found at expected path');
        return;
      }

      // Parse the binary file
      console.log('Decompressing and parsing embeddings...');
      const data = await this.parseCompressedBinary(resourcePath);

      console.log(`Loaded ${data.roots.length} embeddings from file`);
      console.log(`Dimensions: ${data.dimensions}`);

      // Clear any existing embeddings
      console.log('Clearing existing embeddings...');
      await db.execAsync('DELETE FROM spectrum_vectors');

      // Insert embeddings in batches
      const BATCH_SIZE = 50;
      let inserted = 0;

      for (let i = 0; i < data.roots.length; i += BATCH_SIZE) {
        const batch = data.roots.slice(i, i + BATCH_SIZE);

        // Build batch insert
        const values = batch
          .map((entry: any) => {
            const root = entry.root.replace(/'/g, "''"); // Escape single quotes
            const embedding = JSON.stringify(entry.embedding);
            return `('${root}', '${embedding}')`;
          })
          .join(',');

        await db.execAsync(`
          INSERT INTO spectrum_vectors (root, embedding)
          VALUES ${values}
        `);

        inserted += batch.length;
        if (inserted % 500 === 0) {
          console.log(`  Inserted ${inserted}/${data.roots.length}...`);
        }
      }

      console.log(`✓ Successfully inserted ${inserted} embeddings`);

      // Mark as loaded
      await this.markAsLoaded();

      console.log('✓ Embeddings loaded successfully!');
    } catch (error) {
      console.error('Error loading embeddings:', error);
      throw error;
    }
  }

  /**
   * Verify embeddings count in database
   */
  static async verifyEmbeddings(db: SQLiteDatabase): Promise<number> {
    try {
      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM spectrum_vectors'
      );
      return result?.count || 0;
    } catch (error) {
      console.error('Error verifying embeddings:', error);
      return 0;
    }
  }

  /**
   * Force reload embeddings (for development/testing)
   */
  static async forceReload(db: SQLiteDatabase): Promise<void> {
    await AsyncStorage.removeItem(EMBEDDINGS_LOADED_KEY);
    await this.loadEmbeddings(db);
  }
}
