'use client';

// contexts/FavoritesContext.tsx
// State favorit bersama untuk semua halaman dalam route group (dashboard):
// - sekali fetch saat user login (tanpa N+1 per kartu),
// - isSaved() untuk render ikon bookmark,
// - toggle() optimis (update lokal dulu, rollback bila API gagal).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
// Nilai saja (bukan komponen) — AuthModalContext hanya meng-import tipe dari
// file ini, jadi tidak ada circular dependency runtime.
import { PENDING_FAVORITE_KEY } from '@/contexts/AuthModalContext';

export type FavoriteItem = {
  id: string;
  entityType: string;
  dedupeKey: string;
  title: string;
  subtitle: string | null;
  price: number | null;
  image: string | null;
  searchParams: Record<string, unknown>;
  collectionId: string | null;
  createdAt: string;
};

export type CollectionItem = {
  id: string;
  name: string;
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewFavorite = {
  entityType: string;
  dedupeKey: string;
  title: string;
  subtitle?: string | null;
  price?: number | null;
  image?: string | null;
  searchParams: Record<string, unknown>;
};

type FavoritesContextValue = {
  items: FavoriteItem[];
  collections: CollectionItem[];
  loading: boolean;
  /** True setelah fetch pertama selesai (membedakan "belum termuat" vs "kosong"). */
  loaded: boolean;
  isSaved: (entityType: string, dedupeKey: string) => boolean;
  toggle: (item: NewFavorite) => Promise<boolean>;
  removeById: (id: string) => Promise<void>;
  createCollection: (name: string) => Promise<CollectionItem | null>;
  renameCollection: (id: string, name: string) => Promise<boolean>;
  /** Ganti cover koleksi: file = upload cover baru, null = kembali ke gradasi default. */
  setCollectionCover: (id: string, file: File) => Promise<{ ok: boolean; coverImage: string | null }>;
  deleteCollection: (id: string) => Promise<boolean>;
  assignToCollection: (favoriteId: string, collectionId: string | null) => Promise<boolean>;
  refresh: () => Promise<FavoriteItem[] | null>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const keyOf = (entityType: string, dedupeKey: string) => `${entityType}:${dedupeKey}`;

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  // True setelah fetch pertama selesai — dipakai halaman detail koleksi
  // untuk membedakan "belum termuat" (skeleton) vs "memang tidak ada".
  const [loaded, setLoaded] = useState(false);
  // Kunci yang sedang diproses — cegah klik ganda mengirim dua request.
  const pending = useRef<Set<string>>(new Set());
  // Ref sinkron ke state terkini untuk dipakai di dalam removeById/toggle.
  const itemsRef = useRef<FavoriteItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const collectionsRef = useRef<CollectionItem[]>(collections);
  useEffect(() => {
    collectionsRef.current = collections;
  }, [collections]);

  // Nomor urut refresh — respon jaringan bisa datang tidak berurutan, dan
  // respon basi tidak boleh menimpa data terbaru (mis. refresh otomatis saat
  // status login berubah berbarengan dengan refresh dari aksi pending).
  const refreshSeq = useRef(0);

  const refresh = useCallback(async (): Promise<FavoriteItem[] | null> => {
    if (status !== 'authenticated') {
      setItems([]);
      setCollections([]);
      setLoaded(true); // tidak ada yang perlu ditunggu untuk guest
      return null;
    }
    const seq = ++refreshSeq.current;
    try {
      setLoading(true);
      const [favRes, colRes] = await Promise.all([
        fetch('/api/user/favorites'),
        fetch('/api/user/collections'),
      ]);
      const data = await favRes.json();
      const colData = await colRes.json().catch(() => null);
      if (seq !== refreshSeq.current) return null; // respon basi — jangan timpa state
      if (colRes.ok && colData?.success && Array.isArray(colData.collections)) {
        setCollections(colData.collections);
      }
      if (favRes.ok && data.success && Array.isArray(data.favorites)) {
        setItems(data.favorites);
        return data.favorites as FavoriteItem[];
      }
      return null;
    } catch {
      // non-fatal: biarkan daftar lama
      return null;
    } finally {
      if (seq === refreshSeq.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Aksi "simpan favorit" yang ditunda: guest menekan bookmark → popup login →
  // login sukses → halaman reload dengan sesi terautentikasi → payload dari
  // sessionStorage (lihat AuthModalContext) dieksekusi DI SINI, sekali saja.
  // Payload dihapus dari storage lebih dulu agar aman terhadap double-invoke
  // StrictMode dan navigasi ganda.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const raw = sessionStorage.getItem(PENDING_FAVORITE_KEY);
    if (!raw) return;
    let payload: NewFavorite | null = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
    sessionStorage.removeItem(PENDING_FAVORITE_KEY);
    if (!payload || typeof payload.dedupeKey !== 'string' || !payload.title) return;

    (async () => {
      try {
        // Upsert idempoten di server — aman jika entah bagaimana sudah tersimpan.
        await fetch('/api/user/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        /* non-fatal — pengguna bisa menekan bookmark lagi */
      }
      await refresh();
    })();
  }, [status, refresh]);

  const savedKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(keyOf(it.entityType, it.dedupeKey));
    return set;
  }, [items]);

  const isSaved = useCallback(
    (entityType: string, dedupeKey: string) => savedKeySet.has(keyOf(entityType, dedupeKey)),
    [savedKeySet]
  );

  const removeById = useCallback(async (id: string) => {
    const prev = itemsRef.current;
    const target = prev.find((it) => it.id === id);
    if (!target) return;
    const k = keyOf(target.entityType, target.dedupeKey);
    if (pending.current.has(k)) return;
    pending.current.add(k);

    // Optimis: sembunyikan dulu.
    setItems(prev.filter((it) => it.id !== id));
    try {
      const res = await fetch(`/api/user/favorites/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // Rollback bila gagal.
      setItems((cur) =>
        cur.some((it) => it.id === id) ? cur : [target, ...cur].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      );
    } finally {
      pending.current.delete(k);
    }
  }, []);

  const toggle = useCallback(
    async (item: NewFavorite): Promise<boolean> => {
      const k = keyOf(item.entityType, item.dedupeKey);
      if (pending.current.has(k)) return false;
      pending.current.add(k);

      const existing = itemsRef.current.find(
        (it) => it.entityType === item.entityType && it.dedupeKey === item.dedupeKey
      );

      try {
        if (existing) {
          // Optimis: hapus.
          setItems((cur) => cur.filter((it) => it.id !== existing.id));
          const res = await fetch(`/api/user/favorites/${existing.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else {
          // Optimis: tambah (id sementara sampai server balas).
          const optimistic: FavoriteItem = {
            ...item,
            subtitle: item.subtitle ?? null,
            price: item.price ?? null,
            image: item.image ?? null,
            collectionId: null,
            id: `temp:${k}`,
            createdAt: new Date().toISOString(),
          };
          setItems((cur) => [optimistic, ...cur]);
          const res = await fetch('/api/user/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
          // Ganti id optimis dengan id asli dari server.
          setItems((cur) =>
            optimisticIdSwap(cur, optimistic.id, data.favorite as FavoriteItem)
          );
        }
        return true;
      } catch {
        // Rollback: muat ulang daftar sebenarnya dari server.
        await refresh();
        return false;
      } finally {
        pending.current.delete(k);
      }
    },
    [refresh]
  );

  const createCollection = useCallback(
    async (name: string): Promise<CollectionItem | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      try {
        const res = await fetch('/api/user/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
        const created = data.collection as CollectionItem;
        setCollections((cur) => [...cur, created]);
        return created;
      } catch {
        return null;
      }
    },
    []
  );

  const renameCollection = useCallback(async (id: string, name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    try {
      const res = await fetch(`/api/user/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCollections((cur) =>
        cur.map((c) =>
          c.id === id ? { ...c, name: trimmed, updatedAt: new Date().toISOString() } : c
        )
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  const setCollectionCover = useCallback(
    async (id: string, file: File): Promise<{ ok: boolean; coverImage: string | null }> => {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/user/collections/${id}/cover`, {
          method: 'POST',
          body: fd,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
        const url: string = data.coverImage;
        setCollections((cur) =>
          cur.map((c) =>
            c.id === id
              ? { ...c, coverImage: url, updatedAt: data.updatedAt ?? new Date().toISOString() }
              : c
          )
        );
        return { ok: true, coverImage: url };
      } catch {
        return { ok: false, coverImage: null };
      }
    },
    []
  );

  const deleteCollection = useCallback(async (id: string): Promise<boolean> => {
    // Optimis: hapus koleksi + lepas isinya (server melakukan SetNull).
    const prevCols = collectionsRef.current;
    const prevItems = itemsRef.current;
    setCollections((cur) => cur.filter((c) => c.id !== id));
    setItems((cur) =>
      cur.map((it) => (it.collectionId === id ? { ...it, collectionId: null } : it))
    );
    try {
      const res = await fetch(`/api/user/collections/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch {
      // Rollback.
      setCollections(prevCols);
      setItems(prevItems);
      return false;
    }
  }, []);

  const assignToCollection = useCallback(
    async (favoriteId: string, collectionId: string | null): Promise<boolean> => {
      const prev = itemsRef.current;
      const target = prev.find((it) => it.id === favoriteId);
      if (!target) return false;
      // Optimis: pindahkan.
      setItems((cur) =>
        cur.map((it) => (it.id === favoriteId ? { ...it, collectionId } : it))
      );
      try {
        const res = await fetch(`/api/user/favorites/${favoriteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return true;
      } catch {
        // Rollback.
        setItems(prev);
        return false;
      }
    },
    []
  );

  return (
    <FavoritesContext.Provider
      value={{
        items,
        collections,
        loading,
        loaded,
        isSaved,
        toggle,
        removeById,
        createCollection,
        renameCollection,
        setCollectionCover,
        deleteCollection,
        assignToCollection,
        refresh,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

function optimisticIdSwap(cur: FavoriteItem[], tempId: string, real: FavoriteItem): FavoriteItem[] {
  return cur.map((it) => (it.id === tempId ? { ...real } : it));
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites harus dipakai di dalam <FavoritesProvider>');
  return ctx;
}
