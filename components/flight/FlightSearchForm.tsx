'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { id as dateFnsId } from 'date-fns/locale';
import { CalendarField, CalendarRangeField } from '@/components/common/CalendarField';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { loadAirportGeo, GeoAirport } from '@/lib/geo';
import { i18n } from '@/lib/i18n';
import { type FormVariant, vField, vLabel, vValue, vPanel, vInput, vItem, vItemBg, vSub, vMuted, vCode, vDiv, vSection, vToggle, vToggleIdle, vStepper, vStepBtn, vIconCircle, vRowBorder, vEmpty, vChevron, vFieldLabel, vBtnSearch, vFieldError } from '@/lib/formVariants';

type Airport = { code: string; label: string; city: string; };
type SearchRoute = { origin: string; destination: string; departure_date: string; };
type CabinClassValue = 'Y' | 'W' | 'C' | 'F';
type SearchPayload = {
  direction: 'OW' | 'RT' | 'Multi';
  cabin_class: CabinClassValue;
  adult: number; child: number; infant: number;
  origin?: string; destination?: string;
  departure_date?: string; return_date?: string;
  routes?: SearchRoute[];
};
interface FlightSearchFormProps {
  onSearch: (payload: SearchPayload) => void;
  loading: boolean;
  initialData?: Partial<SearchPayload> & { routes?: SearchRoute[] };
  variant?: FormVariant;
}
type PaxKey = 'adult' | 'child' | 'infant';
type Leg = { origin: string; destination: string; date: Date; };

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

declare global { interface Window { mafiaAirports?: Airport[]; } }

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

const POPULAR_AIRPORTS: Airport[] = [
  { code: 'CGK', label: 'Soekarno-Hatta (CGK)', city: 'Jakarta' },
  { code: 'DPS', label: 'Ngurah Rai (DPS)', city: 'Bali' },
  { code: 'SUB', label: 'Juanda (SUB)', city: 'Surabaya' },
  { code: 'SIN', label: 'Changi (SIN)', city: 'Singapore' },
  { code: 'KUL', label: 'Kuala Lumpur (KUL)', city: 'Kuala Lumpur' },
  { code: 'NRT', label: 'Narita (NRT)', city: 'Tokyo' },
];
const CABIN_CLASSES: { value: CabinClassValue; label: string }[] = [
  { value: 'Y', label: 'Ekonomi' }, { value: 'W', label: 'Eko. Premium' },
  { value: 'C', label: 'Bisnis' }, { value: 'F', label: 'First Class' },
];

function AirportInput({ label, value, onChange, icon, dropUp = false, variant = 'dark', error = false }: { label: string; value: string; onChange: (v: string) => void; icon: string; dropUp?: boolean; variant?: FormVariant; error?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [airports, setAirports] = useState<Airport[]>(() => typeof window === 'undefined' ? POPULAR_AIRPORTS : window.mafiaAirports ?? POPULAR_AIRPORTS);
  const [recent, setRecent] = useState<Airport[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const p = JSON.parse(localStorage.getItem('mafia_recent_airports') || '[]'); return Array.isArray(p) ? p : []; } catch { return []; }
  });
  const [loadingDb, setLoadingDb] = useState<boolean>(() => typeof window !== 'undefined' && !window.mafiaAirports);
  const [geoAirports, setGeoAirports] = useState<GeoAirport[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { loadAirportGeo().then(setGeoAirports); }, []);
  useEffect(() => {
    const win = window as Window;
    if (win.mafiaAirports) return;
    fetch('https://raw.githubusercontent.com/algolia/datasets/master/airports/airports.json')
      .then(r => r.json())
      .then((data: unknown) => {
        type Raw = { iata_code?: string; city?: string; country?: string; name?: string };
        const records = Array.isArray(data) ? data as Raw[] : [];
        const formatted = records.filter(a => a.iata_code).map(a => ({
          code: a.iata_code as string, city: a.city || a.country || 'Unknown',
          label: `${a.name || 'Bandara'} (${a.iata_code})`
        }));
        win.mafiaAirports = formatted; setAirports(formatted);
      }).catch(() => {}).finally(() => setLoadingDb(false));
  }, []);

  const handleSelect = (item: Airport) => {
    onChange(item.code); setOpen(false); setSearch('');
    const n = [item, ...recent.filter(r => r.code !== item.code)].slice(0, 3);
    setRecent(n); localStorage.setItem('mafia_recent_airports', JSON.stringify(n));
  };
  const selected = airports.find(a => a.code === value) || POPULAR_AIRPORTS.find(a => a.code === value) || geoAirports.find(a => a.code === value);
  const filtered = airports.filter(a => a.city.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase()) || a.label.toLowerCase().includes(search.toLowerCase())).slice(0, 20);
  const displayValue = selected ? ('city' in selected ? `${selected.city} (${selected.code})` : (selected.name || selected.code)) : value;

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      <div onClick={() => setOpen(true)} className={`group flex flex-col px-4 py-3 rounded-xl cursor-pointer transition-all h-full ${vField(variant)} ${error ? vFieldError(variant) : ''}`}>
        <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>{label}</span>
        <div className="flex items-center gap-1.5">
          <i className={`fa-solid ${icon} text-orange-500 text-[13px]`}></i>
          <div className={`text-[13px] font-medium truncate ${vValue(variant)}`}>{displayValue || 'Pilih'}</div>
        </div>
      </div>
      <FloatingPanel triggerRef={ref} open={open} onClose={() => setOpen(false)} dropUp={dropUp} className={`rounded-xl overflow-hidden ${vPanel(variant)}`}>
          <div className={`p-2.5 ${variant === 'light' ? 'border-b border-slate-100/60' : 'border-b border-white/5'}`}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kota atau bandara..." className={`w-full rounded-lg px-3 py-2 outline-none ${vInput(variant)}`} />
          </div>
          <div className="max-h-[320px] overflow-y-auto scrollbar-hide">
            {search.length === 0 ? (
              <div className={`divide-y ${vDiv(variant)}`}>
                {recent.length > 0 && (
                  <div className="py-1.5">
                    <div className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>Terakhir</div>
                    {recent.map(a => (
                      <div key={`rec-${a.code}`} onClick={() => handleSelect(a)} className={`px-4 py-2.5 cursor-pointer flex items-center gap-2.5 transition-colors ${vItem(variant)}`}>
                        <i className={`fa-solid fa-clock-rotate-left text-[11px] ${vMuted(variant)}`}></i>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[13px] font-medium ${vValue(variant)}`}>{a.city}</div>
                          <div className={`text-[11px] ${vSub(variant)}`}>{a.label}</div>
                        </div>
                        <span className={`text-[10px] font-semibold ${vMuted(variant)}`}>{a.code}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="py-1.5">
                  <div className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>Populer</div>
                  {POPULAR_AIRPORTS.map(a => (
                    <div key={`pop-${a.code}`} onClick={() => handleSelect(a)} className={`px-4 py-2.5 cursor-pointer flex items-center gap-2.5 transition-colors ${vItem(variant)}`}>
                      <i className="fa-solid fa-star text-orange-400/60 text-[11px]"></i>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-medium ${vValue(variant)}`}>{a.city}</div>
                        <div className={`text-[11px] ${vSub(variant)}`}>{a.label}</div>
                      </div>
                      <span className={`text-[10px] font-semibold ${vMuted(variant)}`}>{a.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-1.5">
                {filtered.length === 0 ? (
                  <div className={`p-8 text-center text-[13px] font-medium ${vEmpty(variant)}`}>Tidak ada hasil.</div>
                ) : filtered.map(a => (
                  <div key={`res-${a.code}`} onClick={() => handleSelect(a)} className={`px-4 py-2.5 cursor-pointer flex justify-between items-center transition-colors ${vItemBg(variant)}`}>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className={`text-[13px] font-medium ${vValue(variant)}`}>{a.city}</div>
                      <div className={`text-[11px] ${vSub(variant)}`}>{a.label}</div>
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${vCode(variant)}`}>{a.code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {loadingDb && <div className="p-2 bg-orange-500 text-[10px] text-center font-semibold text-white animate-pulse">Memuat database...</div>}
      </FloatingPanel>
    </div>
  );
}

export default function FlightSearchForm({ onSearch, loading, initialData, variant = 'dark' }: FlightSearchFormProps) {
  const { language } = useLanguage();
  const { nearestAirport } = useLocation();
  const tf = i18n.searchForm[language].flight;
  const initialDirection = (initialData?.direction as SearchPayload['direction']) ?? 'OW';
  const cabinLabel = (c: { value: CabinClassValue; label: string }) =>
    c.value === 'Y' ? tf.economy : c.value === 'C' ? tf.business : c.value === 'F' ? tf.first : c.label;
  const paxShort = { adult: tf.adult.replace(/\s*\(.*\)/, '').trim(), child: tf.child.replace(/\s*\(.*\)/, '').trim(), infant: tf.infant.replace(/\s*\(.*\)/, '').trim() };
  const [tripType, setTripType] = useState<SearchPayload['direction']>(initialDirection);
  const [cabinClass, setCabinClass] = useState<CabinClassValue>(initialData?.cabin_class || 'Y');
  const [pax, setPax] = useState({ adult: Number(initialData?.adult ?? 1), child: Number(initialData?.child ?? 0), infant: Number(initialData?.infant ?? 0) });
  const [openPax, setOpenPax] = useState(false);
  const paxRef = useRef<HTMLDivElement>(null);
  const [openCabin, setOpenCabin] = useState(false);
  const cabinRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState(initialData?.origin || 'CGK');
  const [destination, setDestination] = useState(initialData?.destination || 'DPS');
  const [swapRotation, setSwapRotation] = useState(0);
  const originTouched = useRef(false);

  useEffect(() => {
    if (originTouched.current || initialData?.origin) return;
    if (nearestAirport?.code && origin !== nearestAirport.code) setOrigin(nearestAirport.code);
  }, [nearestAirport?.code]);

  const [startDate, setStartDate] = useState<Date | null>(() => initialData?.departure_date ? parseLocalDate(initialData.departure_date) : new Date(new Date().setDate(new Date().getDate() + 1)));
  const [endDate, setEndDate] = useState<Date | null>(() => initialData?.return_date ? parseLocalDate(initialData.return_date) : null);
  const [tomorrow] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+1); return d; });
  const [legs, setLegs] = useState<Leg[]>(() => {
    if (initialData?.routes && initialData.routes.length >= 2) return initialData.routes.map(r => ({ origin: r.origin || 'CGK', destination: r.destination || 'DPS', date: r.departure_date ? parseLocalDate(r.departure_date) : new Date(new Date().setDate(new Date().getDate()+1)) }));
    return [{ origin: 'CGK', destination: 'DPS', date: new Date(new Date().setDate(new Date().getDate()+1)) }, { origin: 'DPS', destination: 'SIN', date: new Date(new Date().setDate(new Date().getDate()+3)) }];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); } }, [toast]);

  const clearError = (key: string) => setErrors(p => { const n = { ...p }; delete n[key]; return n; });

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (paxRef.current && !paxRef.current.contains(t) && !(e.target as HTMLElement).closest?.('[data-floating-panel]')) setOpenPax(false);
      if (cabinRef.current && !cabinRef.current.contains(t) && !(e.target as HTMLElement).closest?.('[data-floating-panel]')) setOpenCabin(false);
    };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const addLeg = () => { if (legs.length >= 5) { setToast(language === 'EN' ? 'Maximum 5 flights' : 'Maksimal 5 penerbangan'); return; } const l = legs[legs.length-1]; setLegs(p => [...p, { origin: l.destination || '', destination: '', date: new Date(l.date.getTime()+86400000) }]); };
  const removeLeg = (i: number) => { if (legs.length > 2) setLegs(p => p.filter((_,idx) => idx !== i)); };
  const handlePaxChange = (k: PaxKey, d: number) => setPax(p => ({ ...p, [k]: Math.max(k === 'adult' ? 1 : 0, p[k] + d) }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (tripType === 'Multi') {
      if (legs.length < 2) errs.minLegs = tf.errMinLegs;
      legs.forEach((leg, i) => {
        if (!leg.origin) errs[`origin_${i}`] = tf.errOrigin;
        if (!leg.destination) errs[`dest_${i}`] = tf.errDestination;
        if (leg.origin && leg.destination && leg.origin === leg.destination) errs[`same_${i}`] = tf.errSameAirport;
        if (!leg.date) errs[`date_${i}`] = tf.errDeparture;
      });
    } else {
      if (!origin) errs.origin = tf.errOrigin;
      if (!destination) errs.destination = tf.errDestination;
      if (origin && destination && origin === destination) errs.same = tf.errSameAirport;
      if (!startDate) errs.departure = tf.errDeparture;
      if (tripType === 'RT') {
        if (!endDate) errs.return = tf.errReturn;
        if (startDate && endDate && endDate <= startDate) errs.returnAfter = tf.errReturnAfter;
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setToast(Object.values(errs)[0]);
      return;
    }

    const payload: SearchPayload = { direction: tripType, ...pax, cabin_class: cabinClass };
    if (tripType === 'Multi') { payload.routes = legs.map(l => ({ origin: l.origin, destination: l.destination, departure_date: formatLocalDate(l.date) })); }
    else { payload.origin = origin; payload.destination = destination; payload.departure_date = startDate ? formatLocalDate(startDate) : undefined; if (tripType === 'RT' && endDate) payload.return_date = formatLocalDate(endDate); }
    onSearch(payload);
  };

  if (tripType === 'Multi') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 animate-fade-up">
        {/* Back to OW/RT toggle */}
        <div className="flex items-center gap-2 mb-1">
          <button type="button" onClick={() => { setTripType('OW'); setErrors({}); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${variant === 'light' ? 'bg-white/60 hover:bg-white/90 text-slate-600 border border-white/40' : 'bg-white/10 hover:bg-white/20 text-white/80 border border-white/10'}`}>
            <i className="fa-solid fa-arrow-left text-[10px]"></i> {tf.oneWay} / {tf.roundTrip}
          </button>
        </div>
        <div className="space-y-2">
          {legs.map((leg, i) => {
            const originErr = errors[`origin_${i}`] || errors[`same_${i}`];
            const destErr = errors[`dest_${i}`] || errors[`same_${i}`];
            const dateErr = errors[`date_${i}`];
            return (
            <div key={i} className="flex flex-col animate-fade-in">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[11px] font-bold text-brand-orange flex items-center gap-1">
                  <i className="fa-solid fa-route text-[10px]"></i>
                  Rute {i+1}
                </span>
                {legs.length > 2 && (
                  <button type="button" onClick={() => removeLeg(i)} className="px-2 py-1 text-red-400 hover:text-red-500 transition-colors text-[11px] flex items-center gap-1">
                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                    <span className="hidden sm:inline">{tf.removeFlight}</span>
                  </button>
                )}
              </div>
              <div className="flex items-stretch gap-2 relative">
                <AirportInput label={tf.from} value={leg.origin} onChange={(v) => { clearError(`origin_${i}`); clearError(`same_${i}`); const n=[...legs]; n[i].origin=v; setLegs(n); }} icon="fa-plane-departure" variant={variant} error={!!originErr} />
                <button type="button" onClick={() => { clearError(`origin_${i}`); clearError(`dest_${i}`); clearError(`same_${i}`); const n=[...legs]; const t=n[i].origin; n[i].origin=n[i].destination; n[i].destination=t; setLegs(n); }}
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 text-orange-500 rounded-full z-10 flex items-center justify-center hover:scale-110 transition-all duration-300 ${variant === 'light' ? 'bg-white/90 border border-white/40 shadow-md' : 'bg-slate-900 border border-white/20 shadow-xl'}`}>
                  <i className="fa-solid fa-right-left text-[10px]"></i>
                </button>
                <AirportInput label={tf.to} value={leg.destination} onChange={(v) => { clearError(`dest_${i}`); clearError(`same_${i}`); const n=[...legs]; n[i].destination=v; setLegs(n); }} icon="fa-plane-arrival" variant={variant} error={!!destErr} />
              </div>
              <CalendarField
                value={leg.date}
                onChange={(d) => { clearError(`date_${i}`); const n=[...legs]; n[i].date=(d ?? tomorrow) as Date; setLegs(n); }}
                minDate={tomorrow}
              >
                <div className={`mt-2 px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all ${vField(variant)} ${dateErr ? vFieldError(variant) : ''}`}>
                  <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>{tf.departure}</span>
                  <div className="flex items-center gap-1.5">
                    <i className="fa-regular fa-calendar text-orange-500 text-[13px]"></i>
                    <div className={`font-medium text-[12px] truncate ${vValue(variant)}`}>
                      {format(leg.date, 'dd MMM yyyy', { locale: dateFnsId })}
                    </div>
                  </div>
                </div>
              </CalendarField>
            </div>
            );
          })}
          <button type="button" onClick={addLeg} className={`px-4 py-2 border border-dashed font-medium text-[12px] rounded-lg flex items-center gap-2 transition-all ${variant === 'light' ? 'bg-white/60 hover:bg-orange-50 border-white/40 text-orange-600' : 'bg-white/5 hover:bg-white/10 border-white/20 text-orange-500'}`}><i className="fa-solid fa-plus-circle text-[11px]"></i> {tf.addFlight}</button>
        </div>
        <div className={`flex flex-col lg:flex-row items-stretch gap-2 pt-2 ${vRowBorder(variant)}`}>
          <div className="relative flex-1 min-w-[160px]" ref={paxRef}>
            <div onClick={() => { setOpenPax(!openPax); setOpenCabin(false); }} className={`px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all h-full ${vField(variant)}`}>
              <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vFieldLabel(variant)}`}>{tf.passengers}</span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-users text-orange-500 text-[13px]"></i>
                  <div className={`text-[13px] font-medium truncate min-w-0 ${vValue(variant)}`}>{pax.adult} {paxShort.adult}, {pax.child} {paxShort.child}, {pax.infant} {paxShort.infant}</div>
                </div>
                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openPax ? 'rotate-180' : ''} ${vChevron(variant)}`}></i>
              </div>
            </div>
            <FloatingPanel triggerRef={paxRef} open={openPax} onClose={() => setOpenPax(false)} className={`w-full lg:w-[280px] rounded-xl p-3 flex flex-col gap-3 ${vPanel(variant)}`}>
                {[
                  { k: 'adult', l: tf.adult, desc: '≥ 12 th', i: 'fa-user' },
                  { k: 'child', l: tf.child, desc: '2-11 th', i: 'fa-child' },
                  { k: 'infant', l: tf.infant, desc: '< 2 th', i: 'fa-baby' }
                ].map(({ k, l, desc, i }) => {
                  const val = pax[k as PaxKey];
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
                      <button type="button" disabled={isMin} onClick={() => handlePaxChange(k as PaxKey, -1)} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${isMin ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}><i className="fa-solid fa-minus text-[10px]"></i></button>
                      <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{val}</span>
                      <button type="button" disabled={isMax} onClick={() => handlePaxChange(k as PaxKey, 1)} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${isMax ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}><i className="fa-solid fa-plus text-[10px]"></i></button>
                    </div>
                  </div>
                  );
                })}
            </FloatingPanel>
          </div>
          <div className="relative flex-1 lg:w-40 shrink-0 min-w-[120px]" ref={cabinRef}>
            <div onClick={() => { setOpenCabin(!openCabin); setOpenPax(false); }} className={`px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all h-full ${vField(variant)}`}>
              <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vFieldLabel(variant)}`}>{tf.class}</span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-couch text-orange-500 text-[13px]"></i>
                  <div className={`text-[13px] font-medium ${vValue(variant)}`}>{cabinLabel(CABIN_CLASSES.find(c => c.value === cabinClass) || CABIN_CLASSES[0])}</div>
                </div>
                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openCabin ? 'rotate-180' : ''} ${vChevron(variant)}`}></i>
              </div>
            </div>
            <FloatingPanel triggerRef={cabinRef} open={openCabin} onClose={() => setOpenCabin(false)} className={`w-full min-w-[200px] rounded-xl py-1.5 flex flex-col ${vPanel(variant)}`}>
                {CABIN_CLASSES.map(c => {
                  const sel = cabinClass === c.value;
                  return (
                    <div key={c.value} onClick={() => { setCabinClass(c.value); setOpenCabin(false); }} className={`px-4 py-2.5 flex items-center gap-2.5 cursor-pointer transition-colors ${sel ? 'bg-orange-500/10' : vItem(variant)}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${sel ? 'bg-orange-500 text-white' : vIconCircle(variant)}`}><i className="fa-solid fa-couch text-[11px]"></i></div>
                      <span className={`text-[13px] font-medium flex-1 ${sel ? 'text-orange-600' : vValue(variant)}`}>{cabinLabel(c)}</span>
                      {sel && <i className="fa-solid fa-check text-orange-500 text-[11px]"></i>}
                    </div>
                  );
                })}
            </FloatingPanel>
          </div>
          <button type="submit" disabled={loading} className={`shrink-0 w-full sm:w-full lg:w-12 h-12 lg:h-full min-h-[52px] flex items-center justify-center rounded-xl ${vBtnSearch(variant)}`}>
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> :
              <div className="flex items-center gap-2 lg:gap-0"><i className="fa-solid fa-magnifying-glass text-sm"></i><span className="text-sm font-semibold lg:hidden">{tf.search}</span></div>}
          </button>
        </div>
        {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl bg-red-500/90 backdrop-blur-sm text-white text-[12px] font-medium shadow-xl animate-fade-in flex items-center gap-2"><i className="fa-solid fa-circle-exclamation text-[11px]"></i>{toast}</div>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 animate-fade-up">
      {/* Baris 1: Toggle + Pax & Cabin di kanan */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className={`flex gap-1 p-1 rounded-lg w-fit ${vToggle(variant)}`}>
          {([ { id: 'OW', l: tf.oneWay }, { id: 'RT', l: tf.roundTrip }, { id: 'Multi', l: tf.multiCity } ] as Array<{ id: SearchPayload['direction']; l: string }>).map(t => (
            <button key={t.id} type="button" onClick={() => { setTripType(t.id); setErrors({}); }} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${tripType === t.id ? 'bg-orange-500 text-white shadow-md' : vToggleIdle(variant)}`}>{t.l}</button>
          ))}
        </div>

        {/* Spacer */}
        <div className="hidden sm:block flex-1" />

        {/* Pax */}
        <div className="relative flex-1 sm:flex-none sm:min-w-[240px] shrink-0" ref={paxRef}>
          <div onClick={() => { setOpenPax(!openPax); setOpenCabin(false); }} className={`px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer transition-all h-full ${vField(variant)}`}>
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-users text-orange-500 text-[13px]"></i>
              <div className={`text-[13px] font-medium truncate min-w-0 ${vValue(variant)}`}>{pax.adult} {paxShort.adult}, {pax.child} {paxShort.child}, {pax.infant} {paxShort.infant}</div>
            </div>
            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openPax ? 'rotate-180' : ''} ${vChevron(variant)}`}></i>
          </div>
          <FloatingPanel triggerRef={paxRef} open={openPax} onClose={() => setOpenPax(false)} align="right" className={`w-full lg:w-[320px] rounded-xl p-3 flex flex-col gap-3 ${vPanel(variant)}`}>
              {[
                { k: 'adult', l: tf.adult, desc: '≥ 12 th', i: 'fa-user' },
                { k: 'child', l: tf.child, desc: '2-11 th', i: 'fa-child' },
                { k: 'infant', l: tf.infant, desc: '< 2 th', i: 'fa-baby' }
              ].map(({ k, l, desc, i }) => {
                const val = pax[k as PaxKey];
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
                    <button type="button" disabled={isMin} onClick={() => handlePaxChange(k as PaxKey, -1)} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${isMin ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}><i className="fa-solid fa-minus text-[10px]"></i></button>
                    <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{val}</span>
                    <button type="button" disabled={isMax} onClick={() => handlePaxChange(k as PaxKey, 1)} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${isMax ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}><i className="fa-solid fa-plus text-[10px]"></i></button>
                  </div>
                </div>
                );
              })}
          </FloatingPanel>
        </div>

        {/* Cabin */}
        <div className="relative flex-1 sm:flex-none sm:min-w-[190px] shrink-0" ref={cabinRef}>
          <div onClick={() => { setOpenCabin(!openCabin); setOpenPax(false); }} className={`px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer transition-all h-full ${vField(variant)}`}>
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-couch text-orange-500 text-[13px]"></i>
              <div className={`text-[13px] font-medium ${vValue(variant)}`}>{cabinLabel(CABIN_CLASSES.find(c => c.value === cabinClass) || CABIN_CLASSES[0])}</div>
            </div>
            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openCabin ? 'rotate-180' : ''} ${vChevron(variant)}`}></i>
          </div>
          <FloatingPanel triggerRef={cabinRef} open={openCabin} onClose={() => setOpenCabin(false)} align="right" className={`w-full min-w-[220px] rounded-xl py-1.5 flex flex-col ${vPanel(variant)}`}>
              {CABIN_CLASSES.map(c => {
                const sel = cabinClass === c.value;
                return (
                  <div key={c.value} onClick={() => { setCabinClass(c.value); setOpenCabin(false); }} className={`px-4 py-2.5 flex items-center gap-2.5 cursor-pointer transition-colors ${sel ? 'bg-orange-500/10' : vItem(variant)}`}>
                    <span className={`text-[13px] font-medium flex-1 ${sel ? 'text-orange-600' : vValue(variant)}`}>{cabinLabel(c)}</span>
                    {sel && <i className="fa-solid fa-check text-orange-500 text-[11px]"></i>}
                  </div>
                );
              })}
          </FloatingPanel>
        </div>
      </div>

      {/* Baris 2: Semua field dalam 1 baris */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-col md:flex-row items-stretch gap-2 relative w-full">
          {/* From + Swap + To */}
          <div className="flex-1 flex items-stretch gap-2 relative min-w-0">
            <AirportInput label={tf.from} value={origin} onChange={(v) => { originTouched.current=true; clearError('origin'); clearError('same'); setOrigin(v); }} icon="fa-plane-departure" variant={variant} error={!!errors.origin || !!errors.same} />
            <button type="button" onClick={() => { originTouched.current=true; clearError('origin'); clearError('destination'); clearError('same'); const t=origin; setOrigin(destination); setDestination(t); setSwapRotation(r => r + 180); }}
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 text-orange-500 rounded-full z-10 flex items-center justify-center hover:scale-110 transition-all duration-300 ${variant === 'light' ? 'bg-white/90 border border-white/40 shadow-md' : 'bg-slate-900 border border-white/20 shadow-xl'}`}>
              <i className="fa-solid fa-right-left text-[10px]" style={{ transition: 'transform 0.3s ease', transform: `rotate(${swapRotation}deg)` }}></i>
            </button>
            <AirportInput label={tf.to} value={destination} onChange={(v) => { clearError('destination'); clearError('same'); setDestination(v); }} icon="fa-plane-arrival" variant={variant} error={!!errors.destination || !!errors.same} />
          </div>
          {tripType === 'RT' ? (
            <CalendarRangeField
              startDate={startDate}
              endDate={endDate}
              onChange={(r) => { clearError('departure'); clearError('return'); clearError('returnAfter'); setStartDate(r.from); setEndDate(r.to); }}
              minDate={tomorrow}
              defaultMonth={startDate ?? tomorrow}
            >
              <div className={`flex-1 min-w-[170px] px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all animate-fade-in ${vField(variant)} ${(errors.departure || errors.return || errors.returnAfter) ? vFieldError(variant) : ''}`}>
                <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>{tf.departure} – {tf.return}</span>
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
              onChange={(d) => { clearError('departure'); setStartDate(d); }}
              minDate={tomorrow}
            >
              <div className={`flex-[0.7] min-w-[120px] px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all ${vField(variant)} ${errors.departure ? vFieldError(variant) : ''}`}>
                <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>{tf.departure}</span>
                <div className="flex items-center gap-1.5">
                  <i className="fa-regular fa-calendar text-orange-500 text-[13px]"></i>
                  <div className={`font-medium text-[12px] truncate ${startDate ? vValue(variant) : vSub(variant)}`}>
                    {startDate ? format(startDate, 'dd MMM yyyy', { locale: dateFnsId }) : 'Pilih'}
                  </div>
                </div>
              </div>
            </CalendarField>
          )}
          <button type="submit" disabled={loading} className={`shrink-0 w-full sm:w-full lg:w-12 h-12 lg:h-full min-h-[52px] flex items-center justify-center rounded-xl ${vBtnSearch(variant)}`}>
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> :
              <div className="flex items-center gap-2 lg:gap-0"><i className="fa-solid fa-magnifying-glass text-sm"></i><span className="text-sm font-semibold lg:hidden">{tf.search}</span></div>}
          </button>
        </div>
      </div>
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl bg-red-500/90 backdrop-blur-sm text-white text-[12px] font-medium shadow-xl animate-fade-in flex items-center gap-2"><i className="fa-solid fa-circle-exclamation text-[11px]"></i>{toast}</div>}
    </form>
  );
}
