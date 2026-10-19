'use client';

import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageToggle({
  className = '',
  overHero = false,
}: {
  className?: string;
  overHero?: boolean;
}) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-full p-0.5 ${
        overHero ? 'bg-white/15' : 'bg-slate-100'
      } ${className}`}
      aria-label="Choose language"
    >
      {(['ID', 'EN'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          aria-label={lang === 'ID' ? 'Bahasa Indonesia' : 'English'}
          aria-pressed={language === lang}
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
            language === lang
              ? 'bg-brand-orange text-white shadow-sm'
              : overHero
                ? 'text-white/80 hover:text-white'
                : 'text-slate-500 hover:text-brand-blue'
          }`}
        >
          <Image
            src={lang === 'ID' ? '/images/flags/ID.png' : '/images/flags/GB.png'}
            alt=""
            width={16}
            height={12}
            className="mr-1 inline-block h-3 w-4 rounded-[2px] object-cover ring-1 ring-black/10"
          />
          {lang}
        </button>
      ))}
    </div>
  );
}
