'use client';

// components/favorite/FavoriteButton.tsx
// Ikon bookmark untuk menyimpan hasil pencarian sebagai favorit.
// - fa-regular (outline) = belum disimpan · fa-solid oranye = sudah disimpan
// - Belum login → buka popup login (LoginModal); aksi simpan jadi "pending"
//   di sessionStorage dan dieksekusi otomatis setelah login sukses
// - Menyimpan → langsung toast (tanpa popup)
// - Melepas simpan → popup konfirmasi dulu
// - Optimis via FavoritesContext (update instan, rollback bila API gagal)

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { useFavorites, type FavoriteItem, type NewFavorite } from '@/contexts/FavoritesContext';
import { useLoginModal } from '@/contexts/LoginModalContext';
import { useToast } from '@/contexts/ToastContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

type FavoriteButtonProps = {
  entityType: 'flight' | 'hotel' | 'train';
  dedupeKey: string;
  title: string;
  subtitle?: string | null;
  price?: number | null;
  image?: string | null;
  searchParams: Record<string, unknown>;
  /** Kelas posisi — default pojok kanan-atas area gambar/kartu. */
  className?: string;
  /** Ukuran ikon, sesuaikan kepadatan kartu. */
  iconSize?: 'sm' | 'md';
  /** Tampilkan ikon tanpa latar, border, atau bentuk tombol bawaan. */
  iconOnly?: boolean;
  /** Set saat tombol dipakai pada item yang sudah ada di daftar simpan. */
  savedFavoriteId?: string;
  currentCollectionId?: string | null;
};

export default function FavoriteButton({
  entityType,
  dedupeKey,
  title,
  subtitle,
  price,
  image,
  searchParams,
  className = 'absolute top-3 right-3 z-10',
  iconSize = 'md',
  iconOnly = false,
  savedFavoriteId,
  currentCollectionId = null,
}: FavoriteButtonProps) {
  const { language } = useLanguage();
  const t = i18n.favorites[language];
  const tCol = i18n.collections[language];
  const tc = i18n.confirm[language];
  const { status } = useSession();
  const {
    items,
    collections,
    isSaved,
    toggle,
    refresh,
    assignToCollection,
    createCollection,
  } = useFavorites();
  const { openLogin } = useLoginModal();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const saved = isSaved(entityType, dedupeKey);
  const sizeCls = iconSize === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const fontCls = iconOnly ? 'text-[15px]' : iconSize === 'sm' ? 'text-[13px]' : 'text-sm';

  const payload: NewFavorite = {
    entityType,
    dedupeKey,
    title,
    subtitle: subtitle ?? null,
    price: price ?? null,
    image: image ?? null,
    searchParams,
  };

  const handleClick = async (e: React.MouseEvent) => {
    // Jangan sampai menggeger kartu di belakangnya (kartu hotel = <article onClick>).
    e.stopPropagation();
    if (busy || confirmLoading) return;

    if (status !== 'authenticated') {
      // Guest: popup login di tempat. Payload disimpan sebagai aksi pending
      // dan dijalankan FavoritesProvider setelah login sukses (lihat LoginModal).
      openLogin(payload);
      return;
    }

    if (saved) {
      if (savedFavoriteId) {
        setShowCollections(true);
        setSaveOpen(true);
      } else {
        setConfirmOpen(true);
      }
      return;
    }

    setShowCollections(false);
    setNewCollectionName('');
    setSaveOpen(true);
  };

  const saveFavorite = async (): Promise<FavoriteItem | null> => {
    const existing = items.find(
      (item) => item.entityType === entityType && item.dedupeKey === dedupeKey
    );
    if (existing) return existing;

    const saved = await toggle(payload);
    if (!saved) return null;
    const refreshed = await refresh();
    return (
      refreshed?.find(
        (item) => item.entityType === entityType && item.dedupeKey === dedupeKey
      ) ?? null
    );
  };

  const handleSaveToFavorites = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const favorite = await saveFavorite();
      if (favorite) {
        toast(t.toastSaved, { variant: 'success' });
        setSaveOpen(false);
      } else {
        toast(t.saveError, { variant: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveToCollection = async (collectionId: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const favorite = await saveFavorite();
      if (!favorite) {
        toast(t.saveError, { variant: 'error' });
        return;
      }
      const assigned = await assignToCollection(favorite.id, collectionId);
      if (assigned) {
        toast(t.toastAddedToCollection, { variant: 'success' });
        setSaveOpen(false);
      } else {
        toast(t.collectionError, { variant: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const created = await createCollection(name);
      if (!created) {
        toast(tCol.saveError, { variant: 'error' });
        return;
      }

      const favorite = await saveFavorite();
      if (!favorite) {
        toast(t.saveError, { variant: 'error' });
        return;
      }
      const assigned = await assignToCollection(favorite.id, created.id);
      if (assigned) {
        toast(t.toastAddedToCollection, { variant: 'success' });
        setNewCollectionName('');
        setSaveOpen(false);
      } else {
        toast(t.collectionError, { variant: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRemove = async () => {
    setConfirmLoading(true);
    try {
      const removed = await toggle(payload);
      if (removed) {
        toast(t.toastRemoved, { variant: 'info' });
        setConfirmOpen(false);
        setSaveOpen(false);
      } else {
        toast(t.saveError, { variant: 'error' });
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || confirmLoading}
        aria-label={saved ? t.savedLabel : t.saveLabel}
        title={saved ? t.savedLabel : t.saveLabel}
        className={`${className} ${
          iconOnly
            ? 'flex h-9 w-9 items-center justify-center text-slate-900 transition hover:text-sky-700'
            : savedFavoriteId
              ? 'p-1 flex items-center justify-center text-orange-500'
              : `${sizeCls} rounded-full bg-white/90 backdrop-blur-sm border border-white/70 shadow-sm flex items-center justify-center`
        } disabled:opacity-60`}
      >
        {busy ? (
          <i className={`fa-solid fa-circle-notch fa-spin ${fontCls} text-slate-400`}></i>
        ) : (
          <i
            className={`fa-${saved ? 'solid' : 'regular'} fa-bookmark ${fontCls} ${
              iconOnly ? '!text-slate-900' : savedFavoriteId ? 'text-orange-500' : saved ? 'text-orange-500' : 'text-slate-400'
            }`}
          ></i>
        )}
      </button>

      {saveOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => {
            if (!busy) setSaveOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={savedFavoriteId ? t.manageSavedTitle : t.saveDialogTitle}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden p-5"
          >
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 bg-orange-50 border border-orange-100 flex items-center justify-center">
                <i className="fa-regular fa-bookmark text-orange-500 text-lg"></i>
              </div>
              <h3 className="text-base font-black text-brand-ink">
                {savedFavoriteId ? t.manageSavedTitle : t.saveDialogTitle}
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                {savedFavoriteId ? t.manageSavedDescription : t.saveDialogDescription}
              </p>
            </div>

            {showCollections ? (
              <>
                {!savedFavoriteId && (
                  <button
                    type="button"
                    onClick={() => setShowCollections(false)}
                    disabled={busy}
                    className="mb-2 text-xs font-bold text-slate-500 disabled:opacity-50"
                  >
                    <i className="fa-solid fa-arrow-left mr-1.5"></i>
                    {t.saveBack}
                  </button>
                )}
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {savedFavoriteId && (
                    <button
                      type="button"
                      onClick={() => handleSaveToCollection(null)}
                      disabled={busy}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left border border-slate-100 disabled:opacity-60 ${
                        currentCollectionId === null
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-slate-700'
                      }`}
                    >
                      <i className="fa-regular fa-folder text-slate-400"></i>
                      <span className="flex-1 text-xs font-bold">{tCol.assignNone}</span>
                      {currentCollectionId === null && (
                        <i className="fa-solid fa-check text-orange-500 text-xs"></i>
                      )}
                    </button>
                  )}
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => handleSaveToCollection(collection.id)}
                      disabled={busy}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left border border-slate-100 text-slate-700 disabled:opacity-60"
                    >
                      <i className="fa-solid fa-folder text-orange-400"></i>
                      <span className="flex-1 text-xs font-bold truncate">{collection.name}</span>
                      {currentCollectionId === collection.id && (
                        <i className="fa-solid fa-check text-orange-500 text-xs"></i>
                      )}
                      {busy && <i className="fa-solid fa-circle-notch fa-spin text-slate-400"></i>}
                    </button>
                  ))}
                  {collections.length === 0 && !savedFavoriteId && (
                    <p className="text-xs text-slate-400 text-center py-3">{t.noCollections}</p>
                  )}
                </div>
                <form
                  className="mt-3 pt-3 border-t border-slate-100 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleCreateCollection();
                  }}
                >
                  <input
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder={tCol.namePlaceholder}
                    maxLength={60}
                    aria-label={tCol.namePlaceholder}
                    className="flex-1 min-w-0 h-10 px-3 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400"
                  />
                  <button
                    type="submit"
                    disabled={busy || !newCollectionName.trim()}
                    className="h-10 px-3 rounded-xl bg-orange-500 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {busy ? (
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                    ) : (
                      tCol.create
                    )}
                  </button>
                </form>
                {savedFavoriteId && (
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    disabled={busy}
                    className="w-full mt-3 flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold text-red-600 border border-red-100 bg-red-50 disabled:opacity-50"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    {t.savedLabel}
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSaveToFavorites}
                  disabled={busy}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 text-left disabled:opacity-60"
                >
                  <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                    <i className="fa-solid fa-bookmark"></i>
                  </span>
                  <span className="flex-1 text-xs font-bold text-slate-700">
                    {t.saveAsFavorite}
                  </span>
                  {busy && <i className="fa-solid fa-circle-notch fa-spin text-slate-400"></i>}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCollections(true)}
                  disabled={busy}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 text-left disabled:opacity-60"
                >
                  <span className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center">
                    <i className="fa-solid fa-folder-plus"></i>
                  </span>
                  <span className="flex-1 text-xs font-bold text-slate-700">
                    {t.saveToCollection}
                  </span>
                  <i className="fa-solid fa-chevron-right text-[10px] text-slate-400"></i>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSaveOpen(false)}
              disabled={busy}
              className="w-full h-10 mt-4 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold disabled:opacity-50"
            >
              {t.saveCancel}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={tc.removeFavoriteTitle}
        message={tc.removeFavoriteMessage}
        confirmLabel={tc.confirmBtn}
        cancelLabel={tc.cancelBtn}
        loading={confirmLoading}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
