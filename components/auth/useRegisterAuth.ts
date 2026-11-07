'use client';

// components/auth/useRegisterAuth.ts
// Logika registrasi bersama untuk halaman /register dan modal register.

import { useCallback, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import {
  LOGIN_SUCCESS_PENDING_KEY,
  OAUTH_SUCCESS_REGISTER,
} from '@/contexts/AuthModalContext';

export type RegisterSuccessData = {
  name: string;
  email: string;
};

type RegisterFormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
};

type UseRegisterAuthOptions = {
  callbackUrl: string;
  onSuccess: (data: RegisterSuccessData) => void;
};

export function useRegisterAuth({
  callbackUrl,
  onSuccess,
}: UseRegisterAuthOptions) {
  const { language } = useLanguage();
  const t = i18n.register[language];

  const [form, setForm] = useState<RegisterFormState>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setForm({ name: '', email: '', phone: '', password: '', confirm: '' });
    setError('');
    setLoading(false);
  }, []);

  const handleChange = useCallback(
    (key: keyof RegisterFormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
      },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (form.password !== form.confirm) {
        setError(t.errorPasswordMismatch);
        return;
      }
      if (form.password.length < 8) {
        setError(t.errorPasswordShort);
        return;
      }

      setLoading(true);

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone,
            password: form.password,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setError(data?.error || t.errorServer);
          setLoading(false);
          return;
        }

        // Auto login setelah register manual berhasil.
        const signInResult = await signIn('credentials', {
          email: form.email,
          password: form.password,
          redirect: false,
        });

        if (signInResult?.error) {
          setError(t.errorAutoLogin);
          setLoading(false);
          return;
        }

        onSuccess({ name: form.name, email: form.email });
        // loading dibiarkan true — overlay sukses menangani navigasi.
      } catch {
        setError(t.errorServer);
        setLoading(false);
      }
    },
    [form, onSuccess, t]
  );

  const handleGoogle = useCallback(() => {
    try {
      sessionStorage.setItem(LOGIN_SUCCESS_PENDING_KEY, OAUTH_SUCCESS_REGISTER);
    } catch {
      /* ignore */
    }
    void signIn('google', { callbackUrl });
  }, [callbackUrl]);

  return {
    form,
    error,
    setError,
    loading,
    reset,
    handleChange,
    handleSubmit,
    handleGoogle,
  };
}
