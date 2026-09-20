'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

export default function TermsPage() {
  const { language } = useLanguage();
  const t = i18n.termsPage[language];

  usePageTitle('Syarat & Ketentuan');

  return (
    <>
      <header className="max-w-[1280px] mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
          {t.title}
        </h1>
        <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium max-w-2xl">
          {t.updated}
        </p>
      </header>

      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 space-y-6">
        {t.sections.map((section, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 md:p-8">
            <h2 className="text-lg sm:text-xl font-black text-brand-ink mb-3">{section.heading}</h2>
            <div className="text-slate-600 leading-relaxed">
              {'list' in section && section.list ? (
                <ul className="list-disc pl-5 space-y-1">
                  {section.list.map((item: string, j: number) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>{section.content}</p>
              )}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}