"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import LogoutConfirmButton from '@/components/auth/LogoutConfirmButton';

interface Props {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

export default function UnifiedNavbar({ user }: Props) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const t = i18n.navbar[language];

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (pathname?.includes('/checkout')) return null;

  const navLinks = user ? [] : [
    { href: '/find-booking', label: t.findBooking, icon: 'fa-magnifying-glass' },
  ];

  const isActive = (href: string) => pathname?.startsWith(href);
  const isLandingPage = pathname === '/';
  const isTransparent = isLandingPage && !isScrolled;

  const displayInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-300 border-b ${
          isTransparent
            ? 'bg-transparent border-transparent py-4'
            : isScrolled
            ? 'bg-white/90 backdrop-blur-xl border-slate-200 py-3 shadow-sm'
            : 'bg-white border-slate-100 py-4'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">

            {/* ===== LEFT ===== */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-3 shrink-0">
                <div className="relative w-10 h-10 sm:hidden">
                  <Image src="/images/logo.png" alt="The Mafia Travel" fill priority sizes="40px" className="object-contain" />
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <div className={`relative w-11 h-11 rounded-2xl overflow-hidden transition-all duration-300 ${isTransparent ? 'bg-white/10 backdrop-blur-md' : 'bg-slate-50'}`}>
                    <Image src="/images/logo.png" alt="The Mafia Travel" fill priority sizes="44px" className="object-contain p-1" />
                  </div>
                  <div className="flex flex-col leading-none">
                    <div className={`flex items-end gap-1 transition-colors duration-300 ${isTransparent ? 'text-white' : 'text-slate-900'}`}>
                      <span className="text-[22px] font-black tracking-tight">The</span>
                      <span className="text-[22px] font-black tracking-tight text-orange-600">Mafia</span>
                      <span className="text-[18px] font-light tracking-wide">Travel</span>
                    </div>
                    <span className={`text-[9px] uppercase tracking-[0.25em] mt-1 font-bold ${isTransparent ? 'text-white/60' : 'text-slate-400'}`}>
                      Smart Journey Solution
                    </span>
                  </div>
                </div>
              </Link>

              <nav className="hidden xl:flex items-center gap-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative text-sm font-bold tracking-tight transition-all duration-300 ${
                      isActive(link.href)
                        ? 'text-orange-600'
                        : isTransparent
                        ? 'text-white/90 hover:text-white'
                        : 'text-slate-500 hover:text-orange-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <i className={`fa-solid ${link.icon} text-[11px]`}></i>
                      {link.label}
                    </span>
                    {isActive(link.href) && (
                      <div className="absolute -bottom-2 left-0 w-full h-[2px] bg-orange-600 rounded-full"></div>
                    )}
                  </Link>
                ))}
              </nav>
            </div>

            {/* ===== RIGHT ===== */}
            <div className="flex items-center gap-2 md:gap-3">

              {/* USER / AUTH */}
              {user ? (
                <div className="relative hidden md:block" ref={menuRef}>
                  <button onClick={() => setMenuOpen(!menuOpen)}
                    className={`flex items-center gap-3 px-2 py-1.5 rounded-2xl transition-all ${isTransparent ? 'hover:bg-white/10' : 'hover:bg-orange-50'}`}>
                    <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-orange-500 bg-orange-50 flex items-center justify-center">
                      {user.image ? (
                        <Image src={user.image} alt="Profile" width={36} height={36} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-black text-sm text-orange-600">{displayInitial}</span>
                      )}
                    </div>
                    <span className={`text-sm font-black ${isTransparent ? 'text-white' : 'text-slate-700'}`}>
                      {user.name?.split(' ')[0]}
                    </span>
                    <i className={`fa-solid fa-chevron-down text-[10px] ${isTransparent ? 'text-white/60' : 'text-slate-400'}`}></i>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-[calc(100%+12px)] w-[260px] bg-white rounded-3xl border border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18)] overflow-hidden z-50">
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-[10px] uppercase tracking-[0.15em] font-black text-slate-400">{t.personalTools}</p>
                      </div>
                      <div className="p-2 pt-0">
                        <Link href="/account" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-orange-50 transition-all group">
                          <span className="w-9 h-9 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                            <i className="fa-solid fa-user-gear text-blue-500 text-sm"></i>
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-black text-slate-800 group-hover:text-orange-600 transition-colors">{t.account}</div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{t.accountDesc}</div>
                          </div>
                          <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-orange-400 text-[10px] transition-colors"></i>
                        </Link>
                        <Link href="/bookings" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-orange-50 transition-all group">
                          <span className="w-9 h-9 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                            <i className="fa-solid fa-calendar-check text-blue-500 text-sm"></i>
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-black text-slate-800 group-hover:text-orange-600 transition-colors">{t.myBookings}</div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{t.bookingsDesc}</div>
                          </div>
                          <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-orange-400 text-[10px] transition-colors"></i>
                        </Link>
                      </div>
                      <div className="mx-4 border-t border-slate-100 my-1"></div>
                      <div className="p-2">
                        <LogoutConfirmButton
                          callbackUrl="/"
                          title={t.logout}
                          description={t.logoutFrom}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all"
                        >
                          <i className="fa-solid fa-arrow-right-from-bracket w-4"></i>
                          {t.logout}
                        </LogoutConfirmButton>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-3">
                  <Link href="/login" className={`px-5 py-2.5 rounded-2xl text-sm font-bold border transition-all duration-300 ${isTransparent ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    {t.login}
                  </Link>
                  <Link href="/register" className="px-5 py-2.5 rounded-2xl text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20 transition-all">
                    {t.register}
                  </Link>
                </div>
              )}

              {/* HAMBURGER */}
              <button onClick={() => setIsMobileOpen(true)}
                className={`xl:hidden w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all duration-300 ${isTransparent ? 'bg-white/10 border-white/10 backdrop-blur-md' : 'bg-white border-slate-200'}`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`w-5 h-[2px] rounded-full ${isTransparent ? 'bg-white' : 'bg-slate-700'}`}></span>
                ))}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== MOBILE SIDEBAR ===== */}
      <div className={`fixed top-0 right-0 h-screen w-[88%] max-w-[360px] bg-white z-[1200] shadow-[0_0_50px_rgba(0,0,0,0.18)] transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image src="/images/logo.png" alt="Logo" fill className="object-contain" crossOrigin="anonymous" />
            </div>
            <div>
              <div className="font-black text-slate-900">The <span className="text-orange-600">Mafia</span></div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Travel</div>
            </div>
          </div>
          <button aria-label={t.closeMenu} onClick={() => setIsMobileOpen(false)}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-5 overflow-y-auto h-[calc(100vh-82px)]">
          <div className="space-y-2">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${isActive(link.href) ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                <i className={`fa-solid ${link.icon} w-5`}></i>
                {link.label}
              </Link>
            ))}
          </div>

          {user ? (
            <div className="mt-5 space-y-3">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 shadow-lg shadow-orange-500/25">
                <div className="pointer-events-none absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/10" />
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/30 bg-white/20 flex items-center justify-center shadow-md shrink-0">
                    {user.image ? (
                      <Image src={user.image} alt="Profile" width={56} height={56} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-black text-xl text-white">{displayInitial}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-white text-[15px] leading-tight truncate">{user.name}</div>
                    <div className="text-[11px] text-white/70 mt-0.5 truncate">{user.email}</div>
                    <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-white/20 border border-white/20">
                      <i className="fa-solid fa-circle-check text-white text-[9px]"></i>
                      <span className="text-[10px] font-black text-white uppercase tracking-wide">{t.activeMember}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-1 mb-1 px-2">
                <p className="text-[10px] uppercase tracking-[0.15em] font-black text-slate-400">{t.personalTools}</p>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden divide-y divide-slate-100 shadow-sm">
                <Link href="/account" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-3.5 px-5 py-4 hover:bg-orange-50 transition-all active:scale-[0.98] group">
                  <span className="w-9 h-9 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                    <i className="fa-solid fa-user-gear text-blue-500 text-sm"></i>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-black text-slate-800 group-hover:text-orange-600 transition-colors">{t.account}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{t.accountDesc}</div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-orange-400 text-[10px] transition-colors"></i>
                </Link>
                <Link href="/bookings" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-3.5 px-5 py-4 hover:bg-orange-50 transition-all active:scale-[0.98] group">
                  <span className="w-9 h-9 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                    <i className="fa-solid fa-calendar-check text-blue-500 text-sm"></i>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-black text-slate-800 group-hover:text-orange-600 transition-colors">{t.myBookings}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{t.bookingsDesc}</div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-orange-400 text-[10px] transition-colors"></i>
                </Link>
              </div>

              <LogoutConfirmButton
                callbackUrl="/"
                title={t.logout}
                description={t.logoutFrom}
                className="w-full flex items-center gap-3.5 px-5 py-4 rounded-3xl border border-red-100 bg-red-50 hover:bg-red-100 transition-all active:scale-[0.98] group"
              >
                <span className="w-9 h-9 rounded-xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center shrink-0 transition-colors">
                  <i className="fa-solid fa-arrow-right-from-bracket text-red-400 text-sm"></i>
                </span>
                <div className="text-left flex-1">
                  <div className="text-[13px] font-black text-red-500">{t.logout}</div>
                  <div className="text-[10px] text-red-400 font-medium mt-0.5">{t.logoutFrom}</div>
                </div>
              </LogoutConfirmButton>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              <Link href="/login" className="w-full flex items-center justify-center py-3.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700">
                {t.login}
              </Link>
              <Link href="/register" className="w-full flex items-center justify-center py-3.5 rounded-2xl bg-orange-600 text-white text-sm font-black shadow-lg shadow-orange-600/20">
                {t.register}
              </Link>
            </div>
          )}
        </div>
      </div>

      {isMobileOpen && (
        <div onClick={() => setIsMobileOpen(false)} className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[1100]" />
      )}
    </>
  );
}
