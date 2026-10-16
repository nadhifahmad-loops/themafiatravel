'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { id as dateFnsId } from 'date-fns/locale';
import { CalendarField, CalendarRangeField } from '@/components/common/CalendarField';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { i18n } from '@/lib/i18n';
import { type FormVariant, vField, vLabel, vValue, vPanel, vInput, vItem, vSub, vMuted, vCode, vDiv, vSection, vToggle, vToggleIdle, vStepper, vStepBtn, vIconCircle, vEmpty, vChevron, vFieldLabel, vBtnSearch } from '@/lib/formVariants';

interface Station { code: string; name: string; city: string; label: string; }
const POPULAR_STATIONS: Station[] = [
  { code: 'GMR', name: 'Gambir', city: 'Jakarta', label: 'Gambir (GMR)' },
  { code: 'PSE', name: 'Pasar Senen', city: 'Jakarta', label: 'Pasar Senen (PSE)' },
  { code: 'BD', name: 'Bandung', city: 'Bandung', label: 'Bandung (BD)' },
  { code: 'YK', name: 'Yogyakarta', city: 'Yogyakarta', label: 'Yogyakarta (YK)' },
  { code: 'SLO', name: 'Solo Balapan', city: 'Solo', label: 'Solo Balapan (SLO)' },
  { code: 'SMC', name: 'Semarang Poncol', city: 'Semarang', label: 'Semarang Poncol (SMC)' },
  { code: 'SGU', name: 'Surabaya Gubeng', city: 'Surabaya', label: 'Surabaya Gubeng (SGU)' },
  { code: 'ML', name: 'Malang', city: 'Malang', label: 'Malang (ML)' },
];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function FloatingPanel({ triggerRef, open, onClose, children, className, align = 'left', dropUp = false }: {
  triggerRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
  dropUp?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({
      top: dropUp ? r.top - 8 : r.bottom + 4,
      left: align === 'right' ? r.right : r.left,
      width: r.width,
    });
  }, [triggerRef, align, dropUp]);

  useEffect(() => {
    if (!open) return;
    calcPos();
    window.addEventListener('scroll', calcPos, true);
    window.addEventListener('resize', calcPos);
    return () => {
      window.removeEventListener('scroll', calcPos, true);
      window.removeEventListener('resize', calcPos);
    };
  }, [open, calcPos]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      data-floating-panel
      className={`fixed z-[9999] animate-fade-in shadow-2xl ${className || ''}`}
      style={{
        top: dropUp ? undefined : pos.top,
        bottom: dropUp ? `calc(100vh - ${pos.top}px)` : undefined,
        left: align === 'right' ? undefined : pos.left,
        right: align === 'right' ? `calc(100vw - ${pos.left}px)` : undefined,
        width: pos.width,
        maxWidth: 360,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

function StationInput({ label, value, onChange, stations, icon, variant = 'dark' }: { label: string; value: string; onChange: (v: string) => void; stations: Station[]; icon: string; variant?: FormVariant }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<Station[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { const s = localStorage.getItem('mafia_recent_stations'); if (s) setRecent(JSON.parse(s)); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      // Panel daftar stasiun di-portal ke document.body, sehingga klik di
      // dalamnya BUKAN bagian dari `ref`. Tanpa pengecualian ini, mousedown di
      // dalam panel dihitung "klik di luar" → panel menutup sebelum event
      // click sempat sampai ke item, dan stasiun tidak pernah bisa dipilih.
      // (Pola yang sama dengan FlightSearchForm.)
      if (ref.current && !ref.current.contains(t) && !(e.target as HTMLElement).closest?.('[data-floating-panel]')) setOpen(false);
    };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSelect = (item: Station) => {
    onChange(item.code); setOpen(false); setSearch('');
    const n = [item, ...recent.filter(r => r.code !== item.code)].slice(0, 3);
    setRecent(n); localStorage.setItem('mafia_recent_stations', JSON.stringify(n));
  };
  const selected = stations.find(s => s.code === value) || POPULAR_STATIONS.find(s => s.code === value);
  const filtered = stations.filter(s => s.city.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 20);

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      <div onClick={() => setOpen(true)} className={`group flex flex-col px-4 py-3 rounded-xl cursor-pointer transition-all h-full ${vField(variant)}`}>
        <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>{label}</span>
        <div className="flex items-center gap-1.5">
          <i className={`fa-solid ${icon} text-orange-500 text-[13px]`}></i>
          <div className={`text-[13px] font-medium truncate ${vValue(variant)}`}>{selected ? `${selected.city} (${selected.code})` : (value || 'Pilih')}</div>
        </div>
      </div>
      <FloatingPanel triggerRef={ref} open={open} onClose={() => setOpen(false)} className={`rounded-xl overflow-hidden ${vPanel(variant)}`}>
        <div className={`p-2.5 ${variant === 'light' ? 'border-b border-slate-100/60' : 'border-b border-white/5'}`}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kota atau stasiun..." className={`w-full rounded-lg px-3 py-2 outline-none ${vInput(variant)}`} />
        </div>
        <div className="max-h-[320px] overflow-y-auto scrollbar-hide">
          {search.length === 0 ? (
            <div className={`divide-y ${vDiv(variant)}`}>
              {recent.length > 0 && (
                <div className="py-1.5">
                  <div className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>Terakhir</div>
                  {recent.map(s => (
                    <div key={`rec-${s.code}`} onClick={() => handleSelect(s)} className={`px-4 py-2.5 cursor-pointer flex items-center gap-2.5 transition-colors ${vItem(variant)}`}>
                      <i className={`fa-solid fa-clock-rotate-left text-[11px] ${vMuted(variant)}`}></i>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-medium ${vValue(variant)}`}>{s.city}</div>
                        <div className={`text-[11px] ${vSub(variant)}`}>{s.name}</div>
                      </div>
                      <span className={`text-[10px] font-semibold ${vMuted(variant)}`}>{s.code}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="py-1.5">
                <div className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>Populer</div>
                {POPULAR_STATIONS.map(s => (
                  <div key={`pop-${s.code}`} onClick={() => handleSelect(s)} className={`px-4 py-2.5 cursor-pointer flex items-center gap-2.5 transition-colors ${vItem(variant)}`}>
                    <i className="fa-solid fa-star text-orange-400/60 text-[11px]"></i>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-medium ${vValue(variant)}`}>{s.name}</div>
                      <div className={`text-[11px] ${vSub(variant)}`}>{s.city}</div>
                    </div>
                    <span className={`text-[10px] font-semibold ${vMuted(variant)}`}>{s.code}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-1.5">
              {filtered.length === 0 ? (
                <div className={`p-8 text-center text-[13px] font-medium ${vEmpty(variant)}`}>Tidak ditemukan.</div>
              ) : filtered.map(s => (
                <div key={`res-${s.code}`} onClick={() => handleSelect(s)} className={`px-4 py-2.5 cursor-pointer flex justify-between items-center transition-colors ${vItem(variant)}`}>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className={`text-[13px] font-medium ${vValue(variant)}`}>{s.name}</div>
                    <div className={`text-[11px] ${vSub(variant)}`}>{s.city}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${vCode(variant)}`}>{s.code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </FloatingPanel>
    </div>
  );
}

export default function TrainSearchForm({ onSearch, loading, initialData, variant = 'dark' }: { onSearch: (p: any) => void; loading: boolean; initialData?: any; variant?: FormVariant }) {
  const { language } = useLanguage();
  const { nearestStation } = useLocation();
  const t = i18n.searchForm[language].train;
  const [tripType, setTripType] = useState(initialData?.direction || 'OW');
  const [stations, setStations] = useState<Station[]>(POPULAR_STATIONS);
  const [pax, setPax] = useState({ adult: parseInt(initialData?.adult || '1'), infant: parseInt(initialData?.infant || '0') });
  const [openPax, setOpenPax] = useState(false);
  const paxRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState(initialData?.origin || 'GMR');
  const [destination, setDestination] = useState(initialData?.destination || 'BD');
  const [swapRotation, setSwapRotation] = useState(0);
  const originTouched = useRef(false);

  useEffect(() => {
    if (originTouched.current || initialData?.origin) return;
    if (nearestStation?.code && origin !== nearestStation.code) setOrigin(nearestStation.code);
  }, [nearestStation?.code]);

  const [startDate, setStartDate] = useState<Date | null>(() => initialData?.departure_date ? parseLocalDate(initialData.departure_date) : new Date(Date.now()+86400000));
  const [endDate, setEndDate] = useState<Date | null>(() => initialData?.return_date ? parseLocalDate(initialData.return_date) : null);
  const minDateToday = useMemo(() => new Date(), []);

  useEffect(() => {
    fetch('/api/train/destinations').then(r => r.json()).then(d => {
      if (d.success && Array.isArray(d.data) && d.data.length > 0) setStations(d.data.map((s: any) => ({ ...s, label: s.label || `${s.name} (${s.code})` })));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      // Panel penumpang juga di-portal ke document.body — sama seperti
      // StationInput di atas, klik di dalamnya tidak boleh dihitung "klik di
      // luar"; tanpa itu tombol +/− tidak akan pernah bisa ditekan.
      if (paxRef.current && !paxRef.current.contains(t) && !(e.target as HTMLElement).closest?.('[data-floating-panel]')) setOpenPax(false);
    };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin === destination) { alert('Stasiun asal dan tujuan tidak boleh sama'); return; }
    const payload: any = { direction: tripType, adult: pax.adult, infant: pax.infant, provider: 'kai', journey_list: [{ origin, destination, departure_date: startDate ? formatLocalDate(startDate) : '' }] };
    if (tripType === 'RT' && endDate) payload.journey_list.push({ origin: destination, destination: origin, departure_date: formatLocalDate(endDate) });
    onSearch(payload);
  };

  const renderPaxDropdown = () => (
    <div className="relative flex-1 min-w-[140px] shrink-0" ref={paxRef}>
      <div onClick={() => setOpenPax(!openPax)} className={`px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all h-full ${vField(variant)}`}>
        <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vFieldLabel(variant)}`}>{t.passengers}</span>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <i className="fa-solid fa-users text-orange-500 text-[13px]"></i>
            <div className={`text-[13px] font-medium truncate ${vValue(variant)}`}>{pax.adult} {t.adult}, {pax.infant} {t.infant}</div>
          </div>
          <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openPax ? 'rotate-180' : ''} ${vChevron(variant)}`}></i>
        </div>
      </div>
      <FloatingPanel triggerRef={paxRef} open={openPax} onClose={() => setOpenPax(false)} align="right" className={`w-full lg:w-[280px] rounded-xl p-3 flex flex-col gap-3 ${vPanel(variant)}`}>
        {[{ k:'adult', l:t.adult, desc:'≥ 3 th', i:'fa-user' }, { k:'infant', l:t.infant, desc:'< 3 th', i:'fa-baby' }].map(({ k, l, desc, i }) => {
          const val = (pax as any)[k] as number;
          const isMin = k === 'adult' ? val <= 1 : val <= 0;
          const isMax = val >= 9;
          return (
          <div key={k} className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${vIconCircle(variant)}`}><i className={`fa-solid ${i} text-[11px]`}></i></div>
              <div className="flex flex-col">
                <span className={`text-[13px] font-medium ${vValue(variant)}`}>{l}</span>
                <span className={`text-[10px] ${vSub(variant)}`}>{desc}</span>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-1.5 py-0.5 rounded-lg ${vStepper(variant)}`}>
              <button type="button" disabled={isMin} onClick={() => setPax(p => ({...p,[k]:Math.max(k==='adult'?1:0,val-1)}))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${isMin ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}><i className="fa-solid fa-minus text-[10px]"></i></button>
              <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{val}</span>
              <button type="button" disabled={isMax} onClick={() => setPax(p => ({...p,[k]:val+1}))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${isMax ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}><i className="fa-solid fa-plus text-[10px]"></i></button>
            </div>
          </div>
          );
        })}
      </FloatingPanel>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 animate-fade-up">
      {/* Baris 1: Toggle */}
      <div className={`flex gap-1 p-1 rounded-lg w-fit ${vToggle(variant)}`}>
        {[{id:'OW',l:'Sekali Jalan'},{id:'RT',l:'Pulang Pergi'}].map(t => (
          <button key={t.id} type="button" onClick={() => setTripType(t.id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${tripType === t.id ? 'bg-orange-500 text-white shadow-md' : vToggleIdle(variant)}`}>{t.l}</button>
        ))}
      </div>

      {/* Baris 2: Semua field dalam 1 baris */}
      <div className="flex flex-col md:flex-row items-stretch gap-2 relative w-full">
        {/* From + Swap + To */}
        <div className="flex-1 flex items-stretch gap-2 relative min-w-0">
          <StationInput label={t.from} value={origin} onChange={(v) => { originTouched.current=true; setOrigin(v); }} stations={stations} icon="fa-train" variant={variant} />
          <button type="button" onClick={() => { originTouched.current=true; const tmp=origin; setOrigin(destination); setDestination(tmp); setSwapRotation(r => r + 180); }}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 text-orange-500 rounded-full z-10 flex items-center justify-center hover:scale-110 transition-all duration-300 ${variant === 'light' ? 'bg-white/90 border border-white/40 shadow-md' : 'bg-slate-900 border border-white/20 shadow-xl'}`}>
            <i className="fa-solid fa-right-left text-[10px]" style={{ transition: 'transform 0.3s ease', transform: `rotate(${swapRotation}deg)` }}></i>
          </button>
          <StationInput label={t.to} value={destination} onChange={setDestination} stations={stations} icon="fa-train" variant={variant} />
        </div>
        {tripType === 'RT' ? (
          <CalendarRangeField
            startDate={startDate}
            endDate={endDate}
            onChange={(r) => { setStartDate(r.from); setEndDate(r.to); }}
            minDate={minDateToday}
            defaultMonth={startDate ?? minDateToday}
          >
            <div className={`flex-1 min-w-[170px] px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all animate-fade-in ${vField(variant)}`}>
              <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>{t.departure} – Pulang</span>
              <div className="flex items-center gap-1.5">
                <i className="fa-regular fa-calendar text-orange-500 text-[13px]"></i>
                <div className={`font-medium text-[12px] truncate ${startDate ? vValue(variant) : vSub(variant)}`}>
                  {startDate
                    ? `${format(startDate, 'dd MMM', { locale: dateFnsId })}${endDate ? ` – ${format(endDate, 'dd MMM yyyy', { locale: dateFnsId })}` : ' – Pilih pulang'}`
                    : 'Pilih tanggal'}
                </div>
              </div>
            </div>
          </CalendarRangeField>
        ) : (
          <CalendarField
            value={startDate}
            onChange={setStartDate}
            minDate={minDateToday}
          >
            <div className={`flex-[0.7] min-w-[120px] px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all ${vField(variant)}`}>
              <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>{t.departure}</span>
              <div className="flex items-center gap-1.5">
                <i className="fa-regular fa-calendar text-orange-500 text-[13px]"></i>
                <div className={`font-medium text-[12px] truncate ${startDate ? vValue(variant) : vSub(variant)}`}>
                  {startDate ? format(startDate, 'dd MMM yyyy', { locale: dateFnsId }) : 'Pilih'}
                </div>
              </div>
            </div>
          </CalendarField>
        )}
        {renderPaxDropdown()}
        <button type="submit" disabled={loading} className={`shrink-0 w-full sm:w-full lg:w-12 h-12 lg:h-full min-h-[52px] flex items-center justify-center rounded-xl ${vBtnSearch(variant)}`}>
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> :
            <div className="flex items-center gap-2 lg:gap-0"><i className="fa-solid fa-magnifying-glass text-sm"></i><span className="text-sm font-semibold lg:hidden">{t.search}</span></div>}
        </button>
      </div>
    </form>
  );
}