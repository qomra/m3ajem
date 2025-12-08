import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Word segment with context
 */
export interface WordSegment {
  word: string; // with diacritics
  position: number;
  context: string; // surrounding text
}

/**
 * Result from get_word_segments
 */
export interface WordSegmentsResult {
  root: string;
  dictionaryName: string;
  isFullDefinition: boolean;
  content: string; // full definition or formatted segments
  segments?: WordSegment[];
  totalLength: number;
}

/**
 * Service for fetching word segments (Tool 2)
 */
export class WordSegmentsService {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Remove Arabic diacritics
   */
  private removeDiacritics(text: string): string {
    return text.replace(/[\u064B-\u065F\u0670]/g, '');
  }

  /**
   * Get word segments or full definition
   * @param root - The root to fetch
   * @param dictionaryName - Dictionary name
   * @param words - Optional specific words to get context for
   * @param contextWords - Number of words of context, or "full" for entire definition
   */
  async getWordSegments(
    root: string,
    dictionaryName: string,
    words?: string[],
    contextWords: number | 'full' = 40
  ): Promise<WordSegmentsResult | null> {
    // Get the root definition
    let rootData = await this.getRootDefinition(root, dictionaryName);

    // If not found, try with swapped parameters (LLM sometimes confuses root/dictionary)
    if (!rootData) {
      const swappedData = await this.getRootDefinition(dictionaryName, root);
      if (swappedData) {
        console.log(`WordSegmentsService: Found with swapped params - root="${dictionaryName}" dict="${root}"`);
        rootData = swappedData;
      }
    }

    if (!rootData) {
      return null;
    }

    // If "full" or definition is short, return full definition
    if (contextWords === 'full' || rootData.definition.length < 1000) {
      return {
        root: rootData.root,
        dictionaryName: rootData.dictionaryName,
        isFullDefinition: true,
        content: rootData.definition,
        totalLength: rootData.definition.length,
      };
    }

    // Get segments around specific words or all indexed words
    const targetWords = words && words.length > 0
      ? words
      : await this.getIndexedWordsForRoot(rootData.rootId);

    if (targetWords.length === 0) {
      // No specific words, return truncated definition
      return {
        root: rootData.root,
        dictionaryName: rootData.dictionaryName,
        isFullDefinition: false,
        content: rootData.definition.substring(0, 2000) + '...',
        totalLength: rootData.definition.length,
      };
    }

    // Extract segments around each target word
    const segments = this.extractSegments(rootData.definition, targetWords, contextWords as number);

    // Format segments for output
    const formattedContent = this.formatSegments(segments, rootData.root);

    return {
      root: rootData.root,
      dictionaryName: rootData.dictionaryName,
      isFullDefinition: false,
      content: formattedContent,
      segments,
      totalLength: rootData.definition.length,
    };
  }

  /**
   * Format root with spaces: "كتب" → "ك ت ب"
   */
  private formatRootWithSpaces(root: string): string {
    return root.split('').join(' ');
  }

  /**
   * Format root with dashes: "كتب" → "ك - ت - ب"
   */
  private formatRootWithDashes(root: string): string {
    return root.split('').join(' - ');
  }

  /**
   * Get root definition from database with flexible matching
   * Tries multiple strategies: exact, partial, and format variations
   */
  private async getRootDefinition(
    root: string,
    dictionaryName: string
  ): Promise<{ rootId: number; root: string; dictionaryName: string; definition: string } | null> {
    const normalizedRoot = this.removeDiacritics(root);

    // Build search variations
    const searchVariations: string[] = [
      normalizedRoot,                              // exact as provided
      normalizedRoot.replace(/ /g, ''),            // remove spaces (for "ن م ذ ج" → "نمذج")
      this.formatRootWithSpaces(normalizedRoot.replace(/ /g, '')),  // add spaces
      this.formatRootWithDashes(normalizedRoot.replace(/ /g, '')),  // add dashes
    ];

    // Remove duplicates
    const uniqueVariations = [...new Set(searchVariations)];

    // Try exact match with each variation
    for (const variation of uniqueVariations) {
      const exactResult = await this.db.getAllAsync<{
        root_id: number;
        root: string;
        definition: string;
        dictionary_name: string;
      }>(
        `SELECT
          r.id as root_id,
          r.root,
          r.definition,
          d.name as dictionary_name
        FROM roots r
        INNER JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            r.root,
            char(1611), ''),
            char(1612), ''),
            char(1613), ''),
            char(1614), ''),
            char(1615), ''),
            char(1616), ''),
            char(1617), ''),
            char(1618), ''),
            char(1648), '')
          = ?
          AND d.name = ?
        LIMIT 1`,
        [variation, dictionaryName]
      );

      if (exactResult.length > 0) {
        const row = exactResult[0];
        return {
          rootId: row.root_id,
          root: row.root,
          dictionaryName: row.dictionary_name,
          definition: row.definition,
        };
      }
    }

    // Fallback: Try partial match (LIKE) with the base form
    const baseRoot = normalizedRoot.replace(/ /g, '').replace(/-/g, '');
    const partialResult = await this.db.getAllAsync<{
      root_id: number;
      root: string;
      definition: string;
      dictionary_name: string;
    }>(
      `SELECT
        r.id as root_id,
        r.root,
        r.definition,
        d.name as dictionary_name
      FROM roots r
      INNER JOIN dictionaries d ON r.dictionary_id = d.id
      WHERE
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          REPLACE(REPLACE(r.root, ' ', ''), '-', ''),
          char(1611), ''),
          char(1612), ''),
          char(1613), ''),
          char(1614), ''),
          char(1615), ''),
          char(1616), ''),
          char(1617), ''),
          char(1618), ''),
          char(1648), '')
        LIKE '%' || ? || '%'
        AND d.name = ?
      ORDER BY LENGTH(r.root)
      LIMIT 1`,
      [baseRoot, dictionaryName]
    );

    if (partialResult.length > 0) {
      const row = partialResult[0];
      console.log(`WordSegmentsService: Found via partial match: "${row.root}" for search "${root}"`);
      return {
        rootId: row.root_id,
        root: row.root,
        dictionaryName: row.dictionary_name,
        definition: row.definition,
      };
    }

    console.log(`WordSegmentsService: No match found for "${root}" in "${dictionaryName}"`);
    return null;
  }

  /**
   * Get indexed words for a root
   */
  private async getIndexedWordsForRoot(rootId: number): Promise<string[]> {
    const query = `
      SELECT DISTINCT word
      FROM words
      WHERE root_id = ?
      LIMIT 5
    `;

    const results = await this.db.getAllAsync<{ word: string }>(query, [rootId]);
    return results.map((r) => r.word);
  }

  /**
   * Extract segments around target words
   */
  private extractSegments(
    definition: string,
    targetWords: string[],
    contextWords: number
  ): WordSegment[] {
    const segments: WordSegment[] = [];
    const seenPositions = new Set<number>();

    for (const targetWord of targetWords) {
      const normalizedTarget = this.removeDiacritics(targetWord);

      // Find all positions of this word in the definition
      const positions = this.findWordPositions(definition, normalizedTarget);

      for (const pos of positions.slice(0, 3)) { // Max 3 occurrences per word
        // Avoid overlapping segments
        const nearbySegment = Array.from(seenPositions).some(
          (p) => Math.abs(p - pos) < contextWords * 5
        );
        if (nearbySegment) continue;

        seenPositions.add(pos);

        // Extract context around this position
        const context = this.extractContext(definition, pos, contextWords);
        const actualWord = this.extractActualWord(definition, pos, normalizedTarget.length);

        segments.push({
          word: actualWord,
          position: pos,
          context,
        });
      }
    }

    // Sort by position
    segments.sort((a, b) => a.position - b.position);

    return segments.slice(0, 5); // Max 5 total segments
  }

  /**
   * Find positions of a word in text (ignoring diacritics)
   */
  private findWordPositions(text: string, normalizedWord: string): number[] {
    const positions: number[] = [];
    const normalizedText = this.removeDiacritics(text);

    let pos = 0;
    while ((pos = normalizedText.indexOf(normalizedWord, pos)) !== -1) {
      // Map back to original position
      const originalPos = this.mapToOriginalPosition(text, pos);
      positions.push(originalPos);
      pos += normalizedWord.length;
    }

    return positions;
  }

  /**
   * Map normalized position back to original text position
   */
  private mapToOriginalPosition(text: string, normalizedPos: number): number {
    let normalizedCount = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const normalizedChar = this.removeDiacritics(char);
      if (normalizedChar) {
        if (normalizedCount === normalizedPos) {
          return i;
        }
        normalizedCount++;
      }
    }
    return text.length;
  }

  /**
   * Extract the actual word with diacritics at position
   */
  private extractActualWord(text: string, startPos: number, normalizedLength: number): string {
    let endPos = startPos;
    let normalizedCount = 0;

    while (endPos < text.length && normalizedCount < normalizedLength) {
      const char = text[endPos];
      const normalizedChar = this.removeDiacritics(char);
      if (normalizedChar) {
        normalizedCount++;
      }
      endPos++;
    }

    // Include trailing diacritics
    while (endPos < text.length && !this.removeDiacritics(text[endPos])) {
      endPos++;
    }

    return text.substring(startPos, endPos);
  }

  /**
   * Extract context around a position (in words)
   */
  private extractContext(text: string, position: number, contextWords: number): string {
    // Find word boundaries
    const words = text.split(/\s+/);
    let charCount = 0;
    let wordIndex = 0;

    // Find which word contains our position
    for (let i = 0; i < words.length; i++) {
      if (charCount + words[i].length >= position) {
        wordIndex = i;
        break;
      }
      charCount += words[i].length + 1; // +1 for space
    }

    // Get surrounding words
    const startWord = Math.max(0, wordIndex - contextWords);
    const endWord = Math.min(words.length, wordIndex + contextWords + 1);

    const contextParts = words.slice(startWord, endWord);
    let result = contextParts.join(' ');

    // Add ellipsis if truncated
    if (startWord > 0) {
      result = '...' + result;
    }
    if (endWord < words.length) {
      result = result + '...';
    }

    return result;
  }

  /**
   * Format segments for LLM output
   */
  private formatSegments(segments: WordSegment[], root: string): string {
    if (segments.length === 0) {
      return 'لم يتم العثور على مقتطفات';
    }

    let output = '';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      output += `\n[${i + 1}] **${seg.word}** (موضع: ${seg.position})\n`;
      output += `${seg.context}\n`;
    }

    return output;
  }

  /**
   * Format result for LLM
   */
  formatResultForLLM(result: WordSegmentsResult | null): string {
    if (!result) {
      return 'لم يتم العثور على الجذر في هذا المعجم';
    }

    let output = `## ${result.root} - ${result.dictionaryName}\n`;
    output += `الحجم الكلي: ${result.totalLength} حرف\n`;

    if (result.isFullDefinition) {
      output += `\n### التعريف الكامل:\n${result.content}\n`;
    } else {
      output += `\n### مقتطفات:\n${result.content}\n`;
    }

    return output;
  }
}
