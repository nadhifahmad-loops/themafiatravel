'use client';

// components/ui/ConfirmDialog.tsx
// Dialog konfirmasi generik (mis. "Hapus dari favorit?").
// Mengikuti pola overlay yang sama dengan LoginModal.

import { useEffect } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Gaya tombol konfirmasi — default merah (destruktif). */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Kunci scroll body saat terbuka.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC = batal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={() => {
        if (!loading) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden p-6 text-center"
      >
        <div
          className={`w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center border ${
            destructive ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'
          }`}
        >
          <i
            className={`fa-solid ${
              destructive ? 'fa-trash-can text-red-500' : 'fa-circle-question text-orange-500'
            } text-lg`}
          ></i>
        </div>

        <h3 className="text-base font-black text-brand-ink mb-1.5">{title}</h3>
        <p className="text-slate-500 text-xs leading-relaxed mb-6">{message}</p>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 h-10 rounded-xl text-white font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 ${
              destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
