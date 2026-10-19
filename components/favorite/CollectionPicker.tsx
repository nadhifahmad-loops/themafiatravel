'use client';

// components/favorite/CollectionPicker.tsx
// Tombol folder-plus + popover pemilih koleksi untuk satu item favorit.
// Menampilkan daftar koleksi user, opsi "Tanpa koleksi", dan buat koleksi
// baru cepat tanpa meninggalkan halaman.

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { useFavorites, type CollectionItem } from '@/contexts/FavoritesContext';

type CollectionPickerProps = {
  favoriteId: string;
  currentCollectionId: string | null;
};

export default function CollectionPicker({ favoriteId, currentCollectionId }: CollectionPickerProps) {
  const { language } = useLanguage();
  const t = i18n.collections[language];
  const { collections, assignToCollection, createCollection } = useFavorites();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Tutup saat klik di luar.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = async (collectionId: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      await assignToCollection(favoriteId, collectionId);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const created = await createCollection(name);
      if (created) {
        await assignToCollection(favoriteId, created.id);
        setNewName('');
        setCreating(false);
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const activeName =
    collections.find((c: CollectionItem) => c.id === currentCollectionId)?.name ?? null;

  return (
    <div ref={wrapRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={activeName ? `${t.assignTitle}: ${activeName}` : t.assignTitle}
        aria-label={activeName ? `${t.assignTitle}: ${activeName}` : t.assignTitle}
        aria-expanded={open}
        className={`w-8 h-8 rounded-full border shadow-sm flex items-center justify-center ${
          activeName
            ? 'bg-orange-50 border-orange-200 text-orange-500'
            : 'bg-white border-slate-200 text-slate-400'
        }`}
      >
        <i className={`fa-solid ${activeName ? 'fa-folder-open' : 'fa-folder-plus'} text-xs`}></i>
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-30 w-56 bg-white rounded-xl border border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden animate-fade-in">
          <p className="px-3.5 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            {t.assignTitle}
          </p>

          <div className="max-h-48 overflow-y-auto px-1.5 pb-1.5">
            {/* Tanpa koleksi */}
            <button
              type="button"
              onClick={() => pick(null)}
              disabled={busy}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                currentCollectionId === null
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <i className="fa-regular fa-folder text-[11px] w-4 text-center"></i>
              {t.assignNone}
            </button>

            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c.id)}
                disabled={busy}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  currentCollectionId === c.id
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <i className="fa-solid fa-folder text-[11px] w-4 text-center text-orange-400"></i>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>

          {/* Buat koleksi baru cepat */}
          <div className="border-t border-slate-100 p-2">
            {creating ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                  placeholder={t.namePlaceholder}
                  maxLength={60}
                  className="flex-1 min-w-0 h-8 px-2.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={busy || !newName.trim()}
                  className="h-8 px-2.5 rounded-lg bg-orange-500 text-white text-[11px] font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {t.create}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-bold text-orange-600 hover:bg-orange-50 transition-colors"
              >
                <i className="fa-solid fa-plus text-[10px] w-4 text-center"></i>
                {t.assignNew}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
