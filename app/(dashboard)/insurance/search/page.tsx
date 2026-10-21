'use client';
import { useState, useMemo, Suspense, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import InsuranceCard from '@/components/insurance/InsuranceCard';
import InsuranceSearchForm from '@/components/insurance/InsuranceSearchForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { sanitizeInsuranceHtml } from '@/lib/insurance-html';

// ─── Konstanta ────────────────────────────────────────────────────────────────
const PROVIDER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  assistcard:    { label: 'Assist Card',    bg: 'bg-blue-100',   text: 'text-blue-700'   },
  bcainsurance:  { label: 'BCA Insurance',  bg: 'bg-sky-100',    text: 'text-sky-700'    },
  zurich:        { label: 'Zurich',         bg: 'bg-indigo-100', text: 'text-indigo-700' },
  great_eastern: { label: 'Great Eastern',  bg: 'bg-emerald-100',text: 'text-emerald-700'},
  oona:          { label: 'Oona',           bg: 'bg-orange-100', text: 'text-orange-700' },
};

function fmtIDR(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const POPULAR_INSURANCE_AREAS = [
  { area: 'Asia',        label: 'Asia',        labelEN: 'Asia',         img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80', price: '150rb' },
  { area: 'Asia Pacific', label: 'Asia Pasifik', labelEN: 'Asia Pacific', img: 'https://images.unsplash.com/photo-1506665531195-3566af2b4dfa?w=600&q=80', price: '180rb' },
  { area: 'Europe',      label: 'Eropa',       labelEN: 'Europe',       img: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&q=80', price: '250rb' },
  { area: 'Worldwide',   label: 'Seluruh Dunia', labelEN: 'Worldwide',  img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80', price: '350rb' },
  { area: 'ASEAN',       label: 'ASEAN',       labelEN: 'ASEAN',        img: 'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=600&q=80', price: '120rb' },
  { area: 'Domestic',    label: 'Domestik',    labelEN: 'Domestic',     img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80', price: '50rb' },
];

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="space-y-3">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col md:flex-row gap-4 animate-pulse">
          <div className="flex items-center gap-3 md:w-52">
            <div className="w-12 h-12 bg-blue-100 rounded-xl shrink-0"></div>
            <div className="space-y-2 flex-1">
              <div className="h-3 w-28 bg-slate-200 rounded"></div>
              <div className="h-2 w-20 bg-slate-200 rounded"></div>
              <div className="h-2 w-16 bg-slate-200 rounded"></div>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-2 w-3/4 bg-slate-200 rounded"></div>
            <div className="h-2 w-1/2 bg-slate-200 rounded"></div>
            <div className="h-2 w-2/3 bg-slate-200 rounded"></div>
          </div>
          <div className="md:w-48 space-y-2 flex flex-col items-end">
            <div className="h-3 w-20 bg-slate-200 rounded"></div>
            <div className="h-7 w-32 bg-orange-200 rounded"></div>
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
    <div className="w-full lg:w-56 shrink-0 lg:sticky lg:top-24 lg:self-start">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-200 rounded"></div>
          <div className="h-3 w-12 bg-slate-200 rounded"></div>
        </div>
        <div className="p-4 space-y-5">
          <div>
            <div className="h-2 w-20 bg-slate-200 rounded mb-3"></div>
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="flex items-center gap-3"><div className="w-4 h-4 bg-slate-100 rounded"></div><div className="h-2.5 w-24 bg-slate-100 rounded"></div></div>)}
            </div>
          </div>
          <div className="h-px bg-slate-100"></div>
          <div>
            <div className="h-2 w-16 bg-slate-200 rounded mb-3"></div>
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="flex items-center gap-3"><div className="w-4 h-4 bg-slate-100 rounded"></div><div className="h-2.5 w-20 bg-slate-100 rounded"></div></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── No Results with Alternatives ───────────────────────────────────────────
function NoResultsWithAlternatives({ searchMeta, onSearch, onRetry }: { searchMeta: any; onSearch: (p: any) => void; onRetry?: () => void }) {
  const { language } = useLanguage();
  const t = i18n.insuranceSearch[language];
  const isEN = language === 'EN';

  const quickInsurance = (area: typeof POPULAR_INSURANCE_AREAS[0]) => {
    const today = formatLocalDate(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = formatLocalDate(tomorrowDate);
    onSearch({
      area: area.area,
      departure_date: today,
      return_date: tomorrow,
      pax: searchMeta?.pax || 1,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      {/* No results header */}
      <div className="px-6 py-10 text-center">
        <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-shield-halved text-3xl text-orange-300"></i>
        </div>
        <h3 className="font-black text-slate-900 text-lg mb-1.5">{t.noResultTitle}</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">{t.noResultDesc}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm hover:bg-orange-700 transition-colors">
            <i className="fa-solid fa-rotate-right"></i> Coba Lagi
          </button>
        )}
      </div>

      {/* Alternative destinations */}
      <div className="border-t border-slate-100 bg-slate-50 px-6 py-6">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t.alternativeTitle}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {POPULAR_INSURANCE_AREAS.filter(d => d.area !== searchMeta?.area).map(d => (
            <button key={d.area} onClick={() => quickInsurance(d)}
              className="group relative overflow-hidden rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-left">
              <div className="aspect-[16/10] relative">
                <img src={d.img} alt={isEN ? d.labelEN : d.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? d.labelEN : d.label}</p>
                  <p className="text-orange-300 text-[10px] sm:text-xs font-semibold mt-0.5">
                    Mulai dari {d.price}
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

// ─── Review / Konfirmasi Panel (mirip FlightReviewPanel) ──────────────────────
function ReviewPanel({ isOpen, onClose, onConfirm, product, searchMeta, priceData, loadingConfirm }: any) {
  const { language } = useLanguage();
  const t = i18n.insuranceSearch[language];
  const bd = i18n.bookingDetail[language];
  if (!isOpen || !product) return null;

  const price       = priceData?.total_price || product.total_price || 0;
  const summary     = priceData?.service_charge_summary?.[0] || product.service_charge_summary?.[0];
  const baseFare    = summary?.total_fare || summary?.base_fare || price;
  const commission  = Math.abs(summary?.total_commission || 0);
  const nights      = searchMeta?.nights || 1;
  const provider    = product.provider || product.carrier_code || '';
  const badge       = PROVIDER_BADGE[provider] || { label: provider.toUpperCase(), bg: 'bg-slate-100', text: 'text-slate-700' };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-end p-0 md:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full md:w-[440px] md:rounded-3xl shadow-2xl max-h-[95vh] overflow-y-auto"
        style={{ animation: 'slideInRight 0.3s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <i className="fa-solid fa-xmark text-gray-500"></i>
            </button>
            <h2 className="text-base font-black text-slate-900">Konfirmasi Paket Asuransi</h2>
          </div>
          <i className="fa-solid fa-shield-halved text-orange-500 text-xl"></i>
        </div>

        <div className="p-6 space-y-4">
          {/* Produk */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-black px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>{badge.label}</span>
              {product.sector_type && <span className="text-xs text-slate-400 font-semibold">{product.sector_type}</span>}
            </div>
            <h3 className="font-black text-slate-900 text-base leading-snug mb-1">{product.product_name}</h3>
            <p className="text-xs text-slate-400 font-mono mb-3">{product.product_code}</p>

            {/* Info trip */}
            <div className="space-y-2">
              {[
                { icon: 'fa-location-dot',  label: t.destination,  val: searchMeta?.destination || searchMeta?.destination_area },
                { icon: 'fa-calendar',       label: bd.starts,     val: fmtDate(searchMeta?.date_start) },
                { icon: 'fa-calendar-check', label: 'Selesai',     val: fmtDate(searchMeta?.date_end) },
                { icon: 'fa-clock',          label: 'Durasi',      val: `${nights} ${t.days}` },
                { icon: 'fa-users',          label: 'Peserta',     val: `${searchMeta?.pax || 1} orang` },
                { icon: 'fa-plane',          label: t.type,        val: /annual|anual|yearly/i.test(String(searchMeta?.trip_type || '')) ? t.tripAnnual : t.tripSingle },
              ].filter(r => r.val).map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500">
                    <i className={`fa-solid ${r.icon} w-4 text-center text-[11px]`}></i>
                    <span className="text-xs">{r.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{r.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rincian Harga */}
          <div className="border border-slate-100 rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3">Rincian Harga</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Premi Dasar</span>
              <span className="text-sm font-semibold text-slate-700">{fmtIDR(baseFare)}</span>
            </div>
            {commission > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Komisi Agent</span>
                <span className="text-sm font-semibold text-emerald-600">−{fmtIDR(commission)}</span>
              </div>
            )}
            <div className="h-px bg-slate-100 my-2"></div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-400">Total Premi ({searchMeta?.pax || 1} orang)</p>
                <p className="text-2xl font-black text-orange-600">{fmtIDR(price * (searchMeta?.pax || 1))}</p>
                <p className="text-xs text-slate-400">Premi dasar provider; biaya admin ditampilkan di checkout</p>
              </div>
            </div>
          </div>

          {/* Keunggulan produk singkat */}
          {product.info && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-xs font-black text-emerald-700 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-check"></i> Manfaat Utama
              </p>
              <p className="text-xs text-emerald-800 leading-relaxed line-clamp-3"
                 dangerouslySetInnerHTML={{
                   __html: sanitizeInsuranceHtml(product.info.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().substring(0, 200) + '...')
                 }} />
            </div>
          )}

          {/* CTA */}
          <button
            onClick={onConfirm}
            disabled={loadingConfirm}
            className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
          >
            {loadingConfirm ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Memvalidasi...</>
            ) : (
              <>Lanjut ke Pemesanan <i className="fa-solid fa-arrow-right"></i></>
            )}
          </button>

          {product.pdf && (
            <a href={product.pdf} target="_blank" rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-orange-600 transition-colors py-1">
              <i className="fa-solid fa-file-pdf"></i> Lihat Syarat & Ketentuan Lengkap
            </a>
          )}

          <button onClick={onClose} className="text-sm text-slate-400 text-center hover:text-slate-600 transition-colors py-1 w-full">
            Kembali pilih paket lain
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Info Banner (after search) ─────────────────────────────────────────────
function InfoBanner({ searchMeta, nights }: { searchMeta: any; nights: number }) {
  const { language } = useLanguage();
  const t = i18n.insuranceSearch[language];
  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—';
  const pv = PROVIDER_BADGE[searchMeta?.provider] || null;

  return (
    <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-shield-halved text-orange-400 text-sm"></i>
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-black">
              {searchMeta?.destination || searchMeta?.destination_area || 'Semua Area'}
              {pv && <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${pv.bg} ${pv.text}`}>{pv.label}</span>}
            </span>
            <span className="text-white/60">·</span>
            <span className="text-white/60">{fmt(searchMeta?.date_start)} → {fmt(searchMeta?.date_end)}</span>
            <span className="text-white/60">·</span>
            <span className="text-white/60">{nights} {t.days} · {searchMeta?.pax || 1} peserta</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compact Search Bar ───────────────────────────────────────────────────────
function CompactSearchBar({ searchMeta, onSearch, loading }: { searchMeta: any; onSearch: (p: any) => void; loading: boolean }) {
  const { language } = useLanguage();
  const t = i18n.insuranceSearch[language];
  const [collapsed, setCollapsed] = useState(true);
  const today = formatLocalDate(new Date());

  if (collapsed) {
    const nights = searchMeta?.nights || 1;
    const pv = PROVIDER_BADGE[searchMeta?.provider] || null;
    return (
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 cursor-pointer hover:border-orange-200 transition-colors"
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-shield-halved text-orange-600"></i>
          </div>
          <div>
            <p className="font-black text-brand-ink text-sm">
              {searchMeta?.destination || searchMeta?.destination_area || 'Semua Area'}
              {pv && <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${pv.bg} ${pv.text}`}>{pv.label}</span>}
            </p>
            <p className="text-xs text-slate-500">
              {fmtDate(searchMeta?.date_start)} → {fmtDate(searchMeta?.date_end)} · {nights} {t.days} · {searchMeta?.pax || 1} peserta
            </p>
          </div>
        </div>
        <button className="px-4 py-2 bg-orange-100 text-orange-700 font-bold text-xs rounded-xl hover:bg-orange-200 transition-colors shrink-0">
          Ubah Pencarian
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 relative z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-brand-ink text-sm">Ubah Pencarian</h3>
        <button onClick={() => setCollapsed(true)} className="text-slate-400 hover:text-brand-ink transition-colors">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>
      <InsuranceSearchForm
        initialData={searchMeta}
        onSearch={(p: any) => { onSearch(p); setCollapsed(true); }}
        loading={loading}
        variant="light"
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function InsuranceSearchContent() {
  const { language } = useLanguage();
  const t = i18n.insuranceSearch[language];
  const tc = i18n.common[language];
  const isEN = language === 'EN';
  const router      = useRouter();
  const searchParams = useSearchParams();

  usePageTitle(
    searchParams.get('destination')
      ? `Asuransi Perjalanan: ${searchParams.get('destination')}`
      : 'Asuransi Perjalanan'
  );
  const today       = formatLocalDate(new Date());
  const [nextWeek]  = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return formatLocalDate(date);
  });

  const [searchMeta, setSearchMeta] = useState<any>(() => {
    const p         = searchParams.get('provider')         || 'all';
    const area      = searchParams.get('destination_area') || 'Asia';
    const destination = searchParams.get('destination') || '';
    const international = searchParams.has('international')
      ? searchParams.get('international') === 'true'
      : !/domestic|domestik/i.test(area);
    const dateStart = searchParams.get('date_start')       || today;
    const dateEnd   = searchParams.get('date_end')         || nextWeek;
    const tripType  = searchParams.get('trip_type')        || 'single_trip';
    const pax       = parseInt(searchParams.get('pax') || '1', 10);
    const adult     = parseInt(searchParams.get('adult') || String(pax), 10);
    const child     = parseInt(searchParams.get('child') || '0', 10);
    const isSenior  = searchParams.get('is_senior') === 'true';
    const nights    = Math.max(1, Math.round((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86400000));
    return {
      provider: p,
      destination,
      destination_area: area,
      international,
      date_start: dateStart,
      date_end: dateEnd,
      pax,
      adult,
      child,
      trip_type: tripType,
      is_senior: isSenior,
      nights,
    };
  });

  const [products,       setProducts]       = useState<any[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [searched,       setSearched]       = useState(false);
  const [filterProvider, setFilterProvider] = useState('all');
  const [sortBy,         setSortBy]         = useState<'price_asc' | 'price_desc'>('price_asc');
  const [showTimeout,    setShowTimeout]    = useState(false);

  // Review panel
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [priceData,        setPriceData]       = useState<any>(null);
  const [reviewOpen,       setReviewOpen]      = useState(false);
  const [loadingPrice,     setLoadingPrice]    = useState(false);
  const [selectingId,      setSelectingId]     = useState<string | null>(null);

  // Timeout notification saat loading terlalu lama
  useEffect(() => {
    if (!loading) { setShowTimeout(false); return; }
    const timer = setTimeout(() => setShowTimeout(true), 15000);
    return () => clearTimeout(timer);
  }, [loading]);

  // ── Auto-search dari homepage ──
  const handleSearch = useCallback(async (params: any) => {
    setLoading(true); setError(''); setProducts([]);
    setFilterProvider('all'); setSearched(true);
    setSearchMeta(params);

    try {
      const providerList = params.provider === 'all'
        ? ['assistcard', 'bcainsurance', 'zurich', 'great_eastern', 'oona']
        : [params.provider];

      const res = await fetch('/api/insurance/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_start:       params.date_start,
          date_end:         params.date_end,
          pax:              params.pax,
          destination:      params.destination,
          is_senior:        params.is_senior,
          international:    params.international ?? !/domestic|domestik/i.test(String(params.destination_area || '')),
          destination_area: params.destination_area,
          type:             params.trip_type,
          product_type:     'individual',
          providers:        providerList,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mencari asuransi');

      setProducts(data.data?.all || []);
      setSearched(true);
    } catch (e: any) {
      setError(e instanceof TypeError
        ? 'Koneksi internet terputus. Periksa sinyalmu lalu coba lagi.'
        : (e.message || 'Gagal mencari asuransi'));
    }
    setLoading(false);
  }, []);

  const quickSearchArea = (area: string) => {
    const international = !/domestic|domestik/i.test(area);
    handleSearch({
      provider: 'all',
      destination: '',
      destination_area: area,
      international,
      date_start: today,
      date_end: nextWeek,
      pax: 1,
      adult: 1,
      child: 0,
      trip_type: 'single_trip',
      is_senior: false,
      nights: 7,
    });
  };

  useEffect(() => {
    if (searchParams.get('autoSearch') === '1') {
      handleSearch(searchMeta);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Klik Pilih → fetch harga dulu → tampilkan review panel ──
  const handleSelectProduct = useCallback(async (product: any) => {
    const pid = `${product.product_code}-${product.provider}`;
    setSelectingId(pid); setError('');
    try {
      const defaultBirth = new Date();
      defaultBirth.setFullYear(defaultBirth.getFullYear() - 30);
      const bd = formatLocalDate(defaultBirth);
      const pax = searchMeta?.pax || 1;

      const res = await fetch('/api/insurance/price', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { product_code: product.product_code, provider: product.provider, carrier_code: product.carrier_code },
          pax, package: 1, age: Array(pax).fill(bd), age_type: 'birth_date',
          adult: searchMeta?.adult || pax, child: searchMeta?.child || 0,
          date_start: searchMeta?.date_start, date_end: searchMeta?.date_end,
          destination: searchMeta?.destination || '',
          destination_area: searchMeta?.destination_area,
          is_senior: searchMeta?.is_senior,
          international: searchMeta?.international ?? !/domestic|domestik/i.test(String(searchMeta?.destination_area || '')),
          type: searchMeta?.trip_type, product_type: product.product_type_code || 'individual',
        }),
      });
      const data = await res.json();
      const priced = Array.isArray(data.data) ? data.data[0] : data.data;

      setSelectedProduct(product);
      setPriceData(priced || null);
      setReviewOpen(true);
    } catch (e: any) {
      // Buka review panel dengan data mentah jika price gagal
      setSelectedProduct(product);
      setPriceData(null);
      setReviewOpen(true);
    }
    setSelectingId(null);
  }, [searchMeta]);

  // ── Konfirmasi dari review panel → checkout ──
  const handleConfirm = useCallback(async () => {
    if (!selectedProduct) return;
    setLoadingPrice(true);
    try {
      const price    = priceData?.total_price || selectedProduct.total_price || 0;
      const nights   = searchMeta?.nights || 1;
      const q = new URLSearchParams({
        product_code: selectedProduct.product_code,
        package: String(selectedProduct.package ?? selectedProduct.package_id ?? selectedProduct.package_code ?? '1'),
        product_name: selectedProduct.product_name,
        provider:     selectedProduct.provider,
        carrier_code: selectedProduct.carrier_code || selectedProduct.provider,
        carrier_name: selectedProduct.carrier_name || selectedProduct.provider,
        date_start:   searchMeta?.date_start || '',
        date_end:     searchMeta?.date_end   || '',
        pax:          String(searchMeta?.pax || 1),
        is_senior:    String(searchMeta?.is_senior === true),
        destination:  searchMeta?.destination || '',
        destination_area: searchMeta?.destination_area || '',
        international: String(searchMeta?.international ?? !/domestic|domestik/i.test(String(searchMeta?.destination_area || ''))),
        adult:        String(searchMeta?.adult || searchMeta?.pax || 1),
        child:        String(searchMeta?.child || 0),
        total_amount: String(Math.round(price)),
        sector_type:  selectedProduct.sector_type || '',
        product_type: selectedProduct.product_type_code || 'individual',
        trip_type:    selectedProduct.master_trip_id || searchMeta?.trip_type || 'single_trip',
        nights:       String(nights),
      }).toString();
      router.push(`/insurance/checkout?${q}`);
    } catch {
      setLoadingPrice(false);
    }
  }, [selectedProduct, priceData, searchMeta, router]);

  // ── Filter & Sort ──
  const displayed = useMemo(() => {
    let arr = filterProvider === 'all'
      ? [...products]
      : products.filter(p => (p.provider || p.carrier_code) === filterProvider);

    arr.sort((a, b) =>
      sortBy === 'price_asc'
        ? (a.total_price || 0) - (b.total_price || 0)
        : (b.total_price || 0) - (a.total_price || 0)
    );
    return arr;
  }, [products, filterProvider, sortBy]);

  const hasResults = products.length > 0;
  const noResultsAfterSearch = !loading && searched && !hasResults && !error;

  // ── Paket termurah (badge highlight) ──
  const cheapestKey = useMemo(() => {
    let bestKey: string | null = null;
    let bestPrice = Infinity;
    displayed.forEach(p => {
      const price = p.total_price || 0;
      if (price > 0 && price < bestPrice) {
        bestPrice = price;
        bestKey = `${p.product_code}-${p.provider}`;
      }
    });
    return bestKey;
  }, [displayed]);

  // Count per provider
  const providerCounts = useMemo(() => {
    const c: Record<string, number> = {};
    products.forEach(p => {
      const pv = p.provider || p.carrier_code || 'other';
      c[pv] = (c[pv] || 0) + 1;
    });
    return c;
  }, [products]);

  const nights = Math.max(1, Math.round(
    (new Date(searchMeta.date_end).getTime() - new Date(searchMeta.date_start).getTime()) / 86400000
  ));

  return (
    <div className="bg-brand-bgLight min-h-screen pt-20">
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      {/* ── HERO HEADER (landing) ── */}
      {!searched ? (
      <section className="relative z-20 overflow-visible pt-4 md:pt-8 pb-2">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
              {t.landing.title}
            </h1>
            <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium">{t.landing.subtitle}</p>
          </div>

          <div className="bg-white rounded-2xl md:rounded-3xl shadow-floating border border-slate-100/80 p-4 sm:p-6 transition-all">
            <InsuranceSearchForm initialData={searchMeta} onSearch={handleSearch} loading={loading} variant="light" />
          </div>
        </div>
      </section>
      ) : (
      <>
      {/* ─── Info Banner ──────────────────────────────────────────────────────── */}
      <InfoBanner searchMeta={searchMeta} nights={nights} />
      </>
      )}

      {searched && (
      <>
      {/* ─── Sticky Compact Search Bar ─────────────────────────────────────── */}
      <div data-compact-search className="sticky top-0 z-[900] bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3">
          <CompactSearchBar searchMeta={{ ...searchMeta, nights }} onSearch={handleSearch} loading={loading} />
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-5 pb-10">

        {/* Loading with filter skeleton */}
        {loading && (
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            <FilterSkeleton />
            <div className="flex-1 min-w-0 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-card">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
                <div>
                  <p className="font-bold text-slate-700 text-sm">Mencari di semua provider...</p>
                  <p className="text-xs text-slate-400">Assist Card, BCA Insurance, Zurich, Great Eastern, Oona</p>
                </div>
              </div>
              {showTimeout && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <i className="fa-solid fa-clock text-amber-500 mt-0.5"></i>
                  <div>
                    <p className="font-bold text-amber-800 text-sm">Masih memproses...</p>
                    <p className="text-xs text-amber-600 mt-0.5">Beberapa provider mungkin lambat merespons. Mohon tunggu sebentar lagi.</p>
                  </div>
                </div>
              )}
              <SkeletonLoader />
            </div>
          </div>
        )}

        {!loading && searched && !error && !noResultsAfterSearch && products.length > 0 && (
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            {/* ── Sidebar Filter ── */}
            <div className="w-full lg:w-56 shrink-0">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden sticky top-24">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-sliders text-orange-500 text-sm"></i>
                    <h3 className="font-black text-brand-ink text-sm">{tc.filter}</h3>
                  </div>
                  <button
                    onClick={() => { setFilterProvider('all'); setSortBy('price_asc'); }}
                    className="text-orange-600 text-xs font-bold hover:underline"
                  >Reset</button>
                </div>
                <div className="p-4 space-y-5">
                  {/* Filter Provider */}
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">{t.provider}</h4>
                    <div className="space-y-1.5">
                      {[
                        { id: 'all', label: `Semua (${products.length})` },
                        ...Object.entries(providerCounts).map(([p, n]) => ({
                          id: p, label: `${PROVIDER_BADGE[p]?.label || p} (${n})`
                        }))
                      ].map(opt => (
                        <label key={opt.id} className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="radio" name="provFilter"
                            checked={filterProvider === opt.id}
                            onChange={() => setFilterProvider(opt.id)}
                            className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-slate-100"></div>

                  {/* Urutkan */}
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">{t.sortBy}</h4>
                    <div className="space-y-1.5">
                      {[
                        { id: 'price_asc',  label: t.sortOptions.price },
                        { id: 'price_desc', label: 'Premi Tertinggi' },
                      ].map(opt => (
                        <label key={opt.id} className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="radio" name="sortBy"
                            checked={sortBy === opt.id}
                            onChange={() => setSortBy(opt.id as any)}
                            className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Daftar Produk ── */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Summary bar */}
              {displayed.length > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-600">
                    <span className="font-black text-brand-ink">{displayed.length}</span> {t.plansFound}
                    <span className="ml-2 text-xs text-slate-400">· {nights} {t.days} · {searchMeta.pax || 1} peserta</span>
                  </p>
                  <div className="flex gap-2">
                    {[{ id: 'price_asc', label: t.sortOptions.price }, { id: 'price_desc', label: 'Termahal' }].map(s => (
                      <button key={s.id} onClick={() => setSortBy(s.id as any)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${sortBy === s.id ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Kartu produk */}
              {displayed.map((p, i) => {
                const pid = `${p.product_code}-${p.provider}`;
                return (
                  <InsuranceCard
                    key={`${pid}-${i}`}
                    product={p}
                    onSelect={handleSelectProduct}
                    isSelecting={selectingId === pid}
                    isCheapest={cheapestKey === pid}
                  />
                );
              })}

              {/* Empty state after filter */}
              {displayed.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-card">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-shield-halved text-3xl text-slate-300"></i>
                  </div>
                  <h3 className="text-lg font-black text-brand-ink mb-2">{t.noResult}</h3>
                  <p className="text-slate-500 text-sm">{t.noResultSub}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <NoResultsWithAlternatives searchMeta={searchMeta} onSearch={handleSearch} onRetry={() => handleSearch(searchMeta)} />
        )}

        {/* No results after search */}
        {noResultsAfterSearch && (
          <NoResultsWithAlternatives searchMeta={searchMeta} onSearch={handleSearch} />
        )}

        </div>
      </>
      )}

        {/* Landing state — belum search */}
        {!searched && !loading && (
          <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 space-y-6">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-brand-ink">{t.landing.popularTitle}</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">{t.landing.popularSub}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mt-4">
                {POPULAR_INSURANCE_AREAS.map(a => (
                  <button key={a.area} onClick={() => quickSearchArea(a.area)}
                    className="group relative overflow-hidden rounded-2xl shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-left">
                    <div className="aspect-[16/10] relative">
                      <img src={a.img} alt={isEN ? a.labelEN : a.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
                        <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? a.labelEN : a.label}</p>
                        <p className="text-orange-300 text-[10px] sm:text-xs font-semibold mt-0.5">
                          Mulai dari IDR {a.price}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: 'fa-hospital', color: 'text-blue-500 bg-blue-50', title: 'Biaya Medis', desc: 'Proteksi pengobatan darurat di luar negeri' },
                { icon: 'fa-plane-slash', color: 'text-orange-500 bg-orange-50', title: 'Pembatalan Tiket', desc: 'Ganti rugi pembatalan mendadak akibat darurat' },
                { icon: 'fa-suitcase', color: 'text-emerald-500 bg-emerald-50', title: 'Kehilangan Bagasi', desc: 'Proteksi kehilangan & kerusakan koper' },
                { icon: 'fa-person-falling', color: 'text-purple-500 bg-purple-50', title: 'Kecelakaan Diri', desc: 'Santunan kecelakaan selama perjalanan' },
              ].map((f, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 text-center hover:shadow-md hover:border-orange-100 transition-all">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${f.color}`}>
                    <i className={`fa-solid ${f.icon} text-xl`}></i>
                  </div>
                  <h3 className="font-black text-brand-ink text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* ── Review Panel ── */}
      <ReviewPanel
        isOpen={reviewOpen}
        onClose={() => { setReviewOpen(false); setLoadingPrice(false); }}
        onConfirm={handleConfirm}
        product={selectedProduct}
        searchMeta={{ ...searchMeta, nights }}
        priceData={priceData}
        loadingConfirm={loadingPrice}
      />

      <style jsx global>{`
        /* Saat halaman hasil pencarian asuransi: navbar ikut terscroll,
           hanya "Ubah Pencarian" yang sticky di atas. */
        body:has([data-compact-search]) header.fixed {
          position: absolute;
        }
      `}</style>
    </div>
  );
}

export default function InsuranceSearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-bgLight pt-20">
        <section className="relative z-10 overflow-hidden pt-4 md:pt-8 pb-2">
          <div className="max-w-[1280px] mx-auto px-4 md:px-8">
            <div className="space-y-3 animate-pulse">
              <div className="h-6 w-48 bg-slate-200 rounded-full"></div>
              <div className="h-8 w-72 bg-slate-200 rounded"></div>
              <div className="h-4 w-96 bg-slate-200 rounded"></div>
              <div className="h-16 w-full bg-slate-200 rounded-full"></div>
            </div>
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-floating p-4 sm:p-6 mt-6 animate-pulse">
              <div className="h-20 w-full bg-slate-200 rounded-xl"></div>
            </div>
          </div>
        </section>
      </div>
    }>
      <InsuranceSearchContent />
    </Suspense>
  );
}