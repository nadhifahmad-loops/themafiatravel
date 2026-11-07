'use client';

// app/admin/login/page.tsx
// Halaman login khusus administrator. Terpisah dari modal login publik agar
// redirect server-side (proxy/admin layout) tetap punya tujuan yang jelas.

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { safeCallbackUrl } from '@/lib/safe-callback';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useLoginAuth } from '@/components/auth/useLoginAuth';

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F3]">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-orange-600" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const { language } = useLanguage();
  const t = i18n.login[language];
  const tm = i18n.loginModal[language];
  const ta = i18n.adminLogin[language];

  const searchParams = useSearchParams();
  const rawCallback = searchParams.get('callbackUrl');
  const unauthorized = searchParams.get('error') === 'Unauthorized';
  const safe = safeCallbackUrl(rawCallback, '/admin/dashboard');
  // Halaman admin hanya boleh kembali ke area admin (bukan /admin/login lagi).
  const callbackUrl =
    safe.startsWith('/admin/') && !safe.startsWith('/admin/login')
      ? safe
      : '/admin/dashboard';

  const { showSuccess } = useAuthModal();
  const { status, data: session } = useSession();

  const {
    email,
    setEmail,
    password,
    setPassword,
    code,
    handleCodeChange,
    showPassword,
    setShowPassword,
    error,
    loading,
    requires2FA,
    switchAccount,
    handleSubmit,
  } = useLoginAuth({
    callbackUrl,
    requireAdmin: true,
    onSuccess: () => {
      showSuccess({ callbackUrl, redirect: true, kind: 'login' });
    },
  });

  // Admin yang sudah login langsung menuju dashboard (kecuali sedang submit
  // atau baru dipantulkan karena sesi tidak valid — cegah redirect loop).
  useEffect(() => {
    if (
      status === 'authenticated' &&
      session?.user?.role === 'admin' &&
      !loading &&
      !unauthorized
    ) {
      window.location.replace(callbackUrl);
    }
  }, [status, session?.user?.role, loading, callbackUrl, unauthorized]);

  const shownError = error || (unauthorized ? ta.unauthorized : '');

  return (
    <div className="flex min-h-screen bg-[#FAF8F3] text-brand-ink">
      {/* Panel brand — desktop */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-brand-ink px-10 py-12 text-white lg:flex xl:px-14">
        <svg
          aria-hidden="true"
          viewBox="0 0 600 600"
          className="pointer-events-none absolute -right-40 top-1/2 h-[620px] w-[620px] -translate-y-1/2 text-white/[0.06]"
          fill="none"
        >
          <circle cx="340" cy="300" r="220" stroke="currentColor" />
          <circle cx="340" cy="300" r="150" stroke="currentColor" strokeDasharray="3 9" />
          <path
            d="M70 470C180 360 260 300 360 250c70-35 130-55 200-70"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="7 9"
          />
          <circle cx="70" cy="470" r="4.5" fill="currentColor" />
          <circle cx="560" cy="180" r="4.5" fill="currentColor" />
        </svg>

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg">
            <Image
              src="/images/logo.png"
              alt="The Mafia Travel"
              width={44}
              height={44}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight">
              THE <span className="text-orange-400">MAFIA</span> TRAVEL
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">
              {ta.workspace}
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <div className="mb-5 flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.28em] text-orange-400">
            <span className="h-px w-7 bg-orange-400/70" />
            {ta.badge}
          </div>
          <h1 className="text-balance text-4xl font-black leading-[1.06] tracking-[-0.02em] xl:text-[3.25rem]">
            {ta.headline}
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">
            {ta.description}
          </p>
        </div>

        <div className="relative border-t border-white/10 pt-5">
          <p className="text-[11px] leading-relaxed text-white/35">{ta.securityNote}</p>
        </div>
      </aside>

      {/* Panel formulir */}
      <main className="flex min-h-screen w-full flex-col lg:w-[54%]">
        <header className="flex items-center gap-2.5 px-6 py-5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
            <Image
              src="/images/logo.png"
              alt="The Mafia Travel"
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-extrabold tracking-tight text-brand-ink">
              THE <span className="text-orange-600">MAFIA</span> TRAVEL
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
              {ta.badge}
            </p>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 pb-10 pt-2 sm:px-10 lg:px-14 lg:py-12">
          <div className="w-full max-w-[390px]">
            <div className="mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">
                {ta.badge}
              </p>
              <h2 className="mt-3 text-[28px] font-black leading-tight tracking-tight text-brand-ink">
                {ta.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{ta.subtitle}</p>
            </div>

            {shownError && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <i className="fa-solid fa-circle-exclamation mt-0.5 text-sm text-red-500"></i>
                <p className="text-xs font-semibold leading-relaxed text-red-700">
                  {shownError}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!requires2FA && (
                <>
                  <div>
                    <label
                      htmlFor="admin-email"
                      className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
                    >
                      {t.emailLabel}
                    </label>
                    <input
                      type="email"
                      id="admin-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-brand-ink outline-none transition-all placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 disabled:bg-slate-50 disabled:text-slate-400"
                      placeholder="admin@mafia.travel"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-password"
                      className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
                    >
                      {t.passwordLabel}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="admin-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        autoComplete="current-password"
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 pr-11 text-sm font-medium text-brand-ink outline-none transition-all placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        tabIndex={-1}
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-orange-600"
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {requires2FA && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <i className="fa-solid fa-shield-halved text-sm text-orange-600"></i>
                      <span className="truncate text-xs text-slate-600">
                        {tm.loginAs} <strong className="text-brand-ink">{email}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={switchAccount}
                      className="whitespace-nowrap text-[11px] font-bold text-orange-600 underline-offset-4 hover:underline"
                    >
                      {tm.switchAccount}
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-code"
                      className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
                    >
                      {tm.codeLabel}
                    </label>
                    <input
                      type="text"
                      id="admin-code"
                      value={code}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      required
                      disabled={loading}
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium tracking-[0.3em] text-brand-ink outline-none transition-all placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 disabled:bg-slate-50"
                      placeholder="123456"
                    />
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                      {tm.codeHint}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700 active:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                    {t.submitting}
                  </>
                ) : (
                  <>
                    {t.submitBtn}
                    <i className="fa-solid fa-arrow-right text-[10px]"></i>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
              <Link
                href="/"
                className="group inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition-colors hover:text-brand-ink"
              >
                <i className="fa-solid fa-arrow-left text-[10px] transition-transform group-hover:-translate-x-0.5"></i>
                {ta.backToSite}
              </Link>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                <i className="fa-solid fa-lock text-[9px]"></i>
                Secure
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
