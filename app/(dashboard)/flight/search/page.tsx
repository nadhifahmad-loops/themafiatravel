'use client';
import { useState, useMemo, Suspense, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FlightSearchForm from '@/components/flight/FlightSearchForm';
import FlightCard from '@/components/flight/FlightCard';
import { FLIGHT_PROVIDERS } from '@/lib/providers';

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
function fmtDuration(elapsed: string) {
  if (!elapsed) return '';
  const parts = elapsed.split(':').map(Number);
  if (parts.length === 4) return `${parts[1]}j ${parts[2]}m`;
  if (parts.length >= 2) return `${parts[0]}j ${parts[1]}m`;
  return elapsed;
}

// ─── Parse journeys dari respons API ─────────────────────────────────────────
// Mengembalikan array per-schedule: index 0 = outbound, 1 = return, dst (multi)
function parseSchedules(apiData: any): any[][] {
  const d = apiData;
  if (!d) return [[]];

  let schedules: any[] = [];

  if (d?.schedules?.length) {
    schedules = d.schedules;
  } else if (d?.response?.schedules?.length) {
    schedules = d.response.schedules;
  } else if (Array.isArray(d)) {
    // flat array fallback — bungkus jadi satu schedule
    return [d];
  }

  if (!schedules.length) return [[]];

  // Attach provider + sequence ke setiap journey agar bisa dipakai di price/book
  return schedules.map((sched: any) => {
    const provider = sched.provider || '';
    const sequence = sched.sequence || 1;
    return (sched.journeys || []).map((j: any) => ({
      ...j,
      provider:            j.provider || provider,
      schedule_provider:   provider,
      schedule_sequence:   j.sequence || sequence,
      schedule_origin:     sched.origin,
      schedule_destination: sched.destination,
    }));
  });
}

// ─── Review Panel (Panel kanan konfirmasi) ────────────────────────────────────
function ReviewPanel({ isOpen, onClose, onConfirm, selectedLegs, searchMeta, loading }: any) {
  if (!isOpen) return null;

  const isRT    = searchMeta?.direction === 'RT';
  const isMulti = searchMeta?.direction === 'Multi';

  function JourneyBlock({ journey, fare, label, color }: any) {
    if (!journey) return null;
    const seg     = journey.segments?.[0];
    const lastSeg = journey.segments?.[journey.segments.length - 1];
    const summary = fare?.service_charge_summary?.[0];
    const price   = ((summary?.base_fare || 0) + (summary?.base_tax || 0)) * (searchMeta?.adult || 1);
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-black px-2.5 py-1 rounded-full text-white ${color || 'bg-orange-600'}`}>{label}</span>
          <span className="text-xs text-slate-500 font-semibold">{fmtDate(seg?.departure_date)}</span>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm overflow-hidden">
              <img
                src={`https://assets.wego.com/image/upload/h_72,c_fit,f_auto,fl_lossy,q_auto/v20250101/flights/airlines_square/${seg?.carrier_code}.png`}
                alt={seg?.carrier_name}
                className="w-7 h-7 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <p className="font-black text-slate-800 text-sm">{seg?.carrier_name}</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                {fare?.fare_name || fare?.class_of_service || 'Economy'} ·{' '}
                {(journey.segments?.length || 1) === 1 ? 'Langsung' : `${(journey.segments?.length || 1) - 1} transit`}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-black text-slate-900">{fmtTime(seg?.departure_date)}</p>
              <p className="text-xs font-bold text-slate-500">{seg?.origin || journey.origin}</p>
            </div>
            <div className="flex flex-col items-center flex-1 px-3">
              <p className="text-[10px] text-slate-400 font-semibold mb-1">{fmtDuration(journey.elapsed_time)}</p>
              <div className="w-full flex items-center gap-1">
                <div className="flex-1 h-px bg-slate-300"></div>
                <i className="fa-solid fa-plane text-orange-500 text-[10px]"></i>
                <div className="flex-1 h-px bg-slate-300"></div>
              </div>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">
                {(journey.segments?.length || 1) === 1 ? 'Langsung' : `${(journey.segments?.length || 1) - 1} stop`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-slate-900">{fmtTime(lastSeg?.arrival_date)}</p>
              <p className="text-xs font-bold text-slate-500">{lastSeg?.destination || journey.destination}</p>
            </div>
          </div>
          {price > 0 && <p className="text-right text-xs text-orange-600 font-bold mt-2">{fmtIDR(price)}/org</p>}
        </div>
      </div>
    );
  }

  const COLORS = ['bg-orange-600', 'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-rose-600'];
  const LEG_LABELS = isRT
    ? ['Pergi', 'Pulang']
    : isMulti
    ? (searchMeta?.routes || []).map((_: any, i: number) => `Kota ${i + 1}`)
    : ['Penerbangan'];

  const totalPrice = selectedLegs.reduce((sum: number, leg: any) => {
    if (!leg) return sum;
    const summary = leg.fare?.service_charge_summary?.[0];
    return sum + ((summary?.base_fare || 0) + (summary?.base_tax || 0)) * (searchMeta?.adult || 1);
  }, 0);

  const allSelected = isRT
    ? !!(selectedLegs[0] && selectedLegs[1])
    : isMulti
    ? selectedLegs.every((l: any) => !!l)
    : !!selectedLegs[0];

  // Cari leg berikutnya yang belum dipilih
  const nextMissingLeg  = selectedLegs.findIndex((l: any) => !l);
  const nextMissingLabel = nextMissingLeg >= 0 ? LEG_LABELS[nextMissingLeg] : null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-end p-0 md:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full md:w-[480px] md:rounded-3xl shadow-2xl max-h-[95vh] overflow-y-auto animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <i className="fa-solid fa-xmark text-gray-500"></i>
            </button>
            <h2 className="text-base font-black text-slate-900">Review Penerbanganmu</h2>
          </div>
          {/* Step pills */}
          {(isRT || isMulti) && (
            <div className="flex items-center gap-1">
              {LEG_LABELS.map((lbl: string, i: number) => (
                <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                  selectedLegs[i] ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {selectedLegs[i] ? '✓' : i + 1}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          {LEG_LABELS.map((label: string, i: number) => (
            <div key={i}>
              {selectedLegs[i] ? (
                <JourneyBlock
                  journey={selectedLegs[i].journey}
                  fare={selectedLegs[i].fare}
                  label={label}
                  color={COLORS[i % COLORS.length]}
                />
              ) : (
                /* Slot penerbangan yang belum dipilih */
                <div
                  onClick={onConfirm}
                  className={`rounded-2xl border-2 border-dashed p-4 flex items-center gap-3 cursor-pointer transition-all group ${
                    i === nextMissingLeg
                      ? 'border-orange-400 bg-orange-50 hover:bg-orange-100'
                      : 'border-slate-200 bg-slate-50 opacity-50 pointer-events-none'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    i === nextMissingLeg ? 'bg-orange-600' : 'bg-slate-200'
                  }`}>
                    <i className={`fa-solid fa-plane text-sm ${i === nextMissingLeg ? 'text-white' : 'text-slate-400'}`}></i>
                  </div>
                  <div className="flex-1">
                    <p className={`font-black text-sm ${i === nextMissingLeg ? 'text-orange-700' : 'text-slate-500'}`}>
                      Pilih Penerbangan {label}
                    </p>
                    {i === nextMissingLeg && (
                      <p className="text-xs text-orange-500 font-semibold mt-0.5">
                        Klik untuk memilih →
                      </p>
                    )}
                  </div>
                  {i === nextMissingLeg && (
                    <i className="fa-solid fa-chevron-right text-orange-500 text-sm group-hover:translate-x-1 transition-transform"></i>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Total harga (hanya tampil jika ada leg yang sudah dipilih) */}
          {totalPrice > 0 && (
            <div className="flex items-end justify-between pt-2 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-400 font-semibold">
                  {searchMeta?.adult || 1} dewasa · {isRT ? 'Pulang Pergi' : isMulti ? 'Multi-Kota' : 'Sekali Jalan'}
                  {!allSelected && ' · estimasi'}
                </p>
                <p className={`text-2xl font-black ${allSelected ? 'text-orange-600' : 'text-slate-400'}`}>
                  {fmtIDR(totalPrice)}
                </p>
                <p className="text-xs text-slate-400">
                  {allSelected ? 'Total sudah termasuk pajak' : 'Harga belum final, pilih semua penerbangan'}
                </p>
              </div>
            </div>
          )}

          {/* CTA button — kontekstual */}
          {allSelected ? (
            /* Semua leg sudah dipilih → lanjut ke checkout */
            <button
              onClick={onConfirm}
              disabled={loading}
              className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Memvalidasi harga...</>
              ) : (
                <>Lanjutkan ke Pemesanan <i className="fa-solid fa-arrow-right"></i></>
              )}
            </button>
          ) : (
            /* Ada leg yang belum dipilih → arahkan pilih leg berikutnya */
            <button
              onClick={onConfirm}
              className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              Pilih Penerbangan {nextMissingLabel} <i className="fa-solid fa-plane-departure"></i>
            </button>
          )}

          <button onClick={onClose} className="text-sm text-slate-400 text-center hover:text-slate-600 transition-colors py-1 w-full">
            {allSelected ? 'Kembali pilih penerbangan lain' : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Provider Search Progress ─────────────────────────────────────────────────
function ProviderProgress({ providers, done, total }: { providers: string[]; done: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          Mencari di {total} maskapai...
        </div>
        <span className="text-xs text-orange-600 font-black">{done}/{total}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-orange-500 transition-all duration-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {providers.map((p, i) => (
          <span key={p} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            i < done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
          }`}>
            {i < done ? '✓ ' : ''}{FLIGHT_PROVIDERS.find(f => f.id === p)?.label || p}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row gap-4 animate-pulse">
          <div className="flex items-center gap-3 md:w-48">
            <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
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
            <div className="h-9 w-full bg-slate-200 rounded-xl"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Compact Search Bar ───────────────────────────────────────────────────────
function CompactSearchBar({ searchMeta, onSearch, loading }: { searchMeta: any; onSearch: (p: any) => void; loading: boolean }) {
  const [collapsed, setCollapsed] = useState(true);
  if (collapsed) {
    const dirLabel = searchMeta?.direction === 'RT' ? 'Pulang Pergi' : searchMeta?.direction === 'Multi' ? 'Multi-Kota' : 'Sekali Jalan';
    const routeLabel = searchMeta?.direction === 'Multi'
      ? (searchMeta?.routes || []).map((r: any) => `${r.origin}→${r.destination}`).join(', ')
      : `${searchMeta?.origin} → ${searchMeta?.destination}`;
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 cursor-pointer" onClick={() => setCollapsed(false)}>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-plane text-orange-600"></i>
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm">{routeLabel}</p>
            <p className="text-xs text-slate-500">
              {searchMeta?.departure_date} · {dirLabel} · {searchMeta?.adult || 1} Dewasa
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
    <div className="bg-slate-900 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-white text-sm">Ubah Pencarian</h3>
        <button onClick={() => setCollapsed(true)} className="text-white/60 hover:text-white transition-colors">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <FlightSearchForm onSearch={(p) => { onSearch(p); setCollapsed(true); }} loading={loading} initialData={searchMeta} />
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function FlightSearchContent() {
  const searchParamsHook = useSearchParams();
  const router = useRouter();

  // ── Data state ──
  // scheduleResults: array per-leg [ [outbound journeys], [return journeys], ... ]
  const [scheduleResults, setScheduleResults] = useState<any[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Progress multi-provider
  const [providersDone, setProvidersDone] = useState(0);
  const [providersTotal, setProvidersTotal] = useState(0);
  const [searchedProviders, setSearchedProviders] = useState<string[]>([]);

  const [searchMeta, setSearchMeta] = useState<any>({
    origin:         searchParamsHook.get('origin')         || 'CGK',
    destination:    searchParamsHook.get('destination')    || 'DPS',
    departure_date: searchParamsHook.get('departure_date') || '',
    return_date:    searchParamsHook.get('return_date')    || '',
    adult:          searchParamsHook.get('adult')          || '1',
    child:          searchParamsHook.get('child')          || '0',
    infant:         searchParamsHook.get('infant')         || '0',
    cabin_class:    searchParamsHook.get('cabin_class')    || 'Y',
    direction:      searchParamsHook.get('direction')      || 'OW',
  });

  // ── Step state (untuk RT & multi-city) ──
  // currentLegStep: 0 = outbound/leg1, 1 = return/leg2, dst.
  const [currentLegStep, setCurrentLegStep] = useState(0);
  // selectedLegs: array selection per leg [ { journey, fare } | null ]
  const [selectedLegs, setSelectedLegs] = useState<(null | { journey: any; fare: any })[]>([null]);

  // ── Filter & Sort ──
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'earliest' | 'latest'>('price_asc');
  const [filterTransit, setFilterTransit] = useState<string[]>([]);
  const [filterAirlines, setFilterAirlines] = useState<string[]>([]);
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | null>(null);
  const [filterDepartureTime, setFilterDepartureTime] = useState<string[]>([]);

  // ── Review panel ──
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Compute total legs expected
  const totalLegs = useMemo(() => {
    if (searchMeta?.direction === 'RT') return 2;
    if (searchMeta?.direction === 'Multi') return (searchMeta?.routes?.length || 2);
    return 1;
  }, [searchMeta]);

  // Current leg journeys to display
  const currentJourneys = useMemo(() => {
    return scheduleResults[currentLegStep] || [];
  }, [scheduleResults, currentLegStep]);

  // ── Auto-search on mount ──
  useEffect(() => {
    const origin         = searchParamsHook.get('origin');
    const destination    = searchParamsHook.get('destination');
    const departure_date = searchParamsHook.get('departure_date');
    const direction      = searchParamsHook.get('direction') || 'OW';

    if (origin && destination && departure_date) {
      const params: any = {
        origin, destination, departure_date,
        return_date: searchParamsHook.get('return_date') || undefined,
        adult:       searchParamsHook.get('adult')       || 1,
        child:       searchParamsHook.get('child')       || 0,
        infant:      searchParamsHook.get('infant')      || 0,
        cabin_class: searchParamsHook.get('cabin_class') || 'Y',
        direction,
      };
      // Multi-kota: decode routes dari query
      const routesRaw = searchParamsHook.get('routes');
      if (direction === 'Multi' && routesRaw) {
        try { params.routes = JSON.parse(routesRaw); } catch {}
      }
      handleSearch(params);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── handleSearch: search semua provider secara paralel ──
  const handleSearch = async (params: any) => {
    setLoading(true);
    setError('');
    setScheduleResults([]);
    setCurrentLegStep(0);
    setSelectedLegs(new Array(params.direction === 'RT' ? 2 : params.direction === 'Multi' ? (params.routes?.length || 2) : 1).fill(null));
    setFilterAirlines([]);
    setFilterTransit([]);
    setFilterMaxPrice(null);
    setFilterDepartureTime([]);
    setSearchMeta(params);

    // Ambil providers yang akan dicari
    const providers = FLIGHT_PROVIDERS.map(p => p.id);
    setSearchedProviders(providers);
    setProvidersTotal(providers.length);
    setProvidersDone(0);

    // Akumulasi per-schedule index
    // scheduleMap: { [scheduleIndex]: journey[] }
    const scheduleMap: Map<number, any[]> = new Map();

    const searchOne = async (provider: string) => {
      try {
        const res = await fetch('/api/flight/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, provider }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) return;

        const perSchedule = parseSchedules(data.data);
        // Merge ke scheduleMap
        perSchedule.forEach((journeys, idx) => {
          const existing = scheduleMap.get(idx) || [];
          // Deduplicate by journey_code + segment_code
          const newJourneys = journeys.filter(j => {
            const key = j.journey_code || (j.segments?.[0]?.segment_code);
            return !existing.some(e => (e.journey_code || e.segments?.[0]?.segment_code) === key);
          });
          scheduleMap.set(idx, [...existing, ...newJourneys]);
        });

        // Update state secara streaming (tampilkan hasil yang sudah ada)
        const merged: any[][] = [];
        const maxIdx = Math.max(...Array.from(scheduleMap.keys()), 0);
        for (let i = 0; i <= maxIdx; i++) {
          merged.push(scheduleMap.get(i) || []);
        }
        setScheduleResults([...merged]);
      } catch {
        // Provider gagal — lanjut tanpa error ke user
      } finally {
        setProvidersDone(d => d + 1);
      }
    };

    // Jalankan semua providers paralel
    await Promise.all(providers.map(p => searchOne(p)));

    setLoading(false);
    setProvidersDone(providers.length);

    // Cek apakah ada hasil sama sekali
    const total = Array.from(scheduleMap.values()).reduce((s, a) => s + a.length, 0);
    if (total === 0) {
      setError('Tidak ada penerbangan ditemukan untuk rute ini. Coba ubah tanggal atau rute.');
    }
  };

  // ── Airline list dari current leg ──
  const airlineList = useMemo(() => {
    const map = new Map<string, { name: string; code: string; count: number }>();
    currentJourneys.forEach(j => {
      const seg  = j.segments?.[0];
      const code = seg?.carrier_code || '';
      const name = seg?.carrier_name || code;
      if (!code) return;
      const ex = map.get(code);
      if (ex) ex.count++;
      else map.set(code, { name: name.split(' ')[0], code, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [currentJourneys]);

  // ── Price range ──
  const priceRange = useMemo(() => {
    if (!currentJourneys.length) return { min: 0, max: 0 };
    let min = Infinity, max = 0;
    currentJourneys.forEach(j => {
      const fare    = j.segments?.[0]?.fares?.[0];
      const summary = fare?.service_charge_summary?.[0];
      const price   = ((summary?.base_fare || 0) + (summary?.base_tax || 0));
      if (price > 0) { min = Math.min(min, price); max = Math.max(max, price); }
    });
    return { min: min === Infinity ? 0 : min, max };
  }, [currentJourneys]);

  // ── Filter + Sort ──
  const filtered = useMemo(() => {
    let arr = [...currentJourneys];

    if (filterTransit.length > 0) {
      arr = arr.filter(j => {
        const n = j.segments?.length || 1;
        if (filterTransit.includes('direct') && n === 1) return true;
        if (filterTransit.includes('transit') && n > 1) return true;
        return false;
      });
    }
    if (filterAirlines.length > 0) {
      arr = arr.filter(j => filterAirlines.includes(j.segments?.[0]?.carrier_code || ''));
    }
    if (filterMaxPrice !== null) {
      arr = arr.filter(j => {
        const fare    = j.segments?.[0]?.fares?.[0];
        const summary = fare?.service_charge_summary?.[0];
        const price   = (summary?.base_fare || 0) + (summary?.base_tax || 0);
        return price <= filterMaxPrice;
      });
    }
    if (filterDepartureTime.length > 0) {
      arr = arr.filter(j => {
        const dep  = j.segments?.[0]?.departure_date || '';
        const hour = parseInt(dep.substring(11, 13) || '0');
        if (filterDepartureTime.includes('morning')   && hour >= 0  && hour < 12) return true;
        if (filterDepartureTime.includes('afternoon') && hour >= 12 && hour < 17) return true;
        if (filterDepartureTime.includes('evening')   && hour >= 17)              return true;
        return false;
      });
    }

    arr.sort((a, b) => {
      const fa = a.segments?.[0]?.fares?.[0]?.service_charge_summary?.[0];
      const fb = b.segments?.[0]?.fares?.[0]?.service_charge_summary?.[0];
      const pA = (fa?.base_fare || 0) + (fa?.base_tax || 0);
      const pB = (fb?.base_fare || 0) + (fb?.base_tax || 0);
      const tA = new Date(a.segments?.[0]?.departure_date || 0).getTime();
      const tB = new Date(b.segments?.[0]?.departure_date || 0).getTime();
      if (sortBy === 'price_asc')  return pA - pB;
      if (sortBy === 'price_desc') return pB - pA;
      if (sortBy === 'earliest')   return tA - tB;
      if (sortBy === 'latest')     return tB - tA;
      return 0;
    });

    return arr;
  }, [currentJourneys, sortBy, filterTransit, filterAirlines, filterMaxPrice, filterDepartureTime]);

  // ── Pilih flight ──
  const handleSelectFlight = useCallback(async (journey: any, fare: any) => {
    const newLegs = [...selectedLegs];
    newLegs[currentLegStep] = { journey, fare };
    setSelectedLegs(newLegs);
    // Selalu buka review panel — di dalam panel user bisa lanjut ke leg berikutnya
    setIsReviewOpen(true);
  }, [currentLegStep, selectedLegs]);

  // ── Konfirmasi review → price → checkout ──
  const handleConfirmReview = async () => {
    // Cek apakah semua leg sudah dipilih
    const allSelected = selectedLegs.every((l: any) => !!l);

    if (!allSelected) {
      // Temukan leg berikutnya yang belum dipilih
      const nextStep = selectedLegs.findIndex((l: any) => !l);
      if (nextStep >= 0) {
        // Tutup panel & pindah ke step berikutnya
        setIsReviewOpen(false);
        setCurrentLegStep(nextStep);
        setFilterAirlines([]);
        setFilterTransit([]);
        setFilterDepartureTime([]);
        // Scroll ke atas daftar penerbangan
        window.scrollTo({ top: 300, behavior: 'smooth' });
        return;
      }
    }

    // Semua leg sudah dipilih → lanjut ke price & checkout
    setReviewLoading(true);
    try {
      // Bangun schedules sesuai format Orbis
      const formattedSchedules = selectedLegs.map((leg, idx) => {
        if (!leg) return null;
        const { journey, fare } = leg;
        return {
          provider: journey.provider || journey.schedule_provider || searchMeta?.provider || 'citilink',
          sequence: journey.schedule_sequence || idx + 1,
          journeys: [{
            segments: (journey.segments || []).map((seg: any) => ({
              segment_code: seg.segment_code,
              fare_code:    fare?.fare_code || seg.fares?.[0]?.fare_code || '',
            }))
          }]
        };
      }).filter(Boolean);

      const isRT    = searchMeta?.direction === 'RT';
      const isMulti = searchMeta?.direction === 'Multi';

      const priceBody: any = {
        provider:       formattedSchedules[0]?.provider || 'citilink',
        adult:          parseInt(searchMeta?.adult  || '1'),
        child:          parseInt(searchMeta?.child  || '0'),
        infant:         parseInt(searchMeta?.infant || '0'),
        cabin_class:    searchMeta?.cabin_class || 'Y',
        is_combo_price: isRT || isMulti,
        schedules:      formattedSchedules,
      };

      const priceRes  = await fetch('/api/flight/price', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(priceBody),
      });
      const priceData = await priceRes.json();

      // Outbound display info
      const outLeg    = selectedLegs[0];
      const outSeg    = outLeg?.journey?.segments?.[0];
      const lastSeg   = outLeg?.journey?.segments?.[outLeg?.journey?.segments?.length - 1];

      // Untuk RT/Multi: kumpulkan semua leg info
      const allLegsDisplay = selectedLegs.map((leg, i) => {
        if (!leg) return null;
        const s = leg.journey?.segments?.[0];
        const l = leg.journey?.segments?.[leg.journey?.segments?.length - 1];
        return {
          legIndex:    i,
          carrier:     s?.carrier_name,
          origin:      s?.origin || leg.journey?.origin,
          destination: l?.destination || leg.journey?.destination,
          departure:   s?.departure_date,
          arrival:     l?.arrival_date,
          flight_num:  `${s?.carrier_code}${s?.carrier_number}`,
          elapsed:     leg.journey?.elapsed_time,
        };
      });

      const flightPricedData = {
        display: {
          carrier:     outSeg?.carrier_name,
          origin:      outSeg?.origin || outLeg?.journey?.origin,
          destination: lastSeg?.destination || outLeg?.journey?.destination,
          departure:   outSeg?.departure_date,
          arrival:     lastSeg?.arrival_date,
          flight_num:  `${outSeg?.carrier_code}${outSeg?.carrier_number}`,
          elapsed:     outLeg?.journey?.elapsed_time,
        },
        allLegsDisplay,
        priceResponse: priceData.data,
        priceBody,
        searchMeta,
      };

      sessionStorage.setItem('flight_priced_data', JSON.stringify(flightPricedData));
      router.push('/flight/checkout');
    } catch (err: any) {
      // Fallback tanpa price validation
      const outLeg  = selectedLegs[0];
      const outSeg  = outLeg?.journey?.segments?.[0];
      const lastSeg = outLeg?.journey?.segments?.[outLeg?.journey?.segments?.length - 1];

      const formattedSchedulesFallback = selectedLegs.map((leg, idx) => {
        if (!leg) return null;
        const { journey, fare } = leg;
        return {
          provider: journey.provider || journey.schedule_provider || 'citilink',
          sequence: journey.schedule_sequence || idx + 1,
          journeys: [{ segments: [{ segment_code: journey.journey_code || journey.segments?.[0]?.segment_code, fare_code: fare?.fare_code }] }]
        };
      }).filter(Boolean);

      const allLegsDisplay = selectedLegs.map((leg, i) => {
        if (!leg) return null;
        const s = leg.journey?.segments?.[0];
        const l = leg.journey?.segments?.[leg.journey?.segments?.length - 1];
        return { legIndex: i, carrier: s?.carrier_name, origin: s?.origin, destination: l?.destination, departure: s?.departure_date, arrival: l?.arrival_date, flight_num: `${s?.carrier_code}${s?.carrier_number}` };
      });

      sessionStorage.setItem('flight_priced_data', JSON.stringify({
        display: { carrier: outSeg?.carrier_name, origin: outSeg?.origin, destination: lastSeg?.destination, departure: outSeg?.departure_date, arrival: lastSeg?.arrival_date, flight_num: `${outSeg?.carrier_code}${outSeg?.carrier_number}` },
        allLegsDisplay,
        priceResponse: null,
        priceBody: { provider: 'citilink', adult: parseInt(searchMeta?.adult || '1'), child: parseInt(searchMeta?.child || '0'), infant: parseInt(searchMeta?.infant || '0'), schedules: formattedSchedulesFallback, is_combo_price: searchMeta?.direction !== 'OW' },
        searchMeta,
      }));
      router.push('/flight/checkout');
    } finally {
      setReviewLoading(false);
    }
  };

  const isRT    = searchMeta?.direction === 'RT';
  const isMulti = searchMeta?.direction === 'Multi';

  const toggleFilter = (arr: string[], val: string, setArr: (a: string[]) => void) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  // Label step saat ini
  const stepLabel = useMemo(() => {
    if (!isRT && !isMulti) return null;
    if (isRT) return currentLegStep === 0 ? '✈️ Pilih Penerbangan Pergi' : '✈️ Pilih Penerbangan Pulang';
    const routes = searchMeta?.routes || [];
    const r = routes[currentLegStep];
    return r ? `✈️ Pilih Penerbangan ${r.origin} → ${r.destination} (Kota ${currentLegStep + 1})` : `Kota ${currentLegStep + 1}`;
  }, [isRT, isMulti, currentLegStep, searchMeta]);

  const isSearching = loading || providersDone < providersTotal;

  return (
    <div className="bg-[#f4f6fb] min-h-screen pt-20">

      {/* ─── Route Banner ──────────────────────────────────────────────────── */}
      <div className="bg-blue-800 text-white">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-sm font-black">
              {isMulti
                ? 'Multi-Kota'
                : `${searchMeta.origin || 'CGK'} → ${searchMeta.destination || 'DPS'}`}
            </div>
            {!isMulti && (
              <>
                <span className="text-blue-300">·</span>
                <span className="text-sm text-blue-100">{searchMeta.departure_date}</span>
                {isRT && searchMeta.return_date && (
                  <><span className="text-blue-300">→</span><span className="text-sm text-blue-100">{searchMeta.return_date}</span></>
                )}
                <span className="text-blue-300">·</span>
                <span className="text-sm text-blue-100">
                  {searchMeta.adult || 1} Penumpang · {isRT ? 'Pulang Pergi' : 'Sekali Jalan'}
                </span>
              </>
            )}
          </div>
          {!isMulti && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {[-2, -1, 0, 1, 2].map(offset => {
                const d = new Date(searchMeta.departure_date || Date.now());
                d.setDate(d.getDate() + offset);
                const dateStr = d.toISOString().split('T')[0];
                return (
                  <button key={offset} onClick={() => handleSearch({ ...searchMeta, departure_date: dateStr })}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${offset === 0 ? 'bg-white text-blue-800' : 'bg-blue-700 text-blue-100 hover:bg-blue-600'}`}>
                    {d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5">
        {/* Compact search bar */}
        <div className="mb-5">
          <CompactSearchBar searchMeta={searchMeta} onSearch={handleSearch} loading={isSearching} />
        </div>

        {/* ─── Step indicator untuk RT & Multi ──────────────────────────── */}
        {(isRT || isMulti) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
            <div className="flex items-center gap-2 overflow-x-auto">
              {Array.from({ length: totalLegs }).map((_, i) => {
                const isActive  = i === currentLegStep;
                const isDone    = !!selectedLegs[i];
                const isLocked  = i > currentLegStep;
                const routes    = searchMeta?.routes || [];
                const legLabel  = isRT ? (i === 0 ? 'Pergi' : 'Pulang') : `Kota ${i + 1}`;
                const subLabel  = isRT
                  ? (i === 0 ? `${searchMeta.origin}→${searchMeta.destination}` : `${searchMeta.destination}→${searchMeta.origin}`)
                  : routes[i] ? `${routes[i].origin}→${routes[i].destination}` : '';
                return (
                  <div key={i} className="flex items-center gap-2 shrink-0">
                    {i > 0 && <i className="fa-solid fa-arrow-right text-slate-300 text-[10px]"></i>}
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${isActive ? 'bg-orange-50 border-2 border-orange-400' : isDone ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-slate-50 border-2 border-slate-200 opacity-50'}`}
                      onClick={() => { if (isDone || isActive) { setCurrentLegStep(i); setFilterAirlines([]); } }}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${isActive ? 'bg-orange-600 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <div>
                        <p className={`text-xs font-black ${isActive ? 'text-orange-700' : isDone ? 'text-emerald-700' : 'text-slate-500'}`}>{legLabel}</p>
                        {subLabel && <p className="text-[10px] text-slate-400">{subLabel}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {stepLabel && (
              <div className="mt-3 text-sm font-bold text-orange-700 bg-orange-50 rounded-xl px-3 py-2">
                {stepLabel}
              </div>
            )}
          </div>
        )}

        {/* Main layout */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* ─── Sidebar Filter ──────────────────────────────────────────── */}
          <div className="w-full lg:w-64 shrink-0 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-sliders text-orange-500 text-sm"></i>
                  <h3 className="font-black text-slate-800 text-sm">Filter</h3>
                </div>
                <button
                  onClick={() => { setFilterTransit([]); setFilterAirlines([]); setFilterMaxPrice(null); setFilterDepartureTime([]); setSortBy('price_asc'); }}
                  className="text-orange-600 text-xs font-bold hover:underline"
                >Reset</button>
              </div>

              <div className="p-4 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto">
                {/* Transit */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Jumlah Transit</h4>
                  <div className="space-y-1.5">
                    {[{ id: 'direct', label: 'Langsung' }, { id: 'transit', label: '1+ Transit' }].map(opt => (
                      <label key={opt.id} className="flex items-center gap-2.5 cursor-pointer group">
                        <input type="checkbox" checked={filterTransit.includes(opt.id)}
                          onChange={() => toggleFilter(filterTransit, opt.id, setFilterTransit)}
                          className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500" />
                        <span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-slate-100"></div>

                {/* Maskapai */}
                {airlineList.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Maskapai</h4>
                    <div className="space-y-1.5">
                      {airlineList.map(airline => (
                        <label key={airline.code} className="flex items-center justify-between gap-2.5 cursor-pointer group">
                          <div className="flex items-center gap-2.5">
                            <input type="checkbox" checked={filterAirlines.includes(airline.code)}
                              onChange={() => toggleFilter(filterAirlines, airline.code, setFilterAirlines)}
                              className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500" />
                            <span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium">{airline.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded">{airline.count}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="h-px bg-slate-100"></div>

                {/* Waktu */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Waktu Berangkat</h4>
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

                {/* Urutkan */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Urutkan</h4>
                  <div className="space-y-1.5">
                    {[
                      { id: 'price_asc',  label: 'Harga Termurah' },
                      { id: 'earliest',   label: 'Berangkat Paling Awal' },
                      { id: 'latest',     label: 'Berangkat Paling Akhir' },
                      { id: 'price_desc', label: 'Harga Tertinggi' },
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

          {/* ─── Results ─────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Progress bar saat search paralel */}
            {isSearching && providersDone < providersTotal && (
              <ProviderProgress
                providers={searchedProviders}
                done={providersDone}
                total={providersTotal}
              />
            )}

            {/* Summary */}
            {!isSearching && currentJourneys.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-600">
                  <span className="font-black text-slate-900">{filtered.length}</span> penerbangan ditemukan
                  {(isRT || isMulti) && <span className="ml-2 text-xs text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full">Leg {currentLegStep + 1}/{totalLegs}</span>}
                </p>
                <div className="flex gap-2">
                  {[{ id: 'price_asc', label: 'Termurah' }, { id: 'earliest', label: 'Paling Awal' }].map(s => (
                    <button key={s.id} onClick={() => setSortBy(s.id as any)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${sortBy === s.id ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isSearching && currentJourneys.length === 0 && <SkeletonLoader />}

            {/* Streaming results saat masih loading */}
            {isSearching && currentJourneys.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700 font-semibold flex items-center gap-2 mb-2">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
                Menampilkan {currentJourneys.length} hasil... masih mencari di {providersTotal - providersDone} maskapai lagi
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3">
                <i className="fa-solid fa-circle-exclamation text-red-500 mt-1"></i>
                <div>
                  <h3 className="font-bold text-red-800">Gagal Mencari Tiket</h3>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            )}

            {filtered.map((j, i) => (
              <FlightCard
                key={`flight-${currentLegStep}-${i}`}
                journey={j}
                onSelect={handleSelectFlight}
                adultCount={parseInt(searchMeta?.adult || '1')}
              />
            ))}

            {!isSearching && currentJourneys.length > 0 && filtered.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-plane-slash text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Tidak Ada Hasil Filter</h3>
                <p className="text-slate-500 text-sm">Coba ubah filter atau reset pilihan.</p>
                <button onClick={() => { setFilterTransit([]); setFilterAirlines([]); setFilterDepartureTime([]); }}
                  className="mt-4 px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm hover:bg-orange-700 transition-all">
                  Reset Filter
                </button>
              </div>
            )}

            {!isSearching && currentJourneys.length === 0 && !error && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-magnifying-glass text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Tidak Ada Penerbangan</h3>
                <p className="text-slate-500 text-sm">Coba pilih tanggal lain atau rute berbeda.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Review Panel ─────────────────────────────────────────────────── */}
      <ReviewPanel
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onConfirm={handleConfirmReview}
        selectedLegs={selectedLegs}
        searchMeta={searchMeta}
        loading={reviewLoading}
      />

      <style jsx global>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
      `}</style>
    </div>
  );
}

export default function FlightSearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-[#f4f6fb]">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    }>
      <FlightSearchContent />
    </Suspense>
  );
}
