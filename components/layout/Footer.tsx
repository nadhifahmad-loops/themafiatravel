'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

export default function Footer() {
  const { language } = useLanguage();
  const homeT = i18n.home[language];
  const t = homeT.footer;

  const servicesLinks = [
    { label: t.flights, href: '/flight/search' },
    { label: t.hotels, href: '/hotel/search' },
    { label: t.trains, href: '/train/search' },
    { label: t.insurance, href: '/insurance/search' },
  ];

  const companyLinks = [
    { label: t.about, href: '/about' },
    { label: t.career, href: '/career' },
    { label: t.partner, href: '/partner' },
    { label: 'Blog', href: '/blog' },
  ];

  const helpLinks = [
    { label: t.helpCenter, href: '/help' },
    { label: t.refundReschedule, href: '/refund' },
    { label: t.privacyPolicy, href: '/privacy' },
    { label: t.termsConditions, href: '/terms' },
  ];

  return (
    <footer className="bg-brand-ink text-white pt-16 pb-12 border-t border-white/10">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-4 md:gap-10 pb-12 border-b border-white/10">
          {/* Col 1: Brand & Bio — full width on mobile, 4 cols on lg */}
          <div className="col-span-2 md:col-span-1 lg:col-span-4">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-white p-0.5 shrink-0">
                <Image src="/icon.png" alt="The Mafia Travel" width={44} height={44} className="w-full h-full object-cover rounded-lg" />
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-tight text-white">
                  THE <span className="text-brand-orange">MAFIA</span> TRAVEL
                </span>
                <span className="block text-[9px] uppercase font-bold tracking-widest text-brand-sky">{t.tagline}</span>
              </div>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm mb-6">
              {t.tagline}
            </p>
            <div className="flex items-center gap-3">
              {['fa-facebook', 'fa-instagram', 'fa-twitter', 'fa-tiktok'].map(s => (
                <a key={s} href="#" aria-label={s} className="w-9 h-9 rounded-full bg-white/5 hover:bg-brand-blue flex items-center justify-center text-slate-300 hover:text-white transition-colors">
                  <i className={`fa-brands ${s} text-sm`} />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2: Layanan — 4 cols */}
          <div className="lg:col-span-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">{t.services}</h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-400">
              {servicesLinks.map(link => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-brand-orange transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Info & Bantuan — 4 cols */}
          <div className="lg:col-span-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">{t.help}</h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-400">
              {companyLinks.map(link => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-brand-orange transition-colors">{link.label}</Link>
                </li>
              ))}
              {helpLinks.map(link => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-brand-orange transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-center text-xs text-slate-500">
          <p>{t.copyright}</p>
        </div>
      </div>
    </footer>
  );
}