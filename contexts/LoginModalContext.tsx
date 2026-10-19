'use client';

// contexts/LoginModalContext.tsx
// Popup login global untuk tamu (guest). Dipakai saat guest menekan ikon
// bookmark: alih-alih redirect penuh ke /login, tampilkan popup di tempat.
//
// Aksi yang menunggu login (mis. "simpan favorit ini") disimpan di
// sessionStorage sehingga tetap selamat melewati full-reload yang dilakukan
// login page (wajib agar cookie sesi terbaca proxy Next 16). Setelah login
// sukses, FavoritesProvider membaca payload ini dan mengeksekusinya.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { NewFavorite } from '@/contexts/FavoritesContext';

export const PENDING_FAVORITE_KEY = 'mt_pending_fav';

type LoginModalContextValue = {
  isOpen: boolean;
  /** True bila popup dibuka dari klik bookmark (ada aksi yang menunggu). */
  hasPending: boolean;
  openLogin: (pendingFavorite?: NewFavorite) => void;
  /** Menutup popup — sekaligus membatalkan aksi yang menunggu. */
  closeLogin: () => void;
};

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<NewFavorite | null>(null);

  const openLogin = useCallback((pendingFavorite?: NewFavorite) => {
    setPending(pendingFavorite ?? null);
    try {
      if (pendingFavorite) {
        sessionStorage.setItem(PENDING_FAVORITE_KEY, JSON.stringify(pendingFavorite));
      } else {
        sessionStorage.removeItem(PENDING_FAVORITE_KEY);
      }
    } catch {
      /* storage penuh/nonaktif — abaikan */
    }
    setIsOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setIsOpen(false);
    setPending(null);
    // Menutup = membatalkan: jangan biarkan aksi basi ter-eksekusi di login berikutnya.
    try {
      sessionStorage.removeItem(PENDING_FAVORITE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ isOpen, hasPending: pending !== null, openLogin, closeLogin }),
    [isOpen, pending, openLogin, closeLogin]
  );

  return <LoginModalContext.Provider value={value}>{children}</LoginModalContext.Provider>;
}

export function useLoginModal(): LoginModalContextValue {
  const ctx = useContext(LoginModalContext);
  if (!ctx) throw new Error('useLoginModal harus dipakai di dalam <LoginModalProvider>');
  return ctx;
}
