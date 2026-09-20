'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

export default function RefundPage() {
  const { language } = useLanguage();
  const t = i18n.refundPage[language];

  usePageTitle('Refund & Reschedule');

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
            <i className="fa-solid fa-wallet text-brand-orange mr-2"></i>{t.refundPolicy}
          </h2>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>{t.refundDesc}</p>
            <ul className="list-disc pl-5 space-y-2">
              {t.refundList.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 md:p-8">
          <h2 className="text-lg sm:text-xl font-black text-brand-ink mb-3">
            <i className="fa-solid fa-calendar-days text-brand-orange mr-2"></i>{t.reschedulePolicy}
          </h2>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>{t.rescheduleDesc}</p>
            <ul className="list-disc pl-5 space-y-2">
              {t.rescheduleList.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 md:p-8">
          <h2 className="text-lg sm:text-xl font-black text-brand-ink mb-4">
            <i className="fa-solid fa-list-check text-brand-orange mr-2"></i>{t.howToSubmit}
          </h2>
          <ol className="space-y-3 text-slate-600 leading-relaxed">
            {t.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-7 h-7 shrink-0 bg-orange-100 text-orange-600 font-black text-sm rounded-lg flex items-center justify-center">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}