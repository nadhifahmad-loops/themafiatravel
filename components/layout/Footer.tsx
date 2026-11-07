'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { SUPPORT_EMAIL, getSupportWhatsAppUrl } from '@/lib/support';

const linkClass =
  'rounded-sm text-[13px] leading-6 text-white/65 transition-colors hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-brand-ink';

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
    { label: t.blog, href: '/blog' },
  ];

  const helpLinks = [
    { label: t.helpCenter, href: '/help' },
    { label: t.refundReschedule, href: '/refund' },
    { label: t.privacyPolicy, href: '/privacy' },
    { label: t.termsConditions, href: '/terms' },
  ];

  const supportMessage = language === 'ID'
    ? 'Halo The Mafia Travel, saya butuh bantuan.'
    : 'Hi The Mafia Travel, I need help.';

  return (
    <footer className="border-t border-white/10 bg-brand-ink text-white">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:gap-x-10 md:py-14 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-x-12">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-4 focus-visible:ring-offset-brand-ink"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-white/15">
                <Image src="/icon.png" alt="" width={40} height={40} className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-extrabold leading-tight tracking-tight text-white">
                  THE <span className="text-brand-orange">MAFIA</span> TRAVEL
                </span>
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-sky sm:text-[10px]">
                  {t.tagline}
                </span>
              </div>
            </Link>

            <div className="mt-6 space-y-2.5">
              <a
                href={getSupportWhatsAppUrl(supportMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className={`group inline-flex items-center gap-2.5 ${linkClass}`}
              >
                <i
                  className="fa-brands fa-whatsapp w-4 text-center text-base text-brand-sky transition-colors group-hover:text-brand-orange"
                  aria-hidden="true"
                />
                WhatsApp
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className={`group flex items-center gap-2.5 ${linkClass}`}>
                <i
                  className="fa-regular fa-envelope w-4 text-center text-brand-sky transition-colors group-hover:text-brand-orange"
                  aria-hidden="true"
                />
                <span className="break-all">{SUPPORT_EMAIL}</span>
              </a>
            </div>
          </div>

          {/* Layanan */}
          <nav aria-label={t.services}>
            <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-white/90">
              {t.services}
            </h3>
            <ul className="space-y-2.5">
              {servicesLinks.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Perusahaan */}
          <nav aria-label={t.company}>
            <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-white/90">
              {t.company}
            </h3>
            <ul className="space-y-2.5">
              {companyLinks.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Bantuan */}
          <nav aria-label={t.help} className="col-span-2 lg:col-span-1">
            <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-white/90">
              {t.help}
            </h3>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 lg:grid-cols-1">
              {helpLinks.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-center border-t border-white/10 py-5 md:py-6">
          <p className="text-center text-[11px] text-white/50 sm:text-xs">
            {t.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
