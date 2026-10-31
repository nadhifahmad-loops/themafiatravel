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

/**
 * Preferensi bahasa disimpan di DUA tempat:
 * - `localStorage` (client, sumber paling baru untuk user ini)
 * - cookie `app_lang` (dibaca server di app/layout.tsx → `<html lang>` dan
 *   initial state provider, supaya bahasa yang tampil di HTML awal sudah benar)
 */
const STORAGE_KEY = 'app_lang';

function persistLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (error) {
    console.error('Unable to save the language preference.', error);
  }
  try {
    document.cookie = `${STORAGE_KEY}=${lang}; path=/; max-age=31536000; samesite=lax`;
  } catch (error) {
    console.error('Unable to persist the language preference cookie.', error);
  }
}

export function LanguageProvider({ children, initialLang }: { children: React.ReactNode; initialLang?: Lang }) {
  const [language, setLanguageState] = useState<Lang>(initialLang ?? 'ID');

  // Samakan dengan localStorage yang tersimpan (bila beda dengan cookie), dan
  // tulis ulang cookie supaya render server berikutnya ikut.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'ID' || stored === 'EN') {
          setLanguageState(stored);
          persistLang(stored);
        }
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
    persistLang(lang);
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
