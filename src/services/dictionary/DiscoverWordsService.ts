import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Indexed word match (direct scroll available)
 */
export interface IndexedWordMatch {
  word: string; // with diacritics
  dictionaryId: number;
  dictionaryName: string;
  root: string;
  rootId: number;
}

/**
 * Root match in a dictionary
 */
export interface RootMatch {
  root: string;
  rootId: number;
  dictionaryId: number;
  dictionaryName: string;
  definitionLength: number;
  indexedWords: string[]; // words indexed under this root
  matchType: 'exact' | 'root' | 'format'; // how was it matched
}

/**
 * Moraqman (digitized) dictionary match
 */
export interface MoraqmanMatch {
  root: string;
  rootId: number;
  dictionaryId: number;
  dictionaryName: string;
  definitionLength: number;
}

/**
 * Discovery result for a single word
 */
export interface WordDiscoveryResult {
  searchWord: string;
  searchRoot?: string; // LLM-provided root
  exactMatch: boolean;
  indexedMatches: IndexedWordMatch[];
  rootMatches: RootMatch[];
  moraqmanMatches: MoraqmanMatch[]; // Matches in digitized dictionaries
}

/**
 * Service for discovering words across dictionaries (Tool 1)
 * Enhanced with root-based search and format variations
 */
export class DiscoverWordsService {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Remove Arabic diacritics for normalized searching
   */
  private removeDiacritics(text: string): string {
    return text.replace(/[\u064B-\u065F\u0670]/g, '');
  }

  /**
   * Format root with spaces between letters: "كتب" → "ك ت ب"
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
   * Format root with brackets: "كتب" → "[ك ت ب]"
   */
  private formatRootBracketed(root: string): string {
    return `[${this.formatRootWithSpaces(root)}]`;
  }

  /**
   * Discover a single word across all dictionaries
   * @param word - The word as user mentioned it
   * @param root - Optional LLM-extracted root for better search
   */
  async discoverWord(word: string, root?: string): Promise<WordDiscoveryResult> {
    const normalizedWord = this.removeDiacritics(word);
    const normalizedRoot = root ? this.removeDiacritics(root) : undefined;

    // 1. Find indexed word matches (exact match in words table)
    const indexedMatches = await this.findIndexedMatches(normalizedWord);

    // 2. Find root matches across lo3awi dictionaries
    // Search by both word and provided root
    const rootMatches = await this.findRootMatchesEnhanced(normalizedWord, normalizedRoot);

    // 3. Find matches in moraqman (digitized) dictionaries using partial matching
    const moraqmanMatches = await this.findMoraqmanMatches(normalizedWord, normalizedRoot);

    // Determine if exact match was found
    const exactMatch = indexedMatches.length > 0 ||
      rootMatches.some((rm) => rm.matchType === 'exact');

    return {
      searchWord: word,
      searchRoot: root,
      exactMatch,
      indexedMatches,
      rootMatches,
      moraqmanMatches,
    };
  }

  /**
   * Find indexed word matches (words table)
   * Searches for word with and without ال prefix
   */
  private async findIndexedMatches(normalizedWord: string): Promise<IndexedWordMatch[]> {
    // Build search variants: word, word without ال, word with ال
    const searchVariants: string[] = [normalizedWord];
    if (normalizedWord.startsWith('ال')) {
      searchVariants.push(normalizedWord.substring(2));
    } else {
      searchVariants.push('ال' + normalizedWord);
    }

    const placeholders = searchVariants.map(() => '?').join(', ');
    const query = `
      SELECT DISTINCT
        w.word,
        r.id as root_id,
        r.root,
        d.id as dictionary_id,
        d.name as dictionary_name
      FROM words w
      INNER JOIN roots r ON w.root_id = r.id
      INNER JOIN dictionaries d ON r.dictionary_id = d.id
      WHERE
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          w.word,
          char(1611), ''),
          char(1612), ''),
          char(1613), ''),
          char(1614), ''),
          char(1615), ''),
          char(1616), ''),
          char(1617), ''),
          char(1618), ''),
          char(1648), '')
        IN (${placeholders})
      LIMIT 20
    `;

    const results = await this.db.getAllAsync<{
      word: string;
      root_id: number;
      root: string;
      dictionary_id: number;
      dictionary_name: string;
    }>(query, searchVariants);

    return results.map((row) => ({
      word: row.word,
      rootId: row.root_id,
      root: row.root,
      dictionaryId: row.dictionary_id,
      dictionaryName: row.dictionary_name,
    }));
  }

  /**
   * Enhanced root matching with multiple search strategies
   * Searches by word, provided root, and various root formats
   */
  private async findRootMatchesEnhanced(
    normalizedWord: string,
    normalizedRoot?: string
  ): Promise<RootMatch[]> {
    const allMatches: RootMatch[] = [];
    const seenRootIds = new Set<number>();

    // Build search keys with different patterns
    const searchKeys: Array<{ key: string; type: 'exact' | 'root' | 'format' }> = [];

    // 1. Search by the word itself
    searchKeys.push({ key: normalizedWord, type: 'exact' });

    // Try word without ال prefix
    if (normalizedWord.startsWith('ال')) {
      searchKeys.push({ key: normalizedWord.substring(2), type: 'exact' });
    }

    // Try word WITH ال prefix (for entries stored with definite article like النَّمُوذَجُ)
    if (!normalizedWord.startsWith('ال')) {
      searchKeys.push({ key: 'ال' + normalizedWord, type: 'exact' });
    }

    // 2. If root provided, search by root and its formats
    if (normalizedRoot) {
      searchKeys.push({ key: normalizedRoot, type: 'root' });
      searchKeys.push({ key: this.formatRootWithSpaces(normalizedRoot), type: 'format' });
      searchKeys.push({ key: this.formatRootWithDashes(normalizedRoot), type: 'format' });
      searchKeys.push({ key: this.formatRootBracketed(normalizedRoot), type: 'format' });

      // Try root without ال if present
      if (normalizedRoot.startsWith('ال')) {
        searchKeys.push({ key: normalizedRoot.substring(2), type: 'root' });
      }

      // Try root WITH ال prefix (for entries stored with definite article)
      if (!normalizedRoot.startsWith('ال')) {
        searchKeys.push({ key: 'ال' + normalizedRoot, type: 'root' });
      }
    }

    // Search for each key
    for (const { key, type } of searchKeys) {
      const results = await this.db.getAllAsync<{
        root_id: number;
        root: string;
        dictionary_id: number;
        dictionary_name: string;
        definition_length: number;
      }>(
        `SELECT
          r.id as root_id,
          r.root,
          r.dictionary_id,
          d.name as dictionary_name,
          LENGTH(r.definition) as definition_length
        FROM roots r
        INNER JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE d.type = 'lo3awi' AND
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
        ORDER BY d.id
        LIMIT 20`,
        [key]
      );

      for (const row of results) {
        // Skip if already seen this root
        if (seenRootIds.has(row.root_id)) {
          continue;
        }
        seenRootIds.add(row.root_id);

        const indexedWords = await this.getIndexedWordsForRoot(row.root_id);

        allMatches.push({
          root: row.root,
          rootId: row.root_id,
          dictionaryId: row.dictionary_id,
          dictionaryName: row.dictionary_name,
          definitionLength: row.definition_length,
          indexedWords,
          matchType: type,
        });
      }
    }

    return allMatches;
  }

  /**
   * Find matches in moraqman (digitized) dictionaries
   * Uses LIKE for partial matching since moraqman entries can be compound terms
   */
  private async findMoraqmanMatches(
    normalizedWord: string,
    normalizedRoot?: string
  ): Promise<MoraqmanMatch[]> {
    const allMatches: MoraqmanMatch[] = [];
    const seenRootIds = new Set<number>();

    // Build search terms - include both word and root if available
    const searchTerms: string[] = [normalizedWord];

    // Try word variants
    if (normalizedWord.startsWith('ال')) {
      searchTerms.push(normalizedWord.substring(2));
    } else {
      searchTerms.push('ال' + normalizedWord);
    }

    // Add root variants if provided
    if (normalizedRoot && normalizedRoot !== normalizedWord) {
      searchTerms.push(normalizedRoot);
      if (normalizedRoot.startsWith('ال')) {
        searchTerms.push(normalizedRoot.substring(2));
      } else {
        searchTerms.push('ال' + normalizedRoot);
      }
    }

    // Search for each term using partial matching
    for (const term of searchTerms) {
      const results = await this.db.getAllAsync<{
        root_id: number;
        root: string;
        dictionary_id: number;
        dictionary_name: string;
        definition_length: number;
      }>(
        `SELECT
          r.id as root_id,
          r.root,
          r.dictionary_id,
          d.name as dictionary_name,
          LENGTH(r.definition) as definition_length
        FROM roots r
        INNER JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE d.type = 'moraqman' AND
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
          LIKE '%' || ? || '%'
        ORDER BY d.id
        LIMIT 15`,
        [term]
      );

      for (const row of results) {
        if (seenRootIds.has(row.root_id)) {
          continue;
        }
        seenRootIds.add(row.root_id);

        allMatches.push({
          root: row.root,
          rootId: row.root_id,
          dictionaryId: row.dictionary_id,
          dictionaryName: row.dictionary_name,
          definitionLength: row.definition_length,
        });
      }
    }

    return allMatches;
  }

  /**
   * Get indexed words for a specific root
   */
  private async getIndexedWordsForRoot(rootId: number): Promise<string[]> {
    const query = `
      SELECT DISTINCT word
      FROM words
      WHERE root_id = ?
      LIMIT 10
    `;

    const results = await this.db.getAllAsync<{ word: string }>(query, [rootId]);
    return results.map((r) => r.word);
  }

  /**
   * Discover multiple words with optional roots
   * @param words - Array of words as user mentioned them
   * @param roots - Optional array of LLM-extracted roots (same length as words)
   */
  async discoverWords(words: string[], roots?: string[]): Promise<WordDiscoveryResult[]> {
    const results: WordDiscoveryResult[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const root = roots && roots[i] ? roots[i] : undefined;
      const result = await this.discoverWord(word, root);
      results.push(result);
    }

    return results;
  }

  /**
   * Format discovery results for LLM
   */
  formatResultsForLLM(results: WordDiscoveryResult[]): string {
    if (results.length === 0) {
      return 'لم يتم تحديد كلمات للبحث';
    }

    return results
      .map((result) => {
        let output = `\n## ${result.searchWord}`;
        if (result.searchRoot) {
          output += ` (الجذر المستخرج: ${result.searchRoot})`;
        }
        output += '\n';

        if (!result.exactMatch && result.indexedMatches.length === 0 && result.rootMatches.length === 0 && result.moraqmanMatches.length === 0) {
          output += 'لم يتم العثور على نتائج\n';
          return output;
        }

        // Indexed matches (direct scroll)
        if (result.indexedMatches.length > 0) {
          output += '\n### كلمات مفهرسة (تصفح مباشر)\n';
          const uniqueMatches = new Map<string, IndexedWordMatch>();
          for (const match of result.indexedMatches) {
            const key = `${match.word}:${match.dictionaryName}`;
            if (!uniqueMatches.has(key)) {
              uniqueMatches.set(key, match);
            }
          }
          Array.from(uniqueMatches.values()).forEach((match) => {
            output += `- **${match.word}** ← ${match.dictionaryName} (جذر: ${match.root})\n`;
          });
        }

        // Root matches - group by match type for clarity
        if (result.rootMatches.length > 0) {
          output += '\n### جذور في المعاجم\n';

          // Sort by match type priority: exact > root > format
          const sortedMatches = [...result.rootMatches].sort((a, b) => {
            const priority = { exact: 0, root: 1, format: 2 };
            return priority[a.matchType] - priority[b.matchType];
          });

          for (const match of sortedMatches) {
            const sizeLabel = this.getSizeLabel(match.definitionLength);
            const matchLabel = match.matchType === 'exact' ? '✓' : match.matchType === 'root' ? '◎' : '○';
            output += `- ${matchLabel} **${match.root}** ← ${match.dictionaryName} (${match.definitionLength} حرف - ${sizeLabel})\n`;

            if (match.indexedWords.length > 0) {
              output += `  كلمات مفهرسة: [${match.indexedWords.slice(0, 5).join('، ')}${match.indexedWords.length > 5 ? '...' : ''}]\n`;
            }
          }
        }

        // Moraqman (digitized) dictionary matches
        if (result.moraqmanMatches.length > 0) {
          output += '\n### المعاجم المرقمنة\n';
          for (const match of result.moraqmanMatches) {
            const sizeLabel = this.getSizeLabel(match.definitionLength);
            output += `- **${match.root}** ← ${match.dictionaryName} (${match.definitionLength} حرف - ${sizeLabel})\n`;
          }
        }

        return output;
      })
      .join('\n---\n');
  }

  /**
   * Get human-readable size label
   */
  private getSizeLabel(length: number): string {
    if (length < 500) return 'قصير - يمكن جلب الكامل';
    if (length < 2000) return 'متوسط';
    if (length < 5000) return 'طويل';
    return 'طويل جداً - يفضل المقتطفات';
  }
}
