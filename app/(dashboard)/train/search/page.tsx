'use client';

import { useState, useMemo, Suspense, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TrainSearchForm from '@/components/train/TrainSearchForm';
import TrainCard from '@/components/train/TrainCard';

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

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row gap-4 animate-pulse">
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
  const [collapsed, setCollapsed] = useState(true);
  
  if (collapsed) {
    const dirLabel = searchMeta?.direction === 'RT' ? 'Pulang Pergi' : 'Sekali Jalan';
    const origin = searchMeta?.journey_list?.[0]?.origin || searchMeta?.origin;
    const dest = searchMeta?.journey_list?.[0]?.destination || searchMeta?.destination;
    const date = searchMeta?.journey_list?.[0]?.departure_date || searchMeta?.depart;
    
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 cursor-pointer" onClick={() => setCollapsed(false)}>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-train text-orange-600"></i>
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm">{origin} → {dest}</p>
            <p className="text-xs text-slate-500">
              {date} · {dirLabel} · {searchMeta?.adult || 1} Dewasa
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
    <div className="bg-slate-900 rounded-2xl p-5 shadow-xl transition-all">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-white text-sm">Ubah Pencarian</h3>
        <button onClick={() => setCollapsed(true)} className="text-white/60 hover:text-white transition-colors">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>
      <TrainSearchForm onSearch={(p) => { onSearch(p); setCollapsed(true); }} loading={loading} initialData={formInitial} />
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function TrainSearchContent() {
  const searchParamsHook = useSearchParams();
  const router = useRouter();

  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
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

  // ── Filter & Sort States ──
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'earliest' | 'latest'>('price_asc');
  const [filterCabin, setFilterCabin] = useState<string[]>([]);
  const [filterDepartureTime, setFilterDepartureTime] = useState<string[]>([]);

  const handleSearch = async (formPayload: any) => {
    setLoading(true);
    setError('');
    setResults(null);
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
      setError(e.message);
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
    const price = summary?.base_price || summary?.base_fare || 0;
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
      total_amount: String(Math.round(price * parseInt(searchMeta?.adult || '1'))),
      adult: String(searchMeta.adult || '1'),
      infant: String(searchMeta.infant || '0'),
    }).toString();
    router.push(`/train/checkout?${q}`);
  }, [router, searchMeta]);

  // Extract Journeys (Flatten schedules array)
  const allJourneys = useMemo(() => {
    return results?.schedules?.flatMap((s: any) => s.journeys || []) || [];
  }, [results]);

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

  const toggleFilter = (arr: string[], val: string, setArr: (a: string[]) => void) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const isRT = searchMeta?.direction === 'RT';
  const outDate = searchMeta?.journey_list?.[0]?.departure_date || searchMeta?.depart;
  const inDate = searchMeta?.journey_list?.[1]?.departure_date || searchMeta?.return_date;

  return (
    <div className="bg-[#f4f6fb] min-h-screen pt-20">
      {/* ─── Route Banner ──────────────────────────────────────────────────── */}
      <div className="bg-orange-700 text-white">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-sm font-black uppercase">
              {searchMeta?.journey_list?.[0]?.origin || searchMeta.origin} → {searchMeta?.journey_list?.[0]?.destination || searchMeta.destination}
            </div>
            <span className="text-orange-300">·</span>
            <span className="text-sm text-orange-100">{fmtDate(outDate)}</span>
            {isRT && inDate && (
              <><span className="text-orange-300">→</span><span className="text-sm text-orange-100">{fmtDate(inDate)}</span></>
            )}
            <span className="text-orange-300">·</span>
            <span className="text-sm text-orange-100">
              {searchMeta.adult || 1} Dewasa · {isRT ? 'Pulang Pergi' : 'Sekali Jalan'}
            </span>
          </div>
          
          {/* Quick Date Navigator (Hanya aktif untuk Oneway agar mudah) */}
          {!isRT && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {[-2, -1, 0, 1, 2].map(offset => {
                const d = new Date(outDate || Date.now());
                d.setDate(d.getDate() + offset);
                const dateStr = d.toISOString().split('T')[0];
                return (
                  <button key={offset} onClick={() => {
                    const params = {...searchMeta};
                    if(params.journey_list) params.journey_list[0].departure_date = dateStr;
                    else params.depart = dateStr;
                    handleSearch(params);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${offset === 0 ? 'bg-white text-orange-800' : 'bg-orange-800 text-orange-100 hover:bg-orange-600'}`}>
                    {d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5">
        {/* ─── Compact Search Bar ──────────────────────────────────────────── */}
        <div className="mb-5">
          <CompactSearchBar searchMeta={searchMeta} onSearch={handleSearch} loading={loading} />
        </div>

        {/* ─── Main Layout ─────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* SIDEBAR FILTER */}
          <div className="w-full lg:w-64 shrink-0 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-sliders text-orange-500 text-sm"></i>
                  <h3 className="font-black text-slate-800 text-sm">Filter</h3>
                </div>
                <button
                  onClick={() => { setFilterCabin([]); setFilterDepartureTime([]); setSortBy('price_asc'); }}
                  className="text-orange-600 text-xs font-bold hover:underline"
                >Reset</button>
              </div>

              <div className="p-4 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto">
                {/* Waktu Berangkat */}
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

                {/* Kelas Kereta */}
                {cabinOptions.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Kelas Kereta</h4>
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
                  <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Urutkan</h4>
                  <div className="space-y-1.5">
                    {[
                      { id: 'price_asc',  label: 'Harga Termurah' },
                      { id: 'earliest',   label: 'Berangkat Paling Awal' },
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

          {/* MAIN RESULTS */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header Summary */}
            {!loading && allJourneys.length > 0 && (
              <div className="flex items-center justify-between bg-white px-5 py-3 border border-slate-200 rounded-2xl shadow-sm">
                <p className="text-sm font-semibold text-slate-600">
                  Menampilkan <span className="font-black text-slate-900">{filteredJourneys.length}</span> jadwal kereta KAI
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

            {loading && <SkeletonLoader />}

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                <i className="fa-solid fa-circle-exclamation text-red-500 mt-1"></i>
                <div>
                  <h3 className="font-bold text-red-800">Gagal Mencari Tiket Kereta</h3>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            )}

            {!loading && filteredJourneys.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                {filteredJourneys.map((j: any, i: number) => (
                  <TrainCard key={i} journey={j} onSelect={handleSelect} adultCount={parseInt(searchMeta?.adult || '1')} />
                ))}
              </div>
            )}

            {!loading && allJourneys.length > 0 && filteredJourneys.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-train text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Tidak Ada Hasil Filter</h3>
                <p className="text-slate-500 text-sm">Coba ubah filter atau reset pilihan.</p>
                <button onClick={() => { setFilterCabin([]); setFilterDepartureTime([]); setSortBy('price_asc'); }}
                  className="mt-4 px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm hover:bg-orange-700 transition-all">
                  Reset Filter
                </button>
              </div>
            )}

            {!loading && allJourneys.length === 0 && !error && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-magnifying-glass text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Tidak Ada Jadwal Kereta</h3>
                <p className="text-slate-500 text-sm">Coba pilih tanggal lain atau stasiun berbeda.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrainSearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-[#f4f6fb]">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    }>
      <TrainSearchContent />
    </Suspense>
  );
}