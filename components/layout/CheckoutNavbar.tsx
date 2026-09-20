'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function CheckoutNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-300 border-b ${
        isScrolled
          ? 'bg-white/90 backdrop-blur-xl border-slate-200 py-4 shadow-sm'
          : 'bg-white border-slate-100 py-4'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="text-[17px] sm:text-[20px] font-bold tracking-[-0.02em] text-slate-800">
              THE <span className="text-orange-600">MAFIA</span> TRAVEL
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
