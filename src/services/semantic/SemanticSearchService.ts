import type { SQLiteDatabase } from 'expo-sqlite';
import * as SQLite from 'expo-sqlite';

/**
 * Semantic Search Result
 */
export interface SemanticSearchResult {
  root: string;
  similarity: number;
  hasContent?: boolean;
}

/**
 * Root Content Result with chunking support
 */
export interface RootContentResult {
  root: string;
  dictionaryName: string;
  content: string;
  isChunked: boolean;
  currentChunk?: number;
  totalChunks?: number;
  hasMoreChunks?: boolean;
}

const CHUNK_SIZE = 800; // Characters per chunk (reasonable for LLM context)
const TOP_N_RESULTS = 3; // Return top 3 matching roots

/**
 * Semantic Search Service
 * Handles vector search in spectrum data and root content retrieval
 */
export class SemanticSearchService {
  private db: SQLiteDatabase;
  private extensionLoaded = false;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  /**
   * Load sqlite-vec extension
   */
  async loadVectorExtension(): Promise<void> {
    if (this.extensionLoaded) {
      return;
    }

    try {
      // Load sqlite-vec from bundled extensions
      const extension = SQLite.bundledExtensions['sqlite-vec'];
      if (!extension) {
        throw new Error('sqlite-vec extension not found in bundled extensions');
      }

      await this.db.loadExtensionAsync(extension.libPath, extension.entryPoint);
      this.extensionLoaded = true;
      console.log('✓ sqlite-vec extension loaded');
    } catch (error) {
      console.error('Failed to load sqlite-vec extension:', error);
      throw error;
    }
  }

  /**
   * Search for roots by semantic meaning
   */
  async searchByMeaning(
    meaningQuery: string,
    embedding: number[]
  ): Promise<SemanticSearchResult[]> {
    await this.loadVectorExtension();

    try {
      // Query: Find top N similar vectors using cosine similarity
      // sqlite-vec uses vec_distance_cosine for cosine distance
      const query = `
        SELECT
          root,
          vec_distance_cosine(embedding, ?) as distance
        FROM spectrum_vectors
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
      `;

      // Convert embedding to format expected by sqlite-vec
      const embeddingBlob = new Float32Array(embedding).buffer;

      const results = await this.db.getAllAsync<{
        root: string;
        distance: number;
      }>(query, [embeddingBlob, embeddingBlob, TOP_N_RESULTS]);

      // Convert distance to similarity (1 - distance for cosine)
      return results.map((row) => ({
        root: row.root,
        similarity: 1 - row.distance,
        hasContent: true,
      }));
    } catch (error) {
      console.error('Error searching by meaning:', error);
      throw error;
    }
  }

  /**
   * Get root content with optional chunking
   */
  async getRootContent(
    root: string,
    chunkNumber?: number
  ): Promise<RootContentResult | null> {
    try {
      // Query: Get root definition from dictionary
      const query = `
        SELECT
          r.root,
          r.definition,
          d.name as dictionary_name
        FROM roots r
        INNER JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE r.root = ?
        LIMIT 1
      `;

      const result = await this.db.getFirstAsync<{
        root: string;
        definition: string;
        dictionary_name: string;
      }>(query, [root]);

      if (!result) {
        return null;
      }

      const fullContent = result.definition;
      const needsChunking = fullContent.length > CHUNK_SIZE;

      // If no chunking needed, return full content
      if (!needsChunking) {
        return {
          root: result.root,
          dictionaryName: result.dictionary_name,
          content: fullContent,
          isChunked: false,
        };
      }

      // Calculate chunks
      const totalChunks = Math.ceil(fullContent.length / CHUNK_SIZE);
      const requestedChunk = chunkNumber ?? 1;

      // Validate chunk number
      if (requestedChunk < 1 || requestedChunk > totalChunks) {
        throw new Error(`Invalid chunk number: ${requestedChunk}. Total chunks: ${totalChunks}`);
      }

      // Extract chunk
      const startIdx = (requestedChunk - 1) * CHUNK_SIZE;
      const endIdx = Math.min(startIdx + CHUNK_SIZE, fullContent.length);
      const chunk = fullContent.substring(startIdx, endIdx);

      return {
        root: result.root,
        dictionaryName: result.dictionary_name,
        content: chunk,
        isChunked: true,
        currentChunk: requestedChunk,
        totalChunks,
        hasMoreChunks: requestedChunk < totalChunks,
      };
    } catch (error) {
      console.error('Error getting root content:', error);
      throw error;
    }
  }

  /**
   * Format search results for LLM
   */
  formatSearchResults(results: SemanticSearchResult[]): string {
    if (results.length === 0) {
      return 'لم يتم العثور على أي جذور مطابقة للمعنى المطلوب.';
    }

    let formatted = `تم العثور على ${results.length} جذور قد تحتوي على المعنى المطلوب:\n\n`;

    results.forEach((result, idx) => {
      formatted += `${idx + 1}. الجذر: ${result.root} (تشابه: ${(result.similarity * 100).toFixed(1)}%)\n`;
    });

    formatted += '\nيمكنك الآن طلب محتوى أي جذر للتحقق من احتوائه على المعنى المطلوب.';

    return formatted;
  }

  /**
   * Format root content for LLM
   */
  formatRootContent(result: RootContentResult): string {
    let formatted = `## الجذر: ${result.root}\n`;
    formatted += `المعجم: ${result.dictionaryName}\n\n`;

    if (result.isChunked) {
      formatted += `**جزء ${result.currentChunk} من ${result.totalChunks}**\n\n`;
      formatted += result.content;

      if (result.hasMoreChunks) {
        formatted += `\n\n---\nملاحظة: هذا الجذر كبير. إذا لم تجد الإجابة هنا، يمكنك طلب الجزء التالي (${result.currentChunk! + 1}/${result.totalChunks}).`;
      }
    } else {
      formatted += result.content;
    }

    return formatted;
  }
}
