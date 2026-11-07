'use client';

// components/auth/RegisterModal.tsx
// Modal registrasi dua langkah: pilih metode (Google/email) dulu, lalu
// formulir email di tampilan yang sama — tidak menumpuk modal baru.
// Setelah sukses + auto-login, overlay "Akun Berhasil Dibuat" tampil lalu
// kembali ke halaman asal.

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useRegisterAuth } from '@/components/auth/useRegisterAuth';
import AuthModalShell from '@/components/auth/AuthModalShell';

export default function RegisterModal() {
  const { mode, close, switchTo, callbackUrl, showSuccess } = useAuthModal();
  const { language } = useLanguage();
  const t = i18n.register[language];
  const tm = i18n.loginModal[language];
  const [step, setStep] = useState<'options' | 'form'>('options');

  const { form, error, loading, handleChange, handleSubmit, handleGoogle } =
    useRegisterAuth({
      callbackUrl,
      onSuccess: () => {
        showSuccess({
          callbackUrl,
          redirect: true,
          kind: 'register',
        });
      },
    });

  const showForm = step === 'form';
  const googleRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) {
      nameRef.current?.focus();
    } else {
      googleRef.current?.focus();
    }
  }, [showForm]);

  if (mode !== 'register') return null;

  return (
    <AuthModalShell
      onClose={close}
      closeDisabled={loading}
      label={t.title}
      maxWidth={showForm ? 'max-w-lg' : 'max-w-md'}
    >
      {/* Header */}
      <div className="relative px-6 pt-6 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-3">
          <i className="fa-solid fa-user-plus text-orange-500 text-sm"></i>
        </div>
        <h2 className="text-xl font-black text-brand-ink tracking-tight">{t.title}</h2>
        <p className="text-slate-500 text-xs mt-1 pr-8">
          {showForm ? t.subtitle : tm.chooseMethod}
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
            {/* Pilihan metode pendaftaran */}
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
              onClick={() => setStep('options')}
              disabled={loading}
              className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition-colors hover:text-orange-600 disabled:opacity-50"
            >
              <i className="fa-solid fa-arrow-left text-[10px]"></i>
              {tm.back}
            </button>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="register-modal-name"
                    className="block text-xs font-bold text-slate-600 mb-1.5"
                  >
                    {t.nameLabel}
                  </label>
                  <input
                    type="text"
                    id="register-modal-name"
                    value={form.name}
                    onChange={handleChange('name')}
                    required
                    disabled={loading}
                    autoComplete="name"
                    ref={nameRef}
                    className="w-full h-11 px-4 border border-slate-300 rounded-xl text-sm font-medium text-brand-ink outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-slate-50"
                    placeholder={t.namePlaceholder}
                  />
                </div>

                <div>
                  <label
                    htmlFor="register-modal-phone"
                    className="block text-xs font-bold text-slate-600 mb-1.5"
                  >
                    {t.phoneLabel}
                  </label>
                  <input
                    type="tel"
                    id="register-modal-phone"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    disabled={loading}
                    autoComplete="tel"
                    className="w-full h-11 px-4 border border-slate-300 rounded-xl text-sm font-medium text-brand-ink outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-slate-50"
                    placeholder={t.phonePlaceholder}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-modal-email"
                  className="block text-xs font-bold text-slate-600 mb-1.5"
                >
                  {t.emailLabel}
                </label>
                <input
                  type="email"
                  id="register-modal-email"
                  value={form.email}
                  onChange={handleChange('email')}
                  required
                  disabled={loading}
                  autoComplete="email"
                  className="w-full h-11 px-4 border border-slate-300 rounded-xl text-sm font-medium text-brand-ink outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-slate-50"
                  placeholder={t.emailPlaceholder}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="register-modal-password"
                    className="block text-xs font-bold text-slate-600 mb-1.5"
                  >
                    {t.passwordLabel}
                  </label>
                  <input
                    type="password"
                    id="register-modal-password"
                    value={form.password}
                    onChange={handleChange('password')}
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    className="w-full h-11 px-4 border border-slate-300 rounded-xl text-sm font-medium text-brand-ink outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-slate-50"
                    placeholder={t.passwordPlaceholder}
                  />
                </div>

                <div>
                  <label
                    htmlFor="register-modal-confirm"
                    className="block text-xs font-bold text-slate-600 mb-1.5"
                  >
                    {t.confirmLabel}
                  </label>
                  <input
                    type="password"
                    id="register-modal-confirm"
                    value={form.confirm}
                    onChange={handleChange('confirm')}
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    className="w-full h-11 px-4 border border-slate-300 rounded-xl text-sm font-medium text-brand-ink outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-slate-50"
                    placeholder={t.confirmPlaceholder}
                  />
                </div>
              </div>

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
          {t.hasAccount}{' '}
          <button
            type="button"
            onClick={() => switchTo('login')}
            disabled={loading}
            className="text-orange-600 font-bold hover:underline underline-offset-4 disabled:opacity-50"
          >
            {t.loginLink}
          </button>
        </p>
      </div>
    </AuthModalShell>
  );
}
