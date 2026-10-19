'use client';

// contexts/ToastContext.tsx
// Toast notifikasi global (mis. "Tersimpan ke favorit"). Ringan, tanpa library.
// Dipakai via useToast().toast(message, { variant }).
// Dipasang di app/providers.tsx sehingga tersedia di seluruh route group.

import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, opts?: { variant?: ToastVariant }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLE: Record<ToastVariant, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-rose-500',
  info: 'border-l-slate-400',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, opts?: { variant?: ToastVariant }) => {
    const id = nextId.current++;
    const variant = opts?.variant ?? 'success';
    setToasts((cur) => [...cur, { id, message, variant }]);
    setTimeout(() => {
      setToasts((cur) => cur.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] flex w-[calc(100%-2rem)] flex-col items-end gap-2.5 pointer-events-none"
      >
        {toasts.map((t) => {
          return (
            <div
              key={t.id}
              role={t.variant === 'error' ? 'alert' : 'status'}
              className={`w-full max-w-sm rounded-xl border border-slate-200 border-l-4 ${VARIANT_STYLE[t.variant]} bg-white px-4 py-3 text-sm font-semibold leading-5 text-slate-800 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.28)] animate-slide-in-right`}
            >
              <p className="break-words">{t.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  return ctx;
}
