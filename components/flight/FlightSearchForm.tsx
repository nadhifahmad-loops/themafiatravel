'use client';
import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { addDays, format } from 'date-fns';
import { id as dateFnsId, enUS as dateFnsEnUS } from 'date-fns/locale';
import { CalendarField, CalendarRangeField } from '@/components/common/CalendarField';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { loadAirportGeo, GeoAirport } from '@/lib/geo';
import NearMeRow, { type NearMePick } from '@/components/search/NearMeRow';
import { i18n } from '@/lib/i18n';
import { type FormVariant, vFormField, vFormHeading, vFormLabel, vValue, vPanel, vInput, vItem, vItemBg, vSub, vMuted, vCode, vDiv, vSection, vToggle, vToggleIdle, vStepper, vStepBtn, vIconCircle, vEmpty, vChevron, vBtnSearch, vFieldError } from '@/lib/formVariants';

/** Tidak ada store eksternal: dipakai agar nilai klien (mis. bandara terdekat)
 *  baru dipakai SETELAH hidrasi, sehingga SSR & render pertama klien sama. */
const emptySubscribe = () => () => {};

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

function FloatingPanel({ triggerRef, open, onClose, children, className, align = 'left', dropUp = false, maxWidth = 360 }: {
  triggerRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
  dropUp?: boolean;
  maxWidth?: number;
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
        maxWidth,
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

function AirportInput({ label, value, onChange, icon, dropUp = false, variant = 'dark', error = false, showLabel = true, id, showNearMe = false }: {
  label: string; value: string; onChange: (v: string) => void; icon: string;
  dropUp?: boolean; variant?: FormVariant; error?: boolean; showLabel?: boolean; id?: string; showNearMe?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { language } = useLanguage();
  const tf = i18n.searchForm[language].flight;
  const [airports, setAirports] = useState<Airport[]>(() => typeof window === 'undefined' ? POPULAR_AIRPORTS : window.mafiaAirports ?? POPULAR_AIRPORTS);
  const [recent, setRecent] = useState<Airport[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const p = JSON.parse(localStorage.getItem('mafia_recent_airports') || '[]'); return Array.isArray(p) ? p : []; } catch { return []; }
  });
  const [loadingDb, setLoadingDb] = useState<boolean>(() => typeof window !== 'undefined' && !window.mafiaAirports);
  const [geoAirports, setGeoAirports] = useState<GeoAirport[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const labelId = id ? `${id}-label` : undefined;

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
    setRecent(n);
    try { localStorage.setItem('mafia_recent_airports', JSON.stringify(n)); } catch {}
  };
  // Hasil "Dekat Saya": daftarkan ke list supaya label/penampilannya benar.
  const handleNearMe = (item: NearMePick) => {
    const airport: Airport = { code: item.code, city: item.city || item.name || item.code, label: `${item.name} (${item.code})` };
    setAirports(prev => (prev.some(a => a.code === airport.code) ? prev : [airport, ...prev]));
    handleSelect(airport);
  };
  const selected =
    airports.find(a => a.code === value) ||
    POPULAR_AIRPORTS.find(a => a.code === value) ||
    recent.find(a => a.code === value) ||
    geoAirports.find(a => a.code === value);
  const filtered = airports.filter(a => a.city.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase()) || a.label.toLowerCase().includes(search.toLowerCase())).slice(0, 20);
  const displayValue = selected
    ? selected.city
      ? `${selected.city} (${selected.code})`
      : 'name' in selected && selected.name
        ? selected.name
        : selected.code
    : value;

  return (
    <div className="relative flex min-w-0 flex-1 flex-col" ref={ref}>
      {showLabel && <span id={labelId} className={vFormLabel(variant)}>{label}</span>}
      <div
        id={id}
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={showLabel ? labelId : undefined}
        aria-label={showLabel ? undefined : label}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
        }}
        className={`group flex h-full items-center gap-1.5 cursor-pointer transition-all ${vFormField(variant)} ${error ? vFieldError(variant) : ''}`}
      >
        <i className={`fa-solid ${icon} text-sky-600 text-sm`} aria-hidden="true"></i>
        <div className={`min-w-0 flex-1 text-sm font-medium truncate ${vValue(variant)}`}>{displayValue || tf.pick}</div>
        <i className={`fa-solid fa-chevron-down text-[10px] ${vChevron(variant)}`} aria-hidden="true"></i>
      </div>
      <FloatingPanel triggerRef={ref} open={open} onClose={() => setOpen(false)} dropUp={dropUp} className={`rounded-xl overflow-hidden ${vPanel(variant)}`}>
          <div className={`p-2.5 ${variant === 'light' ? 'border-b border-slate-100/60' : 'border-b border-white/5'}`}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kota atau bandara..." className={`w-full rounded-lg px-3 py-2 outline-none ${vInput(variant)}`} />
          </div>
          <div className="max-h-[320px] overflow-y-auto scrollbar-hide">
            {search.length === 0 ? (
              <div className={`divide-y ${vDiv(variant)}`}>
                {showNearMe && <NearMeRow target="airport" variant={variant} onPick={handleNearMe} />}
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
  const isEnglish = language === 'EN';
  const dateLocale = isEnglish ? dateFnsEnUS : dateFnsId;
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
  const [originOverride, setOriginOverride] = useState<string | null>(initialData?.origin ?? null);
  const nearestOriginCode = useSyncExternalStore(
    emptySubscribe,
    () => nearestAirport?.code ?? 'CGK',
    () => 'CGK',
  );
  const origin = originOverride ?? nearestOriginCode;
  const [destination, setDestination] = useState(initialData?.destination || 'DPS');
  const [swapRotation, setSwapRotation] = useState(0);

  const [startDate, setStartDate] = useState<Date | null>(() => initialData?.departure_date ? parseLocalDate(initialData.departure_date) : new Date(new Date().setDate(new Date().getDate() + 1)));
  const [endDate, setEndDate] = useState<Date | null>(() => {
    if (initialData?.return_date) return parseLocalDate(initialData.return_date);
    if (initialDirection !== 'RT') return null;
    const dep = initialData?.departure_date ? parseLocalDate(initialData.departure_date) : new Date(new Date().setDate(new Date().getDate() + 1));
    return addDays(dep, 1);
  });
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

  const addLeg = () => { if (legs.length >= 5) { setToast(isEnglish ? 'Maximum 5 flights' : 'Maksimal 5 penerbangan'); return; } const l = legs[legs.length-1]; setLegs(p => [...p, { origin: l.destination || '', destination: '', date: new Date(l.date.getTime()+86400000) }]); };
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
    if (Object.keys(errs).length > 0) return;

    const payload: SearchPayload = { direction: tripType, ...pax, cabin_class: cabinClass };
    if (tripType === 'Multi') { payload.routes = legs.map(l => ({ origin: l.origin, destination: l.destination, departure_date: formatLocalDate(l.date) })); }
    else { payload.origin = origin; payload.destination = destination; payload.departure_date = startDate ? formatLocalDate(startDate) : undefined; if (tripType === 'RT' && endDate) payload.return_date = formatLocalDate(endDate); }
    onSearch(payload);
  };

  const firstError = Object.values(errors)[0];
  const toggleGroup = (
    <div className={`grid w-full grid-cols-3 gap-1 rounded-lg p-1 sm:flex sm:w-fit ${vToggle(variant)}`}>
      {([ { id: 'OW', l: tf.oneWay }, { id: 'RT', l: tf.roundTrip }, { id: 'Multi', l: tf.multiCity } ] as Array<{ id: SearchPayload['direction']; l: string }>).map(t => (
        <button key={t.id} type="button" aria-pressed={tripType === t.id} onClick={() => {
          setTripType(t.id);
          setErrors({});
          // Mode pulang-pergi: isi tanggal pulang H+1 agar range tidak kosong.
          if (t.id === 'RT' && startDate && (!endDate || endDate <= startDate)) setEndDate(addDays(startDate, 1));
        }} className={`min-h-11 px-2 sm:px-4 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${tripType === t.id ? 'bg-sky-600 text-white shadow-sm' : vToggleIdle(variant)}`}>{t.l}</button>
      ))}
    </div>
  );

  const travelerControl = (
    <div className="relative flex flex-col" ref={paxRef}>
      <span id="flight-pax-label" className={vFormLabel(variant)}>{tf.passengers}</span>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={openPax}
        aria-labelledby="flight-pax-label"
        onClick={() => { setOpenPax(!openPax); setOpenCabin(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenPax(!openPax); setOpenCabin(false); } }}
        className={`flex h-full cursor-pointer items-center justify-between transition-all ${vFormField(variant)}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <i className="fa-solid fa-users text-sky-600 text-sm" aria-hidden="true"></i>
          <div className={`min-w-0 truncate text-[13px] font-medium ${vValue(variant)}`}>{pax.adult} {paxShort.adult}, {pax.child} {paxShort.child}, {pax.infant} {paxShort.infant}</div>
        </div>
        <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openPax ? 'rotate-180' : ''} ${vChevron(variant)}`}></i>
      </div>
      <FloatingPanel triggerRef={paxRef} open={openPax} onClose={() => setOpenPax(false)} align="right" maxWidth={480} className={`w-full rounded-xl p-3 flex flex-col gap-3 ${vPanel(variant)}`}>
        {[
          { k: 'adult', l: tf.adult, desc: tf.adultAge, i: 'fa-user' },
          { k: 'child', l: tf.child, desc: tf.childAge, i: 'fa-child' },
          { k: 'infant', l: tf.infant, desc: tf.infantAge, i: 'fa-baby' }
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
                <button type="button" disabled={isMin} aria-label={`${isEnglish ? 'Remove' : 'Kurangi'} ${l}`} onClick={() => handlePaxChange(k as PaxKey, -1)} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${isMin ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}><i className="fa-solid fa-minus text-[10px]"></i></button>
                <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{val}</span>
                <button type="button" disabled={isMax} aria-label={`${isEnglish ? 'Add' : 'Tambah'} ${l}`} onClick={() => handlePaxChange(k as PaxKey, 1)} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${isMax ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}><i className="fa-solid fa-plus text-[10px]"></i></button>
              </div>
            </div>
          );
        })}
      </FloatingPanel>
    </div>
  );

  const cabinControl = (
    <div className="relative flex flex-col" ref={cabinRef}>
      <span id="flight-cabin-label" className={vFormLabel(variant)}>{tf.class}</span>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={openCabin}
        aria-labelledby="flight-cabin-label"
        onClick={() => { setOpenCabin(!openCabin); setOpenPax(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenCabin(!openCabin); setOpenPax(false); } }}
        className={`flex h-full cursor-pointer items-center justify-between transition-all ${vFormField(variant)}`}
      >
        <div className="flex items-center gap-1.5">
          <i className="fa-solid fa-couch text-sky-600 text-sm" aria-hidden="true"></i>
          <div className={`text-[13px] font-medium ${vValue(variant)}`}>{cabinLabel(CABIN_CLASSES.find(c => c.value === cabinClass) || CABIN_CLASSES[0])}</div>
        </div>
        <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openCabin ? 'rotate-180' : ''} ${vChevron(variant)}`}></i>
      </div>
      <FloatingPanel triggerRef={cabinRef} open={openCabin} onClose={() => setOpenCabin(false)} align="right" className={`w-full min-w-[220px] rounded-xl py-1.5 flex flex-col ${vPanel(variant)}`}>
        {CABIN_CLASSES.map(c => {
          const sel = cabinClass === c.value;
          return (
            <div key={c.value} role="option" aria-selected={sel} onClick={() => { setCabinClass(c.value); setOpenCabin(false); }} className={`px-4 py-2.5 flex items-center gap-2.5 cursor-pointer transition-colors ${sel ? 'bg-sky-500/10' : vItem(variant)}`}>
              <span className={`text-[13px] font-medium flex-1 ${sel ? 'text-sky-700' : vValue(variant)}`}>{cabinLabel(c)}</span>
              {sel && <i className="fa-solid fa-check text-sky-600 text-[11px]"></i>}
            </div>
          );
        })}
      </FloatingPanel>
    </div>
  );

  const searchButton = (
    <button type="submit" disabled={loading} className={`w-full ${vBtnSearch(variant)}`}>
      {loading
        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        : <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />}
      {loading ? (isEnglish ? 'Searching...' : 'Mencari...') : tf.search}
    </button>
  );

  const topRow = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <section>
        <h3 className={vFormHeading(variant)}>{tf.tripTypeLabel}</h3>
        {toggleGroup}
      </section>
      <div className="grid grid-cols-2 gap-3 lg:w-[460px] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:w-[520px]">
        {travelerControl}
        {cabinControl}
      </div>
    </div>
  );

  if (tripType === 'Multi') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-fade-up">
        {topRow}

        <div className="flex flex-col gap-3">
          {legs.map((leg, i) => {
              const originErr = errors[`origin_${i}`] || errors[`same_${i}`];
              const destErr = errors[`dest_${i}`] || errors[`same_${i}`];
              const dateErr = errors[`date_${i}`];
              return (
                <div key={i} className={`flex flex-col gap-3 rounded-lg border p-3 animate-fade-in ${variant === 'light' ? 'border-slate-200/80 bg-slate-50/40' : 'border-white/10 bg-white/5'}`}>
                  <div className="flex items-center justify-between px-0.5">
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${vValue(variant)}`}>
                      <i className="fa-solid fa-route text-[10px] text-sky-600" aria-hidden="true"></i>
                      {tf.routeN.replace('{n}', String(i + 1))}
                    </span>
                    {legs.length > 2 && (
                      <button type="button" onClick={() => removeLeg(i)} className="px-2 py-1 text-[11px] text-red-500 hover:text-red-600 transition-colors flex items-center gap-1">
                        <i className="fa-solid fa-trash-can text-[10px]" aria-hidden="true"></i>
                        <span className="hidden sm:inline">{tf.removeFlight}</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                    <div className="flex min-w-0 flex-col">
                      <div className="grid grid-cols-2 gap-2">
                        <span className={vFormLabel(variant)}>{tf.from}</span>
                        <span className={vFormLabel(variant)}>{tf.to}</span>
                      </div>
                      <div className="relative flex flex-1 items-stretch gap-2">
                        <AirportInput showLabel={false} showNearMe label={tf.from} value={leg.origin} onChange={(v) => { clearError(`origin_${i}`); clearError(`same_${i}`); const n=[...legs]; n[i].origin=v; setLegs(n); }} icon="fa-plane-departure" variant={variant} error={!!originErr} />
                        <button type="button" aria-label={tf.swapBtn} onClick={() => { clearError(`origin_${i}`); clearError(`dest_${i}`); clearError(`same_${i}`); const n=[...legs]; const t=n[i].origin; n[i].origin=n[i].destination; n[i].destination=t; setLegs(n); }}
                          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-sky-700 rounded-full z-10 flex items-center justify-center hover:scale-110 transition-all duration-300 ${variant === 'light' ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-white/20 shadow-xl'}`}>
                          <i className="fa-solid fa-right-left text-[10px]" aria-hidden="true"></i>
                        </button>
                        <AirportInput showLabel={false} label={tf.to} value={leg.destination} onChange={(v) => { clearError(`dest_${i}`); clearError(`same_${i}`); const n=[...legs]; n[i].destination=v; setLegs(n); }} icon="fa-plane-arrival" variant={variant} error={!!destErr} />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className={vFormLabel(variant)}>{tf.departure}</span>
                      <CalendarField value={leg.date} onChange={(d) => { clearError(`date_${i}`); const n=[...legs]; n[i].date=(d ?? tomorrow) as Date; setLegs(n); }} minDate={tomorrow}>
                        <div className={`flex h-full cursor-pointer items-center gap-1.5 transition-all ${vFormField(variant)} ${dateErr ? vFieldError(variant) : ''}`}>
                          <i className="fa-regular fa-calendar text-sky-600 text-sm" aria-hidden="true"></i>
                          <div className={`truncate text-sm font-medium ${vValue(variant)}`}>
                            {format(leg.date, 'dd MMM yyyy', { locale: dateLocale })}
                          </div>
                        </div>
                      </CalendarField>
                    </div>
                  </div>
                </div>
              );
            })}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={addLeg} className={`px-4 py-2.5 border border-dashed font-medium text-xs rounded-md flex items-center justify-center gap-2 transition-all sm:justify-start w-full sm:w-auto ${variant === 'light' ? 'bg-white hover:bg-sky-50 border-slate-200 text-sky-700' : 'bg-white/5 hover:bg-white/10 border-white/20 text-sky-400'}`}><i className="fa-solid fa-plus-circle text-[11px]" aria-hidden="true"></i> {tf.addFlight}</button>
            <div className="w-full sm:w-auto sm:min-w-[180px]">{searchButton}</div>
          </div>
        </div>

        {firstError && <p role="alert" className="text-sm text-red-600">{firstError}</p>}
        {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl bg-red-500/90 backdrop-blur-sm text-white text-[12px] font-medium shadow-xl animate-fade-in flex items-center gap-2"><i className="fa-solid fa-circle-exclamation text-[11px]"></i>{toast}</div>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-fade-up">
      {topRow}

      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col md:col-span-2 xl:col-span-5">
          <div className="grid grid-cols-2 gap-2">
            <span className={vFormLabel(variant)}>{tf.from}</span>
            <span className={vFormLabel(variant)}>{tf.to}</span>
          </div>
          <div className="relative flex flex-1 items-stretch gap-2">
            <AirportInput showLabel={false} showNearMe label={tf.from} value={origin} onChange={(v) => { clearError('origin'); clearError('same'); setOriginOverride(v); }} icon="fa-plane-departure" variant={variant} error={!!errors.origin || !!errors.same} />
            <button type="button" aria-label={tf.swapBtn} onClick={() => { clearError('origin'); clearError('destination'); clearError('same'); const t=origin; setOriginOverride(destination); setDestination(t); setSwapRotation(r => r + 180); }}
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-sky-700 rounded-full z-10 flex items-center justify-center hover:scale-110 transition-all duration-300 ${variant === 'light' ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-white/20 shadow-xl'}`}>
              <i className="fa-solid fa-right-left text-[10px]" aria-hidden="true" style={{ transition: 'transform 0.3s ease', transform: `rotate(${swapRotation}deg)` }}></i>
            </button>
            <AirportInput showLabel={false} label={tf.to} value={destination} onChange={(v) => { clearError('destination'); clearError('same'); setDestination(v); }} icon="fa-plane-arrival" variant={variant} error={!!errors.destination || !!errors.same} />
          </div>
        </div>

        <div className="flex flex-col md:col-span-1 xl:col-span-4">
          <span className={vFormLabel(variant)}>{tripType === 'RT' ? tf.departureReturn : tf.departure}</span>
          {tripType === 'RT' ? (
            <CalendarRangeField
              startDate={startDate}
              endDate={endDate}
              onChange={(r) => { clearError('departure'); clearError('return'); clearError('returnAfter'); setStartDate(r.from); setEndDate(r.to); }}
              onOpenChange={(o) => {
                // Ditutup tanpa memilih tanggal pulang: pakai default H+1.
                if (!o && tripType === 'RT' && startDate) {
                  setEndDate(prev => (prev && prev > startDate ? prev : addDays(startDate, 1)));
                }
              }}
              minDate={tomorrow}
              defaultMonth={startDate ?? tomorrow}
            >
              <div className={`flex h-full min-w-0 cursor-pointer items-center gap-1.5 transition-all animate-fade-in ${vFormField(variant)} ${(errors.departure || errors.return || errors.returnAfter) ? vFieldError(variant) : ''}`}>
                <i className="fa-regular fa-calendar text-sky-600 text-sm" aria-hidden="true"></i>
                <div className={`truncate text-sm font-medium ${startDate ? vValue(variant) : vSub(variant)}`}>
                  {startDate
                    ? `${format(startDate, 'dd MMM', { locale: dateLocale })}${endDate ? ` – ${format(endDate, 'dd MMM yyyy', { locale: dateLocale })}` : ` ${tf.selectReturn}`}`
                    : tf.pickDate}
                </div>
              </div>
            </CalendarRangeField>
          ) : (
            <CalendarField value={startDate} onChange={(d) => { clearError('departure'); setStartDate(d); }} minDate={tomorrow}>
              <div className={`flex h-full min-w-0 cursor-pointer items-center gap-1.5 transition-all ${vFormField(variant)} ${errors.departure ? vFieldError(variant) : ''}`}>
                <i className="fa-regular fa-calendar text-sky-600 text-sm" aria-hidden="true"></i>
                <div className={`truncate text-sm font-medium ${startDate ? vValue(variant) : vSub(variant)}`}>
                  {startDate ? format(startDate, 'dd MMM yyyy', { locale: dateLocale }) : tf.pickDate}
                </div>
              </div>
            </CalendarField>
          )}
        </div>

        <div className="md:col-span-1 xl:col-span-3">{searchButton}</div>
      </div>
      {firstError && <p role="alert" className="text-sm text-red-600">{firstError}</p>}
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl bg-red-500/90 backdrop-blur-sm text-white text-[12px] font-medium shadow-xl animate-fade-in flex items-center gap-2"><i className="fa-solid fa-circle-exclamation text-[11px]"></i>{toast}</div>}
    </form>
  );
}
