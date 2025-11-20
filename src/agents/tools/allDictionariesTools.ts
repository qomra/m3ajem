import type { Tool } from './types';

/**
 * Tool for searching across ALL 14 dictionaries (indexed and non-indexed)
 * Uses each dictionary's specific indexing pattern
 */
export const searchAllDictionariesTool: Tool = {
  name: 'search_all_dictionaries',
  description: `
    Search for words across ALL 14 Arabic dictionaries in the database.

    **IMPORTANT: Use this ONLY AFTER search_dictionary returns no results.**

    This tool searches 111,356 roots across 14 dictionaries:
    - الصّحّاح في اللغة (5,689 roots)
    - لسان العرب (9,272 roots)
    - المعجم الوسيط (33,104 roots)
    - القاموس المحيط (9,811 roots)
    - مقاييس اللغة (4,636 roots)
    - العباب الزاخر (1,528 roots)
    - المصباح المنير (2,691 roots)
    - جمهرة اللغة (2,908 roots)
    - الدخيل في العربية (1,551 roots)
    - اللغة العربية المعاصرة (5,777 roots)
    - معجم الملابس (1,502 roots)
    - معجم المغني (6,193 roots)
    - معجم المصطلحات والألفاظ الفقهية (3,501 roots)
    - معجم الرائد (23,193 roots)

    Each dictionary uses a different indexing method. This tool handles all patterns automatically.

    WHEN TO USE THIS TOOL:
    - ONLY when search_dictionary (لسان العرب) returns no results
    - When you need broader coverage across multiple dictionaries
    - When the user explicitly asks for "all dictionaries" or "جميع المعاجم"

    WHEN NOT TO USE:
    - As your first search (ALWAYS use search_dictionary first)
    - When search_dictionary already found results

    ROOT EXTRACTION GUIDELINES:
    You MUST provide BOTH words and roots for maximum accuracy.

    How to extract Arabic roots:
    1. Remove prefixes: ال (al-), ب (bi-), ك (ka-), ف (fa-), ل (li-), و (wa-)
    2. Remove suffixes: ة (taa marbuta), ات (plural), ين/ون (dual/plural), ها/هم/كم (pronouns)
    3. Identify the core 3-4 consonant letters
    4. Remove diacritics (تشكيل)

    Examples:
    - "الكتاب" → root: "كتب" (remove ال prefix, final ا)
    - "مكتبة" → root: "كتب" (remove م prefix, ة suffix)
    - "يكتبون" → root: "كتب" (remove ي prefix, ون suffix)
    - "المدرسة" → root: "درس" (remove ال prefix, م prefix, ة suffix)
    - "استخراج" → root: "خرج" (remove است prefix, ا infix)

    Special cases:
    - Hamza variations (أ، إ، ء، ؤ، ئ) → همزة
    - Final ى = ي
    - Words with 4 letters might be quadrilateral roots
  `,
  parameters: {
    type: 'object',
    properties: {
      words: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of words to search (as the user mentioned them)',
      },
      roots: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Array of extracted trilateral/quadrilateral roots (optional but strongly recommended). Must have same length as words array if provided.',
      },
    },
    required: ['words'],
  },
};
