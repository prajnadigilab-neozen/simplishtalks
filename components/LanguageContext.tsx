
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';

interface LanguageContextType {
  lang: Language;
  toggleLang: () => void;
  // Fix: Update type definition to accept string or language map to match implementation and usage
  t: (textMap: string | Record<Language, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('simplish-lang');
    return (saved as Language) || 'kn';
  });

  useEffect(() => {
    localStorage.setItem('simplish-lang', lang);
  }, [lang]);

  const toggleLang = () => setLang(prev => prev === 'en' ? 'kn' : 'en');

  // Implementation already handles objects, but interface was too restrictive.
  // We use any here to allow the flexibility of the mapping logic.
  const t = (textMap: any) => {
    if (!textMap) return '';
    if (typeof textMap === 'string') return textMap;
    return textMap[lang] || textMap['en'] || '';
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
