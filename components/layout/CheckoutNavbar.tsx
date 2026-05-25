'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function CheckoutNavbar() {
  return (
    <header className="sticky top-0 left-0 right-0 z-[1000] bg-white/90 backdrop-blur-xl border-b border-slate-100 py-4 shadow-sm transition-all duration-300">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* ===== BRAND (Logo & Nama Saja) ===== */}
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0 select-none group"
          >
            {/* CONTAINER LOGO */}
            <div className="relative w-10 h-10 md:w-11 md:h-11 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100/80 transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/images/logo.png"
                alt="The Mafia Travel"
                fill
                priority
                sizes="44px"
                className="object-contain p-1"
              />
            </div>

            {/* KONTEN TEKS BRAND */}
            <div className="flex flex-col leading-none">
              <div className="flex items-end gap-1 text-slate-900">
                <span className="text-[18px] sm:text-[20px] md:text-[22px] font-black tracking-tight">
                  The
                </span>

                <span className="text-[18px] sm:text-[20px] md:text-[22px] font-black tracking-tight text-orange-600">
                  Mafia
                </span>

                <span className="text-[15px] sm:text-[17px] md:text-[18px] font-light tracking-wide text-slate-700">
                  Travel
                </span>
              </div>

              <span className="text-[8px] md:text-[9px] uppercase tracking-[0.25em] mt-1 font-bold text-slate-400">
                Smart Journey Solution
              </span>
            </div>
          </Link>

          {/* ===== SISI KANAN (KOSONG / DAPAT DIISI BADGE SECURE JIKA DIINGINKAN) ===== */}

        </div>
      </div>
    </header>
  );
}