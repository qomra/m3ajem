import type { Tool } from './types';

/**
 * Semantic Search Tool
 * Searches for word roots by meaning using vector similarity
 *
 * This tool enables a ReAct-style workflow:
 * 1. Initial search returns top 3 matching roots
 * 2. LLM can request full content for each root
 * 3. If content is large, it's chunked automatically
 * 4. LLM can request subsequent chunks
 * 5. LLM evaluates and decides to continue or stop
 */
export const searchWordByMeaningTool: Tool = {
  name: 'search_word_by_meaning',
  description: `البحث عن كلمات عربية بناءً على المعنى باستخدام البحث الدلالي.

هذه الأداة تساعد في الإجابة على أسئلة مثل: "ماهي الكلمة التي قد تعني كذا وكذا؟"

**الاستخدام:**

1. **البحث الأولي:** أرسل وصف المعنى المطلوب
   - مثال: { "meaning_query": "الحركة والانتقال من مكان لآخر" }
   - النتيجة: قائمة بأفضل 3 جذور قد تحتوي على هذا المعنى

2. **طلب محتوى الجذر:** أرسل اسم الجذر للحصول على محتواه
   - مثال: { "meaning_query": "...", "root": "ذهب" }
   - النتيجة: محتوى الجذر كاملاً (إذا كان صغيراً) أو الجزء الأول (إذا كان كبيراً)

3. **طلب الجزء التالي:** إذا كان المحتوى مقسماً، يمكنك طلب الأجزاء التالية
   - مثال: { "meaning_query": "...", "root": "ذهب", "chunk_number": 2 }
   - النتيجة: الجزء الثاني من محتوى الجذر

**ملاحظات مهمة:**
- يجب إرسال نفس meaning_query في جميع الطلبات المتعلقة بنفس عملية البحث
- قيّم المحتوى المستلم: إذا وجدت الإجابة، أخبر المستخدم. وإلا، جرب جذراً آخر أو جزءاً آخر
- إذا لم تجد الإجابة في الجذور الثلاثة، أخبر المستخدم أنك لم تجد إجابة مناسبة
- يوجد حد أقصى 5 استدعاءات لهذه الأداة لتجنب التكرار اللانهائي`,
  parameters: {
    type: 'object',
    properties: {
      meaning_query: {
        type: 'string',
        description: 'وصف المعنى المطلوب البحث عنه (مطلوب دائماً)',
      },
      root: {
        type: 'string',
        description: 'اسم الجذر المراد الحصول على محتواه (اختياري للطلبات التالية)',
      },
      chunk_number: {
        type: 'number',
        description: 'رقم الجزء المطلوب من محتوى الجذر (اختياري، يبدأ من 1)',
      },
    },
    required: ['meaning_query'],
  },
};
