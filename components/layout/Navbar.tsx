'use client';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';

const navDict = {
  ID: { home: 'Beranda', search: 'Cari Hotel', bookings: 'Pesanan', account: 'Akun Saya', myBookings: 'Pesanan Saya', loginAs: 'Login sebagai', logout: 'Keluar', locDetect: 'Mendeteksi...', locFail: 'Gagal deteksi', locDenied: 'Akses ditolak', locNoSupport: 'GPS tidak didukung', searchCity: 'Cari kota...', apply: 'Terapkan Lokasi', changeLoc: 'Ubah Lokasi' },
  EN: { home: 'Home', search: 'Search Hotel', bookings: 'Bookings', account: 'My Account', myBookings: 'My Bookings', loginAs: 'Logged in as', logout: 'Sign Out', locDetect: 'Detecting...', locFail: 'Detection failed', locDenied: 'Access denied', locNoSupport: 'GPS unsupported', searchCity: 'Search city...', apply: 'Apply Location', changeLoc: 'Change Location' }
};

export default function DashboardNavbar({ user }: { user: any }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  
  // State Lokasi & Bahasa
  const [language, setLanguage] = useState('ID');
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [location, setLocation] = useState('Jakarta');

  const t = navDict[language as keyof typeof navDict] || navDict.ID;

  useEffect(() => {
    // Muat bahasa awal
    const storedLang = localStorage.getItem('app_lang') || 'ID';
    setLanguage(storedLang);

    // Muat atau deteksi lokasi awal
    const storedLoc = localStorage.getItem('app_location');
    if (storedLoc) {
      setLocation(storedLoc);
    } else {
      setLocation(navDict[storedLang as keyof typeof navDict].locDetect);
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
              const data = await res.json();
              const city = data.address.city || data.address.town || data.address.county || data.address.state || 'Jakarta';
              setLocation(city);
              localStorage.setItem('app_location', city);
            } catch (error) {
              setLocation('Jakarta');
              localStorage.setItem('app_location', 'Jakarta');
            }
          },
          () => {
            setLocation('Jakarta');
            localStorage.setItem('app_location', 'Jakarta');
          } // Fallback jika ditolak
        );
      } else {
        setLocation('Jakarta');
        localStorage.setItem('app_location', 'Jakarta');
      }
    }

    // Listener jika state diubah dari komponen lain (opsional, untuk konsistensi)
    const handleStateChange = () => {
      setLanguage(localStorage.getItem('app_lang') || 'ID');
      setLocation(localStorage.getItem('app_location') || 'Jakarta');
    };
    window.addEventListener('appStateChange', handleStateChange);
    return () => window.removeEventListener('appStateChange', handleStateChange);
  }, []);

  const changeLanguage = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('app_lang', lang);
    window.dispatchEvent(new Event('appStateChange'));
    setIsLangOpen(false);
  };

  const accountLinks = [
    { href: '/bookings', label: t.myBookings, icon: 'fa-calendar-check' },
    { href: '/dashboard', label: t.account, icon: 'fa-user' },
  ];

  const displayInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50 transition-all">
      <div className="flex justify-between items-center w-full px-6 md:px-8 py-4 max-w-[1280px] mx-auto">
        
        {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="relative w-9 h-9 overflow-hidden rounded-lg bg-slate-50 border border-slate-200 group-hover:scale-105 transition-transform">
                 <Image src="/images/logo.svg" alt="The Mafia Travel Logo" fill className="object-contain p-1" loading="lazy"/>
              </div>
              <div className="text-xl md:text-2xl font-black tracking-tight font-display text-slate-900 hidden sm:block">
                The <span className="text-orange-600">Mafia</span> Travel
              </div>
            </Link>

        {/* Right Side (Tools & Profile) */}
        <div className="flex items-center gap-2 md:gap-4 relative">
          
          {/* Language Selector */}
          <div className="relative hidden sm:block">
            <button onClick={() => setIsLangOpen(!isLangOpen)} className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-orange-600 transition-colors py-1.5 px-2 rounded-lg hover:bg-slate-50">
              <i className="fa-solid fa-globe text-slate-400"></i> {language}
            </button>
            {isLangOpen && (
              <>
                <div onClick={() => setIsLangOpen(false)} className="fixed inset-0 z-40" />
                <div className="absolute right-0 top-[calc(100%+8px)] bg-white rounded-xl shadow-lg border border-slate-100 py-2 w-32 z-50 animate-fade-in">
                  <button onClick={() => changeLanguage('ID')} className={`w-full text-left px-4 py-2 text-sm font-bold hover:bg-orange-50 transition-colors ${language === 'ID' ? 'text-orange-600' : 'text-slate-600'}`}>🇮🇩 ID</button>
                  <button onClick={() => changeLanguage('EN')} className={`w-full text-left px-4 py-2 text-sm font-bold hover:bg-orange-50 transition-colors ${language === 'EN' ? 'text-orange-600' : 'text-slate-600'}`}>🇬🇧 EN</button>
                </div>
              </>
            )}
          </div>

          <div className="w-px h-6 bg-slate-200 hidden sm:block mx-1"></div>

          {/* Profile Menu */}
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500 p-0.5 transform transition-transform active:scale-95 bg-orange-50 flex items-center justify-center text-orange-600 font-bold shrink-0"
          >
            {user?.image ? <img src={user.image} alt="Profile" className="w-full h-full rounded-full object-cover" /> : <span>{displayInitial}</span>}
          </button>

          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40" />
              <div className="absolute right-0 top-[calc(100%+12px)] bg-white border border-gray-100 rounded-xl p-2 min-w-[240px] shadow-xl z-[200] animate-fade-in">
                <div className="px-4 py-3 border-b border-gray-50 mb-2 bg-slate-50/50 rounded-t-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-bold">{t.loginAs}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{user?.email}</p>
                </div>
                
                {/* Mobile Extra Menus */}
                <div className="mb-3 px-2">
                  {accountLinks.map(({ href, label, icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-all"
                    >
                      <i className={`fa-solid ${icon} w-4 text-orange-500`}></i>
                      {label}
                    </Link>
                  ))}
                </div>

                <div className="h-px bg-gray-100 my-2" />

                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold text-red-500 hover:bg-red-50 transition-all text-left"
                >
                  <i className="fa-solid fa-arrow-right-from-bracket w-4"></i> {t.logout}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </header>
  );
}