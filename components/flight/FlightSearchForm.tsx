'use client';
import { useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { registerLocale } from "react-datepicker";
import { id as localeId } from 'date-fns/locale';
registerLocale('id', localeId);
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { loadAirportGeo, GeoAirport } from '@/lib/geo';
import { i18n } from '@/lib/i18n';

type Airport = {
  code: string;
  label: string;
  city: string;
};

type SearchRoute = {
  origin: string;
  destination: string;
  departure_date: string;
};

type CabinClassValue = 'Y' | 'W' | 'C' | 'F';

type SearchPayload = {
  direction: 'OW' | 'RT' | 'Multi';
  cabin_class: CabinClassValue;
  adult: number;
  child: number;
  infant: number;
  origin?: string;
  destination?: string;
  departure_date?: string;
  return_date?: string;
  routes?: SearchRoute[];
};

interface FlightSearchFormProps {
  onSearch: (payload: SearchPayload) => void;
  loading: boolean;
  initialData?: Partial<SearchPayload> & { routes?: SearchRoute[] };
}

type PaxKey = 'adult' | 'child' | 'infant';

type Leg = {
  origin: string;
  destination: string;
  date: Date;
};

declare global {
  interface Window {
    mafiaAirports?: Airport[];
  }
}

const POPULAR_AIRPORTS: Airport[] = [
  { code: 'CGK', label: 'Soekarno-Hatta (CGK)', city: 'Jakarta' },
  { code: 'DPS', label: 'Ngurah Rai (DPS)', city: 'Bali' },
  { code: 'SUB', label: 'Juanda (SUB)', city: 'Surabaya' },
  { code: 'SIN', label: 'Changi (SIN)', city: 'Singapore' },
  { code: 'KUL', label: 'Kuala Lumpur (KUL)', city: 'Kuala Lumpur' },
  { code: 'NRT', label: 'Narita (NRT)', city: 'Tokyo' },
];

const CABIN_CLASSES: { value: CabinClassValue; label: string }[] = [
  { value: 'Y', label: 'Ekonomi' },
  { value: 'W', label: 'Eko. Premium' },
  { value: 'C', label: 'Bisnis' },
  { value: 'F', label: 'First Class' },
];

/* ─── AIRPORT SELECTOR (AUTO-LOAD WORLDWIDE AIRPORTS + RECENT SEARCH) ─── */
function AirportInput({ label, value, onChange, icon, dropUp = false }: { label: string; value: string; onChange: (v: string) => void; icon: string; dropUp?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [airports, setAirports] = useState<Airport[]>(() => {
    if (typeof window === 'undefined') return POPULAR_AIRPORTS;
    return window.mafiaAirports ?? POPULAR_AIRPORTS;
  });
  const [recent, setRecent] = useState<Airport[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('mafia_recent_airports');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [loadingDb, setLoadingDb] = useState<boolean>(() => typeof window !== 'undefined' && !window.mafiaAirports);
  const [geoAirports, setGeoAirports] = useState<GeoAirport[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAirportGeo().then(setGeoAirports);
  }, []);

  useEffect(() => {
    const win = window as Window;
    if (win.mafiaAirports) {
      return;
    }

    fetch('https://raw.githubusercontent.com/algolia/datasets/master/airports/airports.json')
      .then(res => res.json())
      .then((data: unknown) => {
        type RawAirport = { iata_code?: string; city?: string; country?: string; name?: string };
        const records = Array.isArray(data) ? data as RawAirport[] : [];
        const formatted = records
          .filter((a) => a.iata_code)
          .map((a) => ({
            code: a.iata_code as string,
            city: a.city || a.country || 'Unknown',
            label: `${a.name || 'Bandara'} (${a.iata_code})`
          }));
        win.mafiaAirports = formatted;
        setAirports(formatted);
      })
      .catch(() => {})
      .finally(() => setLoadingDb(false));
  }, []);

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const handleSelect = (item: Airport) => {
    onChange(item.code);
    setOpen(false);
    setSearch('');
    const newRecent = [item, ...recent.filter(r => r.code !== item.code)].slice(0, 3);
    setRecent(newRecent);
    localStorage.setItem('mafia_recent_airports', JSON.stringify(newRecent));
  };

  const selected = airports.find(a => a.code === value) || POPULAR_AIRPORTS.find(a => a.code === value) || geoAirports.find(a => a.code === value);
  const filtered = airports
    .filter(a =>
      a.city.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.label.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 20);

  const displayValue = selected
    ? 'city' in selected
      ? `${selected.city} (${selected.code})`
      : (selected.name || selected.code)
    : value;

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
            {displayValue || 'Pilih Bandara'}
          </div>
        </div>
      </div>

      {open && (
        <div className={`absolute left-0 w-full md:w-[380px] bg-slate-900 border border-white/10 shadow-2xl rounded-2xl z-[100] overflow-hidden animate-fade-in ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          <div className="p-3 bg-white/5 border-b border-white/5">
            <input 
              autoFocus value={search} onChange={e => setSearch(e.target.value)} 
              placeholder="Cari kota atau bandara..." 
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500 transition-all"
            />
          </div>
          
          <div className="max-h-[350px] overflow-y-auto scrollbar-hide">
            {search.length === 0 ? (
              <div className="divide-y divide-white/5">
                {recent.length > 0 && (
                  <div className="py-2">
                    <div className="px-5 py-2 text-[10px] font-black text-orange-500 uppercase tracking-widest">Pencarian Terakhir</div>
                    {recent.map(a => (
                      <div key={`rec-${a.code}`} onClick={() => handleSelect(a)} className="px-5 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 text-white transition-colors">
                        <i className="fa-solid fa-clock-rotate-left text-white/30 text-xs"></i>
                        <div className="flex-1">
                          <div className="font-bold text-sm">{a.city}</div>
                          <div className="text-[10px] text-white/40">{a.label}</div>
                        </div>
                        <span className="text-[10px] font-black text-white/30">{a.code}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="py-2">
                  <div className="px-5 py-2 text-[10px] font-black text-white/50 uppercase tracking-widest">Kota & Bandara Populer</div>
                  {POPULAR_AIRPORTS.map(a => (
                    <div key={`pop-${a.code}`} onClick={() => handleSelect(a)} className="px-5 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 text-white transition-colors">
                      <i className="fa-solid fa-star text-orange-500/50 text-xs"></i>
                      <div className="flex-1">
                        <div className="font-bold text-sm">{a.city}</div>
                        <div className="text-[10px] text-white/40">{a.label}</div>
                      </div>
                      <span className="text-[10px] font-black text-white/30">{a.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-2">
                {filtered.length === 0 ? (
                  <div className="p-10 text-center text-white/30 text-xs font-bold">Tidak ada hasil ditemukan.</div>
                ) : (
                  filtered.map(a => (
                    <div key={`res-${a.code}`} onClick={() => handleSelect(a)} className="px-5 py-3 hover:bg-orange-600/20 cursor-pointer flex justify-between items-center text-white transition-colors">
                      <div className="flex-1 pr-3">
                        <div className="font-bold text-sm">{a.city}</div>
                        <div className="text-[10px] text-white/50">{a.label}</div>
                      </div>
                      <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded text-orange-400">{a.code}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {loadingDb && <div className="p-3 bg-orange-600 text-[10px] text-center font-black text-white uppercase animate-pulse">Sinkronisasi Database Global...</div>}
        </div>
      )}
    </div>
  );
}

export default function FlightSearchForm({ onSearch, loading, initialData }: FlightSearchFormProps) {
  const { language } = useLanguage();
  const { nearestAirport } = useLocation();
  const tf = i18n.searchForm[language].flight;
  const initialDirection = (initialData?.direction as SearchPayload['direction']) ?? 'OW';
  const cabinLabel = (c: { value: CabinClassValue; label: string }) =>
    c.value === 'Y' ? tf.economy : c.value === 'C' ? tf.business : c.value === 'F' ? tf.first : c.label;
  const paxShort = {
    adult:  tf.adult.replace(/\s*\(.*\)/, '').trim(),
    child:  tf.child.replace(/\s*\(.*\)/, '').trim(),
    infant: tf.infant.replace(/\s*\(.*\)/, '').trim(),
  };
  const [tripType, setTripType] = useState<SearchPayload['direction']>(initialDirection);
  const [cabinClass, setCabinClass] = useState<CabinClassValue>(initialData?.cabin_class || 'Y');
  
  // Passenger State
  const [pax, setPax] = useState({ 
    adult: Number(initialData?.adult ?? 1), 
    child: Number(initialData?.child ?? 0), 
    infant: Number(initialData?.infant ?? 0),
  });
  const [openPax, setOpenPax] = useState(false);
  const paxRef = useRef<HTMLDivElement>(null);

  // Cabin Class Dropdown State
  const [openCabin, setOpenCabin] = useState(false);
  const cabinRef = useRef<HTMLDivElement>(null);

  const [origin, setOrigin] = useState(initialData?.origin || 'CGK');
  const [destination, setDestination] = useState(initialData?.destination || 'DPS');
  const originTouched = useRef(false);

  // Prefill asal dari GPS (hanya jika user belum memilih sendiri)
  useEffect(() => {
    if (originTouched.current) return;
    if (initialData?.origin) return;
    if (nearestAirport?.code && origin !== nearestAirport.code) setOrigin(nearestAirport.code);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearestAirport?.code]);
  
  // Date State
  const [startDate, setStartDate] = useState<Date | null>(() => {
    if (initialData?.departure_date) return new Date(initialData.departure_date);
    return new Date(new Date().setDate(new Date().getDate() + 1));
  });
  const [endDate, setEndDate] = useState<Date | null>(() => {
    if (initialData?.return_date) return new Date(initialData.return_date);
    return null;
  });

  const [tomorrow] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 1);
    return date;
  });

  const [legs, setLegs] = useState<Leg[]>(() => {
    if (initialData?.routes && Array.isArray(initialData.routes) && initialData.routes.length >= 2) {
      return initialData.routes.map(r => ({
        origin:      r.origin || 'CGK',
        destination: r.destination || 'DPS',
        date:        r.departure_date ? new Date(r.departure_date) : new Date(new Date().setDate(new Date().getDate() + 1)),
      }));
    }
    return [
      { origin: 'CGK', destination: 'DPS', date: new Date(new Date().setDate(new Date().getDate() + 1)) },
      { origin: 'DPS', destination: 'SIN', date: new Date(new Date().setDate(new Date().getDate() + 3)) },
    ];
  });

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (paxRef.current && !paxRef.current.contains(e.target as Node)) setOpenPax(false);
      if (cabinRef.current && !cabinRef.current.contains(e.target as Node)) setOpenCabin(false);
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const addLeg = () => {
    if (legs.length < 5) {
      const last = legs[legs.length - 1];
      setLegs(prev => [...prev, { origin: last.destination || '', destination: '', date: new Date(last.date.getTime() + 86400000) }]);
    }
  };

  const removeLeg = (idx: number) => {
    if (legs.length > 2) setLegs(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePaxChange = (key: PaxKey, delta: number) => {
    setPax(prev => {
      const minimum = key === 'adult' ? 1 : 0;
      return { ...prev, [key]: Math.max(minimum, prev[key] + delta) };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: SearchPayload = { direction: tripType, ...pax, cabin_class: cabinClass };
    if (tripType === 'Multi') {
      payload.routes = legs.map(l => ({ origin: l.origin, destination: l.destination, departure_date: l.date.toISOString().split('T')[0] }));
    } else {
      payload.origin = origin;
      payload.destination = destination;
      payload.departure_date = startDate?.toISOString().split('T')[0];
      if (tripType === 'RT' && endDate) payload.return_date = endDate.toISOString().split('T')[0];
    }
    onSearch(payload);
  };

  // Reusable Sub-components untuk efisiensi render
  const renderPassengerDropdown = () => (
    <div className="relative flex-1 min-w-[240px]" ref={paxRef}>
      <div 
        onClick={() => { setOpenPax(!openPax); setOpenCabin(false); }}
        className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all h-full"
      >
        <span className="text-[9px] text-white/40 font-bold uppercase mb-0.5">{tf.passengers}</span>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-users text-orange-500 text-sm"></i>
            <div className="text-white font-black text-sm truncate min-w-0">
              {pax.adult} {paxShort.adult}, {pax.child} {paxShort.child}, {pax.infant} {paxShort.infant}
            </div>
          </div>
          <i className={`fa-solid fa-chevron-down text-white/30 text-xs transition-transform ${openPax ? 'rotate-180' : ''}`}></i>
        </div>
      </div>

      {openPax && (
        <div className="absolute top-full left-0 mt-2 w-full lg:w-[320px] bg-slate-900 border border-white/10 shadow-2xl rounded-2xl z-[100] p-4 flex flex-col gap-4 animate-fade-in">
          {[ 
            { k: 'adult', l: tf.adult, desc: '≥ 12 tahun', i: 'fa-user' }, 
            { k: 'child', l: tf.child, desc: '2 - 11 tahun', i: 'fa-child' }, 
            { k: 'infant', l: tf.infant, desc: '< 2 tahun', i: 'fa-baby' } 
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
                <button type="button" title={`Kurangi ${l}`} onClick={() => handlePaxChange(k as PaxKey, -1)} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                  <i className="fa-solid fa-minus text-xs"></i>
                </button>
                <span className="text-white font-black text-sm w-4 text-center">{pax[k as PaxKey]}</span>
                <button type="button" title={`Tambah ${l}`} onClick={() => handlePaxChange(k as PaxKey, 1)} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                  <i className="fa-solid fa-plus text-xs"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCabinClass = () => (
    <div className="relative flex-1 lg:w-48 shrink-0 min-w-[160px]" ref={cabinRef}>
      <div 
        onClick={() => { setOpenCabin(!openCabin); setOpenPax(false); }}
        className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all h-full"
      >
        <span className="text-[9px] text-white/40 font-bold uppercase mb-0.5">{tf.class}</span>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-couch text-orange-500 text-sm"></i>
            <div className="text-white font-black text-sm">{cabinLabel(CABIN_CLASSES.find(c => c.value === cabinClass) || CABIN_CLASSES[0])}</div>
          </div>
          <i className={`fa-solid fa-chevron-down text-white/30 text-xs transition-transform ${openCabin ? 'rotate-180' : ''}`}></i>
        </div>
      </div>

      {openCabin && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[220px] bg-slate-900 border border-white/10 shadow-2xl rounded-2xl z-[100] py-2 flex flex-col animate-fade-in">
          {CABIN_CLASSES.map(c => {
            const isSelected = cabinClass === c.value;
            return (
              <div 
                key={c.value} 
                onClick={() => { setCabinClass(c.value); setOpenCabin(false); }}
                className={`px-5 py-3 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-orange-600/10' : 'hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/50'}`}>
                    <i className="fa-solid fa-couch text-xs"></i>
                  </div>
                  <span className={`font-bold text-sm ${isSelected ? 'text-orange-500' : 'text-white'}`}>{cabinLabel(c)}</span>
                </div>
                {isSelected && <i className="fa-solid fa-check text-orange-500 text-sm"></i>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderSubmitButton = () => (
    <button
      type="submit"
      disabled={loading}
      className="
        w-full sm:w-full lg:w-16
        h-12 lg:h-16
        bg-orange-600
        text-white
        rounded-2xl
        hover:bg-orange-700
        shadow-md shadow-orange-600/20
        transition-all
        flex items-center justify-center
        active:scale-95
        disabled:opacity-50
        shrink-0
      "
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <div className="flex items-center gap-2 lg:gap-0">
          <i className="fa-solid fa-magnifying-glass text-sm"></i>

          {/* Text hanya muncul di mobile */}
          <span className="text-sm font-bold lg:hidden">
            {tf.search}
          </span>
        </div>
      )}
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 animate-fade-up">
      {/* TRIP TYPE */}
      <div className="flex gap-1.5 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
        {([
          { id: 'OW', l: tf.oneWay },
          { id: 'RT', l: tf.roundTrip },
          { id: 'Multi', l: tf.multiCity },
        ] as Array<{ id: SearchPayload['direction']; l: string }>).map(t => (
          <button key={t.id} type="button" onClick={() => setTripType(t.id)}
            className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${tripType === t.id ? 'bg-orange-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >{t.l}</button>
        ))}
      </div>

      {/* SEARCH AREA */}
      {tripType === 'Multi' ? (
        <>
          <div className="space-y-3">
            {legs.map((leg, i) => (
              <div key={i} className="flex flex-col md:flex-row gap-3 items-stretch animate-fade-in relative">
                <AirportInput label={`${tf.from} (${i+1})`} value={leg.origin} onChange={(v) => { const n = [...legs]; n[i].origin = v; setLegs(n); }} icon="fa-plane-departure" dropUp />
                <AirportInput label={`${tf.to} (${i+1})`} value={leg.destination} onChange={(v) => { const n = [...legs]; n[i].destination = v; setLegs(n); }} icon="fa-plane-arrival" dropUp />
                <div className="flex-[0.6] min-w-[180px] px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all">
                  <span className="text-[10px] text-white/50 font-bold uppercase mb-0.5">{tf.departure}</span>
                  <div className="flex items-center gap-3">
                    <i className="fa-regular fa-calendar text-orange-500"></i>
                    <DatePicker selected={leg.date} onChange={(d: Date | null) => { const n = [...legs]; n[i].date = d as Date; setLegs(n); }}
                      minDate={tomorrow} className="bg-transparent text-white font-black outline-none w-full text-base cursor-pointer" dateFormat="dd MMM yyyy" />
                  </div>
                </div>
                {legs.length > 2 && <button type="button" aria-label={tf.removeFlight} title={tf.removeFlight} onClick={() => removeLeg(i)} className="px-3 text-red-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>}
              </div>
            ))}
            <button type="button" title={tf.addFlight} onClick={addLeg} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-orange-500 font-bold text-sm rounded-2xl flex items-center gap-2 transition-all"><i className="fa-solid fa-plus-circle"></i> {tf.addFlight}</button>
          </div>

          {/* BOTTOM ROW FOR MULTI CITY */}
          <div className="flex flex-col lg:flex-row items-stretch gap-4 border-t border-white/10 pt-5">
            {renderPassengerDropdown()}
            {renderCabinClass()}
            {renderSubmitButton()}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {/* ROW 2: ASAL & TUJUAN (FULL WIDTH) */}
          <div className="flex flex-col md:flex-row gap-3 relative w-full">
            <AirportInput label={tf.from} value={origin} onChange={(v) => { originTouched.current = true; setOrigin(v); }} icon="fa-plane-departure" />
            <button type="button" title={tf.swapBtn} onClick={() => { originTouched.current = true; const tmp = origin; setOrigin(destination); setDestination(tmp); }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-slate-900 border border-white/20 text-orange-500 rounded-full z-10 flex items-center justify-center hover:scale-110 active:rotate-180 transition-all shadow-xl"
            ><i className="fa-solid fa-right-left text-xs"></i></button>
            <AirportInput label={tf.to} value={destination} onChange={setDestination} icon="fa-plane-arrival" />
          </div>

          {/* ROW 3: TANGGAL, PENUMPANG & KABIN & BUTTON */}
          <div className="flex flex-col lg:flex-row items-stretch gap-4 border-t border-white/10 pt-4">
            
            {/* TANGGAL PERGI */}
            <div className="flex-1 min-w-[150px] px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all">
              <span className="text-[10px] text-white/50 font-bold uppercase mb-0.5">{tf.departure}</span>
              <div className="flex items-center gap-3">
                <i className="fa-regular fa-calendar text-orange-500 text-base"></i>
                <DatePicker selected={startDate} onChange={(d: Date | null) => setStartDate(d)}
                  minDate={tomorrow}
                  className="bg-transparent text-white font-black outline-none w-full text-base cursor-pointer" dateFormat="dd MMM yyyy" placeholderText="Pilih tanggal" />
              </div>
            </div>

            {/* TANGGAL PULANG (HANYA MUNCUL JIKA RT) */}
            {tripType === 'RT' && (
              <div className="flex-1 min-w-[150px] px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all animate-fade-in">
                <span className="text-[10px] text-white/50 font-bold uppercase mb-0.5">{tf.return}</span>
                <div className="flex items-center gap-3">
                  <i className="fa-regular fa-calendar-check text-orange-500 text-base"></i>
                  <DatePicker selected={endDate} onChange={(d: Date | null) => setEndDate(d)}
                    minDate={startDate || tomorrow}
                    className="bg-transparent text-white font-black outline-none w-full text-base cursor-pointer" dateFormat="dd MMM yyyy" placeholderText="Pilih tanggal" />
                </div>
              </div>
            )}

            {renderPassengerDropdown()}
            {renderCabinClass()}
            {renderSubmitButton()}
          </div>
        </div>
      )}

    </form>
  );
}