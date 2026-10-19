'use client';

// app/(dashboard)/favorites/collections/[id]/page.tsx
// Halaman detail koleksi (gaya Traveloka):
//   - Cover besar (kover kustom pilihan user via "Ganti Kover", fallback gradasi)
//   - Kartu putih: avatar + nama user, ikon gembok + nama koleksi,
//     "Diperbarui {tanggal}", tombol "+ Tambah Item" / ✎ (ganti nama) / share
//   - Daftar item koleksi (FavoriteRow — item kedaluwarsa diklik → popup hapus)

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Bookmark, Camera, FolderPlus, LockKeyhole, Pencil, Plus, Share2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { useFavorites, type FavoriteItem } from '@/contexts/FavoritesContext';
import { useToast } from '@/contexts/ToastContext';
import FavoriteRow, { fmtIDR } from '@/components/favorite/FavoriteRow';
import CollectionFormModal from '@/components/favorite/CollectionFormModal';

// ─── Modal "Tambah Item" — pilih favorit yang belum ada di koleksi ini ──────

function AddItemModal({
  open,
  collectionId,
  items,
  onClose,
}: {
  open: boolean;
  collectionId: string;
  items: FavoriteItem[];
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const t = i18n.collections[language];
  const tFav = i18n.favorites[language];
  const { assignToCollection } = useFavorites();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const available = useMemo(
    () => items.filter((i) => i.collectionId !== collectionId),
    [items, collectionId]
  );

  if (!open) return null;

  const add = async (fav: FavoriteItem) => {
    if (busyId) return;
    setBusyId(fav.id);
    try {
      const ok = await assignToCollection(fav.id, collectionId);
      if (ok) toast(t.addedToast, { variant: 'success' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.addItemTitle}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-5 pb-3 border-b border-slate-100">
          <h3 className="text-base font-black text-brand-ink">{t.addItemTitle}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{t.addItemDesc}</p>
        </div>

        {available.length === 0 ? (
          <div className="p-8 text-center">
            <i className="fa-solid fa-circle-check text-emerald-300 text-2xl mb-3"></i>
            <p className="text-slate-500 text-sm font-semibold">
              {language === 'EN'
                ? 'All your favorites are already in this collection.'
                : 'Semua favoritmu sudah ada di koleksi ini.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {available.map((fav) => (
              <button
                key={fav.id}
                type="button"
                onClick={() => add(fav)}
                disabled={busyId !== null}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-50 border border-slate-100 shrink-0 flex items-center justify-center">
                  {fav.image ? (
                    <img src={fav.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Bookmark className="w-4 h-4 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {tFav[
                      fav.entityType === 'flight'
                        ? 'tabFlight'
                        : fav.entityType === 'hotel'
                          ? 'tabHotel'
                          : 'tabTrain'
                    ]}
                  </p>
                  <p className="text-xs font-black text-slate-800 truncate">{fav.title}</p>
                  {typeof fav.price === 'number' && fav.price > 0 && (
                    <p className="text-[11px] font-bold text-slate-700">{fmtIDR(fav.price)}</p>
                  )}
                </div>
                <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[11px]">
                  {busyId === fav.id ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all"
          >
            {i18n.confirm[language].cancelBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Halaman detail koleksi ─────────────────────────────────────────────────

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const collectionId = params?.id;
  const { language } = useLanguage();
  const t = i18n.favorites[language];
  const tCol = i18n.collections[language];
  const { data: session, status: sessionStatus } = useSession();
  const { items, collections, loading, loaded, renameCollection, setCollectionCover } =
    useFavorites();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const collection = collections.find((c) => c.id === collectionId) ?? null;
  const collectionItems = useMemo(
    () => items.filter((i) => i.collectionId === collectionId),
    [items, collectionId]
  );
  // Cover: kustom pilihan user, atau gradasi default (tanpa foto favorit otomatis).
  const cover = collection?.coverImage ?? null;

  const userName = session?.user?.name || session?.user?.email || '—';
  const userInitial = userName.trim().charAt(0).toUpperCase() || 'U';

  const handleRename = async (name: string): Promise<boolean> => {
    if (!collectionId) return false;
    return renameCollection(collectionId, name);
  };

  // Ganti kover: buka file picker → upload → perbarui cover.
  const handleChangeCover = async (file: File | null) => {
    if (!collectionId || !file || coverBusy) return;
    setCoverBusy(true);
    try {
      const res = await setCollectionCover(collectionId, file);
      if (res.ok) toast(tCol.changeCoverToast, { variant: 'success' });
      else toast(tCol.coverError, { variant: 'error' });
    } finally {
      setCoverBusy(false);
    }
  };

  const handleShare = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: collection?.name || tCol.title, url: window.location.href });
          toast(tCol.shareSuccess, { variant: 'success' });
          setShareOpen(false);
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }

      await navigator.clipboard.writeText(window.location.href);
      toast(tCol.shareToast, { variant: 'success' });
      setShareOpen(false);
    } catch {
      toast(tCol.shareError, { variant: 'error' });
    } finally {
      setShareBusy(false);
    }
  };

  const fmtUpdated = (iso: string | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Loading awal — tunggu session + fetch pertama selesai sebelum menyimpulkan.
  const stillLoading = sessionStatus === 'loading' || !loaded || (loading && collections.length === 0);

  if (stillLoading) {
    return (
      <div className="min-h-screen bg-brand-bgLight">
        <div className="pt-24 px-4 max-w-3xl mx-auto" aria-busy="true">
          <span className="sr-only">{t.loading}</span>
          <div className="h-56 rounded-2xl bg-slate-200 animate-pulse"></div>
          <div className="h-28 rounded-2xl bg-white border border-slate-100 -mt-10 mx-6 relative animate-pulse"></div>
          <div className="space-y-3 mt-6">
            <div className="h-24 rounded-2xl bg-white border border-slate-100 animate-pulse"></div>
            <div className="h-24 rounded-2xl bg-white border border-slate-100 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Koleksi tidak ditemukan (id salah / sudah dihapus).
  if (!collection) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="pt-32 px-4 max-w-md mx-auto text-center">
          <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center mx-auto mb-4">
            <FolderPlus className="w-6 h-6 text-slate-300" />
          </div>
          <p className="font-black text-slate-700 mb-1">{tCol.notFound}</p>
          <Link
            href="/favorites"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-slate-900 hover:bg-slate-700 text-white font-bold rounded-xl transition-all text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {tCol.backToFavorites}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Kembali ke daftar favorit */}
          <Link
            href="/favorites"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {tCol.backToFavorites}
          </Link>

          {/* Cover */}
          <div className="relative h-56 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300">
            {cover ? (
              <img
                src={cover}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="w-full h-full bg-gradient-to-br from-slate-400 via-slate-500 to-slate-700 flex items-center justify-center"
              >
                <FolderPlus className="w-16 h-16 text-white/70 stroke-[1.25]" />
              </div>
            )}

            {/* Tombol ganti kover (kanan atas — di luar area tertimpa kartu info) */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={coverBusy}
                title={tCol.changeCover}
                aria-label={tCol.changeCover}
                className="h-9 px-4 rounded-xl bg-white/95 backdrop-blur text-slate-700 hover:bg-white text-[11px] font-bold shadow-sm border border-white/70 flex items-center gap-2 disabled:opacity-60"
              >
                {coverBusy ? (
                  <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                {tCol.changeCover}
              </button>
            </div>

            {/* File picker tersembunyi */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = ''; // reset supaya file yang sama bisa dipilih ulang
                if (file) handleChangeCover(file);
              }}
            />
          </div>

          {/* Kartu info (overlay cover) */}
          <div className="relative -mt-12 mx-4 md:mx-8 bg-white rounded-2xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] border border-slate-100 p-5">
            {/* Baris atas: avatar + nama user · tombol aksi */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 border-4 border-white shadow-sm">
                  {userInitial}
                </div>
                <p className="text-sm font-bold text-slate-700 truncate">{userName}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-700 font-bold text-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {tCol.addItem}
                </button>
                <button
                  type="button"
                  onClick={() => setRenameOpen(true)}
                  title={tCol.rename}
                  aria-label={tCol.rename}
                  className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  title={tCol.shareLabel}
                  aria-label={tCol.shareLabel}
                  className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Gembok + nama koleksi + diperbarui */}
            <div className="mt-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                <LockKeyhole className="w-4 h-4 text-slate-500" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black text-slate-900 truncate">{collection.name}</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {tCol.updated} {fmtUpdated(collection.updatedAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Daftar item koleksi */}
          <div className="mt-6 mx-4 md:mx-8">
            {collectionItems.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
                  <FolderPlus className="w-5 h-5 text-slate-300" />
                </div>
                <p className="font-black text-slate-700 text-sm mb-1">{tCol.emptyCollection}</p>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-700 font-bold text-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {tCol.addItem}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {collectionItems.map((item) => (
                  <FavoriteRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal tambah item */}
      <AddItemModal
        open={addOpen}
        collectionId={collectionId}
        items={items}
        onClose={() => setAddOpen(false)}
      />

      {/* Modal ganti nama */}
      <CollectionFormModal
        open={renameOpen}
        mode="rename"
        initialName={collection.name}
        onClose={() => setRenameOpen(false)}
        onSubmit={handleRename}
      />

      {shareOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !shareBusy && setShareOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-collection-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                <Share2 className="h-5 w-5" />
              </div>
              <h2 id="share-collection-title" className="text-base font-black text-slate-900">
                {tCol.shareConfirmTitle}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{tCol.shareConfirmDescription}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                disabled={shareBusy}
                className="h-10 flex-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {tCol.shareCancel}
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={shareBusy}
                className="h-10 flex-1 rounded-xl bg-orange-500 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {shareBusy ? t.loading : tCol.shareLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
