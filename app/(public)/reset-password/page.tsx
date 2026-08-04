'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

export default function ResetPasswordPage() {
  const { language } = useLanguage();
  const t = i18n.resetPassword[language];
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t.errorPasswordShort);
      return;
    }
    if (password !== confirm) {
      setError(t.errorPasswordMismatch);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = data?.error || t.errorServer;
        if (message.includes('kedaluwarsa')) setError(t.errorExpiredToken);
        else if (message.includes('tidak valid') || message.includes('sudah digunakan')) setError(t.errorInvalidToken);
        else setError(message);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(t.errorServer);
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
              src="https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&q=80"
              alt="Premium Travel"
              className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
            />

            <div className="relative z-10">
              <Link href="/" className="inline-block mb-4 hover:scale-105 transition-transform">
                <h1 className="font-black text-white text-4xl font-display tracking-tight leading-tight">
                  The Mafia<br />Travel
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

          {/* ── RIGHT SIDE: FORM ── */}
          <div className="w-full lg:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white relative">

            {/* Mobile Logo Only */}
            <div className="lg:hidden mb-8">
              <Link href="/" className="font-black text-2xl font-display text-slate-900">
                The <span className="text-orange-600">Mafia</span> Travel
              </Link>
            </div>

            {!success ? (
              <>
                <div className="mb-8">
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

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* New Password */}
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
                      {t.newPasswordLabel}
                    </label>
                  </div>

                  {/* Confirm Password */}
                  <div className="relative">
                    <input
                      type="password"
                      id="confirm"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      disabled={loading}
                      className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-slate-900 bg-transparent disabled:bg-slate-50"
                      placeholder=" "
                    />
                    <label htmlFor="confirm" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                      {t.confirmLabel}
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 mt-2 bg-slate-900 text-white font-bold rounded-lg shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
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
              </>
            ) : (
              /* ── SUCCESS STATE ── */
              <div className="text-center animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <i className="fa-solid fa-circle-check text-3xl text-emerald-600"></i>
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-3 font-display tracking-tight">{t.successTitle}</h2>
                <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">{t.successSub}</p>

                <Link
                  href="/login"
                  className="mt-10 inline-flex items-center gap-2 px-8 h-14 bg-slate-900 text-white font-bold rounded-lg shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all"
                >
                  <i className="fa-solid fa-arrow-right-to-bracket"></i>
                  {i18n.login[language].submitBtn}
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

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
