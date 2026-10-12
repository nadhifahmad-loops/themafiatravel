'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { getSupportWhatsAppUrl } from '@/lib/support';

export default function PartnerContent() {
  const { language } = useLanguage();
  const t = i18n.partnerPage[language];

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
            <i className="fa-solid fa-handshake text-brand-orange mr-2"></i>{t.partnersTitle}
          </h2>
          <p className="text-slate-600 leading-relaxed">
            {t.partnersText}
          </p>
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-black text-brand-ink mb-4">
            <i className="fa-solid fa-diagram-project text-brand-orange mr-2"></i>{t.typesTitle}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {t.types.map(item => (
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

        <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 shadow-card">
          <h3 className="text-xl font-black text-brand-ink mb-2">{t.ctaTitle}</h3>
          <p className="text-slate-500 font-medium">
            {t.ctaPrefix}{' '}
            <a
              href={getSupportWhatsAppUrl(t.waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-semibold hover:text-blue-700 hover:underline underline-offset-2 transition-colors"
            >
              {t.ctaLink}
            </a>{' '}
            {t.ctaSuffix}
          </p>
        </div>
      </section>
    </>
  );
}
