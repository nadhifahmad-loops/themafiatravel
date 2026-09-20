"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import LogoutConfirmButton from '@/components/auth/LogoutConfirmButton';
import NotificationBell from '@/components/layout/NotificationBell';

interface Props {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  showLanguageToggle?: boolean;
}

export default function UnifiedNavbar({ user, showLanguageToggle = true }: Props) {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const t = i18n.navbar[language];

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
      if (helpRef.current && !helpRef.current.contains(event.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (pathname?.includes('/checkout')) return null;

  const navLinks: { label: string; href: string; icon?: string; badge?: boolean }[] = [
    { label: t.flights, href: '/flight/search', icon: 'fa-plane' },
    { label: t.hotels, href: '/hotel/search', icon: 'fa-hotel' },
    { label: t.trains, href: '/train/search', icon: 'fa-train' },
    { label: t.insurance, href: '/insurance/search', icon: 'fa-shield-halved' },
    { label: t.discount, href: '/discount', icon: 'fa-percent' },
    { label: t.aboutUs, href: '/about', icon: 'fa-building' },
  ];

  const isActive = (href: string) => pathname?.startsWith(href);

  const displayInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';

  const rightCluster = user ? (
    <>
      <div className="hidden md:block">
        <NotificationBell isTransparent={false} />
      </div>

      <div className="relative hidden md:block" ref={menuRef}>
        <button onClick={() => setMenuOpen(!menuOpen)}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-full transition-all hover:bg-slate-100`}>
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-brand-orange bg-brand-orange/5 flex items-center justify-center">
            {user.image ? (
              <Image src={user.image} alt="Profile" width={36} height={36} className="w-full h-full object-cover" />
            ) : (
              <span className="font-black text-sm text-brand-orange">{displayInitial}</span>
            )}
          </div>
          <i className={`fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}></i>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+8px)] w-[240px] bg-white rounded-2xl border border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
            </div>
            <div className="p-1.5">
              <Link href="/account" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-blue/5 transition-all group">
                <i className="fa-solid fa-user text-slate-400 group-hover:text-brand-blue text-sm w-5 text-center"></i>
                <span className="text-[13px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{t.account}</span>
              </Link>
              <Link href="/bookings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-blue/5 transition-all group">
                <i className="fa-solid fa-ticket text-slate-400 group-hover:text-brand-blue text-sm w-5 text-center"></i>
                <span className="text-[13px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{t.myBookings}</span>
              </Link>
            </div>
            <div className="border-t border-slate-100 p-1.5">
              <LogoutConfirmButton
                callbackUrl="/"
                title={t.logout}
                description={t.logoutFrom}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 transition-all"
              >
                <i className="fa-solid fa-right-from-bracket text-sm w-5 text-center"></i>
                {t.logout}
              </LogoutConfirmButton>
            </div>
          </div>
        )}
      </div>
    </>
  ) : (
    <>
      <Link href="/register" className="hidden md:flex items-center px-4 py-1.5 rounded-full text-[12px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-brand-blue transition-all duration-200">
        {t.register}
      </Link>
      <Link href="/login" className="hidden md:flex items-center px-4 py-1.5 rounded-full text-[12px] font-bold bg-brand-blue hover:bg-[#28708f] text-white shadow-sm shadow-brand-blue/20 transition-all duration-200">
        {t.login}
      </Link>
    </>
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[1000]">
        {/* ===== ROW 1: LOGO + UTILITY (ID/EN • Find Booking • Auth) ===== */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">

            {/* LEFT: LOGO */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm ring-1 ring-slate-900/5 group-hover:scale-105 transition-transform duration-200 shrink-0">
                <Image src="/icon.png" alt="The Mafia Travel" width={40} height={40} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <div className="text-[15px] sm:text-lg font-extrabold tracking-tight text-brand-ink group-hover:text-brand-blue transition-colors duration-300 leading-tight">
                  THE <span className="text-brand-orange">MAFIA</span> TRAVEL
                </div>
                <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-widest text-brand-blue -mt-0.5">{t.tagline}</span>
              </div>
            </Link>

            {/* RIGHT: UTILITY CLUSTER */}
            <div className="flex items-center gap-3 md:gap-4">
                            {!user && showLanguageToggle && (
                <div className="flex items-center rounded-full bg-slate-100 p-0.5">
                {(['ID', 'EN'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all duration-200 ${
                      language === lang ? 'bg-brand-orange text-white shadow-sm' : 'text-slate-500 hover:text-brand-blue'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              )}

              {!user && (
                <>
                  <span className="hidden md:block w-px h-4 bg-slate-200" />

                  <Link href="/find-booking" className="hidden md:flex items-center gap-1.5 text-[12px] font-bold text-slate-600 hover:text-brand-blue transition-colors">
                    <i className="fa-solid fa-magnifying-glass text-[10px] text-brand-blue"></i>
                    {t.findBooking}
                  </Link>

                  <span className="hidden md:block w-px h-4 bg-slate-200" />
                </>
              )}

              {rightCluster}

              {/* HAMBURGER */}
              <button onClick={() => setIsMobileOpen(true)}
                className={`xl:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5 transition-all duration-300`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`w-5 h-[2px] rounded-full bg-slate-700`}></span>
                ))}
              </button>
            </div>
          </div>
        </div>

        {/* ===== ROW 2: MENU NAVBAR (Flights • Hotels • Trains • Insurance • Discount • About • Help) ===== */}
        <div className={`hidden xl:block bg-white border-t border-slate-100 transition-all duration-300 ${isScrolled ? 'shadow-md shadow-slate-900/5' : ''}`}>
          <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 h-12 flex items-center justify-center">
            <nav className="flex items-center md:gap-6 lg:gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`relative text-sm font-medium tracking-tight transition-all duration-300 ${
                    isActive(link.href)
                      ? 'text-brand-blue'
                      : 'text-slate-600 hover:text-brand-blue'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {link.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-orange/10 text-brand-orange rounded-full">{t.promoBadge}</span>
                    )}
                    {link.label}
                  </span>
                  {isActive(link.href) && (
                    <div className="absolute -bottom-2 left-0 w-full h-[2px] bg-brand-blue rounded-full"></div>
                  )}
                </Link>
              ))}

              {/* HELP DROPDOWN */}
              <div className="relative" ref={helpRef}>
                <button
                  onClick={() => setHelpOpen(!helpOpen)}
                  className={`relative text-sm font-medium tracking-tight transition-all duration-300 flex items-center gap-1.5 text-slate-600 hover:text-brand-blue`}
                >
                  {t.help}
                  <i className={`fa-solid fa-chevron-down text-[9px] transition-transform duration-300 ${helpOpen ? 'rotate-180' : ''}`}></i>
                </button>

                <div
                  className={`absolute left-0 top-[calc(100%+12px)] w-[240px] bg-white rounded-2xl border border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18)] overflow-hidden z-50 transition-all duration-300 origin-top ${
                    helpOpen
                      ? 'opacity-100 scale-y-100 translate-y-0 pointer-events-auto'
                      : 'opacity-0 scale-y-0 -translate-y-1 pointer-events-none'
                  }`}
                >
                <div className="p-1.5">
                    <Link href="/help" onClick={() => setHelpOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-blue/5 transition-all group">
                      <i className="fa-solid fa-headset text-slate-400 group-hover:text-brand-blue text-sm w-5 text-center"></i>
                      <span className="text-[13px] font-semibold text-slate-600 group-hover:text-brand-blue transition-colors">{t.helpCenter}</span>
                    </Link>
                    <Link href="/refund" onClick={() => setHelpOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-blue/5 transition-all group">
                      <i className="fa-solid fa-rotate-left text-slate-400 group-hover:text-brand-blue text-sm w-5 text-center"></i>
                      <span className="text-[13px] font-semibold text-slate-600 group-hover:text-brand-blue transition-colors">{t.refund}</span>
                    </Link>
                    <Link href="/terms" onClick={() => setHelpOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-blue/5 transition-all group">
                      <i className="fa-solid fa-file-contract text-slate-400 group-hover:text-brand-blue text-sm w-5 text-center"></i>
                      <span className="text-[13px] font-semibold text-slate-600 group-hover:text-brand-blue transition-colors">{t.terms}</span>
                    </Link>
                  </div>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* ===== MOBILE SIDEBAR ===== */}
      <div className={`fixed top-0 right-0 h-screen w-[88%] max-w-[360px] bg-white z-[1200] shadow-[0_0_50px_rgba(0,0,0,0.18)] transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm ring-1 ring-slate-900/5">
              <Image src="/icon.png" alt="The Mafia Travel" width={40} height={40} className="w-full h-full object-cover" />
            </div>
            <div className="text-[17px] font-extrabold tracking-tight text-brand-ink">
              THE <span className="text-brand-orange">MAFIA</span> TRAVEL
            </div>
          </div>
          <button aria-label={t.closeMenu} onClick={() => setIsMobileOpen(false)}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-5 overflow-y-auto h-[calc(100vh-82px)]">
          {user ? (
            <div className="space-y-3">
              {/* Profile — paling atas */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-brand-orange bg-brand-orange/5 flex items-center justify-center shrink-0">
                  {user.image ? (
                    <Image src={user.image} alt="Profile" width={40} height={40} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-black text-sm text-brand-orange">{displayInitial}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-800 truncate">{user.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                </div>
              </div>

              {/* Menu items */}
              <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden divide-y divide-slate-100 shadow-sm">
                <Link href="/account" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-3 px-4 py-3.5 hover:bg-brand-blue/5 transition-all group">
                  <i className="fa-solid fa-user-gear text-slate-400 group-hover:text-brand-blue text-sm w-5 text-center"></i>
                  <span className="text-[13px] font-bold text-slate-600 group-hover:text-brand-blue transition-colors">{t.account}</span>
                </Link>
                <Link href="/bookings" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-3 px-4 py-3.5 hover:bg-brand-blue/5 transition-all group">
                  <i className="fa-solid fa-ticket text-slate-400 group-hover:text-brand-blue text-sm w-5 text-center"></i>
                  <span className="text-[13px] font-bold text-slate-600 group-hover:text-brand-blue transition-colors">{t.myBookings}</span>
                </Link>
                <Link href="/help" onClick={() => setIsMobileOpen(false)} className={`flex items-center gap-3 px-4 py-3.5 hover:bg-brand-blue/5 transition-all group ${isActive('/help') ? 'bg-brand-blue/5' : ''}`}>
                  <i className="fa-solid fa-circle-question text-slate-400 group-hover:text-brand-blue text-sm w-5 text-center"></i>
                  <span className="text-[13px] font-bold text-slate-600 group-hover:text-brand-blue transition-colors">{t.help}</span>
                </Link>
              </div>

              <LogoutConfirmButton
                callbackUrl="/"
                title={t.logout}
                description={t.logoutFrom}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[13px] font-bold text-red-500 hover:bg-red-50 transition-all"
              >
                <i className="fa-solid fa-right-from-bracket text-sm w-5 text-center"></i>
                {t.logout}
              </LogoutConfirmButton>
            </div>
          ) : (
            <div className="space-y-2">
              <Link href="/find-booking" onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${isActive('/find-booking') ? 'bg-brand-blue/5 text-brand-blue border border-brand-blue/10' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                <i className="fa-solid fa-magnifying-glass w-5 text-brand-blue"></i>
                {t.findBooking}
              </Link>
              {navLinks.map((link) => (
                <Link key={link.label} href={link.href} onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${isActive(link.href) ? 'bg-brand-blue/5 text-brand-blue border border-brand-blue/10' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                  <i className={`fa-solid ${link.icon} w-5`}></i>
                  {link.badge && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-orange/10 text-brand-orange rounded-full">{t.promoBadge}</span>}
                  {link.label}
                </Link>
              ))}

              <Link href="/help" onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${isActive('/help') ? 'bg-brand-blue/5 text-brand-blue border border-brand-blue/10' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                <i className="fa-solid fa-circle-question w-5"></i>
                {t.help}
              </Link>

              <div className="mt-6 space-y-3">
                <Link href="/login" className="w-full flex items-center justify-center py-3.5 rounded-full bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/20">
                  {t.login}
                </Link>
                <Link href="/register" className="w-full flex items-center justify-center py-3.5 rounded-full border border-slate-200 text-sm font-bold text-slate-700">
                  {t.register}
                </Link>
              </div>
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