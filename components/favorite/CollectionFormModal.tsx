'use client';

// components/favorite/CollectionFormModal.tsx
// Modal input nama koleksi (buat baru / ganti nama). Dipakai halaman favorit
// utama dan halaman detail koleksi.

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

type CollectionFormModalProps = {
  open: boolean;
  mode: 'create' | 'rename';
  initialName: string;
  onClose: () => void;
  /** Kembalikan true bila sukses (modal menutup sendiri), false → tampilkan error. */
  onSubmit: (name: string) => Promise<boolean>;
};

export default function CollectionFormModal({
  open,
  mode,
  initialName,
  onClose,
  onSubmit,
}: CollectionFormModalProps) {
  const { language } = useLanguage();
  const t = i18n.collections[language];
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Reset nilai tiap kali dibuka.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initialName);
      setError('');
    }
  }

  if (!open) return null;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t.emptyName);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ok = await onSubmit(trimmed);
      if (ok) onClose();
      else setError(t.saveError);
    } catch {
      setError(t.saveError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={() => {
        if (!busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? t.newCollectionTitle : t.renameTitle}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden p-6"
      >
        <h3 className="text-base font-black text-brand-ink mb-4">
          {mode === 'create' ? t.newCollectionTitle : t.renameTitle}
        </h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={t.namePlaceholder}
          maxLength={60}
          className={`w-full h-11 px-4 border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/40 transition-all ${
            error ? 'border-red-300' : 'border-slate-300 focus:border-orange-500'
          }`}
        />
        {error && <p className="text-[11px] text-red-500 font-semibold mt-1.5">{error}</p>}
        <div className="flex gap-2.5 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all"
          >
            {i18n.confirm[language].cancelBtn}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim()}
            className="flex-1 h-10 rounded-xl bg-orange-500 text-white font-bold text-xs hover:bg-orange-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            )}
            {mode === 'create' ? t.create : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
