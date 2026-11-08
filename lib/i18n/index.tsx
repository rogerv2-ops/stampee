import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGE_STORAGE_KEY, languageLocale, resolveLanguage } from './language';
import type { Language } from './language';
import { translate } from './translate';
import type { Translator } from './translate';

export type { Language } from './language';
export type { Translator, TranslationValues } from './translate';
export { translate } from './translate';

type I18nContextValue = {
  language: Language;
  locale: 'es-PE' | 'en-US';
  setLanguage: (language: Language) => void;
  t: Translator;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const initialLanguage = (): Language => {
  let stored: string | null = null;
  try { stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* Storage can be disabled. */ }
  return resolveLanguage(stored, typeof navigator === 'undefined' ? 'es' : navigator.language);
};

export const I18nProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, updateLanguage] = useState<Language>(initialLanguage);
  const setLanguage = useCallback((next: Language) => {
    if (next === 'es' || next === 'en') updateLanguage(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* UI still works without storage. */ }
  }, [language]);

  useEffect(() => {
    const syncLanguage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY && (event.newValue === 'es' || event.newValue === 'en')) {
        updateLanguage(event.newValue);
      }
    };
    window.addEventListener('storage', syncLanguage);
    return () => window.removeEventListener('storage', syncLanguage);
  }, []);

  const t = useCallback<Translator>((source, values) => translate(language, source, values), [language]);
  const value = useMemo(() => ({ language, locale: languageLocale(language), setLanguage, t }), [language, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
};
