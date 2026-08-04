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
    const stored = (localStorage.getItem('app_lang') as Lang) || 'ID';
    setLanguageState(stored);
  }, []);

  const setLanguage = (lang: Lang) => {
    setLanguageState(lang);
    localStorage.setItem('app_lang', lang);
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
