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
 * Tool 2: Get Word Segments
 * Fetch actual content - LLM decides how much context
 */
export const getWordSegmentsTool: Tool = {
  name: 'get_word_segments',
  description: `جلب محتوى التعريف من معجم محدد.

**⚠️ مهم جداً:** استخدم اسم الجذر **بالضبط** كما ظهر في نتائج discover_words.

أمثلة صحيحة:
- discover_words أظهر "نَمُوذَجٌ" → استخدم root: "نموذج" (وليس "نمذج")
- discover_words أظهر "ن م ذ ج" → استخدم root: "ن م ذ ج"
- discover_words أظهر "حَرَمَ" → استخدم root: "حرم"

Fetch definition content. Use the EXACT root name as shown in discover_words results.`,
  parameters: {
    type: 'object',
    properties: {
      root: {
        type: 'string',
        description: 'The EXACT root name from discover_words results (e.g., "نموذج", "ن م ذ ج", "حرم")',
      },
      dictionary: {
        type: 'string',
        description: 'Dictionary name exactly as shown in discover_words (e.g., "لسان العرب", "معجم المغني")',
      },
      words: {
        type: 'array',
        description:
          'Optional: specific words to get context for. If not provided, returns general segments.',
        items: {
          type: 'string',
          description: 'Arabic word with diacritics',
        },
      },
      context_words: {
        type: 'string',
        description:
          'How much content to return. Use "full" for short definitions (< 500 chars), or a number like "40" for longer ones.',
      },
    },
    required: ['root', 'dictionary', 'context_words'],
  },
};

/**
 * All smart dictionary tools
 */
export const smartDictionaryTools: Tool[] = [
  discoverWordsTool,
  getWordSegmentsTool,
];
