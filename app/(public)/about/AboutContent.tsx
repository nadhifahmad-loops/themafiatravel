'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

export default function AboutContent() {
  const { language } = useLanguage();
  const t = i18n.aboutPage[language];

  usePageTitle(t.title);

  return (
    <>
      <header className="max-w-[1280px] mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
          {t.title}
        </h1>
        <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium max-w-2xl">
          {t.subtitle}
        </p>
      </header>

      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 md:p-8">
          <h2 className="text-lg sm:text-xl font-black text-brand-ink mb-3">
            <i className="fa-solid fa-eye text-brand-orange mr-2"></i>{t.visionTitle}
          </h2>
          <p className="text-slate-600 leading-relaxed">
            {t.visionText}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 md:p-8">
          <h2 className="text-lg sm:text-xl font-black text-brand-ink mb-4">
            <i className="fa-solid fa-bullseye text-brand-orange mr-2"></i>{t.missionTitle}
          </h2>
          <ul className="space-y-3 text-slate-600 leading-relaxed">
            {t.missionItems.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-7 h-7 shrink-0 bg-orange-100 text-orange-600 font-black text-sm rounded-lg flex items-center justify-center">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-black text-brand-ink mb-4">
            <i className="fa-solid fa-star text-brand-orange mr-2"></i>{t.whyTitle}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {t.whyItems.map(item => (
              <div key={item.title} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-card hover:border-orange-200 transition-colors">
                <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-3">
                  <i className={`fa-solid ${item.icon}`} />
                </div>
                <h3 className="font-bold text-brand-ink mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
