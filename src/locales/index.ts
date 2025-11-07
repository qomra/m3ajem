import ar from './ar.json';

export type TranslationKey = string;

export const translations = {
  ar,
};

export type Locale = keyof typeof translations;

export const defaultLocale: Locale = 'ar';

/**
 * Get translation by key
 * Supports nested keys with dot notation: 'common.search'
 */
export function translate(key: TranslationKey, locale: Locale = defaultLocale): string {
  const keys = key.split('.');
  let value: any = translations[locale];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }

  return typeof value === 'string' ? value : key;
}

export default translations;
