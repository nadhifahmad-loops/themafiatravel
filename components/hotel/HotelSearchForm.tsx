'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { id as dateFnsId, enUS as dateFnsEnUS } from 'date-fns/locale';
import { CalendarRangeField } from '@/components/common/CalendarField';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { type HotelPropertyType } from '@/lib/hotel-property-type';
import { type FormVariant, vFormField, vFormHeading, vFormLabel, vValue, vPanel, vInput, vItem, vItemBg, vSub, vMuted, vCode, vDiv, vSection, vStepper, vStepBtn, vIconCircle, vEmpty, vChevron, vBtnSearch, vField, vToggle, vToggleIdle } from '@/lib/formVariants';

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
  property_type: HotelPropertyType;
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

const NATIONALITIES = [
  { code: 'ID', id: 'Indonesia', en: 'Indonesia' },
  { code: 'SG', id: 'Singapura', en: 'Singapore' },
  { code: 'MY', id: 'Malaysia', en: 'Malaysia' },
  { code: 'TH', id: 'Thailand', en: 'Thailand' },
  { code: 'AU', id: 'Australia', en: 'Australia' },
  { code: 'CN', id: 'Tiongkok', en: 'China' },
  { code: 'GB', id: 'Inggris', en: 'United Kingdom' },
  { code: 'JP', id: 'Jepang', en: 'Japan' },
  { code: 'US', id: 'Amerika Serikat', en: 'United States' },
];

const DESTINATION_OPTIONS = POPULAR_DESTINATIONS;

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
function DestinationInput({ label, value, onChange, icon, variant = 'dark', id }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: string;
  variant?: FormVariant;
  id?: string;
}) {
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
            typeof item?.city === 'string' &&
            POPULAR_DESTINATIONS.some(destination => destination.code === item.code)
          )
        : [];
    } catch {
      return [];
    }
  });
  const ref = useRef<HTMLDivElement>(null);
  const labelId = id ? `${id}-label` : undefined;

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
    <div className="relative flex w-full flex-col" ref={ref}>
      <span id={labelId} className={vFormLabel(variant)}>{label}</span>
      <div className={`flex min-h-11 items-center rounded-md ${vField(variant)}`}>
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={labelId}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className="group flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
        >
          <i className={`fa-solid ${icon} shrink-0 text-sky-600 text-sm`} aria-hidden="true"></i>
          <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${vValue(variant)}`}>
            {selected ? selected.label : (value || tfh.destination)}
          </span>
          <i className={`fa-solid fa-chevron-down text-[10px] ${vChevron(variant)}`} aria-hidden="true"></i>
        </button>
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
                    <div className={`px-4 py-2 text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>{language === 'EN' ? 'Recent searches' : 'Pencarian Terakhir'}</div>
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
                  <div className={`px-4 py-2 text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>{language === 'EN' ? 'Popular destinations' : 'Destinasi Populer'}</div>
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
                  <div className={`p-10 text-center text-xs font-bold ${vEmpty(variant)}`}>{language === 'EN' ? 'Destination not found.' : 'Destinasi tidak ditemukan.'}</div>
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
  const isEnglish = language === 'EN';
  const dateLocale = isEnglish ? dateFnsEnUS : dateFnsId;
  const defaultDest = initialData?.destination_id || POPULAR_DESTINATIONS[2]?.code || 'ID8731';
  const [destination, setDestination] = useState(defaultDest);
  const [propertyType, setPropertyType] = useState<HotelPropertyType>(initialData?.property_type || 'all');
  const [nationality, setNationality] = useState(initialData?.nationality || 'ID');
  const [formError, setFormError] = useState('');

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
      const target = e.target as Node;
      if (paxRef.current && !paxRef.current.contains(target) && !(e.target as HTMLElement).closest?.('[data-floating-panel]')) setOpenPax(false);
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
      setFormError(isEnglish ? 'Please choose a destination first.' : 'Silakan pilih destinasi terlebih dahulu.');
      return;
    }

    if (!dateRange[0] || !dateRange[1]) {
      setFormError(isEnglish ? 'Please choose check-in and check-out dates.' : 'Silakan pilih tanggal check-in dan check-out.');
      return;
    }

    if (dateRange[1] <= dateRange[0]) {
      setFormError(isEnglish ? 'Check-out date must be after check-in date.' : 'Tanggal check-out harus setelah tanggal check-in.');
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
      nationality,
      q: POPULAR_DESTINATIONS.find(d => d.code === destination)?.label || destination,
      property_type: propertyType,
    };

    onSearch(payload);
  };

  const renderGuestDropdown = () => (
    <div className="relative flex flex-col" ref={paxRef}>
      <span id="hotel-guests-label" className={vFormLabel(variant)}>{tfh.guests}</span>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={openPax}
        aria-labelledby="hotel-guests-label"
        onClick={() => setOpenPax(!openPax)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenPax(!openPax); } }}
        className={`flex h-full cursor-pointer items-center justify-between transition-all ${vFormField(variant)}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <i className="fa-solid fa-users text-sky-600 text-sm" aria-hidden="true"></i>
          <div className={`min-w-0 truncate text-sm font-medium ${vValue(variant)}`}>
            {pax.room} {tfh.room}, {pax.adult} {tfh.adult}{pax.child > 0 ? `, ${pax.child} ${tfh.child}` : ''}
          </div>
        </div>
        <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openPax ? 'rotate-180' : ''} ${vChevron(variant)}`}></i>
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
              <button type="button" aria-label={`${isEnglish ? 'Remove' : 'Kurangi'} ${tfh.room}`} disabled={pax.room <= 1} onClick={() => setPax(p => ({ ...p, room: Math.max(1, p.room - 1) }))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.room <= 1 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                <i className="fa-solid fa-minus text-[10px]"></i>
              </button>
              <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{pax.room}</span>
              <button type="button" aria-label={`${isEnglish ? 'Add' : 'Tambah'} ${tfh.room}`} disabled={pax.room >= Math.min(5, pax.adult)} onClick={() => setPax(p => ({ ...p, room: Math.min(5, p.adult, p.room + 1) }))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.room >= Math.min(5, pax.adult) ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
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
                <span className={`text-[11px] ${vSub(variant)}`}>≥ 12 {isEnglish ? 'yrs' : 'tahun'}</span>
              </div>
            </div>
            <div className={`flex items-center gap-3 px-2 py-1 rounded-xl ${vStepper(variant)}`}>
              <button type="button" aria-label={`${isEnglish ? 'Remove' : 'Kurangi'} ${tfh.adult}`} disabled={pax.adult <= pax.room} onClick={() => setPax(p => ({ ...p, adult: Math.max(p.room, p.adult - 1) }))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.adult <= pax.room ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                <i className="fa-solid fa-minus text-[10px]"></i>
              </button>
              <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{pax.adult}</span>
              <button type="button" aria-label={`${isEnglish ? 'Add' : 'Tambah'} ${tfh.adult}`} disabled={pax.adult >= 9} onClick={() => setPax(p => ({ ...p, adult: Math.min(9, p.adult + 1) }))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.adult >= 9 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
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
                <span className={`text-[11px] ${vSub(variant)}`}>0 - 12 {isEnglish ? 'yrs' : 'tahun'}</span>
              </div>
            </div>
            <div className={`flex items-center gap-3 px-2 py-1 rounded-xl ${vStepper(variant)}`}>
              <button type="button" aria-label={`${isEnglish ? 'Remove' : 'Kurangi'} ${tfh.child}`} disabled={pax.child <= 0} onClick={() => updateChildCount(Math.max(0, pax.child - 1))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.child <= 0 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                <i className="fa-solid fa-minus text-[10px]"></i>
              </button>
              <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{pax.child}</span>
              <button type="button" aria-label={`${isEnglish ? 'Add' : 'Tambah'} ${tfh.child}`} disabled={pax.child >= 9} onClick={() => updateChildCount(Math.min(9, pax.child + 1))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax.child >= 9 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                <i className="fa-solid fa-plus text-[10px]"></i>
              </button>
            </div>
          </div>

          {/* Child Ages Selectors */}
          {pax.child > 0 && (
            <div className={`mt-2 pt-4 flex flex-col gap-3 ${variant === 'light' ? 'border-t border-slate-100/60' : 'border-t border-white/10'}`}>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>{isEnglish ? 'Child ages' : 'Umur Anak'}</span>
              <div className="grid grid-cols-2 gap-2">
                {childAges.map((age, idx) => (
                  <select
                    key={idx}
                    aria-label={`${isEnglish ? 'Child' : 'Anak'} ${idx + 1}`}
                    value={age}
                    onChange={(e) => {
                      const newAges = [...childAges];
                      newAges[idx] = parseInt(e.target.value);
                      setChildAges(newAges);
                    }}
                    className={`text-[13px] font-medium p-2 rounded-md outline-none transition-colors ${variant === 'light' ? 'bg-white/60 border border-white/40 text-slate-700 focus:border-orange-400' : 'bg-slate-800 text-white border border-white/10 focus:border-orange-500'}`}
                  >
                    {Array.from({length: 13}).map((_, i) => (
                      <option key={i} value={i}>{i} {isEnglish ? 'yrs' : 'Tahun'}</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          )}

          {/* Nationality */}
          <div className={`mt-1 pt-3 flex flex-col gap-2 ${variant === 'light' ? 'border-t border-slate-100/60' : 'border-t border-white/10'}`}>
            <label htmlFor="hotel-nationality" className={`text-[10px] font-semibold uppercase tracking-wider ${vSection(variant)}`}>
              {tfh.nationality}
            </label>
            <select
              id="hotel-nationality"
              value={nationality}
              onChange={event => setNationality(event.target.value)}
              className={`w-full cursor-pointer rounded-md border px-3 py-2 text-[13px] font-medium outline-none transition-colors ${
                variant === 'light'
                  ? 'border-slate-200 bg-white text-slate-700 focus:border-orange-400'
                  : 'border-white/10 bg-slate-800 text-white focus:border-orange-500'
              }`}
            >
              {NATIONALITIES.map(option => (
                <option key={option.code} value={option.code}>
                  {isEnglish ? option.en : option.id} ({option.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );

  const PROPERTY_TYPES = [
    { value: 'all', label: isEnglish ? 'All' : 'Semua', icon: 'fa-list' },
    { value: 'hotel', label: 'Hotel', icon: 'fa-hotel' },
    { value: 'villa', label: 'Villa', icon: 'fa-house-chimney' },
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-fade-up">
      {/* Baris 1: Jenis properti (selaras dengan trip type di form lain) */}
      <section>
        <h3 className={vFormHeading(variant)}>{tfh.tripTypeLabel}</h3>
        <div className={`grid w-full grid-cols-3 gap-1 rounded-lg p-1 sm:flex sm:w-fit ${vToggle(variant)}`}>
          {PROPERTY_TYPES.map(option => (
            <button
              key={option.value}
              type="button"
              aria-pressed={propertyType === option.value}
              onClick={() => setPropertyType(option.value)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-center text-xs font-semibold transition-all sm:px-4 ${
                propertyType === option.value
                  ? 'bg-sky-600 text-white shadow-sm'
                  : vToggleIdle(variant)
              }`}
            >
              <i className={`fa-solid ${option.icon}`} aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* Baris 2: Semua field + tombol cari dalam satu baris */}
      <div className="grid w-full grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col md:col-span-2 xl:col-span-4">
          <DestinationInput
            id="hotel-destination"
            label={isEnglish ? 'City or destination' : 'Kota atau destinasi'}
            value={destination}
            onChange={setDestination}
            icon="fa-location-dot"
            variant={variant}
          />
        </div>

        {/* DATE RANGE */}
        <div className="flex flex-col md:col-span-1 xl:col-span-3">
          <span id="hotel-dates-label" className={vFormLabel(variant)}>{tfh.checkin} – {tfh.checkout}</span>
          <CalendarRangeField
            startDate={dateRange[0]}
            endDate={dateRange[1]}
            onChange={(r) => setDateRange([r.from, r.to])}
            minDate={new Date()}
            defaultMonth={dateRange[0] ?? undefined}
          >
            <div className={`flex h-full min-w-0 cursor-pointer items-center gap-1.5 transition-all ${vFormField(variant)}`}>
              <i className="fa-regular fa-calendar text-sky-600 text-sm" aria-hidden="true"></i>
              <div className={`min-w-0 truncate text-sm font-medium ${dateRange[0] ? vValue(variant) : vSub(variant)}`}>
                {dateRange[0]
                  ? `${format(dateRange[0], 'dd MMM', { locale: dateLocale })}${dateRange[1] ? ` – ${format(dateRange[1], 'dd MMM yyyy', { locale: dateLocale })}` : ` – ${tfh.checkout}`}`
                  : tfh.checkin}
              </div>
            </div>
          </CalendarRangeField>
        </div>

        <div className="flex min-w-0 flex-col md:col-span-1 xl:col-span-3">{renderGuestDropdown()}</div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full md:col-span-2 xl:col-span-2 ${vBtnSearch(variant)}`}
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          )}
          {loading ? (isEnglish ? 'Searching...' : 'Mencari...') : tfh.search}
        </button>
      </div>

      {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
    </form>
  );
}
