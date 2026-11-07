'use client';

// components/auth/LoginSuccessModal.tsx
// Overlay sukses setelah login/register. Muncul sebelum halaman tujuan dimuat,
// menampilkan checklist, lalu otomatis lanjut setelah ±2 detik.

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import {
  LOGIN_SUCCESS_PENDING_KEY,
  OAUTH_SUCCESS_REGISTER,
  useAuthModal,
} from '@/contexts/AuthModalContext';
import type { AuthSuccess } from '@/contexts/AuthModalContext';

const REDIRECT_DELAY_MS = 2000;

function SuccessCard({
  success,
  clearSuccess,
}: {
  success: AuthSuccess;
  clearSuccess: () => void;
}) {
  const { language } = useLanguage();
  const t = i18n.authSuccess[language];

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      if (success.redirect) {
        window.location.assign(success.callbackUrl);
      } else {
        clearSuccess();
      }
    }, REDIRECT_DELAY_MS);
    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimeout(timer);
    };
  }, [success, clearSuccess]);

  const isRegister = success.kind === 'register';
  const title = isRegister ? t.registerTitle : t.loginTitle;
  const subtitle = isRegister ? t.registerSubtitle : null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
      aria-labelledby="auth-success-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl animate-[popIn_0.3s_ease-out]">
        <div className="relative mx-auto mb-5 h-20 w-20">
          <span className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-50" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
            <svg
              viewBox="0 0 52 52"
              className="h-10 w-10 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 27l8 8 16-16" />
            </svg>
          </span>
        </div>

        <h2
          id="auth-success-title"
          className="text-xl font-black tracking-tight text-brand-ink"
        >
          {title}
        </h2>
        {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export default function LoginSuccessModal() {
  const { success, clearSuccess, showSuccess } = useAuthModal();
  const { status } = useSession();

  const oauthPending = useRef(false);
  const oauthKind = useRef<'login' | 'register'>('login');

  // Deteksi kembali dari redirect Google/OAuth.
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem(LOGIN_SUCCESS_PENDING_KEY);
      if (pending) {
        sessionStorage.removeItem(LOGIN_SUCCESS_PENDING_KEY);
        oauthPending.current = true;
        oauthKind.current =
          pending === OAUTH_SUCCESS_REGISTER ? 'register' : 'login';
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!oauthPending.current || status === 'loading' || success) return;
    oauthPending.current = false;
    if (status === 'authenticated') {
      showSuccess({
        callbackUrl: window.location.pathname + window.location.search,
        redirect: false,
        kind: oauthKind.current,
      });
    }
  }, [status, success, showSuccess]);

  if (!success) return null;

  return <SuccessCard success={success} clearSuccess={clearSuccess} />;
}
