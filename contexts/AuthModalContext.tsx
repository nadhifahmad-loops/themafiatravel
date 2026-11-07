'use client';

// contexts/AuthModalContext.tsx
// State global untuk modal autentikasi (login & register terpisah) plus
// overlay "login berhasil".
//
// - Modal login/register dipakai di seluruh halaman (navbar, checkout, dsb.).
// - callbackUrl menentukan halaman tujuan setelah login; default halaman saat ini.
// - Aksi yang menunggu login (mis. "simpan favorit ini") disimpan di
//   sessionStorage agar tetap selamat melewati full-reload setelah login.
//   FavoritesProvider membaca payload ini dan mengeksekusinya.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { NewFavorite } from '@/contexts/FavoritesContext';
import { safeCallbackUrl } from '@/lib/safe-callback';

export const PENDING_FAVORITE_KEY = 'mt_pending_fav';
/** Flag sessionStorage untuk menampilkan popup sukses setelah redirect OAuth. */
export const LOGIN_SUCCESS_PENDING_KEY = 'mt_login_success_pending';
export const OAUTH_SUCCESS_LOGIN = 'oauth:login';
export const OAUTH_SUCCESS_REGISTER = 'oauth:register';

export type AuthModalMode = 'login' | 'register';

export type AuthSuccess = {
  callbackUrl: string;
  /** true = pindah ke callbackUrl setelah popup; false = cukup tutup popup. */
  redirect: boolean;
  kind: 'login' | 'register';
};

type OpenOptions = {
  callbackUrl?: string;
  pendingFavorite?: NewFavorite;
};

type AuthModalContextValue = {
  mode: AuthModalMode | null;
  isOpen: boolean;
  hasPending: boolean;
  callbackUrl: string;
  success: AuthSuccess | null;
  openLogin: (options?: OpenOptions) => void;
  openRegister: (options?: OpenOptions) => void;
  switchTo: (mode: AuthModalMode) => void;
  close: () => void;
  showSuccess: (success: AuthSuccess) => void;
  clearSuccess: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

function currentCallbackUrl(): string {
  if (typeof window === 'undefined') return '/';
  return safeCallbackUrl(window.location.pathname + window.location.search);
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AuthModalMode | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('/');
  const [pending, setPending] = useState<NewFavorite | null>(null);
  const [success, setSuccess] = useState<AuthSuccess | null>(null);

  const open = useCallback((nextMode: AuthModalMode, options?: OpenOptions) => {
    setCallbackUrl(
      options?.callbackUrl ? safeCallbackUrl(options.callbackUrl) : currentCallbackUrl()
    );

    // Hanya sentuh payload favorit bila memang dikirim (atau dikirim null).
    if (options && Object.prototype.hasOwnProperty.call(options, 'pendingFavorite')) {
      const pendingFavorite = options.pendingFavorite ?? null;
      setPending(pendingFavorite);
      try {
        if (pendingFavorite) {
          sessionStorage.setItem(PENDING_FAVORITE_KEY, JSON.stringify(pendingFavorite));
        } else {
          sessionStorage.removeItem(PENDING_FAVORITE_KEY);
        }
      } catch {
        /* storage penuh/nonaktif — abaikan */
      }
    }

    setMode(nextMode);
  }, []);

  const openLogin = useCallback(
    (options?: OpenOptions) => open('login', options),
    [open]
  );

  const openRegister = useCallback(
    (options?: OpenOptions) => open('register', options),
    [open]
  );

  const switchTo = useCallback((nextMode: AuthModalMode) => {
    setMode(nextMode);
  }, []);

  const close = useCallback(() => {
    setMode(null);
    setPending(null);
    // Menutup = membatalkan: jangan biarkan aksi basi ter-eksekusi di login berikutnya.
    try {
      sessionStorage.removeItem(PENDING_FAVORITE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const showSuccess = useCallback(
    (next: AuthSuccess) => {
      setSuccess({
        ...next,
        callbackUrl: safeCallbackUrl(next.callbackUrl),
      });
      // Tutup modal tanpa menghapus pending favorite — aksi itu dieksekusi
      // setelah halaman reload dengan sesi terautentikasi.
      setMode(null);
    },
    []
  );

  const clearSuccess = useCallback(() => {
    setSuccess(null);
    setPending(null);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isOpen: mode !== null,
      hasPending: pending !== null,
      callbackUrl,
      success,
      openLogin,
      openRegister,
      switchTo,
      close,
      showSuccess,
      clearSuccess,
    }),
    [
      mode,
      pending,
      callbackUrl,
      success,
      openLogin,
      openRegister,
      switchTo,
      close,
      showSuccess,
      clearSuccess,
    ]
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal harus dipakai di dalam <AuthModalProvider>');
  return ctx;
}
