'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { id as dateFnsId } from 'date-fns/locale';
import { CalendarRangeField } from '@/components/common/CalendarField';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { type FormVariant, vField, vLabel, vValue, vPanel, vInput, vItem, vSub, vMuted, vCode, vDiv, vSection, vToggle, vToggleIdle, vStepper, vStepBtn, vIconCircle, vEmpty, vChevron, vFieldLabel, vBtnSearch, vItemBg } from '@/lib/formVariants';

function FloatingPanel({ triggerRef, open, onClose, children, className, align = 'left' }: {
  triggerRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + 4,
      left: align === 'right' ? r.right : r.left,
      width: r.width,
    });
  }, [triggerRef, align]);

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
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
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
        top: pos.top,
        left: align === 'right' ? undefined : pos.left,
        right: align === 'right' ? `calc(100vw - ${pos.left}px)` : undefined,
        width: pos.width,
        maxWidth: 400,
        maxHeight: 'min(70vh, 520px)',
      }}
    >
      {children}
    </div>,
    document.body
  );
}

type Destination = { code: string; label: string; city: string };
type HotelSearchPayload = {
  checkin_date: string;
  checkout_date: string;
  destination_id: string;
  adult: number;
  child: number;
  child_ages: number[];
  room: number;
  nationality: string;
  q: string;
  property_type?: string;
};

interface Props {
  onSearch: (payload: HotelSearchPayload) => void;
  loading: boolean;
  initialData?: Partial<HotelSearchPayload> & { child_ages?: Array<string | number> };
  variant?: FormVariant;
}

const POPULAR_DESTINATIONS: Destination[] = [
  { code: 'SG7355', label: 'Singapura, SG', city: 'Singapore' },
  { code: 'ID339', label: 'Jakarta, ID', city: 'Jakarta' },
  { code: 'ID8731', label: 'Bali, ID', city: 'Bali' },
  { code: 'ID8732', label: 'Surabaya, ID', city: 'Surabaya' },
  { code: 'MY5411', label: 'Kuala Lumpur, MY', city: 'Kuala Lumpur' },
  { code: 'TH3299', label: 'Bangkok, TH', city: 'Bangkok' },
  { code: 'ID8735', label: 'Yogyakarta, ID', city: 'Yogyakarta' },
  { code: 'ID8734', label: 'Bandung, ID', city: 'Bandung' },
];

const DUMMY_DESTINATIONS: Destination[] = [
  { code: "SG7355", label: "Singapore", city: "Singapore" },
  { code: "2252", label: "Holiday Inn Atrium (Hotel)", city: "Singapore" },
  { code: "2254", label: "Grand Park City Hall (Hotel)", city: "Singapore" },
  { code: "ID001", label: "Jakarta", city: "Jakarta" },
  { code: "ID002", label: "Bali", city: "Bali" }
];

const DESTINATION_OPTIONS: Destination[] = [
  ...POPULAR_DESTINATIONS,
  ...DUMMY_DESTINATIONS.filter(dummy =>
    !POPULAR_DESTINATIONS.some(destination => destination.code === dummy.code)
  ),
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

/* ─── DESTINATION SELECTOR (AUTO-LOAD API ORBIS + RECENT SEARCH) ─── */
function DestinationInput({ label, value, onChange, icon, variant = 'dark' }: { label: string; value: string; onChange: (v: string) => void; icon: string; variant?: FormVariant }) {
  const { language } = useLanguage();
  const tfh = i18n.searchForm[language].hotel;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<Destination[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('mafia_recent_hotels');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.filter((item): item is Destination =>
            typeof item?.code === 'string' &&
            typeof item?.label === 'string' &&
            typeof item?.city === 'string'
          )
        : [];
    } catch {
      return [];
    }
  });
  const ref = useRef<HTMLDivElement>(null);

  const handleSelect = (item: Destination) => {
    onChange(item.code);
    setOpen(false);
    setSearch('');
    const newRecent = [item, ...recent.filter(r => r.code !== item.code)].slice(0, 3);
    setRecent(newRecent);
    localStorage.setItem('mafia_recent_hotels', JSON.stringify(newRecent));
  };

  const selected = DESTINATION_OPTIONS.find(a => a.code === value);
  
  const filtered = DESTINATION_OPTIONS.filter(a =>
    a.city?.toLowerCase().includes(search.toLowerCase()) ||
    a.label?.toLowerCase().includes(search.toLowerCase()) ||
    a.code?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  return (
    <div className="relative flex-1 w-full" ref={ref}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`group flex flex-col px-4 py-3 rounded-xl cursor-pointer transition-all h-full ${vField(variant)}`}
      >
        <span className={`mb-1.5 text-xs font-semibold ${vLabel(variant)}`}>{label}</span>
        <div className="flex items-center gap-1.5">
          <i className={`fa-solid ${icon} text-sky-600 text-sm`} aria-hidden="true"></i>
          <div className={`text-sm font-medium truncate ${vValue(variant)}`}>
            {selected ? selected.label : (value || 'Pilih Destinasi')}
          </div>
        </div>
      </div>

      <FloatingPanel
        triggerRef={ref}
        open={open}
        onClose={() => setOpen(false)}
        className={`rounded-xl overflow-hidden ${vPanel(variant)}`}
      >
        <div className={`p-3 ${variant === 'light' ? 'border-b border-slate-100/60' : 'border-b border-white/5'}`}>
            <input 
              autoFocus value={search} onChange={e => setSearch(e.target.value)} 
              placeholder={tfh.searchPlaceholder} 
              className={`w-full rounded-lg px-3 py-2 outline-none transition-all ${vInput(variant)}`}
            />
          </div>
          
          <div className="max-h-[350px] overflow-y-auto scrollbar-hide">
            {search.length === 0 ? (
              <div className={`divide-y ${vDiv(variant)}`}>
                {recent.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-orange-500">Pencarian Terakhir</div>
                    {recent.map(a => (
                      <div key={`rec-${a.code}`} onClick={() => handleSelect(a)} className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors ${vItem(variant)}`}>
                        <i className={`fa-solid fa-clock-rotate-left text-xs ${vMuted(variant)}`}></i>
                        <div className="flex-1">
                          <div className={`text-[13px] font-medium ${vValue(variant)}`}>{a.city}</div>
                          <div className={`text-[11px] ${vSub(variant)}`}>{a.label}</div>
                        </div>
                        <span className={`text-[10px] font-semibold ${vMuted(variant)}`}>{a.code}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="py-2">
                  <div className={`px-4 py-2 text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>Destinasi Populer</div>
                  {POPULAR_DESTINATIONS.map(a => (
                    <div key={`pop-${a.code}`} onClick={() => handleSelect(a)} className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors ${vItem(variant)}`}>
                      <i className="fa-solid fa-star text-orange-500/50 text-xs"></i>
                      <div className="flex-1">
                        <div className={`text-[13px] font-medium ${vValue(variant)}`}>{a.city}</div>
                        <div className={`text-[11px] ${vSub(variant)}`}>{a.label}</div>
                      </div>
                      <span className={`text-[10px] font-semibold ${vMuted(variant)}`}>{a.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-2">
                {filtered.length === 0 ? (
                  <div className={`p-10 text-center text-xs font-bold ${vEmpty(variant)}`}>Destinasi tidak ditemukan.</div>
                ) : (
                  filtered.map(a => (
                    <div key={`res-${a.code}`} onClick={() => handleSelect(a)} className={`px-4 py-2.5 cursor-pointer flex justify-between items-center transition-colors ${vItemBg(variant)}`}>
                      <div className="flex-1 pr-3">
                        <div className={`text-[13px] font-medium ${vValue(variant)}`}>{a.city}</div>
                        <div className={`text-[11px] ${vSub(variant)}`}>{a.label}</div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded ${vCode(variant)}`}>{a.code}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
      </FloatingPanel>
    </div>
  );
}

export default function HotelSearchForm({ onSearch, loading, initialData, variant = 'dark' }: Props) {
  const { language } = useLanguage();
  const tfh = i18n.searchForm[language].hotel;
  const defaultDest = initialData?.destination_id || POPULAR_DESTINATIONS[2]?.code || 'ID8731';
  const [destination, setDestination] = useState(defaultDest);
  const [formError, setFormError] = useState('');

  // Property type filter
  const PROPERTY_TYPES = [
    { value: 'all', label: language === 'EN' ? 'All' : 'Semua', icon: 'fa-solid fa-list' },
    { value: 'hotel', label: language === 'EN' ? 'Hotel' : 'Hotel', icon: 'fa-solid fa-hotel' },
    { value: 'villa', label: language === 'EN' ? 'Villa' : 'Villa', icon: 'fa-solid fa-house-chimney' },
    { value: 'apartment', label: language === 'EN' ? 'Apartment' : 'Apartemen', icon: 'fa-solid fa-building' },
  ];
  const [propertyType, setPropertyType] = useState(initialData?.property_type || 'all');

  // Combined date range picker
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const start = initialData?.checkin_date ? parseLocalDate(initialData.checkin_date) : new Date();
    const end = initialData?.checkout_date ? parseLocalDate(initialData.checkout_date) : new Date(Date.now() + 86400000);
    return [start, end];
  });

  const [pax, setPax] = useState({ 
    room: parseInt(String(initialData?.room || '1')),
    adult: parseInt(String(initialData?.adult || '2')), 
    child: parseInt(String(initialData?.child || '0')) 
  });
  
  const [childAges, setChildAges] = useState<number[]>(() =>
    (initialData?.child_ages ?? [])
      .map(age => typeof age === 'number' ? age : Number.parseInt(String(age), 10))
      .filter(Number.isFinite)
  );
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
      if (newCount > prev.length) return [...prev, ...Array(newCount - prev.length).fill(7)];
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

    if (!dateRange[0] || !dateRange[1]) {
      setFormError('Silakan pilih tanggal check-in dan check-out.');
      return;
    }

    if (dateRange[1] <= dateRange[0]) {
      setFormError('Tanggal check-out harus setelah tanggal check-in.');
      return;
    }

    const payload = {
      checkin_date: formatLocalDate(dateRange[0]),
      checkout_date: formatLocalDate(dateRange[1]),
      destination_id: destination,
      adult: pax.adult,
      child: pax.child,
      child_ages: childAges,
      room: pax.room,
      nationality: initialData?.nationality || 'ID',
      q: POPULAR_DESTINATIONS.find(d => d.code === destination)?.label || destination,
      property_type: propertyType,
    };

    onSearch(payload);
  };

  const renderGuestDropdown = () => (
    <div className="relative flex-1 min-w-[140px] shrink-0" ref={paxRef}>
      <div 
        onClick={() => setOpenPax(!openPax)}
        className={`px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all h-full ${vField(variant)}`}
      >
        <span className={`mb-1.5 text-xs font-semibold ${vFieldLabel(variant)}`}>{tfh.guests}</span>
        <div className="flex min-w-0 items-center justify-between">
          <div className="flex min-w-0 items-center gap-1.5">
            <i className="fa-solid fa-users text-sky-600 text-sm" aria-hidden="true"></i>
            <div className={`min-w-0 truncate text-sm font-medium ${vValue(variant)}`}>
              {pax.room} {tfh.room}, {pax.adult} {tfh.adult}{pax.child > 0 ? `, ${pax.child} ${tfh.child}` : ''}
            </div>
          </div>
          <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openPax ? 'rotate-180' : ''} ${vChevron(variant)}`}></i>
        </div>
      </div>

      {openPax && (
        <div className={`absolute top-full left-0 mt-2 w-full lg:w-[320px] rounded-xl z-[300] p-4 flex flex-col gap-3 animate-fade-in shadow-2xl ${vPanel(variant)}`}>
          
          {/* Room Control */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${vIconCircle(variant)}`}>
                <i className={`fa-solid fa-door-closed text-[10px]`}></i>
              </div>
              <div className="flex flex-col">
                <span className={`text-[13px] font-medium ${vValue(variant)}`}>{tfh.room}</span>
              </div>
            </div>
            <div className={`flex items-center gap-3 px-2 py-1 rounded-xl ${vStepper(variant)}`}>
              <button type="button" disabled={pax.room <= 1} onClick={() => setPax(p => ({ ...p, room: Math.max(1, p.room - 1) }))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.room <= 1 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                <i className="fa-solid fa-minus text-[10px]"></i>
              </button>
              <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{pax.room}</span>
              <button type="button" disabled={pax.room >= 5} onClick={() => setPax(p => ({ ...p, room: Math.min(5, p.room + 1) }))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.room >= 5 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                <i className="fa-solid fa-plus text-[10px]"></i>
              </button>
            </div>
          </div>

          {/* Adult Control */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${vIconCircle(variant)}`}>
                <i className={`fa-solid fa-user text-[10px]`}></i>
              </div>
              <div className="flex flex-col">
                <span className={`text-[13px] font-medium ${vValue(variant)}`}>{tfh.adult}</span>
                <span className={`text-[11px] ${vSub(variant)}`}>≥ 12 tahun</span>
              </div>
            </div>
            <div className={`flex items-center gap-3 px-2 py-1 rounded-xl ${vStepper(variant)}`}>
              <button type="button" disabled={pax.adult <= 1} onClick={() => setPax(p => ({ ...p, adult: Math.max(1, p.adult - 1) }))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.adult <= 1 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                <i className="fa-solid fa-minus text-[10px]"></i>
              </button>
              <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{pax.adult}</span>
              <button type="button" disabled={pax.adult >= 10} onClick={() => setPax(p => ({ ...p, adult: Math.min(10, p.adult + 1) }))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.adult >= 10 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                <i className="fa-solid fa-plus text-[10px]"></i>
              </button>
            </div>
          </div>

          {/* Child Control */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${vIconCircle(variant)}`}>
                <i className={`fa-solid fa-child text-[10px]`}></i>
              </div>
              <div className="flex flex-col">
                <span className={`text-[13px] font-medium ${vValue(variant)}`}>{tfh.child}</span>
                <span className={`text-[11px] ${vSub(variant)}`}>0 - 11 tahun</span>
              </div>
            </div>
            <div className={`flex items-center gap-3 px-2 py-1 rounded-xl ${vStepper(variant)}`}>
              <button type="button" disabled={pax.child <= 0} onClick={() => updateChildCount(Math.max(0, pax.child - 1))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.child <= 0 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                <i className="fa-solid fa-minus text-[10px]"></i>
              </button>
              <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{pax.child}</span>
              <button type="button" disabled={pax.child >= 4} onClick={() => updateChildCount(Math.min(4, pax.child + 1))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.child >= 4 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                <i className="fa-solid fa-plus text-[10px]"></i>
              </button>
            </div>
          </div>

          {/* Child Ages Selectors */}
          {pax.child > 0 && (
            <div className={`mt-2 pt-4 flex flex-col gap-3 ${variant === 'light' ? 'border-t border-slate-100/60' : 'border-t border-white/10'}`}>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>Umur Anak</span>
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
                    className={`text-[13px] font-medium p-2 rounded-lg outline-none transition-colors ${variant === 'light' ? 'bg-white/60 border border-white/40 text-slate-700 focus:border-orange-400' : 'bg-slate-800 text-white border border-white/10 focus:border-orange-500'}`}
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

  const renderPropertyTypeToggle = () => (
    <div className={`grid w-full grid-cols-2 gap-1 p-1 rounded-lg sm:flex sm:w-fit ${vToggle(variant)}`}>
      {PROPERTY_TYPES.map(p => (
        <button
          key={p.value}
          type="button"
          onClick={() => setPropertyType(p.value)}
          className={`flex min-h-9 items-center gap-2 px-4 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
            propertyType === p.value
              ? 'bg-sky-600 text-white shadow-sm'
              : vToggleIdle(variant)
          }`}
        >
          <i className={`${p.icon} text-[10px]`} />
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-fade-up">
      {formError && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
          <i className="fa-solid fa-circle-exclamation mr-2" />{formError}
        </div>
      )}

      {/* Baris 1: Property Type Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {renderPropertyTypeToggle()}

        {/* Spacer */}
        <div className="hidden sm:block flex-1" />
      </div>

      {/* Semua field dalam 1 baris */}
      <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-12 w-full">
        <div className="min-w-0 md:col-span-2 xl:col-span-4">
          <DestinationInput label={tfh.destination} value={destination} onChange={setDestination} icon="fa-bed" variant={variant} />
        </div>

        {/* DATE RANGE */}
        <CalendarRangeField
          startDate={dateRange[0]}
          endDate={dateRange[1]}
          onChange={(r) => setDateRange([r.from, r.to])}
          minDate={new Date()}
          defaultMonth={dateRange[0] ?? undefined}
        >
          <div className={`min-w-0 px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all md:col-span-1 xl:col-span-3 ${vField(variant)}`}>
            <span className={`mb-1.5 text-xs font-semibold ${vLabel(variant)}`}>Check-in - Check-out</span>
            <div className="flex min-w-0 items-center gap-1.5">
              <i className="fa-regular fa-calendar text-sky-600 text-sm" aria-hidden="true"></i>
              <div className={`min-w-0 truncate font-medium text-sm ${dateRange[0] ? vValue(variant) : vSub(variant)}`}>
                {dateRange[0]
                  ? `${format(dateRange[0], 'dd MMM', { locale: dateFnsId })}${dateRange[1] ? ` – ${format(dateRange[1], 'dd MMM yyyy', { locale: dateFnsId })}` : ' – Pilih checkout'}`
                  : 'Pilih tanggal'}
              </div>
            </div>
          </div>
        </CalendarRangeField>

        <div className="min-w-0 md:col-span-1 xl:col-span-3">{renderGuestDropdown()}</div>

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={loading}
          aria-label={tfh.search}
          className={`w-full h-[68px] px-4 md:col-span-2 xl:col-span-2 ${vBtnSearch(variant)}`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
              <span>{tfh.search}</span>
            </div>
          )}
        </button>
      </div>

    </form>
  );
}
