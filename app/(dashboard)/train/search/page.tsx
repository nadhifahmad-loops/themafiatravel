'use client';

import { useState, useMemo, Suspense, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TrainSearchForm from '@/components/train/TrainSearchForm';
import TrainCard from '@/components/train/TrainCard';
import { CalendarField } from '@/components/common/CalendarField';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { i18n, tpl } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { toLocalISODate } from '@/lib/checkout-utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtIDR(n: number) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function getDateOnly(value: string | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

type TrainCoupon = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  minOrderAmount: number;
};

const CABIN_LABEL_KEYS: Record<string, 'cabinExecutive' | 'cabinBusiness' | 'cabinEconomy' | 'cabinPriority'> = {
  E: 'cabinExecutive', B: 'cabinBusiness', K: 'cabinEconomy', P: 'cabinPriority',
};

// Gambar per kota tujuan (disamakan dengan pola beranda: public/images/domestik/<kota>.png)
const POPULAR_TRAIN_ROUTES = [
  { origin: 'GMR', destination: 'BD',  name: 'Jakarta – Bandung',    nameEN: 'Jakarta – Bandung',    price: 75000,  img: '/images/domestik/bandung.png' },
  { origin: 'GMR', destination: 'YK',  name: 'Jakarta – Yogyakarta', nameEN: 'Jakarta – Yogyakarta', price: 200000, img: '/images/domestik/yogyakarta.png' },
  { origin: 'GMR', destination: 'SGU', name: 'Jakarta – Surabaya',   nameEN: 'Jakarta – Surabaya',   price: 180000, img: '/images/domestik/surabaya.png' },
  { origin: 'BD',  destination: 'YK',  name: 'Bandung – Yogyakarta', nameEN: 'Bandung – Yogyakarta', price: 120000, img: '/images/domestik/yogyakarta.png' },
  { origin: 'GMR', destination: 'SMC', name: 'Jakarta – Semarang',   nameEN: 'Jakarta – Semarang',   price: 150000, img: '/images/domestik/semarang.png' },
  { origin: 'YK',  destination: 'SGU', name: 'Yogyakarta – Surabaya', nameEN: 'Yogyakarta – Surabaya', price: 95000,  img: '/images/domestik/surabaya.png' },
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
  const tc = i18n.common[language];
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
            <i className="fa-solid fa-rotate-right"></i> {tc.retry}
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
                <img src={d.img} alt={isEN ? d.nameEN : d.name} onError={(e) => { e.currentTarget.src = '/images/train.jpg'; }} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? d.nameEN : d.name}</p>
                  <p className="text-orange-300 text-[10px] sm:text-xs font-semibold mt-0.5">
                    {t.startingFrom} Rp {(d.price / 1000).toLocaleString(isEN ? 'en-US' : 'id-ID')}K
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

// ─── Compact Search Bar ───────────────────────────────────────────────────────
function CompactSearchBar({ searchMeta, onSearch, loading }: { searchMeta: any; onSearch: (p: any) => void; loading: boolean }) {
  const { language } = useLanguage();
  const tc = i18n.common[language];
  const t = i18n.trainSearch[language];
  const tf = i18n.searchForm[language].train;
  const [collapsed, setCollapsed] = useState(true);
  
  if (collapsed) {
    const dirLabel = searchMeta?.direction === 'RT' ? tf.roundTrip : tf.oneWay;
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
          {t.changeSearch}
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
        <h3 className="font-black text-brand-ink text-sm">{t.changeSearch}</h3>
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
    onSearch({ origin: route.origin, destination: route.destination, depart: toLocalISODate(d), adult: 1, infant: 0, direction: 'OW' });
  };

  return (
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
                <img src={r.img} alt={isEN ? r.nameEN : r.name} onError={(e) => { e.currentTarget.src = '/images/train.jpg'; }} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
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
  const { toast } = useToast();
  const t = i18n.trainSearch[language];

  const searchParamsHook = useSearchParams();
  const router = useRouter();

  usePageTitle(
    searchParamsHook.get('origin') && searchParamsHook.get('destination')
      ? tpl(t.pageTitleWithRoute, {
          origin: searchParamsHook.get('origin')!,
          destination: searchParamsHook.get('destination')!,
        })
      : t.pageTitle
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
  const [filterCarriers, setFilterCarriers] = useState<string[]>([]);
  const [openToolbarMenu, setOpenToolbarMenu] = useState<'time' | 'class' | 'train' | 'sort' | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [trainCoupons, setTrainCoupons] = useState<TrainCoupon[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [copiedPromo, setCopiedPromo] = useState('');
  const [promoCopyError, setPromoCopyError] = useState('');

  useEffect(() => {
    if (!openToolbarMenu) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !toolbarRef.current?.contains(event.target)) {
        setOpenToolbarMenu(null);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [openToolbarMenu]);

  useEffect(() => {
    if (!promoOpen) return;
    let isCurrent = true;
    fetch('/api/coupons/active?category=train&limit=100')
      .then(async response => {
        if (!response.ok) throw new Error(`Coupon request failed (${response.status})`);
        return response.json();
      })
      .then(data => {
        if (isCurrent) setTrainCoupons(Array.isArray(data.coupons) ? data.coupons : []);
      })
      .catch(error => {
        console.error('[TRAIN PROMO] Failed to load active coupons:', error);
        if (isCurrent) setPromoError(t.promoLoadError);
      })
      .finally(() => {
        if (isCurrent) setPromoLoading(false);
      });
    return () => { isCurrent = false; };
  }, [promoOpen, t.promoLoadError]);

  useEffect(() => {
    if (!promoOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPromoOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [promoOpen]);

  const copyTrainCoupon = async (code: string) => {
    setPromoCopyError('');
    try {
      await navigator.clipboard.writeText(code);
      setCopiedPromo(code);
      toast(t.promoCopiedToast, { variant: 'success' });
      window.setTimeout(() => setCopiedPromo(current => current === code ? '' : current), 2000);
    } catch (error) {
      console.error('[TRAIN PROMO] Failed to copy coupon:', error);
      setPromoCopyError(t.promoCopyError);
      toast(t.promoCopyFailedToast, { variant: 'error' });
    }
  };
  const openTrainPromos = () => {
    setPromoError('');
    setPromoLoading(true);
    setPromoOpen(true);
  };

  const handleSearch = async (formPayload: any) => {
    setLoading(true);
    setError('');
    setResults(null);
    setHasSearched(true);
    setFilterCabin([]);
    setFilterDepartureTime([]);
    setFilterCarriers([]);
    
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
      if (!res.ok || !data.success) throw new Error(data.error || t.errorSearchFailed);
      setResults(data.data);
    } catch (e: any) {
      setError(e instanceof TypeError
        ? t.errorOffline
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
      total_amount: String(Math.round(price * Number(searchMeta.adult || 1))),
      base_amount: String(Math.round(price * Number(searchMeta.adult || 1))),
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
  const carrierOptions = useMemo(() => {
    return [...new Set(allJourneys.map((j: any) => j.carrier_name || j.carrier_code).filter(Boolean))] as string[];
  }, [allJourneys]);

  // Filter & Sort Logic
  const filteredJourneys = useMemo(() => {
    let list = [...allJourneys];

    // Filter Kelas
    if (filterCabin.length > 0) {
      list = list.filter((j: any) => filterCabin.includes(j.cabin_class));
    }

    if (filterCarriers.length > 0) {
      list = list.filter((j: any) => filterCarriers.includes(j.carrier_name || j.carrier_code));
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
  }, [allJourneys, filterCabin, filterCarriers, filterDepartureTime, sortBy]);

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
  const resetFilters = () => {
    setFilterCabin([]);
    setFilterDepartureTime([]);
    setFilterCarriers([]);
    setSortBy('price_asc');
  };

  const isRT = searchMeta?.direction === 'RT';
  const outDate = searchMeta?.journey_list?.[0]?.departure_date || searchMeta?.depart;
  const selectedDate = getDateOnly(outDate) || todayDefault;
  const changeDepartureDate = (dateStr: string) => {
    const params = {
      ...searchMeta,
      journey_list: searchMeta?.journey_list?.map((journey: any, index: number) =>
        index === 0 ? { ...journey, departure_date: dateStr } : journey
      ),
      depart: dateStr,
    };
    handleSearch(params);
  };

  return (
    <div className="bg-brand-bgLight min-h-screen pt-20">
      {!hasSearched ? (
        <TrainLanding onSearch={handleSearch} loading={loading} />
      ) : (
      <>
      {/* ─── Sticky Compact Search Bar ─────────────────────────────────────── */}
      <div data-compact-search className="sticky top-0 z-[900] bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3">
          <CompactSearchBar searchMeta={searchMeta} onSearch={handleSearch} loading={loading} />
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-5 pb-10">

        {!loading && !noResultsAfterSearch && allJourneys.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-600">
                {tpl(t.showingResults, { count: filteredJourneys.length, total: allJourneys.length })}
              </p>
              {(filterCabin.length + filterDepartureTime.length + filterCarriers.length > 0) && (
                <button type="button" onClick={resetFilters} className="text-xs font-semibold text-orange-600 hover:underline">
                  {t.resetFilter}
                </button>
              )}
            </div>

            <div ref={toolbarRef} className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-semibold text-slate-700">{t.filterTrain}</span>

                <div className="relative">
                  <button type="button" aria-expanded={openToolbarMenu === 'time'} onClick={() => setOpenToolbarMenu(current => current === 'time' ? null : 'time')} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm hover:border-sky-300">
                    {t.departure}{filterDepartureTime.length > 0 ? ` (${filterDepartureTime.length})` : ''}
                    <i className={`fa-solid fa-chevron-${openToolbarMenu === 'time' ? 'up' : 'down'} text-[9px] text-slate-400`} aria-hidden="true"></i>
                  </button>
                  {openToolbarMenu === 'time' && (
                    <div className="absolute left-0 top-full z-30 mt-2 w-56 rounded-xl border border-slate-100 bg-white p-3 shadow-xl">
                      {[
                        { id: 'morning', label: t.morningSlot, range: '00.00–11.59' },
                        { id: 'afternoon', label: t.afternoonSlot, range: '12.00–16.59' },
                        { id: 'evening', label: t.eveningSlot, range: '17.00–23.59' },
                      ].map(option => (
                        <label key={option.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                          <span className="text-slate-700">{option.label} <span className="text-xs text-slate-400">{option.range}</span></span>
                          <input type="checkbox" checked={filterDepartureTime.includes(option.id)} onChange={() => toggleFilter(filterDepartureTime, option.id, setFilterDepartureTime)} className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {cabinOptions.length > 0 && (
                  <div className="relative">
                    <button type="button" aria-expanded={openToolbarMenu === 'class'} onClick={() => setOpenToolbarMenu(current => current === 'class' ? null : 'class')} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm hover:border-sky-300">
                      {t.class}{filterCabin.length > 0 ? ` (${filterCabin.length})` : ''}
                      <i className={`fa-solid fa-chevron-${openToolbarMenu === 'class' ? 'up' : 'down'} text-[9px] text-slate-400`} aria-hidden="true"></i>
                    </button>
                    {openToolbarMenu === 'class' && (
                      <div className="absolute left-0 top-full z-30 mt-2 min-w-48 rounded-xl border border-slate-100 bg-white p-3 shadow-xl">
                        {cabinOptions.map(cabin => (
                          <label key={cabin} className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                            <span className="text-slate-700">{t[CABIN_LABEL_KEYS[cabin]] || cabin}</span>
                            <input type="checkbox" checked={filterCabin.includes(cabin)} onChange={() => toggleFilter(filterCabin, cabin, setFilterCabin)} className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {carrierOptions.length > 1 && (
                  <div className="relative">
                    <button type="button" aria-expanded={openToolbarMenu === 'train'} onClick={() => setOpenToolbarMenu(current => current === 'train' ? null : 'train')} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm hover:border-sky-300">
                      {t.trainFilter}{filterCarriers.length > 0 ? ` (${filterCarriers.length})` : ''}
                      <i className={`fa-solid fa-chevron-${openToolbarMenu === 'train' ? 'up' : 'down'} text-[9px] text-slate-400`} aria-hidden="true"></i>
                    </button>
                    {openToolbarMenu === 'train' && (
                      <div className="absolute left-0 top-full z-30 mt-2 min-w-52 rounded-xl border border-slate-100 bg-white p-3 shadow-xl">
                        {carrierOptions.map(carrier => (
                          <label key={carrier} className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                            <span className="text-slate-700">{carrier}</span>
                            <input type="checkbox" checked={filterCarriers.includes(carrier)} onChange={() => toggleFilter(filterCarriers, carrier, setFilterCarriers)} className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                {!isRT && (
                  <CalendarField value={parseLocalDate(selectedDate)} onChange={date => { if (date) changeDepartureDate(formatLocalDate(date)); }} defaultMonth={parseLocalDate(selectedDate)}>
                    <button type="button" disabled={loading} aria-label={t.calendar} className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <i className="fa-regular fa-calendar text-sky-600" aria-hidden="true"></i>
                      <span className="hidden sm:inline">{t.calendar}</span>
                    </button>
                  </CalendarField>
                )}

                <button type="button" onClick={() => { setPromoCopyError(''); openTrainPromos(); }} className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700">
                  <i className="fa-solid fa-ticket text-sky-600" aria-hidden="true"></i>
                  {t.promo}
                </button>

                <div className="relative">
                  <button type="button" aria-expanded={openToolbarMenu === 'sort'} onClick={() => setOpenToolbarMenu(current => current === 'sort' ? null : 'sort')} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-sky-700 shadow-sm hover:border-sky-300">
                    {t.sortButton}
                    <i className={`fa-solid fa-chevron-${openToolbarMenu === 'sort' ? 'up' : 'down'} text-[9px] text-slate-400`} aria-hidden="true"></i>
                  </button>
                  {openToolbarMenu === 'sort' && (
                    <div className="absolute right-0 top-full z-30 mt-2 min-w-56 rounded-xl border border-slate-100 bg-white p-3 shadow-xl">
                      {[
                        { id: 'price_asc' as const, label: t.sortOptions.price },
                        { id: 'price_desc' as const, label: t.highestPrice },
                        { id: 'earliest' as const, label: t.sortOptions.departure },
                        { id: 'latest' as const, label: t.latestDeparture },
                      ].map(option => (
                        <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                          <input type="radio" name="trainSortBy" checked={sortBy === option.id} onChange={() => { setSortBy(option.id); setOpenToolbarMenu(null); }} className="h-4 w-4 border-slate-300 text-orange-600 focus:ring-orange-500" />
                          <span className="text-slate-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {loading && <SkeletonLoader />}

        {error && (
          <NoResultsWithAlternatives searchMeta={searchMeta} onSearch={handleSearch} onRetry={() => handleSearch(searchMeta)} />
        )}

        {!loading && filteredJourneys.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            {filteredJourneys.map((j: any, i: number) => (
              <TrainCard key={`${j.journey_code || `${j.carrier_code}-${j.departure_date}-${j.origin}-${j.destination}`}-${i}`} journey={j} onSelect={handleSelect} adultCount={parseInt(searchMeta?.adult || '1')} isCheapest={cheapestIdx === i} />
            ))}
          </div>
        )}

        {!loading && allJourneys.length > 0 && filteredJourneys.length === 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
              <i className="fa-solid fa-train text-3xl text-slate-300"></i>
            </div>
            <h3 className="mb-2 text-lg font-black text-brand-ink">{t.noFilterResult}</h3>
            <p className="text-sm text-slate-500">{t.changeFilter}</p>
            <button type="button" onClick={resetFilters} className="mt-4 rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-orange-700">
              {t.resetFilterUpper}
            </button>
          </div>
        )}

        {noResultsAfterSearch && (
          <NoResultsWithAlternatives searchMeta={searchMeta} onSearch={handleSearch} />
        )}
      </div>
      {promoOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setPromoOpen(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="train-promo-title" className="flex max-h-[min(80vh,42rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 id="train-promo-title" className="text-base font-bold text-slate-800">{t.promoTitle}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{t.promoSubtitle}</p>
              </div>
              <button type="button" onClick={() => setPromoOpen(false)} aria-label={t.closePromo} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </header>
            <div className="overflow-y-auto p-5 sm:p-6">
              {promoLoading ? (
                <div className="flex min-h-40 items-center justify-center gap-3 text-sm font-medium text-slate-500">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600"></span>
                  {t.loadingPromos}
                </div>
              ) : promoError ? (
                <div className="py-10 text-center">
                  <p role="alert" className="text-sm text-rose-600">{promoError}</p>
                  <button type="button" onClick={() => { setTrainCoupons([]); setPromoOpen(false); window.setTimeout(openTrainPromos, 0); }} className="mt-3 text-xs font-bold text-sky-700 hover:underline">
                    {t.tryAgain}
                  </button>
                </div>
              ) : trainCoupons.length === 0 ? (
                <div className="py-12 text-center">
                  <i className="fa-solid fa-ticket text-3xl text-slate-300" aria-hidden="true"></i>
                  <p className="mt-3 text-sm font-semibold text-slate-700">{t.noActivePromos}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {trainCoupons.map(coupon => (
                    <article key={coupon.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800">{coupon.name}</p>
                          {coupon.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{coupon.description}</p>}
                        </div>
                        <span className="shrink-0 rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700">
                          {coupon.type === 'percentage' ? `${coupon.value}%` : fmtIDR(coupon.value)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-3">
                        <code className="min-w-0 truncate rounded bg-slate-100 px-2 py-1 text-xs font-bold tracking-wide text-slate-700">{coupon.code}</code>
                        <button type="button" onClick={() => void copyTrainCoupon(coupon.code)} className="shrink-0 text-xs font-bold text-sky-700 hover:text-sky-900">
                          {copiedPromo === coupon.code ? t.copied : t.copy}
                        </button>
                      </div>
                      {coupon.minOrderAmount > 0 && <p className="mt-2 text-[11px] text-slate-500">{t.minTransaction} {fmtIDR(coupon.minOrderAmount)}</p>}
                    </article>
                  ))}
                </div>
              )}
              {promoCopyError && <p role="alert" className="mt-3 text-xs text-rose-600">{promoCopyError}</p>}
            </div>
          </section>
        </div>
      )}
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