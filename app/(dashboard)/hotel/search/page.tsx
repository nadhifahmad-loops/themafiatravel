'use client';
import { useState, useMemo, useEffect, useRef, useId, Suspense } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import HotelCard from '@/components/hotel/HotelCard';
import HotelSearchForm from '@/components/hotel/HotelSearchForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { matchesHotelPropertyType, parseHotelPropertyType, type HotelPropertyType } from '@/lib/hotel-property-type';

// Gambar per kota (disamakan dengan pola beranda: public/images/domestik/<kota>.png)
const POPULAR_HOTEL_DESTINATIONS = [
  { destination_id: 'ID8731', name: 'Bali',        nameEN: 'Bali',        price: 750000,  img: '/images/domestik/bali.png' },
  { destination_id: 'ID339',  name: 'Jakarta',     nameEN: 'Jakarta',     price: 380000,  img: '/images/domestik/jakarta.png' },
  { destination_id: 'ID8735', name: 'Yogyakarta',  nameEN: 'Yogyakarta',  price: 450000,  img: '/images/domestik/yogyakarta.png' },
  { destination_id: 'ID8734', name: 'Bandung',     nameEN: 'Bandung',     price: 400000,  img: '/images/domestik/bandung.png' },
  { destination_id: 'ID8732', name: 'Surabaya',    nameEN: 'Surabaya',    price: 350000,  img: '/images/domestik/surabaya.png' },
  { destination_id: 'SG7355', name: 'Singapura',   nameEN: 'Singapore',   price: 1500000, img: '/images/domestik/singapura.png' },
];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Loading skeleton ────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
        <div className="flex flex-1 items-start gap-3">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-100" />
            <div className="h-3 w-1/3 rounded bg-slate-100" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-24 rounded-full bg-slate-100" />
              <div className="h-5 w-20 rounded-full bg-slate-100" />
            </div>
          </div>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-4 md:w-56 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="space-y-2">
            <div className="h-2.5 w-16 rounded bg-slate-100" />
            <div className="h-6 w-32 rounded bg-orange-100" />
          </div>
          <div className="h-10 w-28 rounded-xl bg-orange-100" />
        </div>
      </div>
    </div>
  );
}

// ─── Filter Skeleton ────────────────────────────────────────────────────────
function FilterSkeleton() {
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-32 lg:w-72 lg:self-start">
      <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-200 rounded"></div>
          <div className="h-3 w-12 bg-slate-200 rounded"></div>
        </div>
        <div className="p-5 flex flex-col gap-6">
          {/* Price */}
          <div>
            <div className="h-2 w-20 bg-slate-200 rounded mb-3"></div>
            <div className="flex gap-1.5 mb-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-7 w-14 bg-slate-100 rounded-lg"></div>)}
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full mt-2"></div>
          </div>
          {/* Stars */}
          <div className="border-t border-slate-100 pt-5">
            <div className="h-2 w-16 bg-slate-200 rounded mb-3"></div>
            <div className="space-y-2.5">
              {[1,2,3,4,5].map(i => <div key={i} className="flex items-center gap-3"><div className="w-4 h-4 bg-slate-100 rounded"></div><div className="flex gap-0.5">{[1,2,3,4,5].map(j => <div key={j} className="w-2.5 h-2.5 bg-slate-100 rounded-full"></div>)}</div><div className="h-2.5 w-10 bg-slate-100 rounded"></div></div>)}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── No Results with Alternatives ───────────────────────────────────────────
function NoResultsWithAlternatives({ searchParams, onSearch, onRetry }: { searchParams: SearchParamsState | null; onSearch: (p: SearchParamsState) => void; onRetry?: () => void }) {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const isEN = language === 'EN';

  const quickHotel = (destId: string) => {
    const today = formatLocalDate(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = formatLocalDate(tomorrowDate);
    onSearch({
      destination_id: destId,
      q: POPULAR_HOTEL_DESTINATIONS.find(d => d.destination_id === destId)?.nameEN || destId,
      checkin_date: today,
      checkout_date: tomorrow,
      adult: searchParams?.adult || 2,
      room: searchParams?.room || 1,
      child: 0,
      child_ages: [],
      nationality: searchParams?.nationality || 'ID',
      property_type: searchParams?.property_type ?? 'all',
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      {/* No results header */}
      <div className="px-6 py-10 text-center">
        <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-bed text-3xl text-orange-300"></i>
        </div>
        <h3 className="font-black text-brand-ink text-lg mb-1.5">{t.noResultTitle}</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">{t.noResultDesc}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm hover:bg-orange-700 transition-colors">
            <i className="fa-solid fa-rotate-right"></i> {t.tryAgain}
          </button>
        )}
      </div>

      {/* Alternative destinations */}
      <div className="border-t border-slate-100 bg-slate-50 px-6 py-6">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t.alternativeTitle}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {POPULAR_HOTEL_DESTINATIONS.filter(d => d.destination_id !== searchParams?.destination_id).map(d => (
            <button key={d.destination_id} onClick={() => quickHotel(d.destination_id)}
              className="group relative overflow-hidden rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-left">
              <div className="aspect-[16/10] relative">
                <img src={d.img} alt={isEN ? d.nameEN : d.name} onError={(e) => { e.currentTarget.src = '/images/background.jpg'; }} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? d.nameEN : d.name}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-orange-300 sm:text-xs">
                    {t.landing.startingFrom} Rp {d.price.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Compact search bar ───────────────────────────────────────────────────────
function CompactBar({ searchParams, onSearch, loading, open, onOpenChange }: { searchParams: SearchParamsState | null; onSearch: (p: SearchParamsState) => void; loading: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const tc = i18n.common[language];

  const POPULAR: Record<string, string> = {
    'SG7355': 'Singapura, SG', 'ID339': 'Jakarta, ID', 'ID8731': 'Bali, ID',
    'ID8732': 'Surabaya, ID', 'MY5411': 'Kuala Lumpur, MY', 'TH3299': 'Bangkok, TH',
    'ID8735': 'Yogyakarta, ID', 'ID8734': 'Bandung, ID',
  };

  const fmt = (d?: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—';
  const destLabel = searchParams?.q || (searchParams?.destination_id ? POPULAR[searchParams.destination_id] : undefined) || searchParams?.destination_id || '—';

  const nights = searchParams?.checkin_date && searchParams?.checkout_date
    ? Math.max(1, Math.round((new Date(searchParams.checkout_date).getTime() - new Date(searchParams.checkin_date).getTime()) / 86400000))
    : 1;

  if (!open) {
    return (
      <div className="flex cursor-pointer flex-col items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card transition-shadow hover:shadow-md sm:flex-row sm:items-center" onClick={() => onOpenChange(true)}>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-bed text-orange-600"></i>
          </div>
          <div>
            <p className="font-black text-brand-ink text-sm">{destLabel}</p>
            <p className="text-xs text-slate-500">
              {fmt(searchParams?.checkin_date)} → {fmt(searchParams?.checkout_date)} · {nights} {tc.night} · {searchParams?.adult || 2} tamu · {searchParams?.room || 1} {tc.room}
            </p>
          </div>
        </div>
        <button className="shrink-0 rounded-xl bg-orange-100 px-4 py-2 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-200">
          {t.changeSearch}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 relative z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-brand-ink">{t.changeSearch}</h3>
        <button onClick={() => onOpenChange(false)} className="text-slate-400 transition-colors hover:text-brand-ink">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <HotelSearchForm onSearch={(p) => { onSearch(p); onOpenChange(false); }} loading={loading} initialData={searchParams ?? undefined} variant="light" />
    </div>
  );
}

// ─── Sidebar filter ───────────────────────────────────────────────────────────
type SearchParamsState = {
  destination_id?: string;
  q?: string;
  checkin_date?: string;
  checkout_date?: string;
  adult?: number;
  child?: number;
  child_ages?: number[];
  room?: number;
  nationality?: string;
  property_type?: HotelPropertyType;
};

function FilterSection({ title, activeCount = 0, initiallyOpen = true, children }: { title: string; activeCount?: number; initiallyOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="border-t border-slate-100">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
          {title}
          {activeCount > 0 && (
            <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">{activeCount}</span>
          )}
        </span>
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-[10px] text-slate-400`} aria-hidden="true" />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function SidebarFilter({
  priceRange,
  setPriceRange,
  starFilters,
  onStarChange,
  onReset,
  hasActive,
  sortBy,
  onSort,
  count,
}: {
  priceRange: { min: number; max: number };
  setPriceRange: (value: { min: number; max: number }) => void;
  starFilters: number[];
  onStarChange: (star: number) => void;
  onReset: () => void;
  hasActive: boolean;
  sortBy: 'price_asc' | 'price_desc' | 'rating';
  onSort: (value: 'price_asc' | 'price_desc' | 'rating') => void;
  count: number;
}) {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const tc = i18n.common[language];
  const sortGroupId = useId();
  const isEN = language === 'EN';
  const priceActive = priceRange.max < 10000000;
  const PRESETS = [
    { label: isEN ? '< 500K' : '< 500rb', max: 500000 },
    { label: isEN ? '< 1M' : '< 1jt', max: 1000000 },
    { label: isEN ? '< 2M' : '< 2jt', max: 2000000 },
    { label: isEN ? '< 5M' : '< 5jt', max: 5000000 },
    { label: t.allPrices, max: 10000000 },
  ];
  const sortOptions: Array<{ value: 'price_asc' | 'price_desc' | 'rating'; label: string }> = [
    { value: 'price_asc', label: t.sortOptions.priceAsc },
    { value: 'price_desc', label: t.sortOptions.priceDesc },
    { value: 'rating', label: t.sortOptions.rating },
  ];

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-32 lg:w-72 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-black text-brand-ink">
              <i className="fa-solid fa-sliders text-xs text-sky-600" aria-hidden="true" />
              {tc.filter}
            </h3>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{count} {t.hotelsFound}</p>
          </div>
          {hasActive && (
            <button onClick={onReset} className="flex shrink-0 items-center gap-1 text-xs font-bold text-sky-700 transition-colors hover:text-sky-900">
              <i className="fa-solid fa-rotate-right text-[10px]" aria-hidden="true" /> {t.resetFilter}
            </button>
          )}
        </div>

        <FilterSection title={t.pricePerNight} activeCount={priceActive ? 1 : 0}>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.max}
                type="button"
                onClick={() => setPriceRange({ min: 0, max: p.max })}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-all ${
                  priceRange.max === p.max
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-sky-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="range" min="0" max="10000000" step="500000"
            value={priceRange.max}
            onChange={e => setPriceRange({ min: 0, max: parseInt(e.target.value) })}
            className="mt-4 w-full accent-sky-600"
            aria-label={t.pricePerNight}
          />
          <div className="mt-2 flex justify-between">
            <span className="text-xs font-semibold text-slate-400">IDR 0</span>
            <span className="text-xs font-bold text-sky-700">
              {priceRange.max >= 10000000
                ? (isEN ? 'IDR 10M+' : 'IDR 10jt+')
                : `IDR ${(priceRange.max / 1000000).toFixed(1).replace('.0', '')}${isEN ? 'M' : 'jt'}`}
            </span>
          </div>
        </FilterSection>

        <FilterSection title={t.filterStars} activeCount={starFilters.length}>
          <div className="flex flex-col gap-1">
            {[5, 4, 3, 2, 1].map(star => (
              <label key={star} className="flex cursor-pointer items-center gap-3 rounded-lg py-1.5">
                <input
                  type="checkbox"
                  checked={starFilters.includes(star)}
                  onChange={() => onStarChange(star)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="flex items-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <i key={i} className={`fa-solid fa-star text-[10px] ${i < star ? 'text-amber-400' : 'text-slate-200'}`} />
                  ))}
                </span>
                <span className="text-xs font-semibold text-slate-500">{star} {t.stars}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title={t.sortTitle} initiallyOpen={false}>
          <div className="flex flex-col gap-1">
            {sortOptions.map(option => (
              <label key={option.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5">
                <input
                  type="radio"
                  name={`hotel-sort-${sortGroupId}`}
                  checked={sortBy === option.value}
                  onChange={() => onSort(option.value)}
                  className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs font-semibold text-slate-600">{option.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      </div>
    </aside>
  );
}

type HotelPrice = { price?: number; prices?: { price_total?: number }; meal_type?: unknown };

function getLowestPrice(prices?: Record<string, HotelPrice>): number {
  if (!prices) return 0;
  const values = Object.values(prices).map((item) => Number(item?.price ?? item?.prices?.price_total));
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) return 0;
  return Math.min(...valid);
}

// ─── Main page wrapper ────────────────────────────────────────────────────────
export default function HotelSearchPage() {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-bgLight flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 text-sm font-medium">{t.loadingPage}</span>
        </div>
      </div>
    }>
      <HotelSearchContent />
    </Suspense>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────
function HotelSearchContent() {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const tc = i18n.common[language];
  const isEN = language === 'EN';
  const searchParamsHook = useSearchParams();
  const router = useRouter();

  usePageTitle(
    searchParamsHook.get('q')
      ? `Pencarian Hotel: ${searchParamsHook.get('q')}`
      : 'Pencarian Hotel'
  );

  const [results, setResults] = useState<{
    hotel_ids: Array<Record<string, unknown>>;
    city_ids?: unknown[];
    country_ids?: unknown[];
    landmark_ids?: unknown[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<'hotel-provider-unavailable' | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParamsState | null>(null);
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'rating'>('price_asc');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000000 });
  const [starFilters, setStarFilters] = useState<number[]>([]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);

  // Default tanggal dihitung sekali saat mount (stabil & idempotent)
  const [todayISO] = useState(() => formatLocalDate(new Date()));
  const [tomorrowISO] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return formatLocalDate(date);
  });

  // Guard supaya auto-search dari URL params hanya benar-benar dieksekusi
  // SEKALI, walau effect di-invoke berkali-kali (mis. React StrictMode di dev).
  const autoSearchDone = useRef(false);

  const doSearch = async (params: SearchParamsState) => {
    if (!params.destination_id || !params.checkin_date || !params.checkout_date) {
      setErrorKind(null);
      setError('Silakan pilih destinasi dan tanggal stay terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError('');
    setErrorKind(null);
    setResults(null);
    try {
      const res = await fetch('/api/hotel/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkin_date: params.checkin_date,
          checkout_date: params.checkout_date,
          destination_id: params.destination_id,
          adult: params.adult,
          child: params.child,
          child_ages: params.child_ages,
          room: params.room,
          nationality: params.nationality,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.code === 'HOTEL_PROVIDER_UNAVAILABLE') setErrorKind('hotel-provider-unavailable');
        throw new Error(data.error || 'Gagal mencari hotel');
      }
      if (!data.data || !Array.isArray(data.data.hotel_ids)) {
        throw new Error('Respons pencarian hotel tidak sesuai format API.');
      }
      setResults(data.data);
    } catch (error) {
      const msg = error instanceof TypeError
        ? 'Koneksi internet terputus. Periksa sinyalmu lalu coba lagi.'
        : error instanceof Error ? error.message : 'Gagal mencari hotel';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Auto-search from URL params on mount ──
  useEffect(() => {
    if (autoSearchDone.current) return;
    autoSearchDone.current = true;

    const destId = searchParamsHook.get('destination_id');
    if (!destId) return;

    const params = {
      destination_id: destId,
      q: searchParamsHook.get('q') || '',
      checkin_date: searchParamsHook.get('checkin_date') || '',
      checkout_date: searchParamsHook.get('checkout_date') || '',
      adult: parseInt(searchParamsHook.get('adult') || '2'),
      child: parseInt(searchParamsHook.get('child') || '0'),
      child_ages: (() => {
        try { return JSON.parse(searchParamsHook.get('child_ages') || '[]'); } catch { return []; }
      })(),
      room: parseInt(searchParamsHook.get('room') || '1'),
      nationality: searchParamsHook.get('nationality') || 'ID',
      property_type: parseHotelPropertyType(searchParamsHook.get('property_type')),
    };

    // Sinkronisasi sekali dari URL saat mount; guard autoSearchDone mencegah duplikasi.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchParams(params);
    doSearch(params);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (params: SearchParamsState) => {
    setSearchParams(params);
    setCompactOpen(false);
    const urlParams = new URLSearchParams();
    if (params.destination_id) urlParams.set('destination_id', params.destination_id);
    urlParams.set('q', params.q || '');
    if (params.checkin_date) urlParams.set('checkin_date', params.checkin_date);
    if (params.checkout_date) urlParams.set('checkout_date', params.checkout_date);
    urlParams.set('adult', String(params.adult ?? 2));
    urlParams.set('child', String(params.child ?? 0));
    urlParams.set('room', String(params.room ?? 1));
    urlParams.set('nationality', params.nationality || 'ID');
    urlParams.set('property_type', params.property_type || 'all');
    if (params.child_ages?.length) urlParams.set('child_ages', JSON.stringify(params.child_ages));
    router.replace(`/hotel/search?${urlParams.toString()}`, { scroll: false });
    doSearch(params);
  };

  const quickHotel = (destination_id: string) => {
    handleSearch({ destination_id, q: '', checkin_date: todayISO, checkout_date: tomorrowISO, adult: 2, child: 0, child_ages: [], room: 1, nationality: 'ID' });
  };

  const filteredAndSortedHotels = useMemo(() => {
    const hotels = (results?.hotel_ids || []) as Array<Record<string, unknown>>;
    const filtered = hotels.filter((hotel) => {
      if (!matchesHotelPropertyType(hotel, searchParams?.property_type ?? 'all')) return false;
      const prices = (hotel.prices as Record<string, HotelPrice> | undefined) ?? undefined;
      const p = getLowestPrice(prices);
      const ratingValue = Number((hotel.rating as string | number | undefined) ?? 0);
      const priceOk = p >= priceRange.min && (priceRange.max >= 10000000 ? true : p <= priceRange.max);
      const starOk = starFilters.length === 0 || starFilters.includes(Math.round(ratingValue));
      return priceOk && starOk;
    });

    return [...filtered].sort((a, b) => {
      const priceA = getLowestPrice((a.prices as Record<string, HotelPrice> | undefined) ?? undefined);
      const priceB = getLowestPrice((b.prices as Record<string, HotelPrice> | undefined) ?? undefined);
      const ratingA = Number((a.rating as string | number | undefined) ?? 0);
      const ratingB = Number((b.rating as string | number | undefined) ?? 0);

      if (sortBy === 'price_asc') return priceA - priceB;
      if (sortBy === 'price_desc') return priceB - priceA;
      if (sortBy === 'rating') return ratingB - ratingA;
      return 0;
    });
  }, [results, searchParams?.property_type, priceRange, starFilters, sortBy]);

  // ── Hotel termurah (badge Best Price) ──
  const cheapestHotelId = useMemo(() => {
    let bestId: string | number | null = null;
    let bestPrice = Infinity;
    filteredAndSortedHotels.forEach(hotel => {
      const p = getLowestPrice(hotel.prices as Record<string, HotelPrice> | undefined);
      if (p > 0 && p < bestPrice) {
        bestPrice = p;
        bestId = hotel.id as string | number;
      }
    });
    return bestId;
  }, [filteredAndSortedHotels]);

  const nights = searchParams?.checkout_date && searchParams?.checkin_date
    ? Math.max(1, Math.round(
        (new Date(searchParams.checkout_date).getTime() - new Date(searchParams.checkin_date).getTime()) / 86400000
      ))
    : 1;

  const hasActiveFilters = starFilters.length > 0 || priceRange.max < 10000000;
  const resetFilters = () => {
    setPriceRange({ min: 0, max: 10000000 });
    setStarFilters([]);
  };
  const showInitialForm = !searchParams;
  const hasResults = results && results.hotel_ids && results.hotel_ids.length > 0;
  const noResultsAfterSearch = !loading && results && !hasResults;

  return (
    <div className="min-h-screen bg-brand-bgLight pt-20">

      {/* ── HERO HEADER (landing) ── */}
      {showInitialForm && (
      <>
      <section className="relative z-20 overflow-visible pt-4 md:pt-8 pb-2">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
              {t.landing.title}
            </h1>
            <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium">{t.landing.subtitle}</p>
          </div>

          <div className="bg-white rounded-2xl md:rounded-3xl shadow-floating border border-slate-100/80 p-4 sm:p-6 transition-all">
            <HotelSearchForm onSearch={handleSearch} loading={loading} variant="light" />
          </div>
        </div>
      </section>

      {/* Destinasi populer */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <div className="mb-5">
          <h2 className="text-lg sm:text-xl font-black text-brand-ink">{t.landing.popularTitle}</h2>
          <p className="text-brand-neutral text-xs sm:text-sm mt-1">{t.landing.popularSub}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-6">
          {POPULAR_HOTEL_DESTINATIONS.map(d => (
            <button key={d.destination_id} onClick={() => quickHotel(d.destination_id)}
              className="group relative overflow-hidden rounded-2xl text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="relative aspect-[4/3]">
                <img src={d.img} alt={isEN ? d.nameEN : d.name} onError={(e) => { e.currentTarget.src = '/images/background.jpg'; }} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
                  <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? d.nameEN : d.name}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-orange-300 sm:text-xs">
                    {t.landing.startingFrom} Rp {d.price.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      </>
      )}

      {!showInitialForm && (
      <>
      {/* ─── Sticky Compact Search Bar ─────────────────────────────────────── */}
      <div data-compact-search className="sticky top-0 z-[900] bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3">
          <CompactBar searchParams={searchParams} onSearch={handleSearch} loading={loading} open={compactOpen} onOpenChange={setCompactOpen} />
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-5 px-4 pb-10 pt-5 md:px-8 lg:flex-row">

        {/* Mobile filter toggle */}
        {loading && (
          <div className="w-full lg:hidden">
            <div className="flex animate-pulse items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="h-4 w-4 rounded bg-slate-200" />
              <div className="h-3 w-16 rounded bg-slate-200" />
            </div>
          </div>
        )}
        {!loading && !noResultsAfterSearch && results && (
          <div className="w-full lg:hidden">
            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-sliders text-xs text-sky-600"></i>
                {tc.filter}
                {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-sky-500"></span>}
              </span>
              <i className={`fa-solid fa-chevron-${mobileFilterOpen ? 'up' : 'down'} text-xs text-slate-400`}></i>
            </button>
            {mobileFilterOpen && (
              <div className="mt-3">
                <SidebarFilter
                  priceRange={priceRange}
                  setPriceRange={setPriceRange}
                  starFilters={starFilters}
                  onStarChange={(s: number) => setStarFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                  onReset={resetFilters}
                  hasActive={hasActiveFilters}
                  sortBy={sortBy}
                  onSort={setSortBy}
                  count={filteredAndSortedHotels.length}
                />
              </div>
            )}
          </div>
        )}

        {/* Desktop Sidebar */}
        {loading && <FilterSkeleton />}
        {!loading && !noResultsAfterSearch && results && (
          <div className="hidden lg:block">
            <SidebarFilter
              priceRange={priceRange}
              setPriceRange={setPriceRange}
              starFilters={starFilters}
              onStarChange={(s: number) => setStarFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
              onReset={resetFilters}
              hasActive={hasActiveFilters}
              sortBy={sortBy}
              onSort={setSortBy}
              count={filteredAndSortedHotels.length}
            />
          </div>
        )}

        {/* Results */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Summary */}
          {!loading && results && !noResultsAfterSearch && filteredAndSortedHotels.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brand-neutral">
                <span className="font-black text-brand-ink">{filteredAndSortedHotels.length}</span> {t.hotelsFound}
                {hasActiveFilters && (
                  <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">{tc.filter}</span>
                )}
              </p>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="shrink-0 text-xs font-bold text-sky-700 transition-colors hover:text-sky-900">
                  {t.resetFilter}
                </button>
              )}
            </div>
          )}
          {loading && (
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600"></span>
              {t.searching}
            </p>
          )}

          {/* Error */}
          {error && (
            <div role="alert" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
              <div className="flex items-start gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${errorKind === 'hotel-provider-unavailable' ? 'bg-amber-50' : 'bg-rose-50'}`}>
                  <i className={`fa-solid ${errorKind === 'hotel-provider-unavailable' ? 'fa-cloud-arrow-down text-amber-500' : 'fa-circle-exclamation text-rose-500'}`} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-black text-slate-900 sm:text-lg">
                    {errorKind === 'hotel-provider-unavailable' ? t.outageTitle : t.errorTitle}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {errorKind === 'hotel-provider-unavailable' ? t.outageDesc : error}
                  </p>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    {searchParams && (
                      <button
                        type="button"
                        onClick={() => doSearch(searchParams)}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <i className="fa-solid fa-rotate-right text-xs" aria-hidden="true" />
                        {t.tryAgain}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setCompactOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      {t.changeSearch}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Hotel cards */}
          {!loading && filteredAndSortedHotels.length > 0 && (
            <div className="flex flex-col gap-4">
              {filteredAndSortedHotels.map((hotel: Record<string, unknown>, i: number) => (
                <HotelCard key={String((hotel.id as string | number | undefined) ?? i)} hotel={hotel} nights={nights} searchParams={searchParams} isCheapest={hotel.id === cheapestHotelId} />
              ))}
            </div>
          )}

          {/* No results after search - show alternatives */}
          {noResultsAfterSearch && (
            <NoResultsWithAlternatives searchParams={searchParams} onSearch={handleSearch} />
          )}

          {/* Empty state after filter (but results exist overall) */}
          {!loading && results && !noResultsAfterSearch && filteredAndSortedHotels.length === 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-card sm:p-16">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
                <i className="fa-solid fa-filter-circle-xmark text-3xl text-orange-200"></i>
              </div>
              <h3 className="mb-1.5 text-lg font-black text-brand-ink">{t.noResult}</h3>
              <p className="mb-5 text-sm text-slate-400">{t.noResultSub}</p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700"
                >
                  {t.removeAllFilters}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      <style jsx global>{`
        /* Saat halaman hasil pencarian hotel: navbar ikut terscroll,
           hanya "Ubah Pencarian" yang sticky di atas. */
        body:has([data-compact-search]) header.fixed {
          position: absolute;
        }
      `}</style>
    </div>
  );
}