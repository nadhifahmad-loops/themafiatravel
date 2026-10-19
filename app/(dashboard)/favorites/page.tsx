'use client';

// app/(dashboard)/favorites/page.tsx
// Halaman favorit bergaya "Daftar Simpan":
//   1. Section Koleksi — kartu "Buat Koleksi Baru" + kartu koleksi (cover,
//      nama, jumlah item, menu ⋯ → ganti nama / hapus). Klik kartu koleksi
//      → buka halaman detail koleksi (/favorites/collections/[id]).
//   2. Dua kolom — sidebar (filter tipe dan daftar lokasi tersimpan yang bisa
//      dicari) dan daftar kartu besar (FavoriteRow).
// Item kedaluwarsa diklik → popup konfirmasi hapus (bukan buka pencarian).

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useToast } from '@/contexts/ToastContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CollectionFormModal from '@/components/favorite/CollectionFormModal';
import FavoriteRow, { TYPE_META, collectionGradient } from '@/components/favorite/FavoriteRow';
import { airportCity, STATION_COORDS } from '@/lib/geo';

type TypeFilter = 'flight' | 'hotel' | 'train';

const ALL_TYPES: TypeFilter[] = ['flight', 'hotel', 'train'];

type SavedLocation = {
  name: string;
  address: string;
  latestSavedAt: string;
  searchText: string;
  favoriteIds: Set<string>;
};

type LocationParts = {
  city?: string;
  province?: string;
  country?: string;
};

const CITY_PARTS: Record<string, LocationParts> = {
  jakarta: { city: 'Jakarta', province: 'DKI Jakarta', country: 'Indonesia' },
  tangerang: { city: 'Tangerang', province: 'Banten', country: 'Indonesia' },
  surabaya: { city: 'Surabaya', province: 'Jawa Timur', country: 'Indonesia' },
  sidoarjo: { city: 'Sidoarjo', province: 'Jawa Timur', country: 'Indonesia' },
  bandung: { city: 'Bandung', province: 'Jawa Barat', country: 'Indonesia' },
  yogyakarta: { city: 'Yogyakarta', province: 'DI Yogyakarta', country: 'Indonesia' },
  semarang: { city: 'Semarang', province: 'Jawa Tengah', country: 'Indonesia' },
  solo: { city: 'Surakarta', province: 'Jawa Tengah', country: 'Indonesia' },
  malang: { city: 'Malang', province: 'Jawa Timur', country: 'Indonesia' },
  bali: { city: 'Bali', province: 'Bali', country: 'Indonesia' },
  medan: { city: 'Medan', province: 'Sumatera Utara', country: 'Indonesia' },
  makassar: { city: 'Makassar', province: 'Sulawesi Selatan', country: 'Indonesia' },
  balikpapan: { city: 'Balikpapan', province: 'Kalimantan Timur', country: 'Indonesia' },
  palembang: { city: 'Palembang', province: 'Sumatera Selatan', country: 'Indonesia' },
  lombok: { city: 'Lombok', province: 'Nusa Tenggara Barat', country: 'Indonesia' },
  padang: { city: 'Padang', province: 'Sumatera Barat', country: 'Indonesia' },
  'banda aceh': { city: 'Banda Aceh', province: 'Aceh', country: 'Indonesia' },
  pekanbaru: { city: 'Pekanbaru', province: 'Riau', country: 'Indonesia' },
  bengkulu: { city: 'Bengkulu', province: 'Bengkulu', country: 'Indonesia' },
  'palangka raya': { city: 'Palangka Raya', province: 'Kalimantan Tengah', country: 'Indonesia' },
  jayapura: { city: 'Jayapura', province: 'Papua', country: 'Indonesia' },
  'bandar lampung': { city: 'Bandar Lampung', province: 'Lampung', country: 'Indonesia' },
  ambon: { city: 'Ambon', province: 'Maluku', country: 'Indonesia' },
  sorong: { city: 'Sorong', province: 'Papua Barat Daya', country: 'Indonesia' },
  timika: { city: 'Timika', province: 'Papua Tengah', country: 'Indonesia' },
  kendari: { city: 'Kendari', province: 'Sulawesi Tenggara', country: 'Indonesia' },
  tarakan: { city: 'Tarakan', province: 'Kalimantan Utara', country: 'Indonesia' },
  batam: { city: 'Batam', province: 'Kepulauan Riau', country: 'Indonesia' },
  'tanjung pinang': { city: 'Tanjung Pinang', province: 'Kepulauan Riau', country: 'Indonesia' },
  pontianak: { city: 'Pontianak', province: 'Kalimantan Barat', country: 'Indonesia' },
  banjarmasin: { city: 'Banjarmasin', province: 'Kalimantan Selatan', country: 'Indonesia' },
  gorontalo: { city: 'Gorontalo', province: 'Gorontalo', country: 'Indonesia' },
  ternate: { city: 'Ternate', province: 'Maluku Utara', country: 'Indonesia' },
  manado: { city: 'Manado', province: 'Sulawesi Utara', country: 'Indonesia' },
  'labuan bajo': { city: 'Labuan Bajo', province: 'Nusa Tenggara Timur', country: 'Indonesia' },
  kupang: { city: 'Kupang', province: 'Nusa Tenggara Timur', country: 'Indonesia' },
  sumbawa: { city: 'Sumbawa', province: 'Nusa Tenggara Barat', country: 'Indonesia' },
  maumere: { city: 'Maumere', province: 'Nusa Tenggara Timur', country: 'Indonesia' },
  'tanjung pandan': { city: 'Tanjung Pandan', province: 'Kepulauan Bangka Belitung', country: 'Indonesia' },
  singapore: { city: 'Singapore', country: 'Singapore' },
  'kuala lumpur': { city: 'Kuala Lumpur', province: 'Kuala Lumpur', country: 'Malaysia' },
  bangkok: { city: 'Bangkok', province: 'Bangkok', country: 'Thailand' },
  tokyo: { city: 'Tokyo', province: 'Tokyo', country: 'Japan' },
  osaka: { city: 'Osaka', province: 'Osaka', country: 'Japan' },
  'hong kong': { city: 'Hong Kong', country: 'Hong Kong' },
  taipei: { city: 'Taipei', country: 'Taiwan' },
  seoul: { city: 'Seoul', province: 'Seoul', country: 'South Korea' },
  shanghai: { city: 'Shanghai', province: 'Shanghai', country: 'China' },
  beijing: { city: 'Beijing', province: 'Beijing', country: 'China' },
  guangzhou: { city: 'Guangzhou', province: 'Guangdong', country: 'China' },
  'ho chi minh': { city: 'Ho Chi Minh City', country: 'Vietnam' },
  hanoi: { city: 'Hanoi', country: 'Vietnam' },
  manila: { city: 'Manila', province: 'Metro Manila', country: 'Philippines' },
  'new delhi': { city: 'New Delhi', province: 'Delhi', country: 'India' },
  mumbai: { city: 'Mumbai', province: 'Maharashtra', country: 'India' },
  dubai: { city: 'Dubai', country: 'United Arab Emirates' },
  doha: { city: 'Doha', country: 'Qatar' },
  jeddah: { city: 'Jeddah', province: 'Makkah', country: 'Saudi Arabia' },
  sydney: { city: 'Sydney', province: 'New South Wales', country: 'Australia' },
  melbourne: { city: 'Melbourne', province: 'Victoria', country: 'Australia' },
  auckland: { city: 'Auckland', country: 'New Zealand' },
  london: { city: 'London', country: 'United Kingdom' },
  paris: { city: 'Paris', province: 'Ile-de-France', country: 'France' },
  amsterdam: { city: 'Amsterdam', province: 'North Holland', country: 'Netherlands' },
  frankfurt: { city: 'Frankfurt', province: 'Hesse', country: 'Germany' },
  istanbul: { city: 'Istanbul', country: 'Turkey' },
};

const COUNTRY_NAMES: Record<string, string> = {
  ID: 'Indonesia',
  SG: 'Singapore',
  MY: 'Malaysia',
  TH: 'Thailand',
  JP: 'Japan',
};

function countryName(value: string): string {
  const code = value.trim().toUpperCase();
  return COUNTRY_NAMES[code] || value;
}

function locationAddress(parts: LocationParts, fallback?: string): string {
  const address = [parts.city, parts.province, parts.country]
    .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index)
    .join(', ');
  return address || fallback || '';
}

function getSavedLocations(items: ReturnType<typeof useFavorites>['items']): SavedLocation[] {
  const locations = new Map<string, SavedLocation>();

  for (const item of items) {
    const params = item.searchParams || {};
    const textParam = (value: unknown) =>
      typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    let city = '';
    let addressParts: LocationParts = {};

    if (item.entityType === 'flight') {
      const code = textParam(params.destination).toUpperCase();
      city = airportCity(code);
      addressParts = CITY_PARTS[city.toLocaleLowerCase()] || { city };
    } else if (item.entityType === 'train') {
      const journeys = Array.isArray(params.journey_list) ? params.journey_list : [];
      const firstJourney = journeys[0] && typeof journeys[0] === 'object'
        ? (journeys[0] as Record<string, unknown>)
        : {};
      const code = textParam(params.destination ?? firstJourney.destination).toUpperCase();
      const station = STATION_COORDS[code];
      const stationCities: Record<string, string> = {
        GMR: 'Jakarta', PSE: 'Jakarta', JAKK: 'Jakarta', JNG: 'Jakarta',
        SGU: 'Surabaya', SBI: 'Surabaya', YK: 'Yogyakarta', LPN: 'Yogyakarta',
        SLO: 'Solo', PWS: 'Solo', SMT: 'Semarang', SMC: 'Semarang', ML: 'Malang',
      };
      city = stationCities[code] || station?.name || code;
      addressParts = CITY_PARTS[city.toLocaleLowerCase()] || { city };
    } else if (item.entityType === 'hotel') {
      const queryName = textParam(params.q);
      city = item.subtitle?.trim() || queryName;
      addressParts =
        CITY_PARTS[city.toLocaleLowerCase()] ||
        CITY_PARTS[queryName.toLocaleLowerCase()] || {
          city,
          country: countryName(textParam(params._country)),
        };
    }

    const name = city.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const address = locationAddress(addressParts, countryName(textParam(params._country)));
    const current = locations.get(key);
    if (current) {
      if (new Date(item.createdAt).getTime() > new Date(current.latestSavedAt).getTime()) {
        current.latestSavedAt = item.createdAt;
      }
      current.searchText += ` ${item.title} ${item.subtitle || ''}`;
      current.favoriteIds.add(item.id);
    } else {
      locations.set(key, {
        name,
        address,
        latestSavedAt: item.createdAt,
        searchText: `${name} ${address} ${item.title} ${item.subtitle || ''}`,
        favoriteIds: new Set([item.id]),
      });
    }
  }

  return [...locations.values()].sort(
    (a, b) =>
      new Date(b.latestSavedAt).getTime() - new Date(a.latestSavedAt).getTime() ||
      a.name.localeCompare(b.name)
  );
}

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-4 animate-pulse">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 shrink-0"></div>
      <div className="flex-1 py-1 space-y-2.5">
        <div className="h-3 bg-slate-100 rounded w-1/4"></div>
        <div className="h-3.5 bg-slate-100 rounded w-1/2"></div>
        <div className="h-3 bg-slate-100 rounded w-1/3"></div>
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  const { language } = useLanguage();
  const t = i18n.favorites[language];
  const tCol = i18n.collections[language];
  const tc = i18n.confirm[language];
  const router = useRouter();
  const { items, collections, loading, createCollection, renameCollection, deleteCollection } =
    useFavorites();
  const { toast } = useToast();

  const [selectedTypes, setSelectedTypes] = useState<Set<TypeFilter>>(new Set());
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState('');

  // Modal form koleksi (create/rename).
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'rename'>('create');
  const [formTargetId, setFormTargetId] = useState<string | null>(null);
  const [formInitial, setFormInitial] = useState('');

  // Menu ⋯ per kartu koleksi.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  // Konfirmasi hapus koleksi.
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const counts = useMemo(
    () => ({
      all: items.length,
      flight: items.filter((i) => i.entityType === 'flight').length,
      hotel: items.filter((i) => i.entityType === 'hotel').length,
      train: items.filter((i) => i.entityType === 'train').length,
    }),
    [items]
  );

  // Hanya tipe yang benar-benar ada di daftar favorit yang ditampilkan.
  const presentTypes = useMemo(
    () => ALL_TYPES.filter((type) => counts[type] > 0),
    [counts]
  );

  const collectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      if (it.collectionId) map.set(it.collectionId, (map.get(it.collectionId) || 0) + 1);
    }
    return map;
  }, [items]);

  const activeSelectedTypes = useMemo(
    () => new Set([...selectedTypes].filter((type) => presentTypes.includes(type))),
    [selectedTypes, presentTypes]
  );

  const savedLocations = useMemo(() => getSavedLocations(items), [items]);
  const activeSelectedLocations = useMemo(() => {
    const available = new Set(savedLocations.map((location) => location.name.toLocaleLowerCase()));
    return new Set([...selectedLocations].filter((key) => available.has(key)));
  }, [selectedLocations, savedLocations]);

  const visibleItems = useMemo(
    () => {
      let visible = items;
      if (activeSelectedTypes.size > 0) {
        visible = visible.filter((item) => activeSelectedTypes.has(item.entityType as TypeFilter));
      }
      if (activeSelectedLocations.size > 0) {
        const selectedIds = new Set(
          savedLocations
            .filter((location) =>
              activeSelectedLocations.has(location.name.toLocaleLowerCase())
            )
            .flatMap((location) => [...location.favoriteIds])
        );
        visible = visible.filter((item) => selectedIds.has(item.id));
      }
      return visible;
    },
    [items, activeSelectedTypes, activeSelectedLocations, savedLocations]
  );

  const matchingLocations = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase();
    return query
      ? savedLocations.filter((location) =>
          location.searchText.toLocaleLowerCase().includes(query)
        )
      : savedLocations;
  }, [savedLocations, keyword]);

  const toggleType = (type: TypeFilter) => {
    setSelectedTypes((cur) => {
      const next = new Set([...cur].filter((selected) => presentTypes.includes(selected)));
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleLocation = (name: string) => {
    const key = name.toLocaleLowerCase();
    setSelectedLocations((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openCreate = () => {
    setFormMode('create');
    setFormTargetId(null);
    setFormInitial('');
    setFormOpen(true);
  };

  const openRename = (c: { id: string; name: string }) => {
    setFormMode('rename');
    setFormTargetId(c.id);
    setFormInitial(c.name);
    setFormOpen(true);
  };

  const handleFormSubmit = async (name: string): Promise<boolean> => {
    if (formMode === 'create') {
      return (await createCollection(name)) !== null;
    }
    if (formTargetId) return renameCollection(formTargetId, name);
    return false;
  };

  const handleDeleteCollection = async () => {
    if (!deleteTargetId || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const ok = await deleteCollection(deleteTargetId);
      if (ok) toast(tCol.deletedToast, { variant: 'info' });
      setDeleteTargetId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const isLoadingList = loading && items.length === 0;

  return (
    <div className="min-h-screen bg-brand-bgLight">
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          {/* ── SECTION KOLEKSI ── */}
          <section className="pt-2 pb-6">
            <h2 className="text-sm font-black text-slate-800">{tCol.title}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3">{tCol.subtitle}</p>

            <div className="flex gap-3 overflow-x-auto pb-1">
              {/* Buat Koleksi Baru */}
              {/* Buat Koleksi Baru — gaya slot tambahan (dashed) */}
              <button
                type="button"
                onClick={openCreate}
                className="shrink-0 w-36 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/50 text-orange-500 flex flex-col items-center justify-center gap-2.5 h-[7.5rem]"
              >
                <div className="w-11 h-11 rounded-2xl bg-white border border-orange-200 shadow-sm flex items-center justify-center">
                  <i className="fa-solid fa-plus text-base"></i>
                </div>
                <span className="text-xs font-bold leading-tight text-center px-2">
                  {tCol.newCollection}
                </span>
              </button>

              {/* Kartu koleksi — klik → halaman detail koleksi.
                  Catatan: JANGAN pakai active:scale/transform di kartu — saat
                  menekan tombol ⋯, transform membuat kartu jadi stacking
                  context sehingga dropdown (z-20) jatuh di bawah overlay
                  penutup (z-10) dan klik tidak sampai ke tombol menu. */}
              {collections.map((c) => {
                // Cover: kustom pilihan user, atau gradasi default (tanpa
                // foto favorit otomatis).
                const cover = c.coverImage ?? null;
                const count = collectionCounts.get(c.id) || 0;
                return (
                  <div
                    key={c.id}
                    className="shrink-0 w-36 rounded-2xl bg-white border border-slate-100 cursor-pointer"
                    onClick={() => router.push(`/favorites/collections/${c.id}`)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/favorites/collections/${c.id}`);
                      }
                    }}
                    aria-label={`${tCol.title}: ${c.name}`}
                  >
                    <div className="h-20 overflow-hidden rounded-t-2xl">
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
                          className={`w-full h-full bg-gradient-to-br ${collectionGradient(c.id)} flex items-center justify-center`}
                        >
                          <i className="fa-solid fa-folder-open text-white/80 text-xl drop-shadow-sm"></i>
                        </div>
                      )}
                    </div>
                    <div className="px-2.5 py-2 relative pr-8">
                      <p className="text-xs font-black text-slate-800 truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        {tCol.itemCount(count)}
                      </p>
                      {/* Titik tiga — pojok kanan bawah, di bawah gambar */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (menuFor === c.id) {
                            setMenuFor(null);
                            setMenuPosition(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuFor(c.id);
                            setMenuPosition({
                              top: rect.bottom + 4,
                              right: window.innerWidth - rect.right,
                            });
                          }
                        }}
                        title={tCol.menu}
                        aria-label={tCol.menu}
                        aria-expanded={menuFor === c.id}
                        className="absolute right-1.5 bottom-1.5 w-6 h-6 rounded-full border border-slate-200 bg-white shadow-sm flex items-center justify-center text-slate-500"
                      >
                        <i className="fa-solid fa-ellipsis text-[10px]"></i>
                      </button>
                      {menuFor === c.id && (
                        menuPosition &&
                        createPortal(
                          <div
                            style={{
                              position: 'fixed',
                              top: menuPosition.top,
                              right: menuPosition.right,
                            }}
                            className="z-20 w-36 bg-white rounded-xl border border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden animate-fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setMenuFor(null);
                                setMenuPosition(null);
                                openRename(c);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              <i className="fa-solid fa-pen text-[9px] w-3 text-center"></i>
                              {tCol.rename}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuFor(null);
                                setMenuPosition(null);
                                setDeleteTargetId(c.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <i className="fa-solid fa-trash-can text-[9px] w-3 text-center"></i>
                              {tCol.delete}
                            </button>
                          </div>,
                          document.body
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="border-t border-slate-200"></div>

          {/* ── DUA KOLOM: SIDEBAR + DAFTAR (sidebar hanya bila ada item) ── */}
          <div
            className={`grid gap-6 pt-6 ${
              items.length > 0 ? 'grid-cols-1 md:grid-cols-[220px_1fr]' : 'grid-cols-1'
            }`}
          >
            {/* Sidebar — hanya tampil bila ada item; tipe yang kosong tidak ditampilkan */}
            {items.length > 0 && (
              <aside className="self-start rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-5">
                {presentTypes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black text-slate-700 mb-2.5">
                      {language === 'EN' ? 'Item type' : 'Tipe item'}
                    </h3>
                    <div className="space-y-2">
                      {presentTypes.map((type) => {
                        const meta = TYPE_META[type];
                        const checked = selectedTypes.has(type);
                        return (
                          <label key={type} className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleType(type)}
                              className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400 cursor-pointer"
                            />
                            <span className="text-xs font-semibold text-slate-600">
                              {t[meta.labelKey]}
                            </span>
                            <span className="ml-auto text-[10px] font-bold text-slate-400">
                              {counts[type]}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-black text-slate-700 mb-2.5">
                    {t.locationTitle}
                  </h3>
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400"></i>
                    <input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder={t.locationSearchPlaceholder}
                      aria-label={t.locationSearchPlaceholder}
                      className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-xl bg-white text-xs outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition-all"
                    />
                  </div>
                  <h4 className="text-[10px] font-semibold text-slate-500 mt-3 mb-2">
                    {keyword.trim() ? t.locationResults : t.recentLocations}
                  </h4>
                  {matchingLocations.length > 0 ? (
                    <ul className="max-h-80 overflow-y-auto space-y-1">
                      {matchingLocations.map((location) => (
                        <li key={location.name.toLocaleLowerCase()}>
                          <label className="flex items-start gap-2.5 rounded-lg px-1 py-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeSelectedLocations.has(location.name.toLocaleLowerCase())}
                              onChange={() => toggleLocation(location.name)}
                              className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 text-orange-500 focus:ring-orange-400 cursor-pointer"
                            />
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-slate-700 truncate">
                                {location.name}
                              </span>
                              <span className="block text-[10px] text-slate-500">
                                {location.address || location.name}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-400 py-2">{t.noMatchingLocations}</p>
                  )}
                </div>
              </aside>
            )}

            {/* Daftar Simpan */}
            <section>
              <h2 className="text-sm font-black text-slate-800 mb-3">{t.listTitle}</h2>

              {/* Skeleton */}
              {isLoadingList && (
                <div className="space-y-3" aria-busy="true">
                  <span className="sr-only">{t.loading}</span>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              )}

              {/* Kosong (belum ada favorit sama sekali) */}
              {!isLoadingList && items.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 md:p-16 text-center">
                  <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-orange-100">
                    <i className="fa-regular fa-bookmark text-orange-300 text-3xl"></i>
                  </div>
                  <p className="font-black text-slate-800 text-lg md:text-xl mb-2">{t.empty}</p>
                  <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-xl mx-auto">
                    {t.emptyDesc}
                  </p>
                </div>
              )}

              {/* Kosong (filter aktif tapi tidak ada hasil) */}
              {!isLoadingList && items.length > 0 && visibleItems.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
                  <i className="fa-solid fa-filter-circle-xmark text-slate-300 text-2xl mb-3"></i>
                  <p className="font-black text-slate-700 text-sm mb-1">
                    {language === 'EN' ? 'No matching items' : 'Tidak ada item yang cocok'}
                  </p>
                  <p className="text-slate-400 text-xs">
                    {language === 'EN'
                      ? 'Try changing the item type filter.'
                      : 'Coba ubah filter tipe item.'}
                  </p>
                </div>
              )}

              {/* Daftar */}
              {visibleItems.length > 0 && (
                <div className="space-y-3">
                  {visibleItems.map((item) => (
                    <FavoriteRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Modal form koleksi */}
      <CollectionFormModal
        open={formOpen}
        mode={formMode}
        initialName={formInitial}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Konfirmasi hapus koleksi */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        title={tc.removeCollectionTitle}
        message={tc.removeCollectionMessage}
        confirmLabel={tc.confirmBtn}
        cancelLabel={tc.cancelBtn}
        loading={deleteLoading}
        onConfirm={handleDeleteCollection}
        onCancel={() => setDeleteTargetId(null)}
      />

      {/* Klik area luar menutup menu ⋯ */}
      {menuFor !== null && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setMenuFor(null);
            setMenuPosition(null);
          }}
        ></div>
      )}
    </div>
  );
}
