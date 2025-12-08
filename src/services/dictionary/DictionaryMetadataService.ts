import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Dictionary metadata from database
 */
export interface DictionaryMetadata {
  id: number;
  name: string;
  description: string;
  type: 'lo3awi' | 'moraqman'; // linguistic vs specialized
  rootCount: number;
  wordCount: number; // indexed words count
  isIndexed: boolean;
}

/**
 * Dictionary category for system prompt
 */
export interface DictionaryCategory {
  category: string;
  categoryArabic: string;
  dictionaries: DictionaryMetadata[];
}

/**
 * Service to fetch dictionary metadata from database
 */
export class DictionaryMetadataService {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Get all dictionaries with metadata
   */
  async getAllDictionaries(): Promise<DictionaryMetadata[]> {
    const query = `
      SELECT
        d.id,
        d.name,
        d.description,
        d.type,
        COUNT(DISTINCT r.id) as root_count,
        COUNT(w.id) as word_count
      FROM dictionaries d
      LEFT JOIN roots r ON d.id = r.dictionary_id
      LEFT JOIN words w ON r.id = w.root_id
      GROUP BY d.id
      ORDER BY d.type, d.id
    `;

    const results = await this.db.getAllAsync<{
      id: number;
      name: string;
      description: string;
      type: string;
      root_count: number;
      word_count: number;
    }>(query);

    return results.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      type: row.type as 'lo3awi' | 'moraqman',
      rootCount: row.root_count,
      wordCount: row.word_count,
      isIndexed: row.word_count > 0,
    }));
  }

  /**
   * Get dictionaries grouped by category
   */
  async getDictionariesByCategory(): Promise<DictionaryCategory[]> {
    const dictionaries = await this.getAllDictionaries();

    const linguistic = dictionaries.filter((d) => d.type === 'lo3awi');
    const specialized = dictionaries.filter((d) => d.type === 'moraqman');

    return [
      {
        category: 'linguistic',
        categoryArabic: 'معاجم لغوية',
        dictionaries: linguistic,
      },
      {
        category: 'specialized',
        categoryArabic: 'معاجم متخصصة',
        dictionaries: specialized,
      },
    ];
  }

  /**
   * Build system prompt section listing available dictionaries
   */
  async buildDictionaryListForPrompt(): Promise<string> {
    const categories = await this.getDictionariesByCategory();

    let prompt = '## المعاجم المتاحة\n\n';

    for (const category of categories) {
      prompt += `### ${category.categoryArabic}\n`;

      for (const dict of category.dictionaries) {
        const indexedMarker = dict.isIndexed ? ' ✓ مفهرس' : '';
        const rootInfo = `(${dict.rootCount.toLocaleString()} جذر)`;

        prompt += `- **${dict.name}** ${rootInfo}${indexedMarker}\n`;

        // Add short description if available (first 100 chars)
        if (dict.description) {
          const shortDesc = dict.description.length > 100
            ? dict.description.substring(0, 100) + '...'
            : dict.description;
          prompt += `  ${shortDesc}\n`;
        }
      }

      prompt += '\n';
    }

    return prompt;
  }

  /**
   * Get dictionary by ID
   */
  async getDictionaryById(id: number): Promise<DictionaryMetadata | null> {
    const dictionaries = await this.getAllDictionaries();
    return dictionaries.find((d) => d.id === id) || null;
  }

  /**
   * Get dictionary by name
   */
  async getDictionaryByName(name: string): Promise<DictionaryMetadata | null> {
    const dictionaries = await this.getAllDictionaries();
    return dictionaries.find((d) => d.name === name) || null;
  }
}
