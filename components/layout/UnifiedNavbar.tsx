"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface Props {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

const LANGUAGES = [
  { code: 'ID', label: 'Bahasa Indonesia' },
  { code: 'EN', label: 'English' },
];

const CURRENCIES = [
  { code: 'IDR', label: 'Rupiah Indonesia', countryCode: 'ID' },
  { code: 'USD', label: 'US Dollar', countryCode: 'US' },
  { code: 'SGD', label: 'Singapore Dollar', countryCode: 'SG' },
  { code: 'MYR', label: 'Malaysian Ringgit', countryCode: 'MY' },
  { code: 'EUR', label: 'Euro', countryCode: 'EU' },
  { code: 'GBP', label: 'British Pound', countryCode: 'GB' },
  { code: 'AUD', label: 'Australian Dollar', countryCode: 'AU' },
  { code: 'JPY', label: 'Japanese Yen', countryCode: 'JP' },
];

const FlagIcon = ({
  countryCode,
  size = 15,
  isRound = false,
}: {
  countryCode: string;
  size?: number;
  isRound?: boolean;
}) => (
  <div
    style={{
      width: isRound ? size : size * 1.4,
      height: size,
      borderRadius: isRound ? '50%' : '4px',
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid rgba(255,255,255,0.08)',
      flexShrink: 0,
    }}
  >
    <Image
      src={`/images/flags/${countryCode}.png`}
      alt={`Flag ${countryCode}`}
      fill
      sizes="30px"
      className="object-cover"
    />
  </div>
);

export default function UnifiedNavbar({ user }: Props) {
  const pathname = usePathname();

  if (pathname?.includes('/checkout')) {
    return null; 
  }

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingOpen, setSettingOpen] = useState(false);

  const [language, setLanguage] = useState('ID');
  const [currency, setCurrency] = useState('IDR');

  const [tempLang, setTempLang] = useState('ID');
  const [tempCurr, setTempCurr] = useState('IDR');

  // Referensi untuk deteksi klik di luar elemen
  const settingRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Deteksi scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Ambil data lokal
  useEffect(() => {
    const storedLang = localStorage.getItem('app_lang') || 'ID';
    const storedCurr = localStorage.getItem('app_currency') || 'IDR';

    setLanguage(storedLang);
    setCurrency(storedCurr);

    setTempLang(storedLang);
    setTempCurr(storedCurr);
  }, []);

  // Handler klik di luar dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingRef.current && !settingRef.current.contains(event.target as Node)) {
        setSettingOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navLinks = user
    ? []
    : [
        {
          href: '/find-booking',
          label: 'Cari Pesanan',
          icon: 'fa-magnifying-glass',
        },
      ];

  const isActive = (href: string) => pathname?.startsWith(href);

  const currentLangData =
    LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const currentCurrData =
    CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  const isLandingPage = pathname === '/';
  const isTransparent = isLandingPage && !isScrolled;

  const handleSaveSettings = () => {
    setLanguage(tempLang);
    setCurrency(tempCurr);

    localStorage.setItem('app_lang', tempLang);
    localStorage.setItem('app_currency', tempCurr);

    setSettingOpen(false);
  };

  const displayInitial =
    user?.name?.charAt(0)?.toUpperCase() || 'U';

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
              
              {/* BRAND */}
              <Link
                href="/"
                className="flex items-center gap-3 shrink-0"
              >
                {/* MOBILE -> LOGO ONLY */}
                <div className="relative w-10 h-10 sm:hidden">
                  <Image
                    src="/images/logo.png"
                    alt="The Mafia Travel"
                    fill
                    priority
                    sizes="40px"
                    className="object-contain"
                  />
                </div>

                {/* TABLET & DESKTOP */}
                <div className="hidden sm:flex items-center gap-3">
                  <div
                    className={`relative w-11 h-11 rounded-2xl overflow-hidden transition-all duration-300 ${
                      isTransparent
                        ? 'bg-white/10 backdrop-blur-md'
                        : 'bg-slate-50'
                    }`}
                  >
                    <Image
                      src="/images/logo.png"
                      alt="The Mafia Travel"
                      fill
                      priority
                      sizes="44px"
                      className="object-contain p-1"
                    />
                  </div>

                  <div className="flex flex-col leading-none">
                    <div
                      className={`flex items-end gap-1 transition-colors duration-300 ${
                        isTransparent
                          ? 'text-white'
                          : 'text-slate-900'
                      }`}
                    >
                      <span className="text-[22px] font-black tracking-tight">
                        The
                      </span>

                      <span className="text-[22px] font-black tracking-tight text-orange-600">
                        Mafia
                      </span>

                      <span className="text-[18px] font-light tracking-wide">
                        Travel
                      </span>
                    </div>

                    <span
                      className={`text-[9px] uppercase tracking-[0.25em] mt-1 font-bold ${
                        isTransparent
                          ? 'text-white/60'
                          : 'text-slate-400'
                      }`}
                    >
                      Smart Journey Solution
                    </span>
                  </div>
                </div>
              </Link>

              {/* NAV DESKTOP */}
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
                      <i
                        className={`fa-solid ${link.icon} text-[11px]`}
                      ></i>
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

              {/* SETTINGS */}
              <div className="relative" ref={settingRef}>
                <button
                  onClick={() => {
                    setTempLang(language);
                    setTempCurr(currency);
                    setSettingOpen(!settingOpen);
                  }}
                  className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 rounded-2xl border transition-all duration-300 ${
                    isTransparent
                      ? 'border-white/10 bg-white/10 backdrop-blur-md text-white hover:bg-white/15'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50'
                  }`}
                >
                  <FlagIcon
                    countryCode={currentCurrData.countryCode}
                    size={14}
                  />

                  <span className="text-[11px] md:text-xs font-black">
                    {currency}
                  </span>

                  <div
                    className={`w-px h-4 ${
                      isTransparent
                        ? 'bg-white/20'
                        : 'bg-slate-200'
                    }`}
                  ></div>

                  <span className="text-[11px] md:text-xs font-black">
                    {currentLangData.code}
                  </span>

                  <i className="fa-solid fa-chevron-down text-[10px] opacity-60"></i>
                </button>

                {settingOpen && (
                  <div
                    className="
                      fixed md:absolute
                      left-1/2 md:left-auto
                      md:right-0
                      top-1/2 md:top-full
                      -translate-x-1/2 md:translate-x-0
                      -translate-y-1/2 md:translate-y-0
                      md:mt-3

                      w-[92vw]
                      max-w-[420px]
                      md:max-w-[620px]
                      md:w-[620px]

                      max-h-[85vh]
                      overflow-hidden

                      bg-white
                      rounded-[28px]
                      shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)]
                      border border-slate-100
                      z-50
                      animate-fade-in
                    "
                  >
                    
                    {/* HEADER */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                      <div>
                        <h3 className="font-black text-slate-800 text-[15px]">
                          Pengaturan Regional
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Atur bahasa dan mata uang aplikasi
                        </p>
                      </div>

                      <button
                        onClick={() => setSettingOpen(false)}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all flex items-center justify-center shrink-0"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    {/* CONTENT */}
                    <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
                      <div className="p-4 md:p-5">

                        {/* DESKTOP 2 COLUMNS, MOBILE STACK */}
                        <div className="flex flex-col md:grid md:grid-cols-[1.5fr_1fr] gap-5">

                          {/* CURRENCY (2 COLUMNS DI LAPTOP) */}
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-3">
                              Mata Uang
                            </label>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                              {CURRENCIES.map(c => (
                                <button
                                  key={c.code}
                                  onClick={() => setTempCurr(c.code)}
                                  className={`
                                    w-full flex items-center justify-between
                                    px-4 py-3 rounded-2xl border
                                    transition-all text-left
                                    ${
                                      tempCurr === c.code
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-slate-200 hover:bg-slate-50'
                                    }
                                  `}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <FlagIcon
                                      countryCode={c.countryCode}
                                      size={18}
                                      isRound={false}
                                    />

                                    <div className="min-w-0">
                                      <div className="font-black text-[14px] text-slate-800">
                                        {c.code}
                                      </div>

                                      <div className="text-[11px] text-slate-400 truncate">
                                        {c.label}
                                      </div>
                                    </div>
                                  </div>

                                  {tempCurr === c.code && (
                                    <i className="fa-solid fa-circle-check text-orange-500 text-lg shrink-0"></i>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* LANGUAGE */}
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-3">
                              Bahasa
                            </label>

                            <div className="space-y-2">
                              {LANGUAGES.map(l => (
                                <button
                                  key={l.code}
                                  onClick={() => setTempLang(l.code)}
                                  className={`
                                    w-full flex items-center justify-between
                                    px-4 py-3 rounded-2xl border
                                    transition-all text-left
                                    ${
                                      tempLang === l.code
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-slate-200 hover:bg-slate-50'
                                    }
                                  `}
                                >
                                  <span className="font-bold text-[14px] text-slate-700">
                                    {l.label}
                                  </span>

                                  {tempLang === l.code && (
                                    <i className="fa-solid fa-circle-check text-orange-500 text-lg"></i>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* BUTTON */}
                        <div className="pt-5">
                          <button
                            onClick={handleSaveSettings}
                            className="
                              w-full py-3.5
                              rounded-2xl
                              bg-orange-600 hover:bg-orange-700
                              text-white
                              font-black
                              text-[14px]
                              shadow-lg shadow-orange-600/20
                              transition-all
                              active:scale-[0.98]
                            "
                          >
                            Simpan Perubahan
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* USER / AUTH */}
              {user ? (
                <div className="relative hidden md:block" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className={`flex items-center gap-3 px-2 py-1.5 rounded-2xl transition-all ${
                      isTransparent
                        ? 'hover:bg-white/10'
                        : 'hover:bg-orange-50'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-orange-500 bg-orange-50 flex items-center justify-center">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-black text-sm text-orange-600">
                          {displayInitial}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-sm font-black ${
                        isTransparent
                          ? 'text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      {user.name?.split(' ')[0]}
                    </span>

                    <i
                      className={`fa-solid fa-chevron-down text-[10px] ${
                        isTransparent
                          ? 'text-white/60'
                          : 'text-slate-400'
                      }`}
                    ></i>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-[calc(100%+12px)] w-[240px] bg-white rounded-3xl border border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18)] overflow-hidden z-50">
                      
                      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 mb-1">
                          Login sebagai
                        </p>

                        <p className="text-sm font-black text-slate-800 truncate">
                          {user.email}
                        </p>
                      </div>

                      <div className="p-2">
                        <Link
                          href="/bookings"
                          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-all"
                        >
                          <i className="fa-solid fa-calendar-check text-orange-500 w-4"></i>
                          Pesanan Saya
                        </Link>

                        <Link
                          href="/account"
                          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-all"
                        >
                          <i className="fa-solid fa-user-gear text-orange-500 w-4"></i>
                          Ubah Profil
                        </Link>

                        <div className="h-px bg-slate-100 my-2"></div>

                        <button
                          onClick={() =>
                            signOut({ callbackUrl: '/' })
                          }
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all"
                        >
                          <i className="fa-solid fa-arrow-right-from-bracket w-4"></i>
                          Keluar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-3">
                  <Link
                    href="/login"
                    className={`px-5 py-2.5 rounded-2xl text-sm font-bold border transition-all duration-300 ${
                      isTransparent
                        ? 'border-white/20 text-white hover:bg-white/10'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Masuk
                  </Link>

                  <Link
                    href="/register"
                    className="px-5 py-2.5 rounded-2xl text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20 transition-all"
                  >
                    Daftar
                  </Link>
                </div>
              )}

              {/* HAMBURGER */}
              <button
                onClick={() => setIsMobileOpen(true)}
                className={`xl:hidden w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all duration-300 ${
                  isTransparent
                    ? 'bg-white/10 border-white/10 backdrop-blur-md'
                    : 'bg-white border-slate-200'
                }`}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`w-5 h-[2px] rounded-full ${
                      isTransparent
                        ? 'bg-white'
                        : 'bg-slate-700'
                    }`}
                  ></span>
                ))}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== MOBILE SIDEBAR ===== */}
      <div
        className={`fixed top-0 right-0 h-screen w-[88%] max-w-[360px] bg-white z-[1200] shadow-[0_0_50px_rgba(0,0,0,0.18)] transition-transform duration-300 ${
          isMobileOpen
            ? 'translate-x-0'
            : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image
                src="/images/logo.png"
                alt="Logo"
                fill
                className="object-contain"
              />
            </div>

            <div>
              <div className="font-black text-slate-900">
                The <span className="text-orange-600">Mafia</span>
              </div>

              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                Travel
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsMobileOpen(false)}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-5 overflow-y-auto h-[calc(100vh-82px)]">
          
          {/* MOBILE NAV */}
          <div className="space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${
                  isActive(link.href)
                    ? 'bg-orange-50 text-orange-600 border border-orange-100'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <i
                  className={`fa-solid ${link.icon} w-5`}
                ></i>

                {link.label}
              </Link>
            ))}
          </div>

          {/* ===== MOBILE USER (LOGGED IN) ===== */}
          {user ? (
            <div className="mt-5 space-y-3">

              {/* PROFILE CARD */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 shadow-lg shadow-orange-500/25">
                <div className="pointer-events-none absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/10" />

                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/30 bg-white/20 flex items-center justify-center shadow-md shrink-0">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-black text-xl text-white">
                        {displayInitial}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-black text-white text-[15px] leading-tight truncate">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-white/70 mt-0.5 truncate">
                      {user.email}
                    </div>
                    <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-white/20 border border-white/20">
                      <i className="fa-solid fa-circle-check text-white text-[9px]"></i>
                      <span className="text-[10px] font-black text-white uppercase tracking-wide">
                        Member Aktif
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* MENU LIST */}
              <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden divide-y divide-slate-100 shadow-sm">
                <Link
                  href="/bookings"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-3.5 px-5 py-4 hover:bg-orange-50 transition-all active:scale-[0.98] group"
                >
                  <span className="w-9 h-9 rounded-xl bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center shrink-0 transition-colors">
                    <i className="fa-solid fa-calendar-check text-orange-500 text-sm"></i>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-black text-slate-800 group-hover:text-orange-600 transition-colors">
                      Pesanan Saya
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Lihat riwayat booking
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-orange-400 text-[10px] transition-colors"></i>
                </Link>

                <Link
                  href="/account"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-3.5 px-5 py-4 hover:bg-orange-50 transition-all active:scale-[0.98] group"
                >
                  <span className="w-9 h-9 rounded-xl bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center shrink-0 transition-colors">
                    <i className="fa-solid fa-user-gear text-orange-500 text-sm"></i>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-black text-slate-800 group-hover:text-orange-600 transition-colors">
                      Ubah Profil
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Kelola informasi akun
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-orange-400 text-[10px] transition-colors"></i>
                </Link>
              </div>

              {/* LOGOUT BUTTON */}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full flex items-center gap-3.5 px-5 py-4 rounded-3xl border border-red-100 bg-red-50 hover:bg-red-100 transition-all active:scale-[0.98] group"
              >
                <span className="w-9 h-9 rounded-xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center shrink-0 transition-colors">
                  <i className="fa-solid fa-arrow-right-from-bracket text-red-400 text-sm"></i>
                </span>
                <div className="text-left flex-1">
                  <div className="text-[13px] font-black text-red-500">Keluar</div>
                  <div className="text-[10px] text-red-400 font-medium mt-0.5">
                    Logout dari akun ini
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              <Link
                href="/login"
                className="w-full flex items-center justify-center py-3.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700"
              >
                Masuk
              </Link>

              <Link
                href="/register"
                className="w-full flex items-center justify-center py-3.5 rounded-2xl bg-orange-600 text-white text-sm font-black shadow-lg shadow-orange-600/20"
              >
                Daftar
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* OVERLAY UNTUK MOBILE SIDEBAR SAJA */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[1100]"
        />
      )}
    </>
  );
}