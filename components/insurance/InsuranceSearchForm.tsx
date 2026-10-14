'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { id as dateFnsId } from 'date-fns/locale';
import { CalendarField, CalendarRangeField } from '@/components/common/CalendarField';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { type FormVariant, vField, vLabel, vValue, vPanel, vItem, vStepper, vStepBtn, vIconCircle, vToggle, vToggleIdle, vChevron, vFieldLabel, vSub, vBtnSearch } from '@/lib/formVariants';

interface Props {
  onSearch: (p: any) => void;
  loading: boolean;
  initialData?: any;
  variant?: FormVariant;
}

interface ProviderTripConfig {
  code: string;
  family: string;
  dateSetting: number | null;
}

interface ProviderConfigEntry {
  trips?: ProviderTripConfig[];
  supportsSenior?: boolean;
}

type ProviderConfigMap = Record<string, ProviderConfigEntry>;

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

// Nilai `trip_type` bersifat generik; kode master_trip resmi per provider
// (mis. great_eastern: DAILY/ANNUALLY) dipetakan backend dari get_config.
const isAnnualType = (value: unknown) => /annual|anual|yearly/i.test(String(value ?? ''));

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Dropdown generic (dark style like FlightSearchForm) ──────────────────────
function DropdownSelect({
  label, icon, value, options, onChange, variant = 'dark',
}: {
  label: string;
  icon: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  variant?: FormVariant;
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
    <div className="relative flex-1 min-w-0" ref={ref}>
      <div
        onClick={() => setOpen(o => !o)}
        className={`group flex flex-col px-4 py-3 rounded-xl cursor-pointer transition-all h-full ${vField(variant)}`}
      >
        <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>{label}</span>
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <i className={`fa-solid ${icon} text-orange-500 text-[13px] shrink-0`} />
            <span className={`text-[13px] font-medium truncate ${vValue(variant)}`}>
              {selected?.label || 'Pilih...'}
            </span>
          </div>
          <i className={`fa-solid fa-chevron-down text-[9px] shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${vChevron(variant)}`} />
        </div>
      </div>

      {open && (
        <div className={`absolute top-full left-0 mt-2 w-full min-w-[220px] rounded-xl z-[9999] py-2 animate-fade-in overflow-hidden shadow-2xl ${vPanel(variant)}`}>
          {options.map(o => {
            const isActive = o.value === value;
            return (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${isActive ? 'bg-orange-500/10 text-orange-600' : vItem(variant)}`}
              >
                <span className={`text-[13px] font-medium ${isActive ? 'text-orange-600' : vValue(variant)}`}>{o.label}</span>
                {isActive && <i className="fa-solid fa-check text-orange-600 text-xs" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InsuranceSearchForm({ onSearch, loading, initialData, variant = 'dark' }: Props) {
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
  const [tripType, setTripType] = useState<string>(() => (isAnnualType(initialData?.trip_type) ? 'annual' : 'single_trip'));
  const [pax, setPax]           = useState<number>(initialData?.pax || 1);
  const [isSenior, setIsSenior] = useState<boolean>(initialData?.is_senior || false);

  // Master data provider (master_trip & date_setting) untuk penentuan tipe & tanggal tahunan.
  const [providerConfig, setProviderConfig] = useState<ProviderConfigMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/insurance/config')
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.success) setProviderConfig(d.data || {}); })
      .catch(() => { /* fallback: pakai default 365 hari */ });
    return () => { cancelled = true; };
  }, []);

  const TRIP_TYPES = [
    { value: 'single_trip', label: t.singleTrip },
    { value: 'annual', label: t.annualTrip },
  ];

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

  // Reset area when provider changes (dan turunkan tipe tahunan bila provider
  // baru tidak menyediakannya — mis. Zurich hanya single trip).
  const handleProviderChange = (val: string) => {
    setProvider(val);
    const areas = PROVIDER_AREAS[val] || PROVIDER_AREAS.all;
    setArea(areas[0].value);
    if (tripType === 'annual' && val !== 'all') {
      const cfg = providerConfig?.[val];
      if (cfg && !(cfg.trips || []).some((x) => x.family === 'annual')) setTripType('single_trip');
    }
  };

  const currentAreas = PROVIDER_AREAS[provider] || PROVIDER_AREAS.all;

  // Provider tanpa opsi tahunan tidak bisa dipilih (mis. Zurich hanya single trip).
  const providerHasAnnual = useMemo(() => {
    if (provider === 'all') return true;
    const cfg = providerConfig?.[provider];
    if (!cfg) return true; // config belum termuat → biarkan
    return (cfg.trips || []).some((x) => x.family === 'annual');
  }, [provider, providerConfig]);

  // date_setting tipe tahunan untuk provider terpilih (default 365 hari).
  const annualDateSetting = useMemo(() => {
    if (tripType !== 'annual' || provider === 'all') return 365;
    const annual = (providerConfig?.[provider]?.trips || []).find((x) => x.family === 'annual');
    return annual?.dateSetting || 365;
  }, [tripType, provider, providerConfig]);

  // Tipe efektif: paksa single bila provider tidak punya opsi tahunan.
  const effectiveTripType = tripType === 'annual' && !providerHasAnnual ? 'single_trip' : tripType;

  // Tanggal selesai tipe tahunan = tanggal mulai + date_setting (dikunci, tanpa
  // setState di effect — cukup diturunkan saat render).
  const annualEndDate = useMemo(() => {
    if (effectiveTripType !== 'annual' || !startDate) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + annualDateSetting);
    return d;
  }, [effectiveTripType, startDate, annualDateSetting]);

  const effectiveEndDate = effectiveTripType === 'annual' ? annualEndDate : endDate;

  const nights =
    startDate && effectiveEndDate
      ? Math.max(1, Math.round((effectiveEndDate.getTime() - startDate.getTime()) / 86400000))
      : 7;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      provider,
      destination_area: area,
      date_start: startDate ? formatLocalDate(startDate) : undefined,
      date_end:   effectiveEndDate ? formatLocalDate(effectiveEndDate) : undefined,
      trip_type:  effectiveTripType,
      pax,
      is_senior:  isSenior,
      nights,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 animate-fade-up">

      {/* Baris 1: Toggle tipe perjalanan (kiri) + checkbox Senior (kanan) */}
      <div className="flex items-center justify-between gap-2">
        <div className={`flex gap-1 p-1 rounded-lg w-fit ${vToggle(variant)}`}>
          {TRIP_TYPES.map(opt => {
            const disabled = opt.value === 'annual' && !providerHasAnnual;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                title={disabled ? t.annualUnsupported : undefined}
                onClick={() => setTripType(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                  effectiveTripType === opt.value
                    ? 'bg-orange-500 text-white shadow-md'
                    : vToggleIdle(variant)
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <label
          title={t.seniorHint}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
            isSenior
              ? vToggle(variant)
              : variant === 'light'
                ? 'bg-white border border-slate-200 hover:border-orange-300/50'
                : 'bg-white/5 border border-white/10 hover:border-white/25'
          }`}
        >
          <input
            type="checkbox"
            checked={isSenior}
            onChange={() => setIsSenior(!isSenior)}
            className="accent-orange-500 w-4 h-4"
          />
          <span className={`text-[11px] font-medium whitespace-nowrap ${vValue(variant)}`}>{t.senior}</span>
        </label>
      </div>

      {/* Baris 2: Semua field dalam 1 baris */}
      <div className="flex flex-col md:flex-row items-stretch gap-2">
        <DropdownSelect
          label="Provider"
          icon="fa-shield-halved"
          value={provider}
          options={PROVIDERS.map(p => ({ value: p.value, label: p.label }))}
          onChange={handleProviderChange}
          variant={variant}
        />
        <DropdownSelect
          label="Area"
          icon="fa-earth-asia"
          value={area}
          options={currentAreas}
          onChange={setArea}
          variant={variant}
        />

        {effectiveTripType === 'annual' ? (
          <>
            {/* Tanggal Mulai (tahunan) */}
            <CalendarField value={startDate} onChange={setStartDate} minDate={minDateTomorrow}>
              <div className={`flex-[0.8] min-w-[120px] px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all ${vField(variant)}`}>
                <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>{t.departure}</span>
                <div className="flex items-center gap-1.5">
                  <i className="fa-regular fa-calendar text-orange-500 text-[13px]" />
                  <div className={`text-[12px] font-medium truncate ${startDate ? vValue(variant) : vSub(variant)}`}>
                    {startDate ? format(startDate, 'dd MMM yyyy', { locale: dateFnsId }) : 'Pilih'}
                  </div>
                </div>
              </div>
            </CalendarField>

            {/* Tanggal Selesai — otomatis & dikunci untuk tipe tahunan */}
            <div className={`flex-[0.8] min-w-[120px] px-4 py-3 rounded-xl flex flex-col justify-center ${vField(variant)}`}>
              <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>
                {t.return}
                <span className="ml-1 text-orange-400">· {t.annualLocked}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-lock text-orange-500 text-[13px]" />
                <span className={`text-[13px] font-medium truncate ${vValue(variant)}`}>
                  {effectiveEndDate ? effectiveEndDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <CalendarRangeField
            startDate={startDate}
            endDate={endDate}
            onChange={(r) => { setStartDate(r.from); setEndDate(r.to); }}
            minDate={minDateTomorrow}
            defaultMonth={startDate ?? minDateTomorrow}
          >
            <div className={`flex-[1.4] min-w-[170px] px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all ${vField(variant)}`}>
              <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vLabel(variant)}`}>
                {t.departure} – {t.return}
                {startDate && endDate && nights > 0 && (
                  <span className="ml-1 text-orange-400">· {nights} {tc.night}</span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <i className="fa-regular fa-calendar text-orange-500 text-[13px]" />
                <div className={`text-[12px] font-medium truncate ${startDate ? vValue(variant) : vSub(variant)}`}>
                  {startDate
                    ? `${format(startDate, 'dd MMM', { locale: dateFnsId })}${endDate ? ` – ${format(endDate, 'dd MMM yyyy', { locale: dateFnsId })}` : ' – Pilih selesai'}`
                    : 'Pilih tanggal'}
                </div>
              </div>
            </div>
          </CalendarRangeField>
        )}

        {/* Peserta */}
        <div className="relative flex-1 min-w-[140px] shrink-0" ref={paxRef}>
          <div
            onClick={() => setOpenPax(o => !o)}
            className={`px-4 py-3 rounded-xl flex flex-col justify-center cursor-pointer transition-all h-full ${vField(variant)}`}
          >
            <span className={`text-[10px] font-medium uppercase tracking-wider mb-0 ${vFieldLabel(variant)}`}>{t.passengers}</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-users text-orange-500 text-[13px]" />
                <div className={`text-[13px] font-medium ${vValue(variant)}`}>
                  {pax} Peserta
                </div>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openPax ? 'rotate-180' : ''} ${vChevron(variant)}`} />
            </div>
          </div>

          {openPax && (
            <div className={`absolute top-full right-0 mt-2 w-full lg:w-[280px] rounded-xl z-[9999] p-4 flex flex-col gap-4 animate-fade-in shadow-2xl ${vPanel(variant)}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${vIconCircle(variant)}`}>
                    <i className="fa-solid fa-user text-[10px]" />
                  </div>
                  <div>
                    <span className={`text-[13px] font-medium block ${vValue(variant)}`}>Jumlah Peserta</span>
                    <span className={`text-[10px] ${vSub(variant)}`}>Maks. 9 orang</span>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${vStepper(variant)}`}>
                  <button type="button" disabled={pax <= 1} onClick={() => setPax(p => Math.max(1, p - 1))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax <= 1 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                    <i className="fa-solid fa-minus text-[10px]" />
                  </button>
                  <span className={`text-[13px] font-medium w-4 text-center ${vValue(variant)}`}>{pax}</span>
                  <button type="button" disabled={pax >= 9} onClick={() => setPax(p => Math.min(9, p + 1))} className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${pax >= 9 ? 'opacity-30 cursor-not-allowed' : vStepBtn(variant)}`}>
                    <i className="fa-solid fa-plus text-[10px]" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className={`shrink-0 w-full sm:w-full lg:w-12 h-12 lg:h-full min-h-[52px] flex items-center justify-center rounded-xl ${vBtnSearch(variant)}`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="flex items-center gap-2 lg:gap-0">
              <i className="fa-solid fa-magnifying-glass text-sm" />
              <span className="text-sm font-semibold lg:hidden">{t.search}</span>
            </div>
          )}
        </button>
      </div>

    </form>
  );
}
