'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getSupportWhatsAppUrl } from '@/lib/support';

export default function SupportWidget() {
  const { language } = useLanguage();
  const isEN = language === 'EN';

  const label = isEN ? 'Contact Us' : 'Hubungi Kami';
  const message = isEN
    ? 'Hello The Mafia Travel, I need help from the support team.'
    : 'Halo The Mafia Travel, saya butuh bantuan dari tim support.';

  const [hovered, setHovered] = useState(false);
  const [autoShow, setAutoShow] = useState(false);

  // On touch devices (no hover), show the bubble briefly after load.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(hover: hover)').matches) return;

    const showTimer = setTimeout(() => setAutoShow(true), 1400);
    const hideTimer = setTimeout(() => setAutoShow(false), 6000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const visible = hovered || autoShow;

  return (
    <div className="fixed bottom-5 right-5 z-[950] sm:bottom-6 sm:right-6">
      <div
        className="animate-support-float relative flex flex-col items-end"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* ── Speech bubble ── */}
        <div
          role="tooltip"
          className={`absolute bottom-full right-1 mb-3 origin-bottom-right transition-all duration-300 ease-out ${
            visible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0'
          }`}
        >
          <div className="relative flex items-center gap-2 whitespace-nowrap rounded-2xl border border-slate-100 bg-white px-4 py-2.5 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.35)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <i className="fa-brands fa-whatsapp text-sm" />
            </span>
            <span className="text-sm font-bold text-slate-800">{label}</span>

            {/* Tail */}
            <span className="absolute -bottom-[7px] right-5 h-3 w-3 rotate-45 rounded-[2px] border-b border-r border-slate-100 bg-white" />
          </div>
        </div>

        {/* ── Floating button ── */}
        <a
          href={getSupportWhatsAppUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-white p-0.5 shadow-[0_10px_30px_-6px_rgba(234,88,12,0.45)] ring-2 ring-brand-orange/70 transition-transform duration-300 hover:scale-105 active:scale-95 sm:h-16 sm:w-16"
        >
          <span className="relative h-full w-full">
            <span className="block h-full w-full overflow-hidden rounded-full">
              <Image
                src="/images/Customer_Service.png"
                alt={label}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="animate-support-ring pointer-events-none absolute inset-0 rounded-full" />
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </span>
        </a>
      </div>
    </div>
  );
}
