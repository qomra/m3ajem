import { useCallback } from 'react';
import { translate, TranslationKey, defaultLocale } from '@locales';

export function useTranslation() {
  // For now, we only use Arabic
  // In the future, this can be extended to support multiple languages
  const locale = defaultLocale;

  const t = useCallback(
    (key: TranslationKey): string => {
      return translate(key, locale);
    },
    [locale]
  );

  return { t, locale };
}

export default useTranslation;
