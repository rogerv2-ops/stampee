export type Language = 'es' | 'en';
export const LANGUAGE_STORAGE_KEY = 'stampee.ui.language';

export const resolveLanguage = (stored: string | null, browserLanguage = 'es'): Language => {
  if (stored === 'es' || stored === 'en') return stored;
  return browserLanguage.toLowerCase().startsWith('es') ? 'es' : 'en';
};

export const languageLocale = (language: Language) => language === 'es' ? 'es-PE' : 'en-US';
