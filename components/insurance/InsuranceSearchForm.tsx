'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from 'react-datepicker';
import { id as localeId } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
registerLocale('id', localeId);

interface Props {
  onSearch: (p: any) => void;
  loading: boolean;
  initialData?: any;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const PROVIDERS = [
  { value: 'all',           label: 'Semua Provider',  icon: 'fa-globe' },
  { value: 'assistcard',    label: 'Assist Card',     icon: 'fa-briefcase-medical' },
  { value: 'bcainsurance',  label: 'BCA Insurance',   icon: 'fa-building-columns' },
  { value: 'zurich',        label: 'Zurich',          icon: 'fa-shield-halved' },
  { value: 'great_eastern', label: 'Great Eastern',   icon: 'fa-leaf' },
  { value: 'oona',          label: 'Oona',            icon: 'fa-umbrella' },
];

const PROVIDER_AREAS: Record<string, { value: string; label: string }[]> = {
  assistcard:    [
    { value: 'Asia',                            label: 'Asia' },
    { value: 'Europe',                          label: 'Eropa' },
    { value: 'North America',                   label: 'Amerika Utara' },
    { value: 'South America',                   label: 'Amerika Selatan' },
    { value: 'Africa',                          label: 'Afrika' },
    { value: 'Oceania',                         label: 'Oseania' },
    { value: 'Multiple Destinations',           label: 'Multi Destinasi' },
    { value: 'Domestic',                        label: 'Domestik' },
  ],
  bcainsurance:  [
    { value: 'Asia Pasifik',   label: 'Asia Pasifik' },
    { value: 'Worldwide',      label: 'Seluruh Dunia' },
    { value: 'Negara Schengen',label: 'Schengen' },
    { value: 'Domestik',       label: 'Domestik' },
  ],
  zurich:        [
    { value: 'Asia Pacific',                    label: 'Asia Pasifik' },
    { value: 'Asia',                            label: 'Asia' },
    { value: 'Europe',                          label: 'Eropa' },
    { value: 'Schengen',                        label: 'Schengen' },
    { value: 'Worldwide',                       label: 'Seluruh Dunia' },
    { value: 'Worldwide Excluding USA, Canada', label: 'Worldwide Excl. USA/CA' },
    { value: 'ASEAN',                           label: 'ASEAN' },
    { value: 'Domestic',                        label: 'Domestik' },
  ],
  great_eastern: [
    { value: 'Asia Pacific',            label: 'Asia Pasifik' },
    { value: 'ASEAN',                   label: 'ASEAN' },
    { value: 'Worldwide',               label: 'Seluruh Dunia' },
    { value: 'Worldwide exc US/Canada', label: 'Worldwide Excl. USA/CA' },
    { value: 'Domestic',                label: 'Domestik' },
  ],
  oona: [
    { value: 'All', label: 'Semua Destinasi' },
  ],
  all: [
    { value: 'Asia',         label: 'Asia' },
    { value: 'Asia Pacific', label: 'Asia Pasifik' },
    { value: 'Europe',       label: 'Eropa' },
    { value: 'ASEAN',        label: 'ASEAN' },
    { value: 'Worldwide',    label: 'Seluruh Dunia' },
    { value: 'Domestic',     label: 'Domestik' },
  ],
};

const TRIP_TYPES = [
  { value: 'single_trip', label: 'Sekali Jalan' },
  { value: 'annual_trip', label: 'Tahunan' },
];

// ─── Dropdown generic (dark style like FlightSearchForm) ──────────────────────
function DropdownSelect({
  label, icon, value, options, onChange,
}: {
  label: string;
  icon: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative flex-1 w-full" ref={ref}>
      <div
        onClick={() => setOpen(o => !o)}
        className="group flex flex-col px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl cursor-pointer transition-all h-full"
      >
        <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-0.5">{label}</span>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <i className={`fa-solid ${icon} text-orange-500 text-sm shrink-0`} />
            <span className="font-black text-white text-sm truncate">
              {selected?.label || 'Pilih...'}
            </span>
          </div>
          <i className={`fa-solid fa-chevron-down text-white/30 text-xs shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[220px] bg-slate-900 border border-white/10 shadow-2xl rounded-2xl z-[100] py-2 animate-fade-in overflow-hidden">
          {options.map(o => {
            const isActive = o.value === value;
            return (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`px-5 py-3 flex items-center justify-between cursor-pointer transition-colors ${isActive ? 'bg-orange-600/10' : 'hover:bg-white/5'}`}
              >
                <span className={`text-sm font-bold ${isActive ? 'text-orange-400' : 'text-white'}`}>{o.label}</span>
                {isActive && <i className="fa-solid fa-check text-orange-500 text-xs" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InsuranceSearchForm({ onSearch, loading, initialData }: Props) {
  const { language } = useLanguage();
  const t = i18n.searchForm[language].insurance;
  const tc = i18n.common[language];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDateTomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const [provider, setProvider] = useState<string>(initialData?.provider || 'all');
  const [area, setArea]         = useState<string>(initialData?.destination_area || 'Asia');
  const [tripType, setTripType] = useState<string>(initialData?.trip_type || 'single_trip');
  const [pax, setPax]           = useState<number>(initialData?.pax || 1);
  const [isSenior, setIsSenior] = useState<boolean>(initialData?.is_senior || false);

  const [startDate, setStartDate] = useState<Date | null>(() => {
    if (initialData?.date_start) return new Date(initialData.date_start);
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d;
  });
  const [endDate, setEndDate] = useState<Date | null>(() => {
    if (initialData?.date_end) return new Date(initialData.date_end);
    const d = new Date(); d.setDate(d.getDate() + 8);
    return d;
  });

  const [openPax, setOpenPax] = useState(false);
  const paxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (paxRef.current && !paxRef.current.contains(e.target as Node)) setOpenPax(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  // Reset area when provider changes
  const handleProviderChange = (val: string) => {
    setProvider(val);
    const areas = PROVIDER_AREAS[val] || PROVIDER_AREAS.all;
    setArea(areas[0].value);
  };

  const currentAreas = PROVIDER_AREAS[provider] || PROVIDER_AREAS.all;

  const nights =
    startDate && endDate
      ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000))
      : 7;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      provider,
      destination_area: area,
      date_start: startDate?.toISOString().split('T')[0],
      date_end:   endDate?.toISOString().split('T')[0],
      trip_type:  tripType,
      pax,
      is_senior:  isSenior,
      nights,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 animate-fade-up">

      {/* TRIP TYPE TOGGLE */}
      <div className="flex gap-1.5 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
        {TRIP_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTripType(t.value)}
            className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${
              tripType === t.value
                ? 'bg-orange-600 text-white shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ROW 1: PROVIDER + AREA TUJUAN */}
      <div className="flex flex-col md:flex-row gap-3">
        <DropdownSelect
          label="Provider Asuransi"
          icon="fa-shield-halved"
          value={provider}
          options={PROVIDERS.map(p => ({ value: p.value, label: p.label }))}
          onChange={handleProviderChange}
        />
        <DropdownSelect
          label="Area Tujuan"
          icon="fa-earth-asia"
          value={area}
          options={currentAreas}
          onChange={setArea}
        />
      </div>

      {/* ROW 2: TANGGAL + PESERTA + BUTTON */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4 border-t border-white/10 pt-4">

        {/* Tanggal Mulai */}
        <div className="flex-1 min-w-[150px] px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all">
          <span className="text-[10px] text-white/50 font-bold uppercase mb-0.5">{t.departure}</span>
          <div className="flex items-center gap-3">
            <i className="fa-regular fa-calendar text-orange-500 text-base" />
            <DatePicker
              selected={startDate}
              onChange={(d: Date | null) => {
                setStartDate(d);
                if (d && endDate && d >= endDate) {
                  const nd = new Date(d); nd.setDate(nd.getDate() + 7);
                  setEndDate(nd);
                }
              }}
              minDate={minDateTomorrow}
              locale="id"
              className="bg-transparent text-white font-black outline-none w-full text-base cursor-pointer"
              dateFormat="dd MMM yyyy"
              placeholderText="Pilih tanggal"
            />
          </div>
        </div>

        {/* Tanggal Selesai */}
        <div className="flex-1 min-w-[150px] px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all">
          <span className="text-[10px] text-white/50 font-bold uppercase mb-0.5">
            {t.return}
            {nights > 0 && (
              <span className="ml-1 text-orange-400">· {nights} {tc.night}</span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <i className="fa-regular fa-calendar-check text-orange-500 text-base" />
            <DatePicker
              selected={endDate}
              onChange={(d: Date | null) => setEndDate(d)}
              minDate={startDate ? new Date(startDate.getTime() + 86400000) : minDateTomorrow}
              locale="id"
              className="bg-transparent text-white font-black outline-none w-full text-base cursor-pointer"
              dateFormat="dd MMM yyyy"
              placeholderText="Pilih tanggal"
            />
          </div>
        </div>

        {/* Peserta */}
        <div className="relative flex-1 min-w-[200px]" ref={paxRef}>
          <div
            onClick={() => setOpenPax(o => !o)}
            className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center cursor-pointer hover:bg-white/10 transition-all h-full"
          >
            <span className="text-[9px] text-white/40 font-bold uppercase mb-0.5">{t.passengers}</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-users text-orange-500 text-sm" />
                <div className="text-white font-black text-sm">
                  {pax} Peserta{isSenior && <span className="ml-1.5 text-[10px] text-orange-400 font-bold">· Senior</span>}
                </div>
              </div>
              <i className={`fa-solid fa-chevron-down text-white/30 text-xs transition-transform ${openPax ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {openPax && (
            <div className="absolute top-full left-0 mt-2 w-full lg:w-[280px] bg-slate-900 border border-white/10 shadow-2xl rounded-2xl z-[100] p-4 flex flex-col gap-4 animate-fade-in">
              {/* Jumlah Peserta */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                    <i className="fa-solid fa-user text-white/50 text-xs" />
                  </div>
                  <div>
                    <span className="text-white font-bold text-sm block">Jumlah Peserta</span>
                    <span className="text-[10px] text-white/40">Maks. 9 orang</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 px-2 py-1 rounded-xl border border-white/5">
                  <button type="button" onClick={() => setPax(p => Math.max(1, p - 1))} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                    <i className="fa-solid fa-minus text-xs" />
                  </button>
                  <span className="text-white font-black text-sm w-4 text-center">{pax}</span>
                  <button type="button" onClick={() => setPax(p => Math.min(9, p + 1))} className="w-7 h-7 rounded-lg hover:bg-orange-600 text-white transition-colors flex items-center justify-center">
                    <i className="fa-solid fa-plus text-xs" />
                  </button>
                </div>
              </div>

              {/* Senior Toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <div className={`w-10 h-6 rounded-full relative transition-colors ${isSenior ? 'bg-orange-600' : 'bg-white/10'}`} onClick={() => setIsSenior(s => !s)}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isSenior ? 'left-5' : 'left-1'}`} />
                </div>
                <div>
                  <span className="text-white font-bold text-sm block">Senior (60+)</span>
                  <span className="text-[10px] text-white/40">Peserta berusia 60 tahun ke atas</span>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-full lg:w-16 h-12 lg:h-16 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 shadow-md shadow-orange-600/20 transition-all flex items-center justify-center active:scale-95 disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="flex items-center gap-2 lg:gap-0">
              <i className="fa-solid fa-magnifying-glass text-sm" />
              <span className="text-sm font-bold lg:hidden">{t.search}</span>
            </div>
          )}
        </button>
      </div>

    </form>
  );
}
