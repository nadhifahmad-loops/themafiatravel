'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { safeCallbackUrl } from '@/lib/safe-callback';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useRegisterAuth } from '@/components/auth/useRegisterAuth';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-brand-bgLight"><div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin"/></div>}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const { language } = useLanguage();
  const t = i18n.register[language];
  // Kembali ke halaman yang memicu register (mis. checkout) setelah berhasil.
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get('callbackUrl');
  const callbackUrl = safeCallbackUrl(rawCallback);

  const { showSuccess } = useAuthModal();
  const { form, error, loading, handleChange, handleSubmit, handleGoogle } =
    useRegisterAuth({
      callbackUrl,
      onSuccess: () => {
        showSuccess({ callbackUrl, redirect: true, kind: 'register' });
      },
    });

  return (
    <div className="bg-brand-bgLight min-h-screen font-sans text-brand-ink flex flex-col selection:bg-brand-orange selection:text-white">
      
      {/* ── MAIN CONTENT ── */}
      <main className="flex-grow flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-[1100px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row min-h-[700px]">
          
          {/* ── LEFT SIDE: BRANDING VISUAL ── */}
          <div className="hidden lg:flex lg:w-1/2 relative bg-orange-600 p-12 flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 z-0 bg-black/20 mix-blend-multiply"></div>
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
                Experience unstoppable movement with premium travel planning designed for the decisive explorer.
              </p>
            </div>
            
            <div className="relative z-10">
              <div className="flex gap-4 items-center">
                <div className="h-1 w-12 bg-white rounded-full"></div>
                <span className="font-bold text-white text-xs uppercase tracking-widest">Premium Member Access</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT SIDE: FORM REGISTRASI ── */}
          <div className="w-full lg:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white relative">
            
            {/* Mobile Logo Only */}
            <div className="lg:hidden mb-8">
              <Link href="/" className="font-black text-2xl font-display text-brand-ink">
                The <span className="text-orange-600">Mafia</span> Travel
              </Link>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-black text-brand-ink mb-2 font-display tracking-tight">{t.title}</h2>
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
            <div className="mb-6">
              <button 
                type="button" 
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 rounded-lg font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
              >
                <Image src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" width={20} height={20} className="w-5 h-5" />
                {t.googleBtn}
              </button>
            </div>

            <div className="relative flex items-center mb-6">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white">{t.orDivider}</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="text"
                    id="name"
                    value={form.name}
                    onChange={handleChange('name')}
                    required
                    disabled={loading}
                    className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-brand-ink bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label htmlFor="name" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                    {t.nameLabel}
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="tel"
                    id="phone"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    disabled={loading}
                    className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-brand-ink bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label htmlFor="phone" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                    {t.phoneLabel}
                  </label>
                </div>
              </div>

              <div className="relative">
                <input
                  type="email"
                  id="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  required
                  disabled={loading}
                  className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-brand-ink bg-transparent disabled:bg-slate-50"
                  placeholder=" "
                />
                <label htmlFor="email" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                  {t.emailLabel}
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="password"
                    id="password"
                    value={form.password}
                    onChange={handleChange('password')}
                    required
                    disabled={loading}
                    className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-brand-ink bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label htmlFor="password" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                    {t.passwordLabel}
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="password"
                    id="confirm"
                    value={form.confirm}
                    onChange={handleChange('confirm')}
                    required
                    disabled={loading}
                    className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-brand-ink bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label htmlFor="confirm" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                    {t.confirmLabel}
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 mt-4 bg-orange-600 text-white font-bold rounded-lg shadow-lg shadow-orange-600/20 hover:bg-orange-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
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
                {t.hasAccount}{' '}
                <Link href={rawCallback ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login'} className="text-orange-600 font-bold hover:underline underline-offset-4">
                  {t.loginLink}
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
    </div>
  );
}