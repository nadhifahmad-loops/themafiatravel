'use client';

// components/auth/useLoginAuth.ts
// Logika login bersama (credentials + 2FA + Google) untuk halaman /login,
// modal login, dan halaman /admin/login.

import { useCallback, useState } from 'react';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import {
  LOGIN_SUCCESS_PENDING_KEY,
  OAUTH_SUCCESS_LOGIN,
} from '@/contexts/AuthModalContext';

export type LoginSuccessData = {
  name: string;
  email: string;
};

type UseLoginAuthOptions = {
  callbackUrl: string;
  /** Halaman admin: tolak akun yang bukan role admin. */
  requireAdmin?: boolean;
  onSuccess: (data: LoginSuccessData) => void;
};

export function useLoginAuth({
  callbackUrl,
  requireAdmin = false,
  onSuccess,
}: UseLoginAuthOptions) {
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

  const reset = useCallback(() => {
    setEmail('');
    setPassword('');
    setCode('');
    setShowPassword(false);
    setError('');
    setLoading(false);
    setRequires2FA(false);
  }, []);

  const switchAccount = useCallback(() => {
    setRequires2FA(false);
    setCode('');
    setError('');
  }, []);

  const handleCodeChange = useCallback((value: string) => {
    setCode(value.replace(/\D/g, '').slice(0, 8));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');

      try {
        // Timeout pengaman: jangan sampai spinner login muter selamanya
        // (masalah umum signIn() client next-auth yang tidak pernah resolve).
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

        // Sesi baru saja dibuat. Ambil data user (nama & role) untuk popup
        // sukses dan validasi admin.
        let session = await getSession().catch(() => null);
        if (!session) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          session = await getSession().catch(() => null);
        }

        if (requireAdmin && session && session.user?.role !== 'admin') {
          await signOut({ redirect: false });
          setError(tm.errorNotAdmin);
          setLoading(false);
          return;
        }

        onSuccess({
          name: session?.user?.name || email,
          email,
        });
        // loading dibiarkan true — overlay sukses akan menangani navigasi.
      } catch (err) {
        setError(
          err instanceof Error && err.message === 'timeout'
            ? t.errorNetwork
            : t.errorServer
        );
        setLoading(false);
      }
    },
    [email, password, code, onSuccess, requireAdmin, t, tm]
  );

  const handleGoogle = useCallback(() => {
    try {
      // Popup sukses ditampilkan setelah kembali dari redirect Google.
      sessionStorage.setItem(LOGIN_SUCCESS_PENDING_KEY, OAUTH_SUCCESS_LOGIN);
    } catch {
      /* ignore */
    }
    void signIn('google', { callbackUrl });
  }, [callbackUrl]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    code,
    handleCodeChange,
    showPassword,
    setShowPassword,
    error,
    setError,
    loading,
    requires2FA,
    reset,
    switchAccount,
    handleSubmit,
    handleGoogle,
  };
}
