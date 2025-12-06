/**
 * Dictionary categories for Moraqman (digitized dictionaries)
 * Order: Islamic -> Sciences -> Humanities -> Arts
 */

export type CategoryKey = 'islamic' | 'sciences' | 'humanities' | 'arts';

export interface CategoryConfig {
  key: CategoryKey;
  dictionaries: string[];
}

export const MORAQMAN_CATEGORIES: CategoryConfig[] = [
  {
    key: 'islamic',
    dictionaries: [
      'معجم مصطلح الحديث النبوي',
    ],
  },
  {
    key: 'sciences',
    dictionaries: [
      'معجم الرياضيات',
      'معجم مصطلحات الفيزياء',
      'معجم مصطلحات الفيزياء الحديثة',
      'معجم الكيمياء والصيدلة',
      'معجم المصطلحات الطبية (مجمع اللغة العربية)',
      'معجم المصطلحات الطبية (أبو حلتم)',
      'معجم المصطلحات الطبية الحديثة',
      'معجم أسماء النبات',
      'موسوعة المصطلحات الزراعية المصورة كاملة',
      'معجم الهيدرولوجيا',
      'معجم المصطلحات الجغرافية',
      'معجم النفط',
      'معجم مصطلحات الهندسة الميكانيكية',
      'معجم مصطلحات الحاسب',
    ],
  },
  {
    key: 'humanities',
    dictionaries: [
      'المعجم الفلسفي',
      'معجم علم النفس والتربية',
      'معجم القانون',
      'معجم مصطلحات التاريخ والآثار',
      'معجم المصطلحات والألقاب التاريخية',
      'معجم الألقاب والأسماء المستعارة في التاريخ العربي والإسلامي',
      'قاموس المصطلحات الاقتصادية في الحضارة الإسلامية',
      'قاموس رد العامي للفصيج',
    ],
  },
  {
    key: 'arts',
    dictionaries: [
      'معجم الموسيقى',
      'شرح المعلقات السبع',
      'المعجم المفصل في علوم البلاغة البديع والبيان والمعاني',
    ],
  },
];

/**
 * Get the category key for a dictionary name
 */
export function getCategoryForDictionary(dictionaryName: string): CategoryKey | null {
  for (const category of MORAQMAN_CATEGORIES) {
    if (category.dictionaries.includes(dictionaryName)) {
      return category.key;
    }
  }
  return null;
}

/**
 * Get sort order for a dictionary (lower = higher in list)
 */
export function getDictionarySortOrder(dictionaryName: string): number {
  let order = 0;
  for (const category of MORAQMAN_CATEGORIES) {
    const index = category.dictionaries.indexOf(dictionaryName);
    if (index !== -1) {
      return order + index;
    }
    order += category.dictionaries.length;
  }
  // Unknown dictionaries go to the end
  return 9999;
}
