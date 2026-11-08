import { spanishCatalog } from './catalog';
import type { Language } from './language';

export type TranslationValues = Record<string, string | number>;
export type Translator = (source: string, values?: TranslationValues) => string;

export const translate = (language: Language, source: string, values: TranslationValues = {}): string => {
  const message = language === 'es' ? (spanishCatalog[source] ?? source) : source;
  return message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, key: string) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder
  ));
};
