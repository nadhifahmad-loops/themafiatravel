'use client';

// components/auth/LoginModal.tsx
// Popup login ringkas untuk guest (dibuka dari ikon bookmark, dsb.).
// Logika auth mengikuti halaman /login (credentials + 2FA + Google), tetapi
// setelah sukses melakukan FULL RELOAD halaman saat ini (bukan router.push)
// — sama seperti halaman login — agar cookie sesi terbaca proxy Next 16.
// Payload "simpan favorit" yang menunggu tetap ada di sessionStorage dan
// dieksekusi FavoritesProvider setelah halaman dimuat ulang.

import { useEffect, useState, useRef } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { useLoginModal } from '@/contexts/LoginModalContext';

export default function LoginModal() {
  const { isOpen, hasPending, closeLogin } = useLoginModal();
  const { language } = useLanguage();
  const t = i18n.login[language];
  const tm = i18n.loginModal[language];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('/');
  const dialogRef = useRef<HTMLDivElement>(null);

  // URL halaman sekarang — dipakai sebagai tujuan kembali setelah login.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.pathname + window.location.search);
    }
  }, []);

  // Kunci scroll body saat popup terbuka.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ESC untuk tutup + reset form tiap kali popup ditutup.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) closeLogin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, loading, closeLogin]);

  // Reset state form saat popup ditutup (siap untuk pembukaan berikutnya).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      setEmail('');
      setPassword('');
      setCode('');
      setError('');
      setRequires2FA(false);
      setShowPassword(false);
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  const finishLogin = () => {
    // Tandai welcome notification (konsisten dengan halaman /login).
    sessionStorage.setItem('mt_welcome_pending', '1');
    // FULL RELOAD: memastikan cookie sesi sudah terbaca proxy sebelum
    // navigasi lanjutan (pola yang sama dengan halaman /login).
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await Promise.race([
        signIn('credentials', { email, password, code, redirect: false }),
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
        setError(tm.codeError);
        setLoading(false);
        return;
      }

      if (res?.error) {
        setError(t.errorWrongCredentials);
        setLoading(false);
        return;
      }

      finishLogin();
      // loading dibiarkan true — halaman segera reload.
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'timeout' ? t.errorNetwork : t.errorServer
      );
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={() => {
        if (!loading) closeLogin();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={hasPending ? tm.saveHint : t.title}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-3">
            <i
              className={`fa-solid ${hasPending ? 'fa-bookmark' : 'fa-right-to-bracket'} text-orange-500 text-sm`}
            ></i>
          </div>
          <h2 className="text-xl font-black text-brand-ink tracking-tight">{t.title}</h2>
          <p className="text-slate-500 text-xs mt-1 pr-8">
            {hasPending ? tm.saveHint : t.subtitle}
          </p>
          <button
            type="button"
            onClick={closeLogin}
            disabled={loading}
            aria-label={tm.close}
            title={tm.close}
            className="absolute top-5 right-5 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div className="p-6">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
              <i className="fa-solid fa-circle-exclamation text-red-500 text-sm"></i>
              <p className="text-red-600 text-xs font-semibold">{error}</p>
            </div>
          )}

          {/* Google */}
          {!requires2FA && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  sessionStorage.setItem('mt_welcome_pending', '1');
                  signIn('google', { callbackUrl: currentUrl });
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-70"
              >
                <Image
                  src="https://www.svgrepo.com/show/475656/google-color.svg"
                  alt="Google"
                  width={20}
                  height={20}
                  className="w-5 h-5"
                />
                {t.googleBtn}
              </button>

              <div className="relative flex items-center my-5">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="px-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {t.orDivider}
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!requires2FA && (
              <>
                <div>
                  <label
                    htmlFor="modal-email"
                    className="block text-xs font-bold text-slate-600 mb-1.5"
                  >
                    {t.emailLabel}
                  </label>
                  <input
                    type="email"
                    id="modal-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                    className="w-full h-11 px-4 border border-slate-300 rounded-xl text-sm font-medium text-brand-ink outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-slate-50"
                    placeholder="nama@email.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="modal-password"
                    className="block text-xs font-bold text-slate-600 mb-1.5"
                  >
                    {t.passwordLabel}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="modal-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="current-password"
                      className="w-full h-11 px-4 pr-11 border border-slate-300 rounded-xl text-sm font-medium text-brand-ink outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-slate-50"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
                    >
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold pt-0.5">
                  <Link
                    href="/forgot-password"
                    onClick={closeLogin}
                    className="text-orange-600 hover:underline underline-offset-4"
                  >
                    {t.forgotPassword}
                  </Link>
                </div>
              </>
            )}

            {requires2FA && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="fa-solid fa-shield-halved text-orange-600 text-sm"></i>
                    <span className="text-xs text-slate-600 truncate">
                      {tm.loginAs} <strong className="text-brand-ink">{email}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRequires2FA(false);
                      setCode('');
                      setError('');
                    }}
                    className="text-[11px] font-bold text-orange-600 hover:underline underline-offset-4 whitespace-nowrap"
                  >
                    {tm.switchAccount}
                  </button>
                </div>

                <div>
                  <label htmlFor="modal-code" className="block text-xs font-bold text-slate-600 mb-1.5">
                    Kode 2FA
                  </label>
                  <input
                    type="text"
                    id="modal-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="w-full h-11 px-4 border border-slate-300 rounded-xl text-sm font-medium tracking-[0.3em] text-brand-ink outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-slate-50"
                    placeholder="123456"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">{tm.codeHint}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-1 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 hover:bg-orange-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  {t.submitting}
                </>
              ) : (
                <>
                  {t.submitBtn}
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500 font-medium">
            {t.noAccount}{' '}
            <Link
              href={`/register?callbackUrl=${encodeURIComponent(currentUrl)}`}
              onClick={closeLogin}
              className="text-orange-600 font-bold hover:underline underline-offset-4"
            >
              {t.registerLink}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
