'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

/**
 * BAR BRAND halaman checkout.
 *
 * Isinya HANYA identitas brand — ikon, wordmark, dan tagline — dengan markup
 * yang diambil persis dari UnifiedNavbar (baris logo) sehingga header checkout
 * terlihat identik dengan header halaman utama. Menu, notifikasi, pemilih
 * bahasa, dan akun sengaja tidak ikut: fokus user harus tetap di form.
 *
 * Berbeda dengan UnifiedNavbar yang `fixed`, komponen ini memakai `sticky`
 * sehingga ikut dalam alur dokumen — halaman tidak perlu menambahkan padding
 * atas sendiri dan bar kedua (CheckoutStepBar) bisa menempel tepat di bawahnya.
 *
 * Sticky HANYA di desktop (`lg:sticky`). Di mobile bar ini justru ikut
 * ter-scroll ke atas, dan CheckoutStepBar yang menempel di puncak layar —
 * supaya row langkah selalu terlihat saat scroll tanpa menyita ~60px ruang
 * layar ponsel (total bar atas HP jadi ±49px). Logo tetap terlihat saat halaman
 * baru dibuka. Keduanya berdampingan di desktop (0–60px vs 60–109px).
 */
export default function CheckoutNavbar() {
  const { language } = useLanguage();
  const t = i18n.navbar[language];
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`lg:sticky lg:top-0 z-[1000] transition-all duration-300 border-b ${
        isScrolled
          ? 'bg-white/90 backdrop-blur-xl border-slate-200 shadow-sm'
          : 'bg-white border-slate-100'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm ring-1 ring-slate-900/5 group-hover:scale-105 transition-transform duration-200 shrink-0">
            <Image
              src="/icon.png"
              alt="The Mafia Travel"
              width={40}
              height={40}
              priority
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <div className="text-[15px] sm:text-lg font-extrabold tracking-tight text-brand-ink group-hover:text-brand-blue transition-colors duration-300 leading-tight">
              THE <span className="text-brand-orange">MAFIA</span> TRAVEL
            </div>
            <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-widest text-brand-blue -mt-0.5">
              {t.tagline}
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}
