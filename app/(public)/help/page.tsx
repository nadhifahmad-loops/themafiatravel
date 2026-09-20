'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

export default function HelpPage() {
  const { language } = useLanguage();
  const t = i18n.helpPage[language];

  usePageTitle('Pusat Bantuan');

  const links = [
    { href: '/refund', icon: 'fa-rotate-left', title: t.refundTitle, desc: t.refundDesc },
    { href: '/terms', icon: 'fa-file-lines', title: t.termsTitle, desc: t.termsDesc },
    { href: '/privacy', icon: 'fa-shield-halved', title: t.privacyTitle, desc: t.privacyDesc },
  ];

  return (
    <>
      <header className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8 pt-3 sm:pt-4 md:pt-8 pb-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
          {t.title}
        </h1>
        <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium max-w-2xl">
          {t.subtitle}
        </p>
      </header>

      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {links.map(({ href, icon, title, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-slate-100 bg-white shadow-card hover:border-orange-300 hover:shadow-md transition-all group"
            >
              <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-brand-blue/10 text-brand-blue group-hover:bg-orange-50 group-hover:text-orange-500 flex items-center justify-center shrink-0 transition-colors">
                <i className={`fa-solid ${icon} text-base sm:text-lg`}></i>
              </span>
              <div className="min-w-0">
                <div className="text-[13px] sm:text-sm font-bold text-brand-ink group-hover:text-orange-600 transition-colors leading-snug">{title}</div>
                <div className="text-[13px] text-slate-400 mt-0.5 leading-snug">{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8 pb-6 space-y-3">
        {t.faqs.map((faq, i) => (
          <details key={i} className="group bg-white border border-slate-100 shadow-card rounded-2xl overflow-hidden">
            <summary className="px-4 sm:px-6 py-3 sm:py-4 cursor-pointer font-bold text-brand-ink hover:bg-slate-50 transition-colors list-none flex items-center justify-between min-h-[48px]">
              <span className="text-[14px] sm:text-[15px] leading-snug pr-3">{faq.q}</span>
              <i className="fa-solid fa-chevron-down text-slate-400 group-open:rotate-180 transition-transform shrink-0 text-[12px] sm:text-[13px]"></i>
            </summary>
            <div className="px-4 sm:px-6 pb-4 text-slate-600 leading-relaxed text-[13px] sm:text-[14px]">
              {faq.a}
            </div>
          </details>
        ))}
      </section>

      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8 pb-16 pt-6">
        <div className="text-center p-6 sm:p-8 bg-white rounded-2xl border border-slate-100 shadow-card">
          <h3 className="text-lg sm:text-xl font-black text-brand-ink mb-2">{t.stillQuestions}</h3>
          <p className="text-slate-500 font-medium text-[13px] sm:text-[14px]">{t.supportReady}</p>
        </div>
      </section>
    </>
  );
}