'use client';

// components/auth/LoginModal.tsx
// Modal login dua langkah: pilih metode (Google/email) dulu, lalu formulir
// email di tampilan yang sama — tidak menumpuk modal baru.
// Setelah sukses, overlay "Login Berhasil" tampil ±2 detik lalu kembali ke
// halaman asal (callbackUrl).

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useLoginAuth } from '@/components/auth/useLoginAuth';
import AuthModalShell from '@/components/auth/AuthModalShell';

export default function LoginModal() {
  const { mode, close, switchTo, hasPending, callbackUrl, showSuccess } = useAuthModal();
  const { language } = useLanguage();
  const t = i18n.login[language];
  const tm = i18n.loginModal[language];
  const [step, setStep] = useState<'options' | 'form'>('options');

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
    handleGoogle,
  } = useLoginAuth({
    callbackUrl,
    onSuccess: () => {
      showSuccess({
        callbackUrl,
        redirect: true,
        kind: 'login',
      });
    },
  });

  // requires2FA selalu berasal dari submit formulir, jadi tetap tampilkan form.
  const showForm = step === 'form' || requires2FA;
  const googleRef = useRef<HTMLButtonElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showForm) {
      googleRef.current?.focus();
    } else if (requires2FA) {
      codeRef.current?.focus();
    } else {
      emailRef.current?.focus();
    }
  }, [showForm, requires2FA]);

  if (mode !== 'login') return null;

  const backToOptions = () => {
    if (requires2FA) switchAccount();
    setStep('options');
  };

  return (
    <AuthModalShell
      onClose={close}
      closeDisabled={loading}
      label={hasPending ? tm.saveHint : t.title}
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
          {hasPending ? tm.saveHint : showForm ? t.subtitle : tm.chooseMethod}
        </p>
        <button
          type="button"
          onClick={close}
          disabled={loading}
          aria-label={tm.close}
          title={tm.close}
          className="absolute top-5 right-5 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>

      <div className="p-6">
        {/* Error — hanya di tampilan formulir */}
        {showForm && error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
            <i className="fa-solid fa-circle-exclamation text-red-500 text-sm"></i>
            <p className="text-red-600 text-xs font-semibold">{error}</p>
          </div>
        )}

        {!showForm ? (
          <>
            {/* Pilihan metode masuk */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogle}
              data-autofocus
              ref={googleRef}
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
                {tm.or}
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => setStep('form')}
              className="group flex w-full items-center justify-center gap-2 py-1 text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors disabled:opacity-50"
            >
              {t.emailOption}
              <i className="fa-solid fa-arrow-right text-[10px] transition-transform group-hover:translate-x-0.5"></i>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={backToOptions}
              disabled={loading}
              className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition-colors hover:text-orange-600 disabled:opacity-50"
            >
              <i className="fa-solid fa-arrow-left text-[10px]"></i>
              {tm.back}
            </button>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!requires2FA && (
                <>
                  <div>
                    <label
                      htmlFor="login-modal-email"
                      className="block text-xs font-bold text-slate-600 mb-1.5"
                    >
                      {t.emailLabel}
                    </label>
                    <input
                      type="email"
                      id="login-modal-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                      ref={emailRef}
                      className="w-full h-11 px-4 border border-slate-300 rounded-xl text-sm font-medium text-brand-ink outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-slate-50"
                      placeholder="nama@email.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-modal-password"
                      className="block text-xs font-bold text-slate-600 mb-1.5"
                    >
                      {t.passwordLabel}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="login-modal-password"
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
                      onClick={close}
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
                      onClick={switchAccount}
                      className="text-[11px] font-bold text-orange-600 hover:underline underline-offset-4 whitespace-nowrap"
                    >
                      {tm.switchAccount}
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor="login-modal-code"
                      className="block text-xs font-bold text-slate-600 mb-1.5"
                    >
                      {tm.codeLabel}
                    </label>
                    <input
                      type="text"
                      id="login-modal-code"
                      value={code}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      required
                      disabled={loading}
                      ref={codeRef}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
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
          </>
        )}

        <p className="mt-5 text-center text-xs text-slate-500 font-medium">
          {t.noAccount}{' '}
          <button
            type="button"
            onClick={() => switchTo('register')}
            disabled={loading}
            className="text-orange-600 font-bold hover:underline underline-offset-4 disabled:opacity-50"
          >
            {t.registerLink}
          </button>
        </p>
      </div>
    </AuthModalShell>
  );
}
