'use client';
import { useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { registerLocale } from "react-datepicker";
import { id as localeId } from 'date-fns/locale';
registerLocale('id', localeId);
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

interface Props { 
  onSearch: (p: any) => void; 
  loading: boolean; 
  initialData?: any;
}

const POPULAR_DESTINATIONS = [
  { code: 'SG7355', label: 'Singapura, SG', city: 'Singapore' },
  { code: 'ID339', label: 'Jakarta, ID', city: 'Jakarta' },
  { code: 'ID8731', label: 'Bali, ID', city: 'Bali' },
  { code: 'ID8732', label: 'Surabaya, ID', city: 'Surabaya' },
  { code: 'MY5411', label: 'Kuala Lumpur, MY', city: 'Kuala Lumpur' },
  { code: 'TH3299', label: 'Bangkok, TH', city: 'Bangkok' },
  { code: 'ID8735', label: 'Yogyakarta, ID', city: 'Yogyakarta' },
  { code: 'ID8734', label: 'Bandung, ID', city: 'Bandung' },
];

/* ─── DESTINATION SELECTOR (AUTO-LOAD API ORBIS + RECENT SEARCH) ─── */
function DestinationInput({ label, value, onChange, icon }: { label: string; value: string; onChange: (v: string) => void; icon: string }) {
  const { language } = useLanguage();
  const tfh = i18n.searchForm[language].hotel;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [destinations, setDestinations] = useState<any[]>(POPULAR_DESTINATIONS);
  const [recent, setRecent] = useState<any[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. TETAP PERTAHANKAN: Ambil riwayat pencarian terakhir dari localStorage
    const saved = localStorage.getItem('mafia_recent_hotels');
    if (saved) setRecent(JSON.parse(saved));

    // 2. GANTI FETCH DENGAN DATA STATIS (DUMMY)
    const dummyDestinations = [
      { code: "SG7355", label: "Singapore", city: "Singapore" },
      { code: "2252", label: "Holiday Inn Atrium (Hotel)", city: "Singapore" },
      { code: "2254", label: "Grand Park City Hall (Hotel)", city: "Singapore" },
      { code: "ID001", label: "Jakarta", city: "Jakarta" },
      { code: "ID002", label: "Bali", city: "Bali" }
    ];

    // Masukkan data dummy ke dalam state destinasi
    setDestinations(dummyDestinations);
    
    // Matikan efek loading (jika ada)
    setLoadingDb(false);
  }, []);

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const handleSelect = (item: any) => {
    onChange(item.code);
    setOpen(false);
    setSearch('');
    const newRecent = [item, ...recent.filter(r => r.code !== item.code)].slice(0, 3);
    setRecent(newRecent);
    localStorage.setItem('mafia_recent_hotels', JSON.stringify(newRecent));
  };

  const selected = destinations.find(a => a.code === value) || POPULAR_DESTINATIONS.find(a => a.code === value);
  
  const filtered = destinations.filter(a => 
    a.city?.toLowerCase().includes(search.toLowerCase()) || 
    a.label?.toLowerCase().includes(search.toLowerCase()) ||
    a.code?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20); // Batasi render 20 hasil seperti di form pesawat

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
            {selected ? selected.label : (value || 'Pilih Destinasi')}
          </div>
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-full md:w-[380px] bg-slate-900 border border-white/10 shadow-2xl rounded-2xl z-[100] overflow-hidden animate-fade-in">
          <div className="p-3 bg-white/5 border-b border-white/5">
            <input 
              autoFocus value={search} onChange={e => setSearch(e.target.value)} 
              placeholder={tfh.searchPlaceholder} 
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
                  <div className="px-5 py-2 text-[10px] font-black text-white/50 uppercase tracking-widest">Destinasi Populer</div>
                  {POPULAR_DESTINATIONS.map(a => (
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
                  <div className="p-10 text-center text-white/30 text-xs font-bold">Destinasi tidak ditemukan.</div>
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
          {/* BANNER LOADING SEPERTI DI FLIGHT FORM */}
          {loadingDb && <div className="p-3 bg-orange-600 text-[10px] text-center font-black text-white uppercase animate-pulse">Sinkronisasi Database Global...</div>}
        </div>
      )}
    </div>
  );
}

export default function HotelSearchForm({ onSearch, loading, initialData }: Props) {
  const { language } = useLanguage();
  const tfh = i18n.searchForm[language].hotel;
  // Setup Default State
  const defaultDest = initialData?.destination_id || 'ID8730';
  const [destination, setDestination] = useState(defaultDest);
  const [formError, setFormError] = useState('');

  const [startDate, setStartDate] = useState<Date | null>(() => {
    if (initialData?.checkin_date) return new Date(initialData.checkin_date);
    return new Date();
  });
  const [endDate, setEndDate] = useState<Date | null>(() => {
    if (initialData?.checkout_date) return new Date(initialData.checkout_date);
    return new Date(Date.now() + 86400000); // Tomorrow
  });

  const [minDateTomorrow] = useState(() => new Date(Date.now() + 86400000));

  // Guest & Room State
  const [pax, setPax] = useState({ 
    room: parseInt(initialData?.room || '1'),
    adult: parseInt(initialData?.adult || '2'), 
    child: parseInt(initialData?.child || '0') 
  });
  
  // Array umur anak sesuai API doc
  const [childAges, setChildAges] = useState<number[]>(initialData?.child_ages || []);
  const [openPax, setOpenPax] = useState(false);
  const paxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (paxRef.current && !paxRef.current.contains(e.target as Node)) setOpenPax(false);
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const updateChildCount = (newCount: number) => {
    setPax(p => ({ ...p, child: newCount }));
    setChildAges(prev => {
      if (newCount > prev.length) return [...prev, ...Array(newCount - prev.length).fill(7)]; // default usia 7 tahun
      return prev.slice(0, newCount);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!destination) {
      setFormError('Silakan pilih destinasi terlebih dahulu.');
      return;
    }

    if (!startDate || !endDate) {
      setFormError('Silakan pilih tanggal check-in dan check-out.');
      return;
    }

    if (endDate <= startDate) {
      setFormError('Tanggal check-out harus setelah tanggal check-in.');
      return;
    }

    const payload = {
      checkin_date: startDate.toISOString().split('T')[0],
      checkout_date: endDate.toISOString().split('T')[0],
      destination_id: destination,
      adult: pax.adult,
      child: pax.child,
      child_ages: childAges,
      room: pax.room,
      nationality: initialData?.nationality || 'ID',
      q: POPULAR_DESTINATIONS.find(d => d.code === destination)?.label || ''
    };

    onSearch(payload);
  };

  const renderGuestDropdown = () => (
    <div className="relative flex-1 min-w-[240px]" ref={paxRef}>
      <div 
        onClick={() => setOpenPax(!openPax)}
        className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all h-full"
      >
        <span className="text-[9px] text-white/40 font-bold uppercase mb-0.5">{tfh.guests}</span>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-users text-orange-500 text-sm"></i>
            <div className="text-white font-black text-sm truncate">
              {pax.room} {tfh.room}, {pax.adult} {tfh.adult}{pax.child > 0 ? `, ${pax.child} ${tfh.child}` : ''}
            </div>
          </div>
          <i className={`fa-solid fa-chevron-down text-white/30 text-xs transition-transform ${openPax ? 'rotate-180' : ''}`}></i>
        </div>
      </div>

      {openPax && (
        <div className="absolute top-full left-0 mt-2 w-full lg:w-[320px] bg-slate-900 border border-white/10 shadow-2xl rounded-2xl z-[100] p-4 flex flex-col gap-4 animate-fade-in">
          
          {/* Room Control */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <i className={`fa-solid fa-door-closed text-white/50 text-xs`}></i>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm">{tfh.room}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 px-2 py-1 rounded-xl border border-white/5">
              <button type="button" onClick={() => setPax(p => ({ ...p, room: Math.max(1, p.room - 1) }))} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                <i className="fa-solid fa-minus text-xs"></i>
              </button>
              <span className="text-white font-black text-sm w-4 text-center">{pax.room}</span>
              <button type="button" onClick={() => setPax(p => ({ ...p, room: Math.min(5, p.room + 1) }))} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                <i className="fa-solid fa-plus text-xs"></i>
              </button>
            </div>
          </div>

          {/* Adult Control */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <i className={`fa-solid fa-user text-white/50 text-xs`}></i>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm">{tfh.adult}</span>
                <span className="text-[10px] text-white/40 font-medium">≥ 12 tahun</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 px-2 py-1 rounded-xl border border-white/5">
              <button type="button" onClick={() => setPax(p => ({ ...p, adult: Math.max(1, p.adult - 1) }))} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                <i className="fa-solid fa-minus text-xs"></i>
              </button>
              <span className="text-white font-black text-sm w-4 text-center">{pax.adult}</span>
              <button type="button" onClick={() => setPax(p => ({ ...p, adult: Math.min(10, p.adult + 1) }))} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                <i className="fa-solid fa-plus text-xs"></i>
              </button>
            </div>
          </div>

          {/* Child Control */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <i className={`fa-solid fa-child text-white/50 text-xs`}></i>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm">{tfh.child}</span>
                <span className="text-[10px] text-white/40 font-medium">0 - 11 tahun</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 px-2 py-1 rounded-xl border border-white/5">
              <button type="button" onClick={() => updateChildCount(Math.max(0, pax.child - 1))} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                <i className="fa-solid fa-minus text-xs"></i>
              </button>
              <span className="text-white font-black text-sm w-4 text-center">{pax.child}</span>
              <button type="button" onClick={() => updateChildCount(Math.min(4, pax.child + 1))} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                <i className="fa-solid fa-plus text-xs"></i>
              </button>
            </div>
          </div>

          {/* Child Ages Selectors */}
          {pax.child > 0 && (
            <div className="mt-2 pt-4 border-t border-white/10 flex flex-col gap-3">
              <span className="text-white/50 font-bold text-[10px] uppercase tracking-widest">Umur Anak</span>
              <div className="grid grid-cols-2 gap-2">
                {childAges.map((age, idx) => (
                  <select
                    key={idx}
                    value={age}
                    onChange={(e) => {
                      const newAges = [...childAges];
                      newAges[idx] = parseInt(e.target.value);
                      setChildAges(newAges);
                    }}
                    className="bg-slate-800 text-white font-bold text-xs p-2.5 rounded-xl border border-white/10 outline-none focus:border-orange-500 transition-colors"
                  >
                    {Array.from({length: 12}).map((_, i) => (
                      <option key={i} value={i}>{i} Tahun</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-fade-up">
      {/* ROW 1: DESTINATION (FULL WIDTH) */}
      <div className="flex flex-col md:flex-row gap-3 relative w-full">
        <DestinationInput label={tfh.destination} value={destination} onChange={setDestination} icon="fa-bed" />
      </div>

      {formError && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
          <i className="fa-solid fa-circle-exclamation mr-2" />{formError}
        </div>
      )}

      {/* ROW 2: TANGGAL, TAMU & BUTTON */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4 border-t border-white/10 pt-4">
        
        {/* CHECK-IN */}
        <div className="flex-1 min-w-[150px] px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all">
          <span className="text-[10px] text-white/50 font-bold uppercase mb-0.5">{tfh.checkin}</span>
          <div className="flex items-center gap-3">
            <i className="fa-regular fa-calendar text-orange-500 text-base"></i>
            <DatePicker 
              selected={startDate} 
              onChange={(d: Date | null) => {
                setStartDate(d);
                if (d && endDate && d >= endDate) {
                  setEndDate(new Date(d.getTime() + 86400000));
                }
              }}
              minDate={new Date()}
              className="bg-transparent text-white font-black outline-none w-full text-base cursor-pointer" 
              dateFormat="dd MMM yyyy" 
              placeholderText="Pilih tanggal" 
            />
          </div>
        </div>

        {/* CHECK-OUT */}
        <div className="flex-1 min-w-[150px] px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all">
          <span className="text-[10px] text-white/50 font-bold uppercase mb-0.5">{tfh.checkout}</span>
          <div className="flex items-center gap-3">
            <i className="fa-regular fa-calendar-check text-orange-500 text-base"></i>
            <DatePicker 
              selected={endDate} 
              onChange={(d: Date | null) => setEndDate(d)}
              minDate={startDate ? new Date(startDate.getTime() + 86400000) : minDateTomorrow}
              className="bg-transparent text-white font-black outline-none w-full text-base cursor-pointer" 
              dateFormat="dd MMM yyyy" 
              placeholderText="Pilih tanggal" 
            />
          </div>
        </div>

        {renderGuestDropdown()}

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-full lg:w-16 h-12 lg:h-full min-h-[64px] bg-orange-600 text-white rounded-2xl hover:bg-orange-700 shadow-md shadow-orange-600/20 transition-all flex items-center justify-center active:scale-95 disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <div className="flex items-center gap-2 lg:gap-0">
              <i className="fa-solid fa-magnifying-glass text-sm"></i>
              <span className="text-sm font-bold lg:hidden">{tfh.search}</span>
            </div>
          )}
        </button>
      </div>

    </form>
  );
}