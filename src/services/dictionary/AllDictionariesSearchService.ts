import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Result from comprehensive dictionary search
 */
export interface AllDictionariesSearchResult {
  word: string; // The searched word
  root?: string; // The searched root (if provided)
  found: boolean; // Whether word/root was found
  results: DictionaryMatch[]; // All matches across dictionaries
}

export interface DictionaryMatch {
  dictionaryName: string;
  dictionaryId: number;
  rootId: number;
  root: string; // The root as indexed in that dictionary
  definition: string;
  matchType: 'exact' | 'partial' | 'fuzzy'; // How well it matched
}

/**
 * Service for searching across ALL dictionaries (indexed and non-indexed)
 * Uses each dictionary's specific indexing pattern
 */
export class AllDictionariesSearchService {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Remove Arabic diacritics from text
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
   * Get all dictionaries
   */
  private async getDictionaries(): Promise<Array<{ id: number; name: string }>> {
    return await this.db.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM dictionaries ORDER BY id'
    );
  }

  /**
   * Search for a root in a specific dictionary
   */
  private async searchInDictionary(
    dictionaryId: number,
    dictionaryName: string,
    word: string,
    root?: string
  ): Promise<DictionaryMatch[]> {
    const matches: DictionaryMatch[] = [];

    // Normalize inputs
    const normalizedWord = this.removeDiacritics(word);
    const normalizedRoot = root ? this.removeDiacritics(root) : '';

    // Build search keys - try all common patterns
    const searchKeys: string[] = [];

    // If root provided, search by root first
    if (normalizedRoot) {
      searchKeys.push(normalizedRoot); // Simple root
      searchKeys.push(this.formatRootWithSpaces(normalizedRoot)); // Spaced
      searchKeys.push(this.formatRootWithDashes(normalizedRoot)); // Dashed
      searchKeys.push(this.formatRootBracketed(normalizedRoot)); // Bracketed
    }

    // Try the word itself
    searchKeys.push(normalizedWord);

    // Try word without ال prefix
    if (normalizedWord.startsWith('ال')) {
      searchKeys.push(normalizedWord.substring(2));
    }

    // Try word with ال prefix
    if (!normalizedWord.startsWith('ال')) {
      searchKeys.push('ال' + normalizedWord);
    }

    // Search for each key
    for (const searchKey of searchKeys) {
      // Exact match
      const exactResults = await this.db.getAllAsync<{
        id: number;
        root: string;
        definition: string;
      }>(
        `SELECT id, root, definition
         FROM roots
         WHERE dictionary_id = ?
         AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           root,
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
         LIMIT 5`,
        [dictionaryId, searchKey]
      );

      for (const result of exactResults) {
        matches.push({
          dictionaryName,
          dictionaryId,
          rootId: result.id,
          root: result.root,
          definition: result.definition,
          matchType: 'exact',
        });
      }

      // If no exact match, try partial match (LIKE)
      if (exactResults.length === 0) {
        const partialResults = await this.db.getAllAsync<{
          id: number;
          root: string;
          definition: string;
        }>(
          `SELECT id, root, definition
           FROM roots
           WHERE dictionary_id = ?
           AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
             root,
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
           LIMIT 3`,
          [dictionaryId, searchKey]
        );

        for (const result of partialResults) {
          matches.push({
            dictionaryName,
            dictionaryId,
            rootId: result.id,
            root: result.root,
            definition: result.definition,
            matchType: 'partial',
          });
        }
      }
    }

    // Deduplicate by rootId
    const seen = new Set<number>();
    return matches.filter((match) => {
      if (seen.has(match.rootId)) {
        return false;
      }
      seen.add(match.rootId);
      return true;
    });
  }

  /**
   * Search for a word/root across all dictionaries
   */
  async searchAllDictionaries(word: string, root?: string): Promise<AllDictionariesSearchResult> {
    try {
      const dictionaries = await this.getDictionaries();
      const allMatches: DictionaryMatch[] = [];

      // Search in each dictionary
      for (const dict of dictionaries) {
        const matches = await this.searchInDictionary(
          dict.id,
          dict.name,
          word,
          root
        );
        allMatches.push(...matches);
      }

      return {
        word,
        root,
        found: allMatches.length > 0,
        results: allMatches,
      };
    } catch (error) {
      console.error('AllDictionariesSearchService error:', error);
      return {
        word,
        root,
        found: false,
        results: [],
      };
    }
  }

  /**
   * Search multiple words/roots at once
   */
  async searchMultiple(
    words: string[],
    roots?: string[]
  ): Promise<AllDictionariesSearchResult[]> {
    const results: AllDictionariesSearchResult[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const root = roots && roots[i] ? roots[i] : undefined;
      const result = await this.searchAllDictionaries(word, root);
      results.push(result);
    }

    return results;
  }

  /**
   * Format results for LLM
   */
  formatResultsForLLM(results: AllDictionariesSearchResult[]): string {
    if (results.length === 0) {
      return 'لم يتم العثور على نتائج.';
    }

    const output: string[] = [];

    for (const result of results) {
      if (!result.found) {
        output.push(`\n❌ الكلمة "${result.word}" لم توجد في أي معجم.`);
        continue;
      }

      output.push(`\n✓ الكلمة: "${result.word}"${result.root ? ` (الجذر: ${result.root})` : ''}`);
      output.push(`  عدد المعاجم: ${result.results.length}`);

      // Group by dictionary
      const byDict = new Map<string, DictionaryMatch[]>();
      for (const match of result.results) {
        if (!byDict.has(match.dictionaryName)) {
          byDict.set(match.dictionaryName, []);
        }
        byDict.get(match.dictionaryName)!.push(match);
      }

      // Show each dictionary
      for (const [dictName, matches] of byDict.entries()) {
        output.push(`\n  📖 ${dictName}:`);
        for (const match of matches.slice(0, 2)) {
          // Max 2 per dictionary
          const snippet = match.definition.substring(0, 150);
          output.push(`    • ${match.root}: ${snippet}${match.definition.length > 150 ? '...' : ''}`);
        }
      }
    }

    return output.join('\n');
  }
}
