import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Result from dictionary lookup
 */
export interface DictionaryLookupResult {
  word: string; // The searched word
  found: boolean; // Whether word was found
  results: WordOccurrence[]; // All occurrences
}

export interface WordOccurrence {
  root: string; // Root form (e.g., "ك ت ب")
  dictionaryName: string; // Dictionary name
  dictionaryId: number;
  rootId: number;
  definition: string; // Full root definition
  positions: number[]; // Character positions where word appears
  snippets: DefinitionSnippet[]; // Context snippets
  isShortDefinition: boolean; // True if definition < 500 chars
}

export interface DefinitionSnippet {
  before: string; // Text before word
  word: string; // The word itself
  after: string; // Text after word
  position: number; // Position in definition
}

const SHORT_DEFINITION_THRESHOLD = 500; // chars
const SNIPPET_CONTEXT_LENGTH = 50; // chars before/after

export class DictionaryLookupService {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Remove Arabic diacritics from text for normalized searching
   * Same logic as indexed tab (line 29 of indexed/index.tsx)
   */
  private removeDiacritics(text: string): string {
    return text.replace(/[\u064B-\u065F\u0670]/g, ''); // Remove Arabic diacritics
  }

  /**
   * Search for a word in all dictionaries
   */
  async searchWord(word: string): Promise<DictionaryLookupResult> {
    try {
      // Normalize the search word (remove diacritics only, like indexed tab)
      const normalizedWord = this.removeDiacritics(word);

      // Query: Find word in words table with joins to roots and dictionaries
      // Use REPLACE to remove diacritics from database words, then use LIKE for substring matching
      const query = `
        SELECT
          w.word,
          w.all_positions,
          r.id as root_id,
          r.root,
          r.definition,
          r.dictionary_id,
          d.name as dictionary_name
        FROM words w
        INNER JOIN roots r ON w.root_id = r.id
        INNER JOIN dictionaries d ON r.dictionary_id = d.id
        WHERE
          -- Remove diacritics from database word and use LIKE for substring match
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            w.word,
            char(1611), ''),  -- Tanween Fath
            char(1612), ''),  -- Tanween Damm
            char(1613), ''),  -- Tanween Kasr
            char(1614), ''),  -- Fatha
            char(1615), ''),  -- Damma
            char(1616), ''),  -- Kasra
            char(1617), ''),  -- Shadda
            char(1618), ''),  -- Sukun
            char(1648), '')   -- Tatweel
          LIKE '%' || ? || '%'
        ORDER BY d.id, r.id
      `;

      const result = await this.db.getAllAsync<{
        word: string;
        all_positions: string;
        root_id: number;
        root: string;
        definition: string;
        dictionary_id: number;
        dictionary_name: string;
      }>(query, [normalizedWord]);

      if (result.length === 0) {
        return {
          word,
          found: false,
          results: [],
        };
      }

      // Process each occurrence
      const results: WordOccurrence[] = result.map((row) => {
        const positions: number[] = JSON.parse(row.all_positions);
        const isShort = row.definition.length < SHORT_DEFINITION_THRESHOLD;

        return {
          root: row.root,
          dictionaryName: row.dictionary_name,
          dictionaryId: row.dictionary_id,
          rootId: row.root_id,
          definition: row.definition,
          positions,
          snippets: isShort ? [] : this.extractSnippets(row.definition, word, positions),
          isShortDefinition: isShort,
        };
      });

      return {
        word,
        found: true,
        results,
      };
    } catch (error) {
      console.error('Error searching word:', word, error);
      return {
        word,
        found: false,
        results: [],
      };
    }
  }

  /**
   * Search for multiple words (used by tool calling)
   */
  async searchWords(words: string[]): Promise<DictionaryLookupResult[]> {
    return await Promise.all(words.map((word) => this.searchWord(word)));
  }

  /**
   * Extract context snippets around word occurrences
   */
  private extractSnippets(
    definition: string,
    word: string,
    positions: number[]
  ): DefinitionSnippet[] {
    return positions.slice(0, 3).map((pos) => {
      // Limit to first 3 occurrences
      const before = definition.substring(
        Math.max(0, pos - SNIPPET_CONTEXT_LENGTH),
        pos
      );

      const after = definition.substring(
        pos + word.length,
        Math.min(definition.length, pos + word.length + SNIPPET_CONTEXT_LENGTH)
      );

      return {
        before: before.startsWith(definition) ? before : '...' + before,
        word,
        after: after.endsWith(definition.substring(definition.length)) ? after : after + '...',
        position: pos,
      };
    });
  }

  /**
   * Format results as text for LLM
   */
  formatResultsForLLM(results: DictionaryLookupResult[]): string {
    if (results.length === 0) {
      return 'لم يتم العثور على أي نتائج';
    }

    return results
      .map((result) => {
        if (!result.found) {
          return `الكلمة "${result.word}": لم يتم العثور عليها في المعجم المفهرس`;
        }

        return result.results
          .map((occ) => {
            let formatted = `\n## الكلمة: ${result.word}\n`;
            formatted += `الجذر: ${occ.root}\n`;
            formatted += `المعجم: ${occ.dictionaryName}\n\n`;

            if (occ.isShortDefinition) {
              // Return full definition for short entries
              formatted += `${occ.definition}\n`;
            } else {
              // Return snippets for long entries
              formatted += 'مقتطفات من التعريف:\n\n';
              occ.snippets.forEach((snippet, idx) => {
                formatted += `${idx + 1}. ${snippet.before}**${snippet.word}**${snippet.after}\n\n`;
              });
            }

            return formatted;
          })
          .join('\n---\n');
      })
      .join('\n\n');
  }
}
