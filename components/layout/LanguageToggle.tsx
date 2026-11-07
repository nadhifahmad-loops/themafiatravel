'use client';

import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageToggle({
  className = '',
  overHero = false,
  tone = 'light',
}: {
  className?: string;
  overHero?: boolean;
  tone?: 'light' | 'dark';
}) {
  const { language, setLanguage } = useLanguage();
  const isDark = overHero || tone === 'dark';

  return (
    <div
      role="group"
      aria-label={language === 'ID' ? 'Pilih bahasa' : 'Choose language'}
      className={`inline-flex items-center rounded-full p-0.5 ${
        isDark ? 'bg-white/15' : 'bg-slate-100'
      } ${className}`}
    >
      {(['ID', 'EN'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          aria-label={lang === 'ID' ? 'Bahasa Indonesia' : 'English'}
          aria-pressed={language === lang}
          className={`inline-flex min-w-[52px] items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none transition-colors ${
            language === lang
              ? 'bg-brand-orange text-white shadow-sm'
              : isDark
                ? 'text-white/80 hover:text-white'
                : 'text-slate-500 hover:text-brand-blue'
          }`}
        >
          <Image
            src={lang === 'ID' ? '/images/flags/ID.png' : '/images/flags/GB.png'}
            alt=""
            width={16}
            height={12}
            className="h-3 w-4 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10"
          />
          {lang}
        </button>
      ))}
    </div>
  );
}
