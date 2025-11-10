import type { Tool } from './types';

/**
 * Dictionary Search Tool
 * Searches for Arabic words in indexed classical dictionaries
 */
export const dictionarySearchTool: Tool = {
  name: 'search_dictionary',
  description:
    'البحث عن كلمات عربية في المعاجم الكلاسيكية المفهرسة. يعيد نتائج تحتوي على الجذر والتعريف والسياق. ' +
    'Search for Arabic words in indexed classical dictionaries (لسان العرب، الصحاح في اللغة، المعجم الوسيط، القاموس المحيط، وغيرها). ' +
    'Returns word occurrences with root definitions and context snippets. ' +
    'Accepts a single word or an array of word variations to search for.',
  parameters: {
    type: 'object',
    properties: {
      words: {
        type: 'array',
        description:
          'Array of Arabic word forms to search (e.g., ["ركب", "ركبه", "ركبها"] for different variations). ' +
          'Can also be a single word string.',
        items: {
          type: 'string',
          description: 'Arabic word to search (exact form with or without diacritics)',
        },
      },
    },
    required: ['words'],
  },
};
