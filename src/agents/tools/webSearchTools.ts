import type { Tool } from './types';

/**
 * Web Search Tool
 * Searches the web for information when local resources don't have the answer
 *
 * This tool should be used as a LAST RESORT after trying local tools:
 * 1. First try search_dictionary for specific word lookups
 * 2. Then try search_word_by_meaning for semantic searches (if available)
 * 3. Only then use search_web if local tools don't have the answer
 */
export const webSearchTool: Tool = {
  name: 'search_web',
  description: `البحث في الإنترنت عن معلومات غير متوفرة في المصادر المحلية.

**متى تستخدم هذه الأداة:**
- عندما لا تجد الإجابة في المعاجم الكلاسيكية
- عندما يسأل المستخدم عن معلومات حديثة أو معاصرة
- عندما يطلب معلومات خارج نطاق المعاجم العربية الكلاسيكية
- للتحقق من معلومات أو البحث عن مصادر إضافية

**قواعد مهمة:**
1. استخدم هذه الأداة كخيار أخير بعد تجريب الأدوات المحلية
2. **لا تضع الروابط في إجابتك** - المصادر ستظهر تلقائياً في قائمة المصادر القابلة للنقر
3. اذكر فقط اسم الموقع: "حسب موقع ويكيبيديا..." أو "وفقاً للموقع الرسمي..."
4. تحقق من موثوقية المصادر - فضّل المصادر الأكاديمية والموسوعات
5. لا تكرر البحث عن نفس الاستعلام
6. إذا لم تجد نتائج مفيدة، أخبر المستخدم بدلاً من التخمين

**أمثلة للاستخدام الصحيح:**
- "ما هو تاريخ اللغة العربية الحديثة؟" → search_web
- "من هو أحمد شوقي؟" → search_web (شاعر حديث)
- "ما معنى كلمة blockchain بالعربية؟" → search_web (مصطلح تقني)

**أمثلة للاستخدام الخاطئ:**
- "ما معنى كلمة كتب؟" → استخدم search_dictionary أولاً
- "ماهي الكلمة التي تعني الحركة؟" → استخدم search_word_by_meaning أولاً`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'استعلام البحث بالعربية أو الإنجليزية',
      },
      num_results: {
        type: 'number',
        description: 'عدد النتائج المطلوبة (افتراضي: 5، الحد الأقصى: 10)',
      },
    },
    required: ['query'],
  },
};
