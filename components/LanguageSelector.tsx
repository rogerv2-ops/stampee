import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-black/15 bg-white/95 px-3 py-2 text-sm text-[#171512] shadow-lg backdrop-blur-sm print:hidden">
      <Languages aria-hidden="true" className="h-4 w-4 shrink-0" />
      <label htmlFor="interface-language" className="sr-only">{t('Interface language')}</label>
      <select
        id="interface-language"
        value={language}
        onChange={(event) => {
          const next = event.target.value;
          if (next === 'es' || next === 'en') setLanguage(next);
        }}
        className="min-h-8 cursor-pointer rounded-full bg-transparent px-1 font-medium outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#735b2a]"
      >
        <option value="es" lang="es">Español</option>
        <option value="en" lang="en">English</option>
      </select>
    </div>
  );
};
