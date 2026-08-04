'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { registerLocale } from "react-datepicker";
import { id as localeId } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { i18n } from '@/lib/i18n';
registerLocale('id', localeId);

interface Station {
  code: string;
  name: string;
  city: string;
  label: string;
}

// Stasiun Populer & Fallback
const POPULAR_STATIONS: Station[] = [
  { code: 'GMR',  name: 'Gambir',                city: 'Jakarta',    label: 'Gambir (GMR)' },
  { code: 'PSE',  name: 'Pasar Senen',            city: 'Jakarta',    label: 'Pasar Senen (PSE)' },
  { code: 'BD',   name: 'Bandung',                city: 'Bandung',    label: 'Bandung (BD)' },
  { code: 'YK',   name: 'Yogyakarta',             city: 'Yogyakarta', label: 'Yogyakarta (YK)' },
  { code: 'SLO',  name: 'Solo Balapan',           city: 'Solo',       label: 'Solo Balapan (SLO)' },
  { code: 'SMC',  name: 'Semarang Poncol',        city: 'Semarang',   label: 'Semarang Poncol (SMC)' },
  { code: 'SGU',  name: 'Surabaya Gubeng',        city: 'Surabaya',   label: 'Surabaya Gubeng (SGU)' },
  { code: 'ML',   name: 'Malang',                 city: 'Malang',     label: 'Malang (ML)' },
];

/* ─── STATION SELECTOR (AUTO-LOAD API + RECENT SEARCH + POPULAR) ─── */
function StationInput({ label, value, onChange, stations, icon }: { label: string; value: string; onChange: (v: string) => void; stations: Station[]; icon: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<Station[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Load Pencarian Terakhir dari LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('mafia_recent_stations');
    if (saved) setRecent(JSON.parse(saved));
  }, []);

  // Handle click outside untuk menutup dropdown
  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const handleSelect = (item: Station) => {
    onChange(item.code);
    setOpen(false);
    setSearch('');
    
    // Simpan ke pencarian terakhir (Maksimal 3)
    const newRecent = [item, ...recent.filter(r => r.code !== item.code)].slice(0, 3);
    setRecent(newRecent);
    localStorage.setItem('mafia_recent_stations', JSON.stringify(newRecent));
  };

  const selected = stations.find(s => s.code === value) || POPULAR_STATIONS.find(s => s.code === value);
  const filtered = stations.filter(s => 
    s.city.toLowerCase().includes(search.toLowerCase()) || 
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  return (
    <div className="relative flex-1 w-full" ref={ref}>
      <div 
        onClick={() => setOpen(true)}
        className="group flex flex-col px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl cursor-pointer transition-all h-full"
      >
        <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-0.5">{label}</span>
        <div className="flex items-center gap-3">
          <i className={`fa-solid ${icon} text-orange-500 text-base`}></i>
          <div className="font-black text-white text-base truncate">
            {selected ? `${selected.city} (${selected.code})` : (value || 'Pilih Stasiun')}
          </div>
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-full md:w-[380px] bg-slate-900 border border-white/10 shadow-2xl rounded-2xl z-[100] overflow-hidden animate-fade-in">
          <div className="p-3 bg-white/5 border-b border-white/5">
            <input 
              autoFocus value={search} onChange={e => setSearch(e.target.value)} 
              placeholder="Cari kota atau stasiun..." 
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500 transition-all"
            />
          </div>
          
          <div className="max-h-[350px] overflow-y-auto scrollbar-hide">
            {search.length === 0 ? (
              <div className="divide-y divide-white/5">
                {/* Pencarian Terakhir */}
                {recent.length > 0 && (
                  <div className="py-2">
                    <div className="px-5 py-2 text-[10px] font-black text-orange-500 uppercase tracking-widest">Pencarian Terakhir</div>
                    {recent.map(s => (
                      <div key={`rec-${s.code}`} onClick={() => handleSelect(s)} className="px-5 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 text-white transition-colors">
                        <i className="fa-solid fa-clock-rotate-left text-white/30 text-xs"></i>
                        <div className="flex-1">
                          <div className="font-bold text-sm">{s.city}</div>
                          <div className="text-[10px] text-white/40">{s.name}</div>
                        </div>
                        <span className="text-[10px] font-black text-white/30">{s.code}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Stasiun Populer */}
                <div className="py-2">
                  <div className="px-5 py-2 text-[10px] font-black text-white/50 uppercase tracking-widest">Kota & Stasiun Populer</div>
                  {POPULAR_STATIONS.map(s => (
                    <div key={`pop-${s.code}`} onClick={() => handleSelect(s)} className="px-5 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 text-white transition-colors">
                      <i className="fa-solid fa-star text-orange-500/50 text-xs"></i>
                      <div className="flex-1">
                        <div className="font-bold text-sm">{s.city}</div>
                        <div className="text-[10px] text-white/40">{s.name}</div>
                      </div>
                      <span className="text-[10px] font-black text-white/30">{s.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Hasil Pencarian
              <div className="py-2">
                {filtered.length === 0 ? (
                  <div className="p-10 text-center text-white/30 text-xs font-bold">Stasiun tidak ditemukan.</div>
                ) : (
                  filtered.map(s => (
                    <div key={`res-${s.code}`} onClick={() => handleSelect(s)} className="px-5 py-3 hover:bg-orange-600/20 cursor-pointer flex justify-between items-center text-white transition-colors">
                      <div className="flex-1 pr-3">
                        <div className="font-bold text-sm">{s.name}</div>
                        <div className="text-[10px] text-white/50">{s.city}</div>
                      </div>
                      <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded text-orange-400">{s.code}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrainSearchForm({ onSearch, loading, initialData }: { onSearch: (p: any) => void; loading: boolean; initialData?: any; }) {
  const { language } = useLanguage();
  const { nearestStation } = useLocation();
  const t = i18n.searchForm[language].train;
  const [tripType, setTripType] = useState(initialData?.direction || 'OW');
  const [stations, setStations] = useState<Station[]>(POPULAR_STATIONS); // Pakai populer sebagai awalan
  
  // Penumpang Kereta KAI hanya Adult dan Infant
  const [pax, setPax] = useState({ 
    adult: parseInt(initialData?.adult || '1'), 
    infant: parseInt(initialData?.infant || '0') 
  });
  const [openPax, setOpenPax] = useState(false);
  const paxRef = useRef<HTMLDivElement>(null);

  const [origin, setOrigin] = useState(initialData?.origin || 'GMR');
  const [destination, setDestination] = useState(initialData?.destination || 'BD');
  const originTouched = useRef(false);

  // Prefill asal dari GPS (hanya jika user belum memilih sendiri)
  useEffect(() => {
    if (originTouched.current) return;
    if (initialData?.origin) return;
    if (nearestStation?.code && origin !== nearestStation.code) setOrigin(nearestStation.code);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearestStation?.code]);
  
  const [startDate, setStartDate] = useState<Date | null>(() => {
    if (initialData?.departure_date) return new Date(initialData.departure_date);
    return new Date(Date.now() + 86400000); // Default H+1
  });
  const [endDate, setEndDate] = useState<Date | null>(() => {
    if (initialData?.return_date) return new Date(initialData.return_date);
    return null;
  });

  const minDateToday = useMemo(() => new Date(), []);

  // Ambil Data Stasiun API
  useEffect(() => {
    fetch('/api/train/destinations')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data) && d.data.length > 0) {
          // Tambahkan label tambahan jika dari API belum ada
          const mapped = d.data.map((s: any) => ({
            ...s,
            label: s.label || `${s.name} (${s.code})`
          }));
          setStations(mapped);
        }
      })
      .catch((err) => {
        console.error("Gagal load stasiun API:", err);
      });
  }, []);

  // Handle klik di luar pax dropdown
  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (paxRef.current && !paxRef.current.contains(e.target as Node)) setOpenPax(false);
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin === destination) {
      alert('Stasiun asal dan tujuan tidak boleh sama');
      return;
    }

    // Payload KAI API Format
    const payload: any = { 
      direction: tripType, 
      adult: pax.adult, 
      infant: pax.infant,
      provider: 'kai',
      journey_list: [
        {
          origin: origin,
          destination: destination,
          departure_date: startDate?.toISOString().split('T')[0]
        }
      ]
    };

    if (tripType === 'RT' && endDate) {
      payload.journey_list.push({
        origin: destination,
        destination: origin,
        departure_date: endDate.toISOString().split('T')[0]
      });
    }

    onSearch(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 animate-fade-up">
      {/* TIPE PERJALANAN (KAI API hanya mendukung OW & RT) */}
      <div className="flex gap-1.5 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
        {[ {id:'OW', l:'Sekali Jalan'}, {id:'RT', l:'Pulang Pergi'} ].map(t => (
          <button key={t.id} type="button" onClick={() => setTripType(t.id)}
            className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${tripType === t.id ? 'bg-orange-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >{t.l}</button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {/* ROW ASAL & TUJUAN */}
        <div className="flex flex-col md:flex-row gap-3 relative w-full">
          <StationInput label={t.from} value={origin} onChange={(v) => { originTouched.current = true; setOrigin(v); }} stations={stations} icon="fa-train" />
          <button type="button" onClick={() => { originTouched.current = true; const tmp = origin; setOrigin(destination); setDestination(tmp); }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-slate-900 border border-white/20 text-orange-500 rounded-full z-10 flex items-center justify-center hover:scale-110 active:rotate-180 transition-all shadow-xl"
          ><i className="fa-solid fa-right-left text-xs"></i></button>
          <StationInput label={t.to} value={destination} onChange={setDestination} stations={stations} icon="fa-train" />
        </div>

        {/* ROW TANGGAL & PENUMPANG & TOMBOL */}
        <div className="flex flex-col lg:flex-row items-stretch gap-4 border-t border-white/10 pt-4">
          
          <div className="flex-1 min-w-[150px] px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all">
            <span className="text-[10px] text-white/50 font-bold uppercase mb-0.5">{t.departure}</span>
            <div className="flex items-center gap-3">
              <i className="fa-regular fa-calendar text-orange-500 text-base"></i>
              <DatePicker selected={startDate} onChange={(d: Date | null) => setStartDate(d)}
                minDate={minDateToday}
                className="bg-transparent text-white font-black outline-none w-full text-base cursor-pointer" dateFormat="dd MMM yyyy" placeholderText="Pilih tanggal" />
            </div>
          </div>

          {tripType === 'RT' && (
            <div className="flex-1 min-w-[150px] px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all animate-fade-in">
              <span className="text-[10px] text-white/50 font-bold uppercase mb-0.5">Tanggal Pulang</span>
              <div className="flex items-center gap-3">
                <i className="fa-regular fa-calendar-check text-orange-500 text-base"></i>
                <DatePicker selected={endDate} onChange={(d: Date | null) => setEndDate(d)}
                  minDate={startDate || minDateToday}
                  className="bg-transparent text-white font-black outline-none w-full text-base cursor-pointer" dateFormat="dd MMM yyyy" placeholderText="Pilih tanggal" />
              </div>
            </div>
          )}

          {/* DROP DOWN PENUMPANG */}
          <div className="relative flex-1 min-w-[200px]" ref={paxRef}>
            <div 
              onClick={() => setOpenPax(!openPax)}
              className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all h-full"
            >
              <span className="text-[9px] text-white/40 font-bold uppercase mb-0.5">{t.passengers}</span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-users text-orange-500 text-sm"></i>
                  <div className="text-white font-black text-sm truncate">
                    {pax.adult} {t.adult}, {pax.infant} {t.infant}
                  </div>
                </div>
                <i className={`fa-solid fa-chevron-down text-white/30 text-xs transition-transform ${openPax ? 'rotate-180' : ''}`}></i>
              </div>
            </div>

            {openPax && (
              <div className="absolute top-full left-0 mt-2 w-full lg:w-[320px] bg-slate-900 border border-white/10 shadow-2xl rounded-2xl z-[100] p-4 flex flex-col gap-4 animate-fade-in">
                {[ 
                  { k: 'adult', l: t.adult, desc: '≥ 3 tahun', i: 'fa-user' }, 
                  { k: 'infant', l: t.infant, desc: '< 3 tahun', i: 'fa-baby' } 
                ].map(({ k, l, desc, i }) => (
                  <div key={k} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                        <i className={`fa-solid ${i} text-white/50 text-xs`}></i>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-sm">{l}</span>
                        <span className="text-[10px] text-white/40 font-medium">{desc}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 px-2 py-1 rounded-xl border border-white/5">
                      <button type="button" onClick={() => setPax(p => ({ ...p, [k]: Math.max(k === 'adult' ? 1 : 0, (p as any)[k] - 1) }))} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                        <i className="fa-solid fa-minus text-xs"></i>
                      </button>
                      <span className="text-white font-black text-sm w-4 text-center">{(pax as any)[k]}</span>
                      <button type="button" onClick={() => setPax(p => ({ ...p, [k]: (p as any)[k] + 1 }))} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                        <i className="fa-solid fa-plus text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-full lg:w-16 h-12 lg:h-16 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 shadow-md shadow-orange-600/20 transition-all flex items-center justify-center active:scale-95 disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <div className="flex items-center gap-2 lg:gap-0">
                <i className="fa-solid fa-magnifying-glass text-sm"></i>
                <span className="text-sm font-bold lg:hidden">{t.search}</span>
              </div>
            )}
          </button>
        </div>
      </div>

    </form>
  );
}