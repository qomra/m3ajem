import type { Tool } from './types';

/**
 * Tool 1: Discover Words
 * Fast metadata scan - returns what exists without content
 * Supports both word search and root-based search
 */
export const discoverWordsTool: Tool = {
  name: 'discover_words',
  description: `استكشاف الكلمات والجذور في جميع المعاجم (14 معجم، 111,356 جذر).
يعيد معلومات عن الجذور والمعاجم المتاحة دون المحتوى الكامل.
استخدم هذه الأداة أولاً لمعرفة ما هو متاح قبل طلب المحتوى.

Discover words across ALL 14 dictionaries. Returns metadata: which roots exist, in which dictionaries, definition lengths, and indexed words available.

**ROOT EXTRACTION - IMPORTANT:**
You SHOULD provide extracted roots for better search coverage.

How to extract Arabic roots:
1. Remove prefixes: ال (al-), ب (bi-), ك (ka-), ف (fa-), ل (li-), و (wa-), م (meem for nouns of place/instrument)
2. Remove suffixes: ة (taa marbuta), ات (plural), ين/ون (dual/plural), ها/هم/كم (pronouns)
3. Identify the core 3-4 consonant letters
4. Remove diacritics (تشكيل)

Examples:
- "الكتاب" → root: "كتب" (remove ال prefix, final ا)
- "مكتبة" → root: "كتب" (remove م prefix, ة suffix)
- "يكتبون" → root: "كتب" (remove ي prefix, ون suffix)
- "المدرسة" → root: "درس" (remove ال, م prefix, ة suffix)
- "استخراج" → root: "خرج" (remove است prefix)
- "نموذج" → root: "نمذج" (quadrilateral root)
- "الاحترام" → root: "حرم" (remove ال, ا prefix)

Special cases:
- Hamza variations (أ، إ، ء، ؤ، ئ) → همزة
- Final ى = ي
- Words with 4 letters might be quadrilateral roots`,
  parameters: {
    type: 'object',
    properties: {
      words: {
        type: 'array',
        description:
          'Array of Arabic words to discover as the user mentioned them (e.g., ["احترام", "تقدير"]).',
        items: {
          type: 'string',
          description: 'Arabic word to search',
        },
      },
      roots: {
        type: 'array',
        description:
          'Array of extracted trilateral/quadrilateral roots (strongly recommended). ' +
          'Must match words array length. E.g., for words ["الاحترام", "نموذج"], roots would be ["حرم", "نمذج"].',
        items: {
          type: 'string',
          description: 'Extracted Arabic root (3-4 letters)',
        },
      },
    },
    required: ['words'],
  },
};

/**
 * Tool 2: Get Entry by ID
 * Fetch actual content using the ID from discover_words
 * Simple and unambiguous - just pass the ID number
 */
export const getEntryTool: Tool = {
  name: 'get_entry',
  description: `جلب محتوى التعريف باستخدام رقم المعرف من نتائج discover_words.

استخدم الرقم الموجود بين الأقواس المربعة [ID] من نتائج البحث.

Fetch definition content using the ID number from discover_words results.
The ID is shown in square brackets like [12345].`,
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'number',
        description: 'The entry ID from discover_words (the number in square brackets)',
      },
    },
    required: ['id'],
  },
};

/**
 * All smart dictionary tools
 */
export const smartDictionaryTools: Tool[] = [
  discoverWordsTool,
  getEntryTool,
];
