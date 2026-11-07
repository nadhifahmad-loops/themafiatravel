'use client';
import { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { addDays, format } from 'date-fns';
import { id as dateFnsId, enUS as dateFnsEnUS } from 'date-fns/locale';
import { CalendarField, CalendarRangeField } from '@/components/common/CalendarField';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { i18n } from '@/lib/i18n';
import NearMeRow, { type NearMePick } from '@/components/search/NearMeRow';
import { type FormVariant, vFormField, vFormHeading, vFormLabel, vValue, vPanel, vInput, vItem, vSub, vMuted, vCode, vDiv, vSection, vToggle, vToggleIdle, vStepper, vStepBtn, vIconCircle, vEmpty, vChevron, vFieldError, vBtnSearch } from '@/lib/formVariants';

/** Lihat catatan di FlightSearchForm: nilai klien hanya dipakai setelah hidrasi. */
const emptySubscribe = () => () => {};

interface Station { code: string; name: string; city: string; label: string; }

interface TrainInitialData {
  direction?: string;
  adult?: string | number;
  infant?: string | number;
  origin?: string;
  destination?: string;
  departure_date?: string;
  return_date?: string;
}

interface TrainSearchPayload {
  direction: string;
  adult: number;
  infant: number;
  provider: string;
  journey_list: { origin: string; destination: string; departure_date: string }[];
}

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

function StationInput({ label, value, onChange, stations, icon, variant = 'dark', showLabel = true, id, error = false, showNearMe = false }: {
  label: string; value: string; onChange: (v: string) => void; stations: Station[]; icon: string;
  variant?: FormVariant; showLabel?: boolean; id?: string; error?: boolean; showNearMe?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { language } = useLanguage();
  const t = i18n.searchForm[language].train;
  const [recent, setRecent] = useState<Station[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('mafia_recent_stations');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  const ref = useRef<HTMLDivElement>(null);
  const labelId = id ? `${id}-label` : undefined;

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
    setRecent(n);
    try { localStorage.setItem('mafia_recent_stations', JSON.stringify(n)); } catch {}
  };
  // Hasil "Dekat Saya": cocokkan dulu ke daftar stasiun yang tersedia.
  const handleNearMe = (item: NearMePick) => {
    const known = stations.find(s => s.code === item.code) || POPULAR_STATIONS.find(s => s.code === item.code);
    handleSelect(known || { code: item.code, name: item.name, city: item.city || item.name, label: `${item.name} (${item.code})` });
  };
  const selected =
    stations.find(s => s.code === value) ||
    POPULAR_STATIONS.find(s => s.code === value) ||
    recent.find(s => s.code === value);
  const filtered = stations.filter(s => s.city.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 20);

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
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
        className={`group flex h-full items-center gap-1.5 cursor-pointer transition-all ${vFormField(variant)} ${error ? vFieldError(variant) : ''}`}
      >
        <i className={`fa-solid ${icon} text-sky-600 text-sm`} aria-hidden="true"></i>
        <div className={`min-w-0 flex-1 truncate text-sm font-medium ${vValue(variant)}`}>{selected ? `${selected.city} (${selected.code})` : (value || t.pick)}</div>
        <i className={`fa-solid fa-chevron-down text-[10px] ${vChevron(variant)}`} aria-hidden="true"></i>
      </div>
      <FloatingPanel triggerRef={ref} open={open} onClose={() => setOpen(false)} className={`rounded-xl overflow-hidden ${vPanel(variant)}`}>
        <div className={`p-2.5 ${variant === 'light' ? 'border-b border-slate-100/60' : 'border-b border-white/5'}`}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={t.searchCityStation} className={`w-full rounded-lg px-3 py-2 outline-none ${vInput(variant)}`} />
        </div>
        <div className="max-h-[320px] overflow-y-auto scrollbar-hide">
          {search.length === 0 ? (
            <div className={`divide-y ${vDiv(variant)}`}>
              {showNearMe && <NearMeRow target="station" variant={variant} onPick={handleNearMe} />}
              {recent.length > 0 && (
                <div className="py-1.5">
                  <div className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>{t.recent}</div>
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
                <div className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>{t.popular}</div>
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
                <div className={`p-8 text-center text-[13px] font-medium ${vEmpty(variant)}`}>{t.noResult}</div>
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

export default function TrainSearchForm({ onSearch, loading, initialData, variant = 'dark' }: {
  onSearch: (p: TrainSearchPayload) => void;
  loading: boolean;
  initialData?: TrainInitialData;
  variant?: FormVariant;
}) {
  const { language } = useLanguage();
  const { nearestStation } = useLocation();
  const t = i18n.searchForm[language].train;
  const isEnglish = language === 'EN';
  const dateLocale = isEnglish ? dateFnsEnUS : dateFnsId;
  const [tripType, setTripType] = useState(initialData?.direction || 'OW');
  const [stations, setStations] = useState<Station[]>(POPULAR_STATIONS);
  const [pax, setPax] = useState({ adult: parseInt(String(initialData?.adult ?? '1')), infant: parseInt(String(initialData?.infant ?? '0')) });
  const [openPax, setOpenPax] = useState(false);
  const paxRef = useRef<HTMLDivElement>(null);
  const [originOverride, setOriginOverride] = useState<string | null>(initialData?.origin ?? null);
  const nearestOriginCode = useSyncExternalStore(
    emptySubscribe,
    () => nearestStation?.code ?? 'GMR',
    () => 'GMR',
  );
  const origin = originOverride ?? nearestOriginCode;
  const [destination, setDestination] = useState(initialData?.destination || 'BD');
  const [swapRotation, setSwapRotation] = useState(0);
  const [formError, setFormError] = useState('');

  const [startDate, setStartDate] = useState<Date | null>(() => initialData?.departure_date ? parseLocalDate(initialData.departure_date) : new Date(Date.now()+86400000));
  const [endDate, setEndDate] = useState<Date | null>(() => {
    if (initialData?.return_date) return parseLocalDate(initialData.return_date);
    if (initialData?.direction !== 'RT') return null;
    const dep = initialData?.departure_date ? parseLocalDate(initialData.departure_date) : new Date(Date.now()+86400000);
    return addDays(dep, 1);
  });
  const minDateToday = useMemo(() => new Date(), []);

  useEffect(() => {
    fetch('/api/train/destinations').then(r => r.json()).then(d => {
      if (d.success && Array.isArray(d.data) && d.data.length > 0) setStations(d.data.map((s: Station) => ({ ...s, label: s.label || `${s.name} (${s.code})` })));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      // Panel penumpang juga di-portal ke document.body — sama seperti
      // StationInput di atas, klik di dalamnya tidak boleh dihitung "klik di
      // luar"; tanpa itu tombol +/− tidak akan pernah bisa ditekan.
      if (paxRef.current && !paxRef.current.contains(target) && !(e.target as HTMLElement).closest?.('[data-floating-panel]')) setOpenPax(false);
    };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin === destination) { setFormError(t.errSameStation); return; }
    if (!startDate) { setFormError(t.errDeparture); return; }
    if (tripType === 'RT' && !endDate) { setFormError(t.errReturn); return; }
    setFormError('');
    const payload: TrainSearchPayload = { direction: tripType, adult: pax.adult, infant: pax.infant, provider: 'kai', journey_list: [{ origin, destination, departure_date: startDate ? formatLocalDate(startDate) : '' }] };
    if (tripType === 'RT' && endDate) payload.journey_list.push({ origin: destination, destination: origin, departure_date: formatLocalDate(endDate) });
    onSearch(payload);
  };

  const renderPaxDropdown = () => (
    <div className="relative flex flex-col" ref={paxRef}>
      <span id="train-pax-label" className={vFormLabel(variant)}>{t.passengers}</span>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={openPax}
        aria-labelledby="train-pax-label"
        onClick={() => setOpenPax(!openPax)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenPax(!openPax); } }}
        className={`flex h-full cursor-pointer items-center justify-between transition-all ${vFormField(variant)}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <i className="fa-solid fa-users text-sky-600 text-sm" aria-hidden="true"></i>
          <div className={`min-w-0 truncate text-[13px] font-medium ${vValue(variant)}`}>{pax.adult} {t.adult}, {pax.infant} {t.infant}</div>
        </div>
        <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openPax ? 'rotate-180' : ''} ${vChevron(variant)}`}></i>
      </div>
      <FloatingPanel triggerRef={paxRef} open={openPax} onClose={() => setOpenPax(false)} align="right" maxWidth={480} className={`w-full rounded-xl p-3 flex flex-col gap-3 ${vPanel(variant)}`}>
        {([{ k: 'adult', l: t.adult, desc: t.adultAge, i: 'fa-user' }, { k: 'infant', l: t.infant, desc: t.infantAge, i: 'fa-baby' }] as const).map(({ k, l, desc, i }) => {
          const val = pax[k];
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
              <button type="button" aria-label={`${isEnglish ? 'Remove' : 'Kurangi'} ${l}`} disabled={isMin} onClick={() => setPax(p => ({...p,[k]:Math.max(k==='adult'?1:0,val-1)}))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${isMin ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}><i className="fa-solid fa-minus text-[10px]"></i></button>
              <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{val}</span>
              <button type="button" aria-label={`${isEnglish ? 'Add' : 'Tambah'} ${l}`} disabled={isMax} onClick={() => setPax(p => ({...p,[k]:val+1}))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${isMax ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}><i className="fa-solid fa-plus text-[10px]"></i></button>
            </div>
          </div>
          );
        })}
      </FloatingPanel>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-fade-up">
      {/* Baris 1: Trip type */}
      <section>
        <h3 className={vFormHeading(variant)}>{t.tripTypeLabel}</h3>
        <div className={`grid w-full grid-cols-2 gap-1 rounded-lg p-1 sm:flex sm:w-fit ${vToggle(variant)}`}>
          {[{id:'OW',l:t.oneWay},{id:'RT',l:t.roundTrip}].map(opt => (
            <button key={opt.id} type="button" aria-pressed={tripType === opt.id} onClick={() => {
              setTripType(opt.id);
              setFormError('');
              // Mode pulang-pergi: isi tanggal pulang H+1 agar range tidak kosong.
              if (opt.id === 'RT' && startDate && (!endDate || endDate <= startDate)) setEndDate(addDays(startDate, 1));
            }} className={`min-h-11 px-2 sm:px-4 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${tripType === opt.id ? 'bg-sky-600 text-white shadow-sm' : vToggleIdle(variant)}`}>{opt.l}</button>
          ))}
        </div>
      </section>

      {/* Baris 2: Semua field + tombol cari dalam satu baris */}
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-12 relative w-full">
        {/* From + Swap + To */}
        <div className="flex min-w-0 flex-col md:col-span-2 xl:col-span-4">
          <div className="grid grid-cols-2 gap-2">
            <span className={vFormLabel(variant)}>{t.from}</span>
            <span className={vFormLabel(variant)}>{t.to}</span>
          </div>
          <div className="relative flex flex-1 items-stretch gap-2">
            <StationInput showLabel={false} showNearMe label={t.from} value={origin} onChange={(v) => { setOriginOverride(v); setFormError(''); }} stations={stations} icon="fa-train" variant={variant} error={origin === destination} />
            <button type="button" aria-label={t.swapBtn} onClick={() => { const tmp=origin; setOriginOverride(destination); setDestination(tmp); setSwapRotation(r => r + 180); setFormError(''); }}
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-sky-700 rounded-full z-10 flex items-center justify-center hover:scale-110 transition-all duration-300 ${variant === 'light' ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-white/20 shadow-xl'}`}>
              <i className="fa-solid fa-right-left text-[10px]" aria-hidden="true" style={{ transition: 'transform 0.3s ease', transform: `rotate(${swapRotation}deg)` }}></i>
            </button>
            <StationInput showLabel={false} label={t.to} value={destination} onChange={(v) => { setDestination(v); setFormError(''); }} stations={stations} icon="fa-train" variant={variant} error={origin === destination} />
          </div>
        </div>
        <div className="flex flex-col md:col-span-1 xl:col-span-3">
          <span className={vFormLabel(variant)}>{tripType === 'RT' ? t.departureReturn : t.departure}</span>
          {tripType === 'RT' ? (
            <CalendarRangeField
              startDate={startDate}
              endDate={endDate}
              onChange={(r) => { setStartDate(r.from); setEndDate(r.to); setFormError(''); }}
              onOpenChange={(o) => {
                // Ditutup tanpa memilih tanggal pulang: pakai default H+1.
                if (!o && tripType === 'RT' && startDate) {
                  setEndDate(prev => (prev && prev > startDate ? prev : addDays(startDate, 1)));
                }
              }}
              minDate={minDateToday}
              defaultMonth={startDate ?? minDateToday}
            >
              <div className={`flex h-full min-w-0 cursor-pointer items-center gap-1.5 transition-all animate-fade-in ${vFormField(variant)}`}>
                <i className="fa-regular fa-calendar text-sky-600 text-sm" aria-hidden="true"></i>
                <div className={`min-w-0 truncate text-sm font-medium ${startDate ? vValue(variant) : vSub(variant)}`}>
                  {startDate
                    ? `${format(startDate, 'dd MMM', { locale: dateLocale })}${endDate ? ` – ${format(endDate, 'dd MMM yyyy', { locale: dateLocale })}` : ` ${t.selectReturn}`}`
                    : t.pickDate}
                </div>
              </div>
            </CalendarRangeField>
          ) : (
            <CalendarField
              value={startDate}
              onChange={(d) => { setStartDate(d); setFormError(''); }}
              minDate={minDateToday}
            >
              <div className={`flex h-full min-w-0 cursor-pointer items-center gap-1.5 transition-all ${vFormField(variant)}`}>
                <i className="fa-regular fa-calendar text-sky-600 text-sm" aria-hidden="true"></i>
                <div className={`min-w-0 truncate text-sm font-medium ${startDate ? vValue(variant) : vSub(variant)}`}>
                  {startDate ? format(startDate, 'dd MMM yyyy', { locale: dateLocale }) : t.pickDate}
                </div>
              </div>
            </CalendarField>
          )}
        </div>
        <div className="flex min-w-0 flex-col md:col-span-1 xl:col-span-3">{renderPaxDropdown()}</div>

        <button type="submit" disabled={loading} className={`w-full md:col-span-2 xl:col-span-2 ${vBtnSearch(variant)}`}>
          {loading
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />}
          {loading ? (isEnglish ? 'Searching...' : 'Mencari...') : t.search}
        </button>
      </div>

      {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
    </form>
  );
}
