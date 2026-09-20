'use client';

import { useState, useMemo, Suspense, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TrainSearchForm from '@/components/train/TrainSearchForm';
import TrainCard from '@/components/train/TrainCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtIDR(n: number) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
function fmtTime(dt: string) {
  if (!dt) return '--:--';
  return dt.split(' ')[1]?.substring(0, 5) || dt.substring(11, 16);
}
function fmtDate(dt: string) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const CABIN_LABELS: Record<string, string> = {
  E: 'Eksekutif', B: 'Bisnis', K: 'Ekonomi', P: 'Prioritas',
};

const POPULAR_TRAIN_ROUTES = [
  { origin: 'GMR', destination: 'BD',  name: 'Jakarta – Bandung',    nameEN: 'Jakarta – Bandung',    price: 75000,  img: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&q=80' },
  { origin: 'GMR', destination: 'YK',  name: 'Jakarta – Yogyakarta', nameEN: 'Jakarta – Yogyakarta', price: 200000, img: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=600&q=80' },
  { origin: 'GMR', destination: 'SGU', name: 'Jakarta – Surabaya',   nameEN: 'Jakarta – Surabaya',   price: 180000, img: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=600&q=80' },
  { origin: 'BD',  destination: 'YK',  name: 'Bandung – Yogyakarta', nameEN: 'Bandung – Yogyakarta', price: 120000, img: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=600&q=80' },
  { origin: 'GMR', destination: 'SMC', name: 'Jakarta – Semarang',   nameEN: 'Jakarta – Semarang',   price: 150000, img: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&q=80' },
  { origin: 'YK',  destination: 'SGU', name: 'Yogyakarta – Surabaya', nameEN: 'Yogyakarta – Surabaya', price: 95000,  img: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=600&q=80' },
];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── No Results with Alternatives ───────────────────────────────────────────
function NoResultsWithAlternatives({ searchMeta, onSearch, onRetry }: { searchMeta: any; onSearch: (p: any) => void; onRetry?: () => void }) {
  const { language } = useLanguage();
  const t = i18n.trainSearch[language];
  const isEN = language === 'EN';

  const quickTrain = (route: typeof POPULAR_TRAIN_ROUTES[0]) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = formatLocalDate(tomorrow);
    onSearch({
      journey_list: [{ origin: route.origin, destination: route.destination, depart: dateStr }],
      adult: searchMeta?.adult || 1,
      child: searchMeta?.child || 0,
      direction: 'OW',
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      {/* No results header */}
      <div className="px-6 py-10 text-center">
        <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-train text-3xl text-orange-300"></i>
        </div>
        <h3 className="font-black text-brand-ink text-lg mb-1.5">{t.noResultTitle}</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">{t.noResultDesc}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm hover:bg-orange-700 transition-colors">
            <i className="fa-solid fa-rotate-right"></i> Coba Lagi
          </button>
        )}
      </div>

      {/* Alternative routes */}
      <div className="border-t border-slate-100 bg-slate-50 px-6 py-6">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t.alternativeTitle}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {POPULAR_TRAIN_ROUTES.filter(d => !(d.origin === searchMeta?.journey_list?.[0]?.origin && d.destination === searchMeta?.journey_list?.[0]?.destination)).map(d => (
            <button key={`${d.origin}-${d.destination}`} onClick={() => quickTrain(d)}
              className="group relative overflow-hidden rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-left">
              <div className="aspect-[16/10] relative">
                <img src={d.img} alt={isEN ? d.nameEN : d.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? d.nameEN : d.name}</p>
                  <p className="text-orange-300 text-[10px] sm:text-xs font-semibold mt-0.5">
                    Mulai dari Rp {(d.price / 1000).toLocaleString('id-ID')}K
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

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col md:flex-row gap-4 animate-pulse">
          <div className="flex items-center gap-3 md:w-48">
            <div className="w-12 h-12 bg-orange-100 rounded-xl"></div>
            <div className="space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded"></div>
              <div className="h-2 w-16 bg-slate-200 rounded"></div>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-between">
            <div className="h-8 w-16 bg-slate-200 rounded"></div>
            <div className="flex-1 mx-4 h-px bg-slate-200"></div>
            <div className="h-8 w-16 bg-slate-200 rounded"></div>
          </div>
          <div className="md:w-52 space-y-2">
            <div className="h-4 w-20 bg-slate-200 rounded ml-auto"></div>
            <div className="h-7 w-28 bg-orange-200 rounded ml-auto"></div>
            <div className="h-9 w-full bg-slate-200 rounded-xl mt-2"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Filter Skeleton ────────────────────────────────────────────────────────
function FilterSkeleton() {
  return (
    <div className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 lg:self-start">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-200 rounded"></div>
          <div className="h-3 w-12 bg-slate-200 rounded"></div>
        </div>
        <div className="p-4 space-y-5">
          {/* Departure time */}
          <div>
            <div className="h-2 w-24 bg-slate-200 rounded mb-3"></div>
            <div className="grid grid-cols-3 gap-1.5">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl"></div>)}
            </div>
          </div>
          <div className="h-px bg-slate-100"></div>
          {/* Cabin class */}
          <div>
            <div className="h-2 w-20 bg-slate-200 rounded mb-3"></div>
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="flex items-center gap-3"><div className="w-4 h-4 bg-slate-100 rounded"></div><div className="h-2.5 w-16 bg-slate-100 rounded"></div></div>)}
            </div>
          </div>
          <div className="h-px bg-slate-100"></div>
          {/* Sort */}
          <div>
            <div className="h-2 w-16 bg-slate-200 rounded mb-3"></div>
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="flex items-center gap-3"><div className="w-4 h-4 bg-slate-100 rounded"></div><div className="h-2.5 w-20 bg-slate-100 rounded"></div></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compact Search Bar ───────────────────────────────────────────────────────
function CompactSearchBar({ searchMeta, onSearch, loading }: { searchMeta: any; onSearch: (p: any) => void; loading: boolean }) {
  const { language } = useLanguage();
  const tc = i18n.common[language];
  const [collapsed, setCollapsed] = useState(true);
  
  if (collapsed) {
    const dirLabel = searchMeta?.direction === 'RT' ? 'Pulang Pergi' : 'Sekali Jalan';
    const origin = searchMeta?.journey_list?.[0]?.origin || searchMeta?.origin;
    const dest = searchMeta?.journey_list?.[0]?.destination || searchMeta?.destination;
    const date = searchMeta?.journey_list?.[0]?.departure_date || searchMeta?.depart;
    
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 cursor-pointer" onClick={() => setCollapsed(false)}>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-train text-orange-600"></i>
          </div>
          <div>
            <p className="font-black text-brand-ink text-sm">{origin} → {dest}</p>
            <p className="text-xs text-slate-500">
              {date} · {dirLabel} · {searchMeta?.adult || 1} {tc.adult}
            </p>
          </div>
        </div>
        <button className="px-4 py-2 bg-orange-100 text-orange-700 font-bold text-xs rounded-xl hover:bg-orange-200 transition-colors shrink-0">
          Ubah Pencarian
        </button>
      </div>
    );
  }

  // Passing format data yang sesuai ke initialData form kereta
  const formInitial = {
    direction: searchMeta?.direction || 'OW',
    adult: searchMeta?.adult || '1',
    infant: searchMeta?.infant || '0',
    origin: searchMeta?.journey_list?.[0]?.origin || searchMeta?.origin || 'GMR',
    destination: searchMeta?.journey_list?.[0]?.destination || searchMeta?.destination || 'BD',
    departure_date: searchMeta?.journey_list?.[0]?.departure_date || searchMeta?.depart,
    return_date: searchMeta?.journey_list?.[1]?.departure_date || searchMeta?.return_date,
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 relative z-50 transition-all">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-brand-ink text-sm">Ubah Pencarian</h3>
        <button onClick={() => setCollapsed(true)} className="text-slate-400 hover:text-brand-ink transition-colors">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>
      <TrainSearchForm onSearch={(p) => { onSearch(p); setCollapsed(true); }} loading={loading} initialData={formInitial} variant="light" />
    </div>
  );
}

// ─── Landing (default, belum mencari) ────────────────────────────────────────
function TrainLanding({ onSearch, loading }: { onSearch: (p: any) => void; loading: boolean }) {
  const { language } = useLanguage();
  const t = i18n.trainSearch[language];
  const isEN = language === 'EN';

  const quickSearch = (route: { origin: string; destination: string }) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    onSearch({ origin: route.origin, destination: route.destination, depart: d.toISOString().split('T')[0], adult: 1, infant: 0, direction: 'OW' });
  };

  return (
    <>
      <section className="relative z-10 overflow-hidden pt-4 md:pt-8 pb-2">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
              {t.landing.title}
            </h1>
            <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium">{t.landing.subtitle}</p>
          </div>

          <div className="bg-white rounded-2xl md:rounded-3xl shadow-floating border border-slate-100/80 p-4 sm:p-6 transition-all">
            <TrainSearchForm onSearch={onSearch} loading={loading} variant="light" />
          </div>
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <div className="mb-5">
          <h2 className="text-lg sm:text-xl font-black text-brand-ink">{t.landing.popularTitle}</h2>
          <p className="text-brand-neutral text-xs sm:text-sm mt-1">{t.landing.popularSub}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {POPULAR_TRAIN_ROUTES.map(r => (
            <button key={`${r.origin}-${r.destination}`} onClick={() => quickSearch(r)}
              className="group relative overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-left">
              <div className="aspect-[4/3] relative">
                <img src={r.img} alt={isEN ? r.nameEN : r.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
                  <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? r.nameEN : r.name}</p>
                  <p className="text-orange-300 text-[10px] sm:text-xs font-semibold mt-0.5">{t.landing.startingFrom} {fmtIDR(r.price)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function TrainSearchContent() {
  const { language } = useLanguage();
  const t = i18n.trainSearch[language];
  const tc = i18n.common[language];

  const searchParamsHook = useSearchParams();
  const router = useRouter();

  usePageTitle(
    searchParamsHook.get('origin') && searchParamsHook.get('destination')
      ? `Pencarian Kereta: ${searchParamsHook.get('origin')} → ${searchParamsHook.get('destination')}`
      : 'Pencarian Kereta'
  );

  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  // Ambil state pencarian dari URL / Props saat awal render
  const [searchMeta, setSearchMeta] = useState<any>({
    origin: searchParamsHook.get('origin') || 'GMR',
    destination: searchParamsHook.get('destination') || 'BD',
    depart: searchParamsHook.get('depart') || searchParamsHook.get('departure_date') || '',
    return_date: searchParamsHook.get('return_date') || '',
    adult: searchParamsHook.get('adult') || '1',
    infant: searchParamsHook.get('infant') || '0',
    direction: searchParamsHook.get('direction') || 'OW',
    provider: searchParamsHook.get('provider') || 'kai',
  });

  // Default "hari ini" dihitung sekali saat mount (stabil & idempotent)
  const [todayDefault] = useState(() => formatLocalDate(new Date()));

  // ── Filter & Sort States ──
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'earliest' | 'latest'>('price_asc');
  const [filterCabin, setFilterCabin] = useState<string[]>([]);
  const [filterDepartureTime, setFilterDepartureTime] = useState<string[]>([]);

  const handleSearch = async (formPayload: any) => {
    setLoading(true);
    setError('');
    setResults(null);
    setHasSearched(true);
    setFilterCabin([]);
    setFilterDepartureTime([]);
    
    // Normalisasi payload ke format KAI API
    let apiPayload: any = { provider: 'kai' };
    
    if (formPayload.journey_list) {
      apiPayload = formPayload;
    } else {
      apiPayload.direction = formPayload.direction || 'OW';
      apiPayload.adult = parseInt(formPayload.adult || '1');
      apiPayload.infant = parseInt(formPayload.infant || '0');
      apiPayload.journey_list = [
        { origin: formPayload.origin, destination: formPayload.destination, departure_date: formPayload.depart }
      ];
      if (formPayload.direction === 'RT' && formPayload.return_date) {
        apiPayload.journey_list.push({ origin: formPayload.destination, destination: formPayload.origin, departure_date: formPayload.return_date });
      }
    }
    
    setSearchMeta(apiPayload);

    try {
      const res = await fetch('/api/train/search', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mencari jadwal kereta. Pastikan rute & tanggal benar.');
      setResults(data.data);
    } catch (e: any) {
      setError(e instanceof TypeError
        ? 'Koneksi internet terputus. Periksa sinyalmu lalu coba lagi.'
        : e.message);
    }
    setLoading(false);
  };

  // Auto Search via URL Parameters
  useEffect(() => {
    const origin = searchParamsHook.get('origin');
    const destination = searchParamsHook.get('destination');
    const depart = searchParamsHook.get('depart') || searchParamsHook.get('departure_date');
    if (origin && destination && depart) {
      handleSearch({
        origin, destination, depart,
        return_date: searchParamsHook.get('return_date'),
        adult: searchParamsHook.get('adult'),
        infant: searchParamsHook.get('infant'),
        direction: searchParamsHook.get('direction') || 'OW'
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback((journey: any, fare: any) => {
    const summary = fare?.service_charge_summary?.[0];
    const price = summary?.total_price || summary?.base_price || summary?.base_fare || 0;
    const q = new URLSearchParams({
      journey_code: journey.journey_code,
      fare_code: fare.fare_code,
      origin: journey.origin,
      destination: journey.destination,
      departure_date: journey.departure_date,
      arrival_date: journey.arrival_date,
      train_name: journey.carrier_name,
      train_number: journey.carrier_number,
      elapsed_time: journey.elapsed_time,
      cabin_class: journey.cabin_class,
      class_of_service: journey.class_of_service || '',
      total_amount: String(Math.round(price)),
      adult: String(searchMeta.adult || '1'),
      infant: String(searchMeta.infant || '0'),
    }).toString();
    router.push(`/train/checkout?${q}`);
  }, [router, searchMeta]);

  // Extract Journeys (Flatten schedules array)
  const allJourneys = useMemo(() => {
    return results?.schedules?.flatMap((s: any) => s.journeys || []) || [];
  }, [results]);

  const hasResults = allJourneys.length > 0;
  const noResultsAfterSearch = !loading && hasSearched && !hasResults && !error;

  // Extract Kelas (Cabin Options) available in result
  const cabinOptions = useMemo(() => {
    return [...new Set(allJourneys.map((j: any) => j.cabin_class))].filter(Boolean) as string[];
  }, [allJourneys]);

  // Filter & Sort Logic
  const filteredJourneys = useMemo(() => {
    let list = [...allJourneys];

    // Filter Kelas
    if (filterCabin.length > 0) {
      list = list.filter((j: any) => filterCabin.includes(j.cabin_class));
    }

    // Filter Waktu Keberangkatan
    if (filterDepartureTime.length > 0) {
      list = list.filter((j: any) => {
        const dep = j.departure_date || '';
        const hour = parseInt(dep.substring(11, 13) || '0');
        if (filterDepartureTime.includes('morning')   && hour >= 0  && hour < 12) return true;
        if (filterDepartureTime.includes('afternoon') && hour >= 12 && hour < 17) return true;
        if (filterDepartureTime.includes('evening')   && hour >= 17)              return true;
        return false;
      });
    }

    // Sort
    list.sort((a: any, b: any) => {
      const pa = a.fares?.[0]?.service_charge_summary?.[0]?.base_price || 0;
      const pb = b.fares?.[0]?.service_charge_summary?.[0]?.base_price || 0;
      const ta = new Date(a.departure_date || 0).getTime();
      const tb = new Date(b.departure_date || 0).getTime();

      if (sortBy === 'price_asc')  return pa - pb;
      if (sortBy === 'price_desc') return pb - pa;
      if (sortBy === 'earliest')   return ta - tb;
      if (sortBy === 'latest')     return tb - ta;
      return 0;
    });

    return list;
  }, [allJourneys, filterCabin, filterDepartureTime, sortBy]);

  // ── Indeks jadwal termurah (badge highlight) ──
  const cheapestIdx = useMemo(() => {
    let bestIdx = -1;
    let bestPrice = Infinity;
    filteredJourneys.forEach((j, i) => {
      const summary = j.fares?.[0]?.service_charge_summary?.[0];
      const p = summary?.base_price || summary?.base_fare || 0;
      if (p > 0 && p < bestPrice) { bestPrice = p; bestIdx = i; }
    });
    return bestIdx;
  }, [filteredJourneys]);

  const toggleFilter = (arr: string[], val: string, setArr: (a: string[]) => void) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const isRT = searchMeta?.direction === 'RT';
  const outDate = searchMeta?.journey_list?.[0]?.departure_date || searchMeta?.depart;
  const inDate = searchMeta?.journey_list?.[1]?.departure_date || searchMeta?.return_date;

  return (
    <div className="bg-brand-bgLight min-h-screen pt-20">
      {!hasSearched ? (
        <TrainLanding onSearch={handleSearch} loading={loading} />
      ) : (
      <>
      {/* ─── Route Banner ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <i className="fa-solid fa-train text-orange-400 text-sm"></i>
            </div>
            <div>
              <div className="text-sm font-black">
                {searchMeta?.journey_list?.[0]?.origin || searchMeta.origin} → {searchMeta?.journey_list?.[0]?.destination || searchMeta.destination}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/60 mt-0.5">
                <span>{fmtDate(outDate)}</span>
                {isRT && inDate && (
                  <><span>→</span><span>{fmtDate(inDate)}</span></>
                )}
                <span>·</span>
                <span>{searchMeta.adult || 1} {tc.adult} · {isRT ? 'Pulang Pergi' : 'Sekali Jalan'}</span>
              </div>
            </div>
          </div>
          
          {/* Quick Date Navigator (Hanya aktif untuk Oneway agar mudah) */}
          {!isRT && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {[-2, -1, 0, 1, 2].map(offset => {
                const d = new Date(outDate || todayDefault);
                d.setDate(d.getDate() + offset);
                const dateStr = d.toISOString().split('T')[0];
                return (
                  <button key={offset} onClick={() => {
                    const params = {...searchMeta};
                    if(params.journey_list) params.journey_list[0].departure_date = dateStr;
                    else params.depart = dateStr;
                    handleSearch(params);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${offset === 0 ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                    {d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Sticky Compact Search Bar ─────────────────────────────────────── */}
      <div data-compact-search className="sticky top-0 z-[900] bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3">
          <CompactSearchBar searchMeta={searchMeta} onSearch={handleSearch} loading={loading} />
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-5 pb-10">

        {!loading && !noResultsAfterSearch && allJourneys.length > 0 && (
          <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-brand-ink">Jadwal kereta yang paling relevan</p>
              <p className="text-xs text-slate-500 mt-1">Bandingkan kelas, waktu berangkat, dan harga dalam satu tampilan yang lebih rapi.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">Kursi tersedia terpantau</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">Pilih tarif lebih cepat</span>
            </div>
          </div>
        )}

        {/* ─── Main Layout ─────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* SIDEBAR FILTER */}
          {loading && <FilterSkeleton />}
          {!loading && !error && !noResultsAfterSearch && allJourneys.length > 0 && (
          <div className="w-full lg:w-64 shrink-0 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden sticky top-24">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-sliders text-orange-500 text-sm"></i>
                  <h3 className="font-black text-brand-ink text-sm">{tc.filter}</h3>
                </div>
                <button
                  onClick={() => { setFilterCabin([]); setFilterDepartureTime([]); setSortBy('price_asc'); }}
                  className="text-orange-600 text-xs font-bold hover:underline"
                >Reset</button>
              </div>

              <div className="p-4 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto">
                {/* Waktu Berangkat */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">{t.departure}</h4>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'morning',   label: 'Pagi',  icon: 'fa-sun',       sub: '00-12' },
                      { id: 'afternoon', label: 'Siang', icon: 'fa-cloud-sun', sub: '12-17' },
                      { id: 'evening',   label: 'Malam', icon: 'fa-moon',      sub: '17-24' },
                    ].map(t => (
                      <button key={t.id}
                        onClick={() => toggleFilter(filterDepartureTime, t.id, setFilterDepartureTime)}
                        className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 text-xs font-bold transition-all ${filterDepartureTime.includes(t.id) ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <i className={`fa-solid ${t.icon} text-sm mb-1`}></i>
                        <span>{t.label}</span>
                        <span className="text-[9px] text-slate-400 font-normal">{t.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-slate-100"></div>

                {/* Kelas Kereta */}
                {cabinOptions.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">{t.class}</h4>
                    <div className="space-y-1.5">
                      {cabinOptions.map(cabin => (
                        <label key={cabin} className="flex items-center gap-2.5 cursor-pointer group">
                          <input type="checkbox" checked={filterCabin.includes(cabin)}
                            onChange={() => toggleFilter(filterCabin, cabin, setFilterCabin)}
                            className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500" />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium">
                            {CABIN_LABELS[cabin] || cabin}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="h-px bg-slate-100"></div>

                {/* Urutkan */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">{t.sortBy}</h4>
                  <div className="space-y-1.5">
                    {[
                      { id: 'price_asc',  label: t.sortOptions.price },
                      { id: 'earliest',   label: t.sortOptions.departure },
                      { id: 'latest',     label: 'Berangkat Paling Akhir' },
                    ].map(opt => (
                      <label key={opt.id} className="flex items-center gap-2.5 cursor-pointer group">
                        <input type="radio" name="sortBy" checked={sortBy === opt.id} onChange={() => setSortBy(opt.id as any)}
                          className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500" />
                        <span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
          )}

          {/* MAIN RESULTS */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header Summary */}
            {!loading && !noResultsAfterSearch && allJourneys.length > 0 && (
              <div className="flex items-center justify-between bg-white px-5 py-3 border border-slate-100 rounded-2xl shadow-card">
                <p className="text-sm font-semibold text-slate-600">
                  Menampilkan <span className="font-black text-brand-ink">{filteredJourneys.length}</span> jadwal kereta KAI
                </p>
                <div className="flex gap-2">
                  {[{ id: 'price_asc', label: t.sortOptions.price }, { id: 'earliest', label: t.sortOptions.departure }].map(s => (
                    <button key={s.id} onClick={() => setSortBy(s.id as any)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${sortBy === s.id ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && <SkeletonLoader />}

            {error && (
              <NoResultsWithAlternatives searchMeta={searchMeta} onSearch={handleSearch} onRetry={() => handleSearch(searchMeta)} />
            )}

            {!loading && filteredJourneys.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                {filteredJourneys.map((j: any, i: number) => (
                  <TrainCard key={i} journey={j} onSelect={handleSelect} adultCount={parseInt(searchMeta?.adult || '1')} isCheapest={cheapestIdx === i} />
                ))}
              </div>
            )}

            {!loading && allJourneys.length > 0 && filteredJourneys.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-card">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-train text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-black text-brand-ink mb-2">Tidak Ada Hasil Filter</h3>
                <p className="text-slate-500 text-sm">Coba ubah filter atau reset pilihan.</p>
                <button onClick={() => { setFilterCabin([]); setFilterDepartureTime([]); setSortBy('price_asc'); }}
                  className="mt-4 px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm hover:bg-orange-700 transition-all">
                  Reset Filter
                </button>
              </div>
            )}

            {noResultsAfterSearch && (
              <NoResultsWithAlternatives searchMeta={searchMeta} onSearch={handleSearch} />
            )}
          </div>
        </div>
      </div>
      </>
      )}

      <style jsx global>{`
        /* Saat halaman hasil pencarian kereta: navbar ikut terscroll,
           hanya "Ubah Pencarian" yang sticky di atas. */
        body:has([data-compact-search]) header.fixed {
          position: absolute;
        }
      `}</style>
    </div>
  );
}

export default function TrainSearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-brand-bgLight">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    }>
      <TrainSearchContent />
    </Suspense>
  );
}