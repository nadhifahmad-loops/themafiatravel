'use client';
import { useState, useMemo, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import InsuranceCard from '@/components/insurance/InsuranceCard';

// ─── Konstanta ────────────────────────────────────────────────────────────────
const PROVIDERS = [
  { value: 'all',           label: 'Semua Provider',  icon: 'fa-globe' },
  { value: 'assistcard',    label: 'Assist Card',     icon: 'fa-briefcase-medical' },
  { value: 'bcainsurance',  label: 'BCA Insurance',   icon: 'fa-building-columns' },
  { value: 'zurich',        label: 'Zurich',          icon: 'fa-shield-halved' },
  { value: 'great_eastern', label: 'Great Eastern',   icon: 'fa-leaf' },
  { value: 'oona',          label: 'Oona',            icon: 'fa-umbrella' },
];

const PROVIDER_AREAS: Record<string, { value: string; label: string; international: boolean }[]> = {
  assistcard:    [
    { value: 'Europe',                          label: 'Eropa',                      international: true  },
    { value: 'Asia',                            label: 'Asia',                       international: true  },
    { value: 'North America',                   label: 'Amerika Utara',              international: true  },
    { value: 'South America',                   label: 'Amerika Selatan',            international: true  },
    { value: 'Africa',                          label: 'Afrika',                     international: true  },
    { value: 'Oceania',                         label: 'Oseania',                    international: true  },
    { value: 'Multiple Destinations',           label: 'Multi Destinasi',            international: true  },
    { value: 'Domestic',                        label: 'Domestik',                   international: false },
  ],
  bcainsurance:  [
    { value: 'Asia Pasifik',                    label: 'Asia Pasifik',               international: true  },
    { value: 'Worldwide',                       label: 'Seluruh Dunia',              international: true  },
    { value: 'Negara Schengen',                 label: 'Negara Schengen',            international: true  },
    { value: 'Domestik',                        label: 'Domestik',                   international: false },
  ],
  zurich:        [
    { value: 'Asia Pacific',                    label: 'Asia Pasifik',               international: true  },
    { value: 'Asia',                            label: 'Asia',                       international: true  },
    { value: 'Europe',                          label: 'Eropa',                      international: true  },
    { value: 'Schengen',                        label: 'Schengen',                   international: true  },
    { value: 'Worldwide',                       label: 'Seluruh Dunia',              international: true  },
    { value: 'Worldwide Excluding USA, Canada', label: 'Worldwide Excl. USA/CA',     international: true  },
    { value: 'ASEAN',                           label: 'ASEAN',                      international: true  },
    { value: 'Domestic',                        label: 'Domestik',                   international: false },
  ],
  great_eastern: [
    { value: 'Asia Pacific',                    label: 'Asia Pasifik',               international: true  },
    { value: 'ASEAN',                           label: 'ASEAN',                      international: true  },
    { value: 'Worldwide',                       label: 'Seluruh Dunia',              international: true  },
    { value: 'Worldwide exc US/Canada',         label: 'Worldwide Excl. USA/CA',     international: true  },
    { value: 'Domestic',                        label: 'Domestik',                   international: false },
  ],
  oona:          [
    { value: 'All',                             label: 'Semua Destinasi',            international: true  },
  ],
  all:           [
    { value: 'Asia',                            label: 'Asia',                       international: true  },
    { value: 'Asia Pacific',                    label: 'Asia Pasifik',               international: true  },
    { value: 'Europe',                          label: 'Eropa',                      international: true  },
    { value: 'Worldwide',                       label: 'Seluruh Dunia',              international: true  },
    { value: 'ASEAN',                           label: 'ASEAN',                      international: true  },
    { value: 'Domestic',                        label: 'Domestik',                   international: false },
  ],
};

const PROVIDER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  assistcard:    { label: '🩺 Assist Card',    bg: 'bg-blue-100',   text: 'text-blue-700'   },
  bcainsurance:  { label: '🏦 BCA Insurance',  bg: 'bg-sky-100',    text: 'text-sky-700'    },
  zurich:        { label: '🔵 Zurich',         bg: 'bg-indigo-100', text: 'text-indigo-700' },
  great_eastern: { label: '🟢 Great Eastern',  bg: 'bg-emerald-100',text: 'text-emerald-700'},
  oona:          { label: '🟠 Oona',           bg: 'bg-orange-100', text: 'text-orange-700' },
};

function fmtIDR(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="space-y-3">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row gap-4 animate-pulse">
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

// ─── Review / Konfirmasi Panel (mirip FlightReviewPanel) ──────────────────────
function ReviewPanel({ isOpen, onClose, onConfirm, product, searchMeta, priceData, loadingConfirm }: any) {
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
                { icon: 'fa-location-dot',  label: 'Destinasi',   val: searchMeta?.destination_area },
                { icon: 'fa-calendar',       label: 'Mulai',       val: fmtDate(searchMeta?.date_start) },
                { icon: 'fa-calendar-check', label: 'Selesai',     val: fmtDate(searchMeta?.date_end) },
                { icon: 'fa-clock',          label: 'Durasi',      val: `${nights} hari` },
                { icon: 'fa-users',          label: 'Peserta',     val: `${searchMeta?.pax || 1} orang` },
                { icon: 'fa-plane',          label: 'Tipe',        val: searchMeta?.trip_type === 'annual_trip' ? 'Tahunan' : 'Perjalanan Tunggal' },
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
                <p className="text-xs text-slate-400">Sudah termasuk biaya admin</p>
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
                   __html: product.info.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().substring(0, 200) + '...'
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

// ─── Compact Search Bar ───────────────────────────────────────────────────────
function CompactSearchBar({ searchMeta, onSearch, loading }: { searchMeta: any; onSearch: (p: any) => void; loading: boolean }) {
  const [collapsed, setCollapsed] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  if (collapsed) {
    const nights = searchMeta?.nights || 1;
    const pv = PROVIDER_BADGE[searchMeta?.provider] || null;
    return (
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 cursor-pointer hover:border-orange-200 transition-colors"
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-shield-halved text-orange-600"></i>
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm">
              {searchMeta?.destination_area || 'Semua Area'}
              {pv && <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${pv.bg} ${pv.text}`}>{pv.label}</span>}
            </p>
            <p className="text-xs text-slate-500">
              {fmtDate(searchMeta?.date_start)} → {fmtDate(searchMeta?.date_end)} · {nights} hari · {searchMeta?.pax || 1} peserta
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
    <InlineSearchForm
      initialData={searchMeta}
      onSearch={(p: any) => { onSearch(p); setCollapsed(true); }}
      loading={loading}
      onCancel={() => setCollapsed(true)}
    />
  );
}

// ─── Inline Search Form ───────────────────────────────────────────────────────
function InlineSearchForm({ initialData, onSearch, loading, onCancel }: any) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    provider:         initialData?.provider         || 'all',
    destination_area: initialData?.destination_area || 'Asia',
    date_start:       initialData?.date_start       || today,
    date_end:         initialData?.date_end         || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    pax:              initialData?.pax              || 1,
    trip_type:        initialData?.trip_type        || 'single_trip',
    is_senior:        initialData?.is_senior        || false,
  });

  const currentAreas = PROVIDER_AREAS[form.provider] || PROVIDER_AREAS.all;

  const handleProviderChange = (val: string) => {
    const areas = PROVIDER_AREAS[val] || PROVIDER_AREAS.all;
    setForm(f => ({ ...f, provider: val, destination_area: areas[0].value }));
  };

  const inp = "w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm outline-none focus:border-orange-500 transition-colors placeholder-slate-500 [color-scheme:dark]";
  const lbl = "block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider";

  const nights = Math.max(1, Math.round((new Date(form.date_end).getTime() - new Date(form.date_start).getTime()) / 86400000));

  return (
    <div className="bg-slate-900 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-white text-sm">Ubah Pencarian</h3>
        {onCancel && <button onClick={onCancel} className="text-white/50 hover:text-white transition-colors text-sm"><i className="fa-solid fa-xmark"></i></button>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
        <div>
          <label className={lbl}>Provider</label>
          <select value={form.provider} onChange={e => handleProviderChange(e.target.value)} className={inp} style={{ background: '#1e293b' }}>
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Area Tujuan</label>
          <select value={form.destination_area} onChange={e => setForm(f => ({ ...f, destination_area: e.target.value }))} className={inp} style={{ background: '#1e293b' }}>
            {currentAreas.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Tanggal Mulai</label>
          <input type="date" value={form.date_start} min={today} onChange={e => setForm(f => ({ ...f, date_start: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className={lbl}>Selesai ({nights}h)</label>
          <input type="date" value={form.date_end} min={form.date_start} onChange={e => setForm(f => ({ ...f, date_end: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className={lbl}>Tipe Perjalanan</label>
          <select value={form.trip_type} onChange={e => setForm(f => ({ ...f, trip_type: e.target.value }))} className={inp} style={{ background: '#1e293b' }}>
            <option value="single_trip">Sekali Jalan</option>
            <option value="annual_trip">Tahunan</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Peserta</label>
          <div className="flex items-center bg-slate-800 border border-slate-600 rounded-xl overflow-hidden h-10">
            <button type="button" onClick={() => setForm(f => ({ ...f, pax: Math.max(1, f.pax - 1) }))} className="w-9 text-orange-400 text-lg font-bold bg-transparent border-none flex items-center justify-center hover:bg-slate-700 h-full transition-colors">−</button>
            <span className="flex-1 text-center text-white text-sm font-bold">{form.pax}</span>
            <button type="button" onClick={() => setForm(f => ({ ...f, pax: Math.min(9, f.pax + 1) }))} className="w-9 text-orange-400 text-lg font-bold bg-transparent border-none flex items-center justify-center hover:bg-slate-700 h-full transition-colors">+</button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.is_senior} onChange={e => setForm(f => ({ ...f, is_senior: e.target.checked }))} className="w-4 h-4 rounded accent-orange-500" />
          <span className="text-sm text-slate-400">Senior (60+)</span>
        </label>
        <button
          disabled={loading}
          onClick={() => onSearch({ ...form, nights })}
          className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-600 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
        >
          {loading ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Mencari...</> : <><i className="fa-solid fa-magnifying-glass"></i> Cari Asuransi</>}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function InsuranceSearchContent() {
  const router      = useRouter();
  const today       = new Date().toISOString().split('T')[0];
  const nextWeek    = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const [searchMeta, setSearchMeta] = useState<any>({
    provider: 'all', destination_area: 'Asia',
    date_start: today, date_end: nextWeek,
    pax: 1, trip_type: 'single_trip', is_senior: false, nights: 7,
  });

  const [products,       setProducts]       = useState<any[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [searched,       setSearched]       = useState(false);
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({});
  const [filterProvider, setFilterProvider] = useState('all');
  const [sortBy,         setSortBy]         = useState<'price_asc' | 'price_desc'>('price_asc');

  // Review panel
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [priceData,        setPriceData]       = useState<any>(null);
  const [reviewOpen,       setReviewOpen]      = useState(false);
  const [loadingPrice,     setLoadingPrice]    = useState(false);
  const [selectingId,      setSelectingId]     = useState<string | null>(null);

  // ── Search ──
  const handleSearch = useCallback(async (params: any) => {
    setLoading(true); setError(''); setProducts([]);
    setProviderErrors({}); setFilterProvider('all'); setSearched(false);
    setSearchMeta(params);

    try {
      const providerList = params.provider === 'all'
        ? ['assistcard', 'bcainsurance', 'zurich', 'great_eastern', 'oona']
        : [params.provider];

      const areaMap: Record<string, string> = {
        all:           params.destination_area || 'Asia',
        assistcard:    (PROVIDER_AREAS.assistcard.find(a  => a.value === params.destination_area) ? params.destination_area : 'Asia'),
        bcainsurance:  (PROVIDER_AREAS.bcainsurance.find(a => a.value === params.destination_area) ? params.destination_area : 'Asia Pasifik'),
        zurich:        (PROVIDER_AREAS.zurich.find(a       => a.value === params.destination_area) ? params.destination_area : 'Asia Pacific'),
        great_eastern: (PROVIDER_AREAS.great_eastern.find(a=> a.value === params.destination_area) ? params.destination_area : 'Asia Pacific'),
        oona:          'All',
      };

      const res = await fetch('/api/insurance/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_start:       params.date_start,
          date_end:         params.date_end,
          pax:              params.pax,
          is_senior:        params.is_senior,
          international:    true,
          destination_area: params.destination_area,
          type:             params.trip_type,
          product_type:     'individual',
          providers:        providerList,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mencari asuransi');

      setProducts(data.data?.all || []);
      setProviderErrors(data.data?.errors || {});
      setSearched(true);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  // ── Klik Pilih → fetch harga dulu → tampilkan review panel ──
  const handleSelectProduct = useCallback(async (product: any) => {
    const pid = `${product.product_code}-${product.provider}`;
    setSelectingId(pid); setError('');
    try {
      const defaultBirth = new Date();
      defaultBirth.setFullYear(defaultBirth.getFullYear() - 30);
      const bd = defaultBirth.toISOString().split('T')[0];
      const pax = searchMeta?.pax || 1;

      const res = await fetch('/api/insurance/price', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { product_code: product.product_code, provider: product.provider, carrier_code: product.carrier_code },
          pax, package: 1, age: Array(pax).fill(bd), age_type: 'birth_date', adult: pax,
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
        product_name: selectedProduct.product_name,
        provider:     selectedProduct.provider,
        carrier_code: selectedProduct.carrier_code || selectedProduct.provider,
        carrier_name: selectedProduct.carrier_name || selectedProduct.provider,
        date_start:   searchMeta?.date_start || '',
        date_end:     searchMeta?.date_end   || '',
        pax:          String(searchMeta?.pax || 1),
        destination:  searchMeta?.destination_area || '',
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
    <div className="bg-[#f4f6fb] min-h-screen pt-20">
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      {/* ── Banner Header ─────────────────────────────────────────────────── */}
      <div className="bg-blue-800 text-white">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3 flex items-center gap-3 flex-wrap">
          <i className="fa-solid fa-shield-halved text-blue-300 text-lg"></i>
          <div className="text-sm font-black">Asuransi Perjalanan</div>
          <span className="text-blue-300">·</span>
          <span className="text-sm text-blue-100">
            {searchMeta.destination_area || 'Semua Area'}
          </span>
          {searched && (
            <>
              <span className="text-blue-300">·</span>
              <span className="text-sm text-blue-100">{searchMeta.date_start} → {searchMeta.date_end}</span>
              <span className="text-blue-300">·</span>
              <span className="text-sm text-blue-100">{searchMeta.pax || 1} Peserta</span>
            </>
          )}
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5">

        {/* Compact / Inline search bar */}
        <div className="mb-5">
          {searched ? (
            <CompactSearchBar searchMeta={{ ...searchMeta, nights }} onSearch={handleSearch} loading={loading} />
          ) : (
            <InlineSearchForm initialData={searchMeta} onSearch={handleSearch} loading={loading} />
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 mb-5">
            <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
            <div>
              <h3 className="font-bold text-red-800">Terjadi Kesalahan</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Provider partial errors */}
        {Object.keys(providerErrors).length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
            <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 text-sm"></i>
            <div className="text-xs text-amber-800">
              <span className="font-bold">Beberapa provider tidak merespons: </span>
              {Object.entries(providerErrors).map(([p, _], i) => (
                <span key={p}>{i > 0 ? ', ' : ''}{PROVIDER_BADGE[p]?.label || p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
              <div>
                <p className="font-bold text-slate-700 text-sm">Mencari di semua provider...</p>
                <p className="text-xs text-slate-400">Assist Card, BCA Insurance, Zurich, Great Eastern, Oona</p>
              </div>
            </div>
            <SkeletonLoader />
          </div>
        )}

        {/* Results */}
        {!loading && searched && (
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            {/* ── Sidebar Filter ── */}
            <div className="w-full lg:w-56 shrink-0">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-sliders text-orange-500 text-sm"></i>
                    <h3 className="font-black text-slate-800 text-sm">Filter</h3>
                  </div>
                  <button
                    onClick={() => { setFilterProvider('all'); setSortBy('price_asc'); }}
                    className="text-orange-600 text-xs font-bold hover:underline"
                  >Reset</button>
                </div>
                <div className="p-4 space-y-5">
                  {/* Filter Provider */}
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Provider</h4>
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
                    <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Urutkan</h4>
                    <div className="space-y-1.5">
                      {[
                        { id: 'price_asc',  label: 'Premi Termurah' },
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
                    <span className="font-black text-slate-900">{displayed.length}</span> produk ditemukan
                    <span className="ml-2 text-xs text-slate-400">· {nights} hari · {searchMeta.pax || 1} peserta</span>
                  </p>
                  <div className="flex gap-2">
                    {[{ id: 'price_asc', label: 'Termurah' }, { id: 'price_desc', label: 'Termahal' }].map(s => (
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
                  />
                );
              })}

              {/* Empty state */}
              {displayed.length === 0 && !loading && (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-shield-halved text-3xl text-slate-300"></i>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-2">Tidak Ada Produk</h3>
                  <p className="text-slate-500 text-sm">Coba ubah area tujuan, tanggal, atau provider.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Landing state — belum search */}
        {!searched && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
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
                <h3 className="font-black text-slate-900 text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}

export default function InsuranceSearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-[#f4f6fb]">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    }>
      <InsuranceSearchContent />
    </Suspense>
  );
}