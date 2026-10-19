'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Lang = 'ID' | 'EN';

interface LanguageContextType {
  language: Lang;
  setLanguage: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ID',
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Lang>('ID');

  // Baca dari localStorage saat mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem('app_lang');
        if (stored === 'ID' || stored === 'EN') setLanguageState(stored);
      } catch (error) {
        console.error('Unable to read the saved language preference.', error);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'ID' ? 'id' : 'en';
  }, [language]);

  const setLanguage = (lang: Lang) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('app_lang', lang);
    } catch (error) {
      console.error('Unable to save the language preference.', error);
    }
    // Tetap dispatch event untuk kompatibilitas backward
    window.dispatchEvent(new Event('appStateChange'));
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
