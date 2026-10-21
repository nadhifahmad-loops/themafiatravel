'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { enUS, id as dateFnsId } from 'date-fns/locale';
import { CalendarField, CalendarRangeField } from '@/components/common/CalendarField';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import {
  type FormVariant,
  vBtnSearch,
  vChevron,
  vField,
  vPanel,
  vStepBtn,
  vStepper,
  vSub,
  vToggle,
  vToggleIdle,
  vValue,
} from '@/lib/formVariants';

interface Props {
  onSearch: (payload: InsuranceSearchPayload) => void;
  loading: boolean;
  initialData?: {
    provider?: string;
    destination?: string;
    destination_area?: string;
    international?: boolean;
    date_start?: string;
    date_end?: string;
    trip_type?: string;
    pax?: number;
    adult?: number;
    child?: number;
    is_senior?: boolean;
  };
  variant?: FormVariant;
}

export interface InsuranceSearchPayload {
  provider: string;
  destination: string;
  destination_area: string;
  international: boolean;
  date_start: string;
  date_end: string;
  trip_type: 'single_trip' | 'annual';
  pax: number;
  adult: number;
  child: number;
  is_senior: boolean;
  nights: number;
}

type DestinationRegion = 'Asia' | 'Europe' | 'North America' | 'South America' | 'Africa' | 'Oceania' | 'Worldwide';

interface DestinationCountry {
  id: string;
  en: string;
  region: DestinationRegion;
  apiName?: string;
}

type SelectedDestination = DestinationCountry;

function destinationRegion(area: string): DestinationRegion {
  if (/asia|asean|apac/i.test(area)) return 'Asia';
  if (/europe|schengen/i.test(area)) return 'Europe';
  if (/north america/i.test(area)) return 'North America';
  if (/south america/i.test(area)) return 'South America';
  if (/africa/i.test(area)) return 'Africa';
  if (/oceania/i.test(area)) return 'Oceania';
  return 'Worldwide';
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value?: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateAfter(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDestinationArea(destinations: SelectedDestination[]): string {
  if (destinations.length === 0) return 'Worldwide';
  const regions = new Set(destinations.map((destination) => destination.region));
  if (regions.size > 1) return 'Multiple Destinations';
  return destinations[0].region;
}

export default function InsuranceSearchForm({
  onSearch,
  loading,
  initialData,
  variant = 'dark',
}: Props) {
  const { language } = useLanguage();
  const t = i18n.searchForm[language].insurance;
  const isEnglish = language === 'EN';
  const dateLocale = isEnglish ? enUS : dateFnsId;
  const travelersRef = useRef<HTMLDivElement>(null);
  const destinationsRef = useRef<HTMLDivElement>(null);

  const initialPax = Math.min(9, Math.max(1, Number(initialData?.pax) || 1));
  const initialAdult = Math.min(initialPax, Math.max(1, Number(initialData?.adult) || initialPax));
  const initialChild = Math.min(9 - initialAdult, Math.max(0, Number(initialData?.child) || 0));
  const initialInternational = initialData?.international
    ?? !/domestic|domestik/i.test(initialData?.destination_area || '');

  const [international, setInternational] = useState(initialInternational);
  const [tripType, setTripType] = useState<'single_trip' | 'annual'>(
    /annual|anual|yearly/i.test(initialData?.trip_type || '') ? 'annual' : 'single_trip',
  );
  const [destinations, setDestinations] = useState<SelectedDestination[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<SelectedDestination[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [destinationsUnavailable, setDestinationsUnavailable] = useState(false);
  const [destinationInput, setDestinationInput] = useState('');
  const [adult, setAdult] = useState(initialAdult);
  const [child, setChild] = useState(initialChild);
  const [travelerOpen, setTravelerOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [error, setError] = useState('');

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const startDateDefault = dateAfter(today, 1);
  const [startDate, setStartDate] = useState<Date | null>(
    () => parseLocalDate(initialData?.date_start) ?? startDateDefault,
  );
  const [endDate, setEndDate] = useState<Date | null>(
    () => parseLocalDate(initialData?.date_end) ?? dateAfter(startDateDefault, 7),
  );

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!travelersRef.current?.contains(target)) setTravelerOpen(false);
      if (!destinationsRef.current?.contains(target)) setDestinationOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/insurance/config')
      .then(async (response) => {
        if (!response.ok) throw new Error('Gagal memuat daftar tujuan asuransi.');
        const result = await response.json();
        const providers = result?.success && result.data && typeof result.data === 'object'
          ? Object.values(result.data as Record<string, {
            destinations?: unknown;
            destinationAreas?: unknown;
          }>)
          : [];
        const options = new Map<string, SelectedDestination>();
        for (const provider of providers) {
          const names = Array.isArray(provider.destinations)
            ? provider.destinations.filter((name): name is string => typeof name === 'string')
            : [];
          const areas = provider.destinationAreas && typeof provider.destinationAreas === 'object'
            ? provider.destinationAreas as Record<string, string>
            : {};
          for (const name of names) {
            if (/^indonesia$/i.test(name.trim())) continue;
            const option: SelectedDestination = {
              id: name,
              en: name,
              region: destinationRegion(areas[name] ?? ''),
              apiName: name,
            };
            if (!options.has(option.id.toLowerCase())) options.set(option.id.toLowerCase(), option);
          }
        }
        if (options.size === 0) throw new Error('Daftar tujuan tidak tersedia dari API asuransi.');
        if (!cancelled) {
          const availableOptions = [...options.values()].sort((a, b) => {
            const aLabel = isEnglish ? a.en : a.id;
            const bLabel = isEnglish ? b.en : b.id;
            return aLabel.localeCompare(bLabel);
          });
          setDestinationOptions(availableOptions);
          const initialNames = initialData?.destination?.split(',').map((name) => name.trim()).filter(Boolean) ?? [];
          setDestinations(initialNames.flatMap((name) => {
            const match = availableOptions.find((option) => (
              option.apiName?.toLowerCase() === name.toLowerCase()
              || option.id.toLowerCase() === name.toLowerCase()
              || option.en.toLowerCase() === name.toLowerCase()
            ));
            return match ? [match] : [];
          }).slice(0, 5));
          setDestinationsUnavailable(false);
        }
      })
      .catch((error: unknown) => {
        console.error('[INSURANCE FORM] Gagal memuat daftar tujuan:', error);
        if (!cancelled) setDestinationsUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setDestinationsLoading(false);
      });
    return () => { cancelled = true; };
  }, [initialData?.destination, isEnglish]);

  const totalPax = adult + child;
  const annualEndDate = startDate ? dateAfter(startDate, 365) : null;
  const effectiveEndDate = tripType === 'annual' ? annualEndDate : endDate;
  const nights = startDate && effectiveEndDate
    ? Math.max(1, Math.round((effectiveEndDate.getTime() - startDate.getTime()) / 86400000))
    : 7;

  const filteredCountries = useMemo(() => {
    const query = destinationInput.trim().toLowerCase();
    if (!query) return destinationOptions.filter(
      (country) => !destinations.some((destination) => destination.id === country.id),
    );
    return destinationOptions.filter((country) => (
      !destinations.some((destination) => destination.id === country.id)
      && (country.id.toLowerCase().includes(query) || country.en.toLowerCase().includes(query))
    ));
  }, [destinationInput, destinationOptions, destinations]);

  const addDestination = (country?: DestinationCountry) => {
    const candidate = country
      ? destinationOptions.find((option) => option.id === country.id)
      : undefined;
    if (!candidate || destinations.length >= 5) return;
    if (!destinations.some((destination) => destination.id.toLowerCase() === candidate.id.toLowerCase())) {
      setDestinations((current) => [...current, candidate]);
    }
    setDestinationInput('');
    setDestinationOpen(false);
    setError('');
  };

  const removeDestination = (countryId: string) => {
    setDestinations((current) => current.filter((destination) => destination.id !== countryId));
  };

  const adjustTravelerCount = (type: 'adult' | 'child', change: number) => {
    if (type === 'adult') {
      setAdult((count) => Math.min(9 - child, Math.max(1, count + change)));
    } else {
      setChild((count) => Math.min(9 - adult, Math.max(0, count + change)));
    }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isAnnual = tripType === 'annual';
    const isInternational = isAnnual || international;
    const destination = isInternational && !isAnnual
      ? destinations.map((item) => item.apiName || item.en).join(', ')
      : '';

    if (isInternational && !isAnnual && !destination) {
      setError(isEnglish ? 'Choose at least one destination.' : 'Pilih tujuan perjalanan terlebih dahulu.');
      return;
    }
    if (isInternational && !isAnnual && destinationsUnavailable) {
      setError(isEnglish ? 'Destination list is unavailable. Please try again later.' : 'Daftar negara tujuan belum tersedia. Silakan coba lagi nanti.');
      return;
    }
    if (!startDate || !effectiveEndDate || effectiveEndDate <= startDate) {
      setError(isEnglish ? 'Choose valid coverage dates.' : 'Pilih tanggal perlindungan yang valid.');
      return;
    }

    setError('');
    onSearch({
      provider: 'all',
      destination,
      destination_area: isAnnual ? 'Worldwide' : (isInternational ? getDestinationArea(destinations) : 'Domestic'),
      international: isInternational,
      date_start: formatLocalDate(startDate),
      date_end: formatLocalDate(effectiveEndDate),
      trip_type: tripType,
      pax: totalPax,
      adult,
      child,
      is_senior: false,
      nights,
    });
  };

  const travelerSummary = isEnglish
    ? `${adult} Adult${adult === 1 ? '' : 's'}, ${child} Child${child === 1 ? '' : 'ren'}`
    : `${adult} Dewasa, ${child} Anak`;
  const fieldBase = `min-h-[44px] rounded-md px-3 py-2.5 ${vField(variant)}`;

  return (
    <form onSubmit={submitSearch} className="flex flex-col gap-3">
      <section>
        <h3 className={`mb-1.5 text-xs font-semibold ${vValue(variant)}`}>
          {isEnglish ? 'Choose coverage type' : 'Pilih Jenis Perlindungan'}
        </h3>
        <div className={`grid w-full grid-cols-2 gap-1 rounded-lg p-1 sm:flex sm:w-fit ${vToggle(variant)}`}>
          {([
            { value: 'single_trip', label: t.singleTrip, icon: 'fa-suitcase-rolling' },
            { value: 'annual', label: isEnglish ? 'Annual Trip' : 'Perjalanan Tahunan', icon: 'fa-calendar-check' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={tripType === option.value}
              onClick={() => { setTripType(option.value); setError(''); }}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-center text-xs font-semibold transition-colors sm:px-4 ${
                tripType === option.value
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

      <div className={`grid grid-cols-1 items-start gap-4 sm:grid-cols-2 ${tripType === 'annual' ? 'xl:grid-cols-2' : 'xl:grid-cols-4'}`}>
        {tripType === 'single_trip' && (
          <section className="sm:col-span-2 xl:col-span-2">
            <h3 className={`mb-1.5 text-xs font-semibold ${vValue(variant)}`}>
              {isEnglish ? 'Travel region' : 'Wilayah Perjalanan'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: true, label: t.international, icon: 'fa-earth-americas' },
                { value: false, label: t.domestic, icon: 'fa-flag' },
              ]).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={international === option.value}
                  onClick={() => { setInternational(option.value); setError(''); }}
                  className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors ${
                    international === option.value
                      ? 'border-sky-500 bg-sky-50 text-sky-800'
                      : variant === 'light'
                        ? 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'
                        : 'border-white/15 bg-white/5 text-white/80 hover:border-white/30'
                  }`}
                >
                  {option.value ? (
                    <i className={`fa-solid ${option.icon}`} aria-hidden="true" />
                  ) : (
                    <span className="inline-flex h-6 w-6 shrink-0 flex-col overflow-hidden rounded-full border border-slate-300 shadow-sm" aria-hidden="true">
                      <span className="h-1/2 w-full bg-red-600" />
                      <span className="h-1/2 w-full bg-white" />
                    </span>
                  )}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {tripType === 'annual' ? (
          <div className={`flex min-h-[74px] flex-col justify-center rounded-lg border px-3 py-3 sm:col-span-2 xl:col-span-2 ${variant === 'light' ? 'border-slate-200 bg-white shadow-sm' : 'border-white/15 bg-white/5'}`}>
            <p className={`flex items-center gap-2 text-xs font-semibold ${vValue(variant)}`}>
              <i className="fa-solid fa-earth-asia text-slate-500" aria-hidden="true" />
              {isEnglish ? 'For international travel' : 'Untuk perjalanan Internasional'}
            </p>
            <p className={`mt-2 text-[11px] leading-snug ${vSub(variant)}`}>
              {isEnglish
                ? 'Multiple trips while the policy is valid. Per-trip limits depend on the selected plan.'
                : 'Dapat digunakan untuk beberapa perjalanan selama masa polis. Batas tiap perjalanan mengikuti ketentuan plan.'}
            </p>
          </div>
        ) : !international ? (
          <div className={`flex min-h-[74px] items-center gap-3 rounded-lg border px-3 py-3 sm:col-span-2 xl:col-span-2 ${variant === 'light' ? 'border-slate-200 bg-white shadow-sm' : 'border-white/15 bg-white/5'}`}>
            <span className="inline-flex h-8 w-8 shrink-0 flex-col overflow-hidden rounded-full border border-slate-300 shadow-sm" aria-hidden="true">
              <span className="h-1/2 w-full bg-red-600" />
              <span className="h-1/2 w-full bg-white" />
            </span>
            <div>
              <p className={`text-xs font-semibold ${vValue(variant)}`}>
                {isEnglish ? 'Valid in Indonesia' : 'Berlaku di Wilayah Indonesia'}
              </p>
              <p className={`mt-2 text-[11px] leading-snug ${vSub(variant)}`}>
                {isEnglish
                  ? 'This insurance is valid for domestic trips within Indonesia.'
                  : 'Asuransi perjalanan ini hanya berlaku untuk perjalanan domestik di dalam wilayah Indonesia.'}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <label className={`mb-1.5 block text-xs font-semibold ${vValue(variant)}`}>
              {isEnglish ? 'Country of residence' : 'Negara Asal'}
            </label>
            <div className={`flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 text-sm text-slate-400 ${variant === 'dark' ? 'border-white/10 bg-white/5 text-white/45' : ''}`}>
              <i className="fa-solid fa-plane-departure" aria-hidden="true" />
              <span>Indonesia</span>
            </div>
          </div>
        )}

        <div className={`relative sm:col-span-2 ${tripType === 'annual' || international ? 'xl:col-span-1' : 'xl:col-span-2'}`} ref={travelersRef}>
          <label className={`mb-1.5 block text-xs font-semibold ${vValue(variant)}`} htmlFor="insurance-travelers">
            {isEnglish ? 'Travelers' : 'Traveler'}
          </label>
          <button
            id="insurance-travelers"
            type="button"
            aria-expanded={travelerOpen}
            onClick={() => setTravelerOpen((open) => !open)}
            className={`flex w-full items-center justify-between text-left text-sm ${fieldBase}`}
          >
            <span className={`flex items-center gap-2 ${vValue(variant)}`}>
              <i className="fa-solid fa-users text-slate-500" aria-hidden="true" />
              {travelerSummary}
            </span>
            <i className={`fa-solid fa-chevron-down text-xs transition-transform ${travelerOpen ? 'rotate-180' : ''} ${vChevron(variant)}`} aria-hidden="true" />
          </button>
          {travelerOpen && (
            <div className={`absolute right-0 top-full z-[300] mt-2 w-full min-w-[260px] rounded-lg p-4 shadow-xl ${vPanel(variant)}`}>
              {([
                { type: 'adult' as const, label: isEnglish ? 'Adults' : 'Dewasa', count: adult, min: 1 },
                { type: 'child' as const, label: isEnglish ? 'Children' : 'Anak', count: child, min: 0 },
              ]).map((traveler) => (
                <div key={traveler.type} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className={`text-sm font-semibold ${vValue(variant)}`}>{traveler.label}</p>
                  </div>
                  <div className={`flex items-center gap-3 rounded-md px-2 py-1 ${vStepper(variant)}`}>
                    <button
                      type="button"
                      aria-label={`${isEnglish ? 'Remove' : 'Kurangi'} ${traveler.label}`}
                      disabled={traveler.count <= traveler.min}
                      onClick={() => adjustTravelerCount(traveler.type, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded text-orange-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <i className="fa-solid fa-minus text-xs" aria-hidden="true" />
                    </button>
                    <span className={`w-4 text-center text-sm font-semibold ${vValue(variant)}`}>{traveler.count}</span>
                    <button
                      type="button"
                      aria-label={`${isEnglish ? 'Add' : 'Tambah'} ${traveler.label}`}
                      disabled={totalPax >= 9}
                      onClick={() => adjustTravelerCount(traveler.type, 1)}
                      className={`flex h-7 w-7 items-center justify-center rounded disabled:cursor-not-allowed disabled:opacity-30 ${vStepBtn(variant)}`}
                    >
                      <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              <p className={`border-t pt-3 text-xs ${vSub(variant)}`}>
                {isEnglish ? 'Maximum 9 travelers' : 'Maksimal 9 traveler'}
              </p>
            </div>
          )}
        </div>

        {tripType === 'single_trip' && international && (
          <div className="relative sm:col-span-2 xl:col-span-2" ref={destinationsRef}>
            <label className={`mb-1.5 block text-xs font-semibold ${vValue(variant)}`} htmlFor="insurance-destination">
              {isEnglish ? 'Destination' : 'Negara Tujuan'}
            </label>
            <div className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5 ${vField(variant)}`}>
              {destinations.map((destination) => (
                <span key={destination.id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                  {isEnglish ? destination.en : destination.id}
                  <button
                    type="button"
                    aria-label={`${isEnglish ? 'Remove' : 'Hapus'} ${isEnglish ? destination.en : destination.id}`}
                    onClick={() => removeDestination(destination.id)}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                  </button>
                </span>
              ))}
              <button
                id="insurance-destination"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={destinationOpen}
                disabled={destinationsLoading || destinationsUnavailable}
                onClick={() => setDestinationOpen((open) => !open)}
                className={`flex min-h-8 min-w-[150px] flex-1 items-center justify-between gap-2 px-1 text-left text-sm disabled:cursor-not-allowed ${vSub(variant)}`}
              >
                <span>
                  {destinationsLoading
                    ? (isEnglish ? 'Loading destinations...' : 'Memuat negara tujuan...')
                    : destinationsUnavailable
                      ? (isEnglish ? 'Destination data unavailable' : 'Data negara tujuan tidak tersedia')
                      : destinations.length >= 5
                        ? (isEnglish ? 'Maximum 5 countries selected' : 'Maksimal 5 negara dipilih')
                        : (isEnglish ? 'Select destination countries' : 'Pilih negara tujuan')}
                </span>
                <i className={`fa-solid fa-chevron-down text-xs transition-transform ${destinationOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            </div>
            {destinationOpen && !destinationsUnavailable && (
              <div className={`absolute left-0 right-0 top-full z-[350] mt-2 overflow-hidden rounded-lg shadow-xl ${vPanel(variant)}`}>
                <div className={`border-b p-3 ${variant === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                  <label className="sr-only" htmlFor="insurance-destination-search">
                    {isEnglish ? 'Search countries' : 'Cari negara'}
                  </label>
                  <div className={`flex min-h-10 items-center gap-2 rounded-md px-3 ${vField(variant)}`}>
                    <i className="fa-solid fa-magnifying-glass text-xs text-slate-500" aria-hidden="true" />
                    <input
                      id="insurance-destination-search"
                      type="search"
                      value={destinationInput}
                      autoFocus
                      onChange={(event) => setDestinationInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setDestinationOpen(false);
                        if (event.key === 'Enter' && filteredCountries[0]) {
                          event.preventDefault();
                          addDestination(filteredCountries[0]);
                        }
                      }}
                      placeholder={isEnglish ? 'Search countries' : 'Cari negara'}
                      className={`min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 ${vValue(variant)}`}
                      autoComplete="off"
                    />
                  </div>
                  <p className={`mt-2 text-[11px] ${vSub(variant)}`}>
                    {filteredCountries.length} {isEnglish ? 'countries available' : 'negara tersedia'}
                  </p>
                </div>
                <div role="listbox" aria-label={isEnglish ? 'Destination countries' : 'Negara tujuan'} className="max-h-56 overflow-y-auto py-1">
                  {filteredCountries.map((country) => (
                    <button
                      key={country.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      disabled={destinations.length >= 5}
                      onClick={() => addDestination(country)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${vValue(variant)} ${variant === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                    >
                      <span>{isEnglish ? country.en : country.id}</span>
                      <span className={`text-xs ${vSub(variant)}`}>{country.region}</span>
                    </button>
                  ))}
                  {filteredCountries.length === 0 && (
                    <p className={`px-3 py-3 text-sm ${vSub(variant)}`}>
                      {isEnglish ? 'No matching country found.' : 'Negara tidak ditemukan.'}
                    </p>
                  )}
                </div>
              </div>
            )}
            {destinationsUnavailable && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {isEnglish ? 'Please try again later.' : 'Silakan coba lagi nanti.'}
              </p>
            )}
            <p className={`mt-1 text-[10px] ${vSub(variant)}`}>
              {isEnglish ? 'Choose up to 5 countries' : 'Pilih tujuan (hingga 5 negara)'}
            </p>
          </div>
        )}

        <div className={tripType === 'annual' ? '' : 'sm:col-span-2 xl:col-span-2'}>
          <span className={`mb-1.5 block text-xs font-semibold ${vValue(variant)}`}>
            {tripType === 'annual'
              ? (isEnglish ? 'Coverage starts' : 'Mulai Perlindungan')
              : (isEnglish ? 'Travel dates' : 'Tanggal Perjalanan')}
          </span>
          {tripType === 'annual' ? (
            <CalendarField value={startDate} onChange={(date) => { setStartDate(date); setError(''); }} minDate={today}>
              <div className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 ${fieldBase}`}>
                <i className="fa-regular fa-calendar text-slate-500" aria-hidden="true" />
                <span className={`text-sm ${startDate ? vValue(variant) : vSub(variant)}`}>
                  {startDate ? format(startDate, 'd MMMM yyyy', { locale: dateLocale }) : (isEnglish ? 'Choose date' : 'Pilih tanggal')}
                </span>
              </div>
            </CalendarField>
          ) : (
            <CalendarRangeField
              startDate={startDate}
              endDate={endDate}
              onChange={(range) => { setStartDate(range.from); setEndDate(range.to); setError(''); }}
              minDate={today}
              defaultMonth={startDate ?? today}
            >
              <div className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 ${fieldBase}`}>
                <i className="fa-regular fa-calendar text-slate-500" aria-hidden="true" />
                <span className={`truncate text-sm ${startDate ? vValue(variant) : vSub(variant)}`}>
                  {startDate
                    ? `${format(startDate, 'd MMM', { locale: dateLocale })}${endDate ? ` – ${format(endDate, 'd MMM yyyy', { locale: dateLocale })}` : ''}`
                    : (isEnglish ? 'Choose dates' : 'Pilih tanggal')}
                </span>
              </div>
            </CalendarRangeField>
          )}
        </div>

      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className={`flex items-start gap-2 text-xs ${vSub(variant)}`}>
          <i className="fa-solid fa-circle-info mt-0.5 text-orange-500" aria-hidden="true" />
          <p>
            {isEnglish
              ? 'Available to Indonesian citizens and foreign nationals with a valid KITAS or KITAP.'
              : 'Asuransi ini untuk WNI atau WNA dengan izin tinggal yang masih berlaku (KITAS/KITAP).'}
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`w-full px-5 sm:w-auto ${vBtnSearch(variant)}`}
        >
          {loading
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />}
          {loading ? (isEnglish ? 'Searching...' : 'Mencari...') : t.search}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
