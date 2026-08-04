'use client';
import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { safeCallbackUrl } from '@/lib/security';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

export default function LoginPage() {
  const { language } = useLanguage();
  const t = i18n.login[language];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  
  // Menangkap URL asal untuk redirect otomatis setelah login.
  // Sanitasi untuk mencegah open redirect (hanya URL internal yang diizinkan).
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));

  // ─── Pengaman ekstra: jika user SEBENARNYA sudah login (cookie sesi ada di browser)
  // tapi navigasi gagal/terblokir, halaman login otomatis pindah ke callbackUrl.
  // Menyembuhkan kasus "berhasil login tapi tidak redirect" tanpa restart server.
  const { status: sessionStatus } = useSession();
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      window.location.href = callbackUrl;
    }
  }, [sessionStatus, callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); 
    setError('');
    
    try {
      // Timeout pengaman: jangan sampai spinner login muter selamanya
      // (masalah umum signIn() client next-auth yang tidak pernah resolve).
      const res = await Promise.race([
        signIn('credentials', {
          email,
          password,
          code,
          redirect: false,
        }),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 20000)
        ),
      ]);

      if (res?.error === '2FA_REQUIRED') {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      if (res?.error === 'INVALID_2FA') {
        setError('Kode 2FA salah atau tidak valid.');
        setLoading(false);
        return;
      }

      if (res?.error) {
        setError(t.errorWrongCredentials);
        setLoading(false);
      } else {
        // Tandai "baru saja login" untuk notifikasi selamat datang (Login sebagai ...)
        sessionStorage.setItem('mt_welcome_pending', '1');
        // Navigasi FULL (bukan router.push) agar cookie sesi terpasang dulu
        // sehingga middleware selalu melihat token saat mengakses halaman tujuan.
        // Menghindari bug next-auth v4 + Next 15/16 di mana token belum terlihat
        // middleware pada navigasi client-side pertama → balik ke /login.
        window.location.href = callbackUrl;
      }
    } catch (err) {
      setError(err instanceof Error && err.message === 'timeout'
        ? t.errorNetwork
        : t.errorServer);
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f8f9ff] min-h-screen font-sans text-slate-900 flex flex-col selection:bg-orange-500 selection:text-white">
      
      {/* ── MAIN CONTENT ── */}
      <main className="flex-grow flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-[1100px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row min-h-[700px]">
          
          {/* ── LEFT SIDE: BRANDING VISUAL ── */}
          <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 p-12 flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 z-0 bg-black/40 mix-blend-multiply"></div>
            <img 
              src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80" 
              alt="Premium Travel" 
              className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
            />
            
            <div className="relative z-10">
              <Link href="/" className="inline-block mb-4 hover:scale-105 transition-transform">
                <h1 className="font-black text-white text-4xl font-display tracking-tight leading-tight">
                  The Mafia<br/>Travel
                </h1>
              </Link>
              <p className="text-white/90 text-lg max-w-sm leading-relaxed">
                {t.tagline}
              </p>
            </div>
            
            <div className="relative z-10">
              <div className="flex gap-4 items-center">
                <div className="h-1 w-12 bg-white rounded-full"></div>
                <span className="font-bold text-white text-xs uppercase tracking-widest">Unstoppable Movement</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT SIDE: FORM LOGIN ── */}
          <div className="w-full lg:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white relative">
            
            {/* Mobile Logo Only */}
            <div className="lg:hidden mb-8">
              <Link href="/" className="font-black text-2xl font-display text-slate-900">
                The <span className="text-orange-600">Mafia</span> Travel
              </Link>
            </div>

            <div className="mb-10">
              <h2 className="text-3xl font-black text-slate-900 mb-2 font-display tracking-tight">{t.title}</h2>
              <p className="text-slate-500 text-sm">{t.subtitle}</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6 animate-fade-in">
                <i className="fa-solid fa-circle-exclamation text-red-500"></i>
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* 🔥 GOOGLE LOGIN (SUDAH AKTIF) 🔥 */}
            {!requires2FA && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem('mt_welcome_pending', '1');
                    signIn('google', { callbackUrl });
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 rounded-lg font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
                >
                  <Image src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" width={20} height={20} className="w-5 h-5" />
                  {t.googleBtn}
                </button>
              </div>
            )}

            {!requires2FA && (
              <div className="relative flex items-center mb-6">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white">{t.orDivider}</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Email */}
              {!requires2FA && (
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-slate-900 bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label htmlFor="email" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                    {t.emailLabel}
                  </label>
                </div>
              )}

              {/* Password */}
              {!requires2FA && (
                <div className="relative">
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-slate-900 bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label htmlFor="password" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                    {t.passwordLabel}
                  </label>
                </div>
              )}

              {requires2FA && (
                <div className="space-y-5">
                  {/* Status login sebagai */}
                  <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <i className="fa-solid fa-shield-halved text-orange-600"></i>
                      <span className="text-sm text-slate-600 truncate">
                        Login sebagai <strong className="text-slate-900">{email}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setRequires2FA(false); setCode(''); setError(''); }}
                      className="text-xs font-bold text-orange-600 hover:underline underline-offset-4 whitespace-nowrap"
                    >
                      Ganti akun
                    </button>
                  </div>

                  {/* Kode 2FA */}
                  <div className="relative">
                    <input
                      type="text"
                      id="code"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      required
                      disabled={loading}
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-describedby="code-hint"
                      className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-slate-900 bg-transparent disabled:bg-slate-50"
                      placeholder=" "
                    />
                    <label htmlFor="code" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                      Kode 2FA
                    </label>
                  </div>
                  <p id="code-hint" className="text-xs text-slate-500">
                    Masukkan 6 digit kode dari aplikasi authenticator, atau kode cadangan.
                  </p>
                </div>
              )}

              {/* Remember Me & Forgot Password */}
              {!requires2FA && (
                <div className="flex items-center justify-between text-sm font-medium mt-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer" />
                    <span className="text-slate-500 group-hover:text-slate-900 transition-colors">{t.rememberMe}</span>
                  </label>
                  <Link href="/forgot-password" className="text-orange-600 hover:underline underline-offset-4 decoration-2">
                    {t.forgotPassword}
                  </Link>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 mt-6 bg-slate-900 text-white font-bold rounded-lg shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {t.submitting}
                  </>
                ) : (
                  <>
                    {t.submitBtn}
                    <i className="fa-solid fa-arrow-right"></i>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500 font-medium">
                {t.noAccount}{' '}
                <Link href="/register" className="text-orange-600 font-bold hover:underline underline-offset-4">
                  {t.registerLink}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── TRUST BADGES ── */}
      <div className="max-w-[1280px] mx-auto w-full px-6 pb-12">
        <div className="flex flex-wrap justify-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <i className="fa-solid fa-shield-halved text-orange-600"></i>
            <span className="font-bold text-slate-700 text-xs">Secure 256-bit Encryption</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <i className="fa-solid fa-user-check text-orange-600"></i>
            <span className="font-bold text-slate-700 text-xs">Identity Verified Partners</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <i className="fa-solid fa-headset text-orange-600"></i>
            <span className="font-bold text-slate-700 text-xs">24/7 Global Concierge</span>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="w-full border-t bg-slate-50 border-slate-200 mt-auto">
        <div className="max-w-[1280px] mx-auto py-8 px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="text-lg font-black text-slate-900 font-display">The Mafia Travel</span>
            <p className="text-xs text-slate-500 font-medium">© 2026 The Mafia Travel. Unstoppable Movement.</p>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-xs font-semibold text-slate-500 hover:text-orange-600 transition-colors">About Us</a>
            <a href="#" className="text-xs font-semibold text-slate-500 hover:text-orange-600 transition-colors">Terms of Service</a>
            <a href="#" className="text-xs font-semibold text-slate-500 hover:text-orange-600 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}