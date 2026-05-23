'use client';
import { useState, useRef, useEffect } from 'react';

interface Props { 
  onSearch: (p: any) => void; 
  loading: boolean; 
  initialParams?: any; 
}

const POPULAR_DESTINATIONS = [
  { id: 'SG7355', label: 'Singapura, SG', city: 'Singapore' },
  { id: 'ID8730', label: 'Jakarta, ID', city: 'Jakarta' },
  { id: 'ID8731', label: 'Bali, ID', city: 'Bali' },
  { id: 'ID8732', label: 'Surabaya, ID', city: 'Surabaya' },
  { id: 'MY5411', label: 'Kuala Lumpur, MY', city: 'Kuala Lumpur' },
  { id: 'TH3299', label: 'Bangkok, TH', city: 'Bangkok' },
  { id: 'ID8735', label: 'Yogyakarta, ID', city: 'Yogyakarta' },
  { id: 'ID8734', label: 'Bandung, ID', city: 'Bandung' },
];

export default function HotelSearchForm({ onSearch, loading, initialParams }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Map destination ID ke Label supaya form tidak kosong jika hanya ID yang di-pass
  const defaultDest = initialParams?.destination_id 
    ? POPULAR_DESTINATIONS.find(d => d.id === initialParams.destination_id) 
    : null;

  const initialLabel = initialParams?.q || defaultDest?.label || 'Jakarta, ID';

  const [form, setForm] = useState({
    destination_id: initialParams?.destination_id || 'ID8730',
    destinationLabel: initialLabel,
    checkin_date: initialParams?.checkin_date || today,
    checkout_date: initialParams?.checkout_date || tomorrow,
    adult: parseInt(initialParams?.adult) || 2,
    child: parseInt(initialParams?.child) || 0,
    room: parseInt(initialParams?.room) || 1,
    nationality: initialParams?.nationality || 'ID',
  });

  // Sinkronisasi form jika initialParams berubah (misalnya ketika useEffect di page.tsx menyuntik data)
  useEffect(() => {
    if (initialParams) {
      const dest = POPULAR_DESTINATIONS.find(d => d.id === initialParams.destination_id);
      setForm(f => {
        const newLabel = initialParams.q || dest?.label || f.destinationLabel;
        setDestInput(newLabel);
        return {
          ...f,
          destination_id: initialParams.destination_id || f.destination_id,
          destinationLabel: newLabel,
          checkin_date: initialParams.checkin_date || f.checkin_date,
          checkout_date: initialParams.checkout_date || f.checkout_date,
          adult: parseInt(initialParams.adult) || f.adult,
          child: parseInt(initialParams.child) || f.child,
          room: parseInt(initialParams.room) || f.room,
        };
      });
    }
  }, [initialParams]);

  const [destInput, setDestInput] = useState(form.destinationLabel);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredDestinations = POPULAR_DESTINATIONS.filter(d => 
    d.label.toLowerCase().includes(destInput.toLowerCase()) || 
    d.city.toLowerCase().includes(destInput.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDestDropdown(false);
        setDestInput(form.destinationLabel);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [form.destinationLabel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = {
      destination_id: form.destination_id,
      checkin_date: form.checkin_date,
      checkout_date: form.checkout_date,
      adult: form.adult,
      child: form.child,
      room: form.room,
      nationality: form.nationality,
      child_ages: [],
      q: form.destinationLabel 
    };

    const existing = JSON.parse(localStorage.getItem('app_search_history') || '[]');
    const newEntry = {
      id: Date.now().toString(),
      type: 'hotel',
      title: `Hotel di ${form.destinationLabel.split(',')[0]}`,
      subtitle: `${form.checkin_date} · ${form.room} Kamar, ${form.adult} Tamu`,
      params: params
    };
    const filtered = existing.filter((e: any) => e.params?.destination_id !== params.destination_id).slice(0, 4);
    localStorage.setItem('app_search_history', JSON.stringify([newEntry, ...filtered]));

    onSearch(params);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 p-2 bg-white rounded-xl shadow-lg border border-slate-200 items-center w-full">
      
      {/* 1. Destinasi */}
      <div className="flex-1 px-4 py-2 md:border-r border-slate-200 flex items-center gap-3 w-full relative" ref={dropdownRef}>
        <i className="fa-solid fa-location-dot text-orange-600 text-lg"></i>
        <div className="flex flex-col w-full relative">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Destination</span>
          <input
            type="text"
            value={destInput}
            onChange={(e) => {
              setDestInput(e.target.value);
              setShowDestDropdown(true);
            }}
            onFocus={() => setShowDestDropdown(true)}
            className="border-none p-0 text-slate-900 font-bold text-sm bg-transparent outline-none focus:ring-0 w-full placeholder:text-slate-300"
            placeholder="Mau menginap di mana?"
          />
          
          {showDestDropdown && (
            <div className="absolute top-full left-0 mt-3 w-[250px] bg-white border border-slate-100 rounded-xl shadow-2xl z-50 overflow-hidden">
              {filteredDestinations.length > 0 ? (
                filteredDestinations.map(d => (
                  <div
                    key={d.id}
                    className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                    onClick={() => {
                      setForm(f => ({ ...f, destination_id: d.id, destinationLabel: d.label }));
                      setDestInput(d.label);
                      setShowDestDropdown(false);
                    }}
                  >
                    <div className="font-bold text-sm text-slate-800">{d.city}</div>
                    <div className="text-xs text-slate-500">{d.label}</div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-slate-500 italic">Destinasi tidak ditemukan</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Tanggal */}
      <div className="flex-[1.5] px-4 py-2 md:border-r border-slate-200 flex items-center gap-3 w-full">
        <i className="fa-solid fa-calendar-days text-orange-600 text-lg"></i>
        <div className="flex flex-col w-full">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Check-in / Check-out</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={form.checkin_date}
              min={today}
              onChange={e => setForm(f => ({ ...f, checkin_date: e.target.value }))}
              className="border-none p-0 text-slate-900 font-bold text-sm bg-transparent outline-none focus:ring-0 w-full cursor-pointer"
              required
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              value={form.checkout_date}
              min={form.checkin_date}
              onChange={e => setForm(f => ({ ...f, checkout_date: e.target.value }))}
              className="border-none p-0 text-slate-900 font-bold text-sm bg-transparent outline-none focus:ring-0 w-full cursor-pointer"
              required
            />
          </div>
        </div>
      </div>

      {/* 3. Tamu & Kamar */}
      <div className="flex-1 px-4 py-2 flex items-center gap-3 w-full">
        <i className="fa-solid fa-user-group text-orange-600 text-lg"></i>
        <div className="flex flex-col w-full">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Guests</span>
          <div className="flex items-center gap-2">
            <button type="button" className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-orange-100 hover:text-orange-600" onClick={() => setForm(f => ({ ...f, adult: Math.max(1, f.adult - 1) }))}>-</button>
            <span className="font-bold text-sm text-slate-900 whitespace-nowrap">{form.adult} Dewasa</span>
            <button type="button" className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-orange-100 hover:text-orange-600" onClick={() => setForm(f => ({ ...f, adult: Math.min(10, f.adult + 1) }))}>+</button>
          </div>
        </div>
      </div>

      {/* 4. Tombol Search */}
      <button
        type="submit"
        disabled={loading}
        className="w-full md:w-auto bg-orange-600 text-white font-bold px-8 py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-orange-700 transition-all shadow-md active:scale-95 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`}></i>
        {loading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}