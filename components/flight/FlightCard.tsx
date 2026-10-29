'use client';
import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n, tpl } from '@/lib/i18n';
import { CARRIER_CODE_TO_AIRLINE } from '@/lib/providers';
import { airportCity, loadAirportGeo } from '@/lib/geo';
import type { GeoAirport } from '@/lib/geo';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import { useToast } from '@/contexts/ToastContext';

type FareDetail = {
  detail_code?: string;
  detail_type?: string;
  detail_name?: string;
  amount?: number | string;
  unit?: string;
  description?: string[] | string;
};

type FareSummary = {
  service_charges?: { total?: number | string }[];
  base_fare?: number | string;
  base_tax?: number | string;
};

type FlightFare = {
  fare_code?: string;
  fare_name?: string;
  class_of_service?: string;
  cabin_class?: string;
  available_count?: number | string;
  service_charge_summary?: FareSummary[];
  fare_details?: FareDetail[];
  fare_rules?: { description?: string[] }[];
};

type FlightLeg = {
  leg_code?: string;
  leg_code2?: string;
  origin?: string;
  origin_terminal?: string;
  origin_utc?: number;
  destination?: string;
  destination_terminal?: string;
  destination_utc?: number;
  departure_date?: string;
  arrival_date?: string;
  elapsed_time?: string;
  transit_duration?: string;
  carrier_name?: string;
  carrier_code?: string;
  carrier_number?: string;
  carrier_type_code?: string;
  operating_airline_code?: string;
  sequence?: number;
};

type FlightSegment = {
  segment_code?: string;
  carrier_code?: string;
  carrier_name?: string;
  carrier_number?: string;
  carrier_type_code?: string;
  operating_airline_code?: string;
  origin?: string;
  origin_terminal?: string;
  origin_utc?: number;
  destination?: string;
  destination_terminal?: string;
  destination_utc?: number;
  departure_date?: string;
  arrival_date?: string;
  elapsed?: string;
  elapsed_time?: string;
  transit_duration?: string;
  sequence?: number;
  legs?: FlightLeg[];
  fares?: FlightFare[];
};

type FlightJourney = {
  segments?: FlightSegment[];
  transit_count?: number | string | null;
  elapsed_time?: string;
  origin?: string;
  destination?: string;
};

type FlightCardProps = {
  journey: FlightJourney;
  onSelect: (journey: FlightJourney, fare: FlightFare) => Promise<void> | void;
  adultCount: number;
  isCheapest?: boolean;
  searchParams?: Record<string, unknown>;
};

function formatDuration(elapsed: string | undefined) {
  if (!elapsed) return '-';
  const parts = elapsed.split(':').map(Number);
  if (parts.length === 4) return `${parts[0] * 24 + parts[1]}j ${parts[2]}m`;
  if (parts.length >= 2) return `${parts[0]}j ${parts[1]}m`;
  return elapsed;
}

function formatTime(dt: string | undefined) {
  if (!dt) return '--:--';
  return dt.split(' ')[1]?.substring(0, 5) || dt.substring(11, 16);
}

function formatTimezone(offset: number | undefined) {
  if (offset === undefined || !Number.isFinite(offset)) return '';
  if (offset === 7) return 'WIB';
  if (offset === 8) return 'WITA';
  if (offset === 9) return 'WIT';
  const sign = offset < 0 ? '-' : '+';
  const absoluteOffset = Math.abs(offset);
  const hours = Math.floor(absoluteOffset);
  const minutes = Math.round((absoluteOffset - hours) * 60);
  return `UTC${sign}${String(hours).padStart(2, '0')}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

function formatDate(dt: string, locale: string) {
  if (!dt) return '';
  const date = new Date(dt.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function airportLabel(code: string | undefined) {
  if (!code) return '';
  const city = airportCity(code);
  return city === code ? code : `${city} (${code})`;
}

function getSsrLabel(type: string | undefined, language: string) {
  const english = language === 'EN';
  switch (type) {
    case 'BG': return english ? 'Baggage' : 'Bagasi';
    case 'BGA': return english ? 'Checked baggage' : 'Bagasi pesawat';
    case 'BGC': return english ? 'Cabin baggage' : 'Bagasi kabin';
    case 'ML': return english ? 'Meal' : 'Makanan';
    default: return english ? 'Additional service' : 'Fasilitas tambahan';
  }
}

function getFareDetailText(detail: FareDetail) {
  const name = detail.detail_name?.trim();
  const description = Array.isArray(detail.description)
    ? detail.description.filter(Boolean).join(', ')
    : detail.description?.trim();
  const quantity = [detail.amount, detail.unit].filter((value) => value !== undefined && value !== '').join(' ');
  const readableText = [name, description]
    .filter((value): value is string => value !== undefined && value.length > 0 && !/^(?:default[\s_-]*ssr|[a-z]+(?:_[a-z0-9]+)+)$/i.test(value))
    .filter((value, index, values) => values.findIndex(candidate => candidate.toLowerCase() === value.toLowerCase()) === index)
    .join(' — ');
  if (readableText && quantity && !readableText.toLowerCase().includes(quantity.toLowerCase())) {
    return `${readableText} · ${quantity}`;
  }
  return readableText || quantity;
}

function isBaggageDetail(detail: FareDetail) {
  const detailText = `${detail.detail_name || ''} ${
    Array.isArray(detail.description) ? detail.description.join(' ') : detail.description || ''
  }`;
  return ['BG', 'BGA', 'BGC'].includes(detail.detail_type || '') || /baggage|bagasi/i.test(detailText);
}

function getFareDetailLabel(detail: FareDetail, language: string) {
  if (detail.detail_type && ['BG', 'BGA', 'BGC', 'ML'].includes(detail.detail_type)) {
    return getSsrLabel(detail.detail_type, language);
  }
  const detailText = `${detail.detail_name || ''} ${
    Array.isArray(detail.description) ? detail.description.join(' ') : detail.description || ''
  }`.toLowerCase();
  if (/baggage|bagasi/.test(detailText)) return language === 'EN' ? 'Baggage' : 'Bagasi';
  return getSsrLabel(detail.detail_type, language);
}

function classifyFareBenefit(text: string) {
  if (/baggage|bagasi|luggage/i.test(text)) return 'baggage';
  if (/reschedul|rebook|change flight|flight change|date change|ubah jadwal|perubahan jadwal/i.test(text)) return 'reschedule';
  if (/refund|refundable|cancell?ation|cancel|pembatalan|pengembalian dana/i.test(text)) return 'refund';
  return 'other';
}

function getFareBenefitGroups(fareDetails: FareDetail[], fareRules: string[], language: string) {
  const groups: Record<'baggage' | 'reschedule' | 'refund' | 'other', string[]> = {
    baggage: [],
    reschedule: [],
    refund: [],
    other: [],
  };

  fareDetails.forEach((detail) => {
    const text = getFareDetailText(detail);
    if (!text) return;
    const category = isBaggageDetail(detail)
      ? 'baggage'
      : classifyFareBenefit(`${detail.detail_type || ''} ${detail.detail_name || ''} ${text}`);
    const value = `${getFareDetailLabel(detail, language)}: ${text}`;
    if (!groups[category].some(existing => existing.toLowerCase() === value.toLowerCase())) {
      groups[category].push(value);
    }
  });

  fareRules.forEach((rule) => {
    const text = rule.trim();
    if (!text) return;
    const category = classifyFareBenefit(text);
    if (!groups[category].some(existing => existing.toLowerCase() === text.toLowerCase())) {
      groups[category].push(text);
    }
  });

  return [
    { id: 'baggage', label: language === 'EN' ? 'Baggage' : 'Bagasi', icon: 'fa-suitcase-rolling', values: groups.baggage },
    { id: 'reschedule', label: language === 'EN' ? 'Reschedule' : 'Ubah jadwal', icon: 'fa-calendar-check', values: groups.reschedule },
    { id: 'refund', label: language === 'EN' ? 'Refund' : 'Pengembalian dana', icon: 'fa-money-bill-transfer', values: groups.refund },
    { id: 'other', label: language === 'EN' ? 'Other benefits' : 'Fasilitas lain', icon: 'fa-circle-check', values: groups.other },
  ].filter(group => group.values.length > 0);
}

function getCabinClassLabel(cabinClass: string | undefined, language: string) {
  const labels: Record<string, { id: string; en: string }> = {
    Y: { id: 'Ekonomi', en: 'Economy' },
    W: { id: 'Premium ekonomi', en: 'Premium economy' },
    C: { id: 'Bisnis', en: 'Business' },
    F: { id: 'Kelas satu', en: 'First class' },
  };
  if (!cabinClass) return '';
  const label = labels[cabinClass.toUpperCase()];
  return label ? (language === 'EN' ? label.en : label.id) : '';
}

function getCabinLabel(fare: FlightFare | undefined, language: string, fallback: string) {
  if (!fare) return fallback;
  const cabinCode = fare.cabin_class?.toUpperCase();
  if (['Y', 'W'].includes(cabinCode || '')) return fallback;
  if (['C', 'J'].includes(cabinCode || '')) return language === 'EN' ? 'Business' : 'Bisnis';
  if (['F', 'A'].includes(cabinCode || '')) return language === 'EN' ? 'First class' : 'Kelas satu';
  const serviceClass = fare.class_of_service?.trim();
  return serviceClass && !/^[A-Z]$/i.test(serviceClass) ? serviceClass : '';
}

function getAmenityIcon(detail: FareDetail) {
  const searchableText = `${detail.detail_type || ''} ${detail.detail_name || ''} ${
    Array.isArray(detail.description) ? detail.description.join(' ') : detail.description || ''
  }`.toLowerCase();
  if (isBaggageDetail(detail) || /baggage|bagasi/.test(searchableText)) return 'fa-suitcase';
  if (/meal|food|makanan/.test(searchableText)) return 'fa-utensils';
  if (/entertainment|hiburan|inflight entertainment/.test(searchableText)) return 'fa-tv';
  if (/power|outlet|socket|usb|stopkontak/.test(searchableText)) return 'fa-plug';
  if (/seat|kursi|pitch|jarak antar/.test(searchableText)) return 'fa-chair';
  return 'fa-circle-info';
}

function getAircraftName(code: string | undefined) {
  if (!code) return '';
  const aircraftNames: Record<string, string> = {
    '320': 'Airbus A320-100/200',
    '321': 'Airbus A321',
    '32A': 'Airbus A320',
    '32N': 'Airbus A320neo',
    '333': 'Airbus A330-300',
    '359': 'Airbus A350-900',
    '738': 'Boeing 737-800',
    '739': 'Boeing 737-900',
    '77W': 'Boeing 777-300ER',
    '788': 'Boeing 787-8',
    '789': 'Boeing 787-9',
  };
  return aircraftNames[code.toUpperCase()] || '';
}

function getCarrierDisplayName(code: string | undefined, name: string | undefined, fallback: string, language: string) {
  const mappedName = CARRIER_CODE_TO_AIRLINE[code || ''];
  if (mappedName) return mappedName;
  const cleanName = name?.trim();
  if (cleanName && !/^[A-Z0-9]{2,3}[-\s]?\d+$/i.test(cleanName)) return cleanName;
  return fallback || (language === 'EN' ? 'Airline' : 'Maskapai');
}

function dateLabel(dt: string | undefined, locale: string) {
  if (!dt) return '';
  const date = new Date(dt.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function calculateLayover(arrival: string | undefined, departure: string | undefined) {
  if (!arrival || !departure) return '';
  const elapsedMs = new Date(departure.replace(' ', 'T')).getTime() - new Date(arrival.replace(' ', 'T')).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '';
  const totalMinutes = Math.round(elapsedMs / 60000);
  return `${Math.floor(totalMinutes / 60)}j ${totalMinutes % 60}m`;
}

function farePricePerPassenger(fare: FlightFare | undefined) {
  const summary = fare?.service_charge_summary?.[0];
  if (!summary) return 0;
  const chargesTotal = (summary.service_charges || []).reduce(
    (total: number, charge) => total + (Number(charge.total) || 0),
    0
  );
  return chargesTotal || (Number(summary.base_fare) || 0) + (Number(summary.base_tax) || 0);
}

function fmtIDR(n: number) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function getAirlineLogoUrl(code: string) {
  return `https://assets.wego.com/image/upload/h_72,c_fit,f_auto,fl_lossy,q_auto/v20250101/flights/airlines_square/${code}.png`;
}

function FlightCard({ journey, onSelect, adultCount, isCheapest = false, searchParams }: FlightCardProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const t = i18n.flightSearch[language];
  const tf = i18n.searchForm[language].flight;
  const [farePickerOpen, setFarePickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<'airline' | 'transit' | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [airportNames, setAirportNames] = useState<Record<string, string>>({});
  const fareStripRef = useRef<HTMLDivElement>(null);
  const [fareScroll, setFareScroll] = useState({ hasOverflow: false, canScrollLeft: false, canScrollRight: false });

  const segments = useMemo(() => journey.segments || [], [journey.segments]);
  const seg = segments[0];
  const lastSeg = segments[segments.length - 1];
  const fares = useMemo(() => seg?.fares || [], [seg]);
  const sortedFares = useMemo(
    () => [...fares].sort((fareA, fareB) => farePricePerPassenger(fareA) - farePricePerPassenger(fareB)),
    [fares]
  );
  const updateFareScroll = useCallback(() => {
    const strip = fareStripRef.current;
    if (!strip) return;
    const hasOverflow = strip.scrollWidth > strip.clientWidth + 1;
    const nextState = {
      hasOverflow,
      canScrollLeft: hasOverflow && strip.scrollLeft > 1,
      canScrollRight: hasOverflow && strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
    };
    setFareScroll((current) =>
      current.hasOverflow === nextState.hasOverflow &&
      current.canScrollLeft === nextState.canScrollLeft &&
      current.canScrollRight === nextState.canScrollRight
        ? current
        : nextState
    );
  }, []);
  const lowestFare = useMemo(
    () => fares.reduce<FlightFare | undefined>((lowest, fare) =>
      !lowest || farePricePerPassenger(fare) < farePricePerPassenger(lowest) ? fare : lowest,
    undefined),
    [fares]
  );
  const routeLegs = useMemo(() => segments.flatMap((segment) => {
    const legs = segment.legs?.length ? segment.legs : [segment];
    return legs.map((leg) => ({
      origin: leg.origin || segment.origin,
      origin_terminal: leg.origin_terminal || segment.origin_terminal,
      origin_utc: leg.origin_utc ?? segment.origin_utc,
      destination: leg.destination || segment.destination,
      destination_terminal: leg.destination_terminal || segment.destination_terminal,
      destination_utc: leg.destination_utc ?? segment.destination_utc,
      departure_date: leg.departure_date || segment.departure_date,
      arrival_date: leg.arrival_date || segment.arrival_date,
      elapsed_time: leg.elapsed_time || segment.elapsed_time,
      transit_duration: leg.transit_duration || segment.transit_duration,
      carrier_name: leg.carrier_name || segment.carrier_name,
      carrier_code: leg.carrier_code || segment.carrier_code,
      carrier_number: leg.carrier_number || segment.carrier_number,
      carrier_type_code: leg.carrier_type_code || segment.carrier_type_code,
      operating_airline_code: leg.operating_airline_code || segment.operating_airline_code,
      sequence: leg.sequence,
    }));
  }), [segments]);

  const airlineCode = seg?.carrier_code || '';
  const airlineName = getCarrierDisplayName(airlineCode, seg?.carrier_name, '', language);
  const flightNum = seg?.carrier_number || '';
  const stopsCount = journey.transit_count !== undefined && journey.transit_count !== null && Number.isFinite(Number(journey.transit_count))
    ? Number(journey.transit_count)
    : Math.max(0, routeLegs.length - 1);
  const originCode = seg?.origin || journey.origin || '';
  const destCode = seg?.destination || journey.destination || '';
  const departureTime = useMemo(() => formatTime(seg?.departure_date), [seg]);
  const arrivalTime = useMemo(() => formatTime(lastSeg?.arrival_date), [lastSeg]);
  const favoriteTitle = originCode && destCode
    ? `${airportCity(originCode)} → ${airportCity(destCode)}`
    : `${airlineName}${airlineCode || flightNum ? ` ${airlineCode}${flightNum}` : ''}`;
  const favoriteSubtitle = `${airlineName}${flightNum ? ` ${airlineCode}${flightNum}` : ''}`;
  const favoriteSearchParams = {
    ...(searchParams || {}),
    _airline: airlineName,
    _flight_no: `${airlineCode}${flightNum}`,
    _dep_time: departureTime,
    _arr_time: arrivalTime,
    _elapsed: seg?.elapsed_time || '',
    _stops: stopsCount,
  };
  const shareTitle = `${favoriteTitle}${seg?.departure_date ? ` · ${formatDate(seg.departure_date, language === 'EN' ? 'en-US' : 'id-ID')}` : ''}`;

  const lowestPrice = farePricePerPassenger(lowestFare);

  const handleSelect = useCallback(async (fare: FlightFare) => {
    if (isSelecting) return;
    setIsSelecting(true);
    try { await onSelect(journey, fare); }
    catch (err) { console.error(err); }
    finally { setIsSelecting(false); }
  }, [journey, onSelect, isSelecting]);

  const selectedFareDetails = lowestFare?.fare_details || [];
  const baggageDetails = selectedFareDetails.filter((detail) => isBaggageDetail(detail) && getFareDetailText(detail));
  const amenityDetails = selectedFareDetails.filter((detail) => getFareDetailText(detail));
  const baggageSummary = baggageDetails.length
    ? Array.from(new Set(baggageDetails.map(getFareDetailText))).join(' · ')
    : language === 'EN' ? 'Baggage information unavailable' : 'Info bagasi tidak tersedia';
  useEffect(() => {
    let isCurrent = true;
    void loadAirportGeo().then((airports: GeoAirport[]) => {
      if (!isCurrent) return;
      setAirportNames(Object.fromEntries(airports.map((airport) => [airport.code, airport.name])));
    });
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    if (!activeTooltip) return;
    const closeTooltip = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-flight-tooltip-root]')) {
        setActiveTooltip(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveTooltip(null);
    };
    document.addEventListener('pointerdown', closeTooltip);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeTooltip);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeTooltip]);

  useEffect(() => {
    if (!farePickerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isSelecting) return;
      if (shareOpen) setShareOpen(false);
      else setFarePickerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [farePickerOpen, isSelecting, shareOpen]);

  useEffect(() => {
    if (!farePickerOpen) return;
    const strip = fareStripRef.current;
    if (!strip) return;
    const frame = window.requestAnimationFrame(updateFareScroll);
    const observer = new ResizeObserver(updateFareScroll);
    observer.observe(strip);
    if (strip.parentElement) observer.observe(strip.parentElement);
    window.addEventListener('resize', updateFareScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updateFareScroll);
    };
  }, [farePickerOpen, sortedFares.length, updateFareScroll]);

  const openFarePicker = useCallback(() => {
    if (fares.length) {
      setActiveTooltip(null);
      setFarePickerOpen(true);
    }
  }, [fares.length]);

  const chooseFare = useCallback(async (fare: FlightFare) => {
    setFarePickerOpen(false);
    await handleSelect(fare);
  }, [handleSelect]);

  const fullAirportLabel = (code: string | undefined) => {
    if (!code) return '';
    const name = airportNames[code];
    return name ? `${code} - ${name}` : `${code} - ${airportCity(code)}`;
  };

  const toggleTooltip = (tooltip: 'airline' | 'transit') => {
    setActiveTooltip((current) => current === tooltip ? null : tooltip);
  };

  const openShareDialog = () => {
    setShareUrl(window.location.href);
    setShareOpen(true);
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast(language === 'EN' ? 'Link copied' : 'Tautan berhasil disalin', { variant: 'success' });
    } catch (error) {
      console.error('Failed to copy flight search link:', error);
      toast(language === 'EN' ? 'Could not copy the link' : 'Tautan gagal disalin', { variant: 'error' });
    }
  };

  return (
    <>
      {isSelecting && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-5 max-w-sm w-full mx-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-[6px] border-orange-100"></div>
              <div className="absolute inset-0 rounded-full border-[6px] border-orange-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fa-solid fa-ticket text-orange-600 text-2xl"></i>
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-black text-xl text-brand-ink">{t.processing}</h3>
              <p className="text-sm text-slate-500 mt-2">{t.pleaseWait}</p>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      )}

      <article className={`relative rounded-xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md ${isCheapest ? 'border-orange-300 ring-1 ring-orange-200' : 'border-slate-200 hover:border-sky-200'}`}>
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center md:p-5">
          <div className="grid min-w-0 gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
            <div className="group relative min-w-0" data-flight-tooltip-root>
              <button
                type="button"
                onClick={() => toggleTooltip('airline')}
                className="peer flex w-full min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-expanded={activeTooltip === 'airline'}
                aria-describedby={activeTooltip === 'airline' ? `airline-tooltip-${airlineCode}-${flightNum}` : undefined}
                aria-label={`${airlineName} ${flightNum} flight details`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
                  {logoFailed ? (
                    <i className="fa-solid fa-plane text-sky-600" aria-hidden="true" />
                  ) : (
                    <img
                      src={getAirlineLogoUrl(airlineCode)}
                      alt={airlineName}
                      className="h-9 w-9 object-contain"
                      onError={() => setLogoFailed(true)}
                    />
                  )}
                </span>
                <span className="block min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800">{airlineName}</span>
                  {baggageDetails.length > 0 && (
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-600">
                      <i className="fa-solid fa-suitcase text-slate-400" aria-hidden="true" />
                      <span className="truncate">{baggageSummary}</span>
                    </span>
                  )}
                  {amenityDetails.some((detail) => !isBaggageDetail(detail)) && (
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                      {amenityDetails.filter((detail) => !isBaggageDetail(detail)).map((detail, index) => {
                        const detailText = getFareDetailText(detail);
                        return (
                          <i
                            key={`${detail.detail_type || detail.detail_code}-${index}`}
                            className={`fa-solid ${getAmenityIcon(detail)}`}
                            title={detailText}
                            aria-label={detailText}
                          />
                        );
                      })}
                    </span>
                  )}
                </span>
              </button>
              <div
                id={`airline-tooltip-${airlineCode}-${flightNum}`}
                role="tooltip"
                className={`fixed bottom-3 left-3 right-3 top-auto z-[1000] max-h-[70dvh] w-auto overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl transition md:absolute md:bottom-auto md:left-0 md:right-auto md:top-full md:mt-2 md:max-h-[min(60vh,24rem)] md:w-[min(25rem,calc(100vw-2rem))] ${activeTooltip === 'airline' ? 'visible opacity-100' : 'invisible opacity-0 md:group-hover:visible md:group-hover:opacity-100'}`}
              >
                <p className="text-sm font-bold text-slate-800">{airlineName}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {[flightNum && `${airlineCode}-${flightNum}`, getCabinLabel(lowestFare, language, tf.economy), getAircraftName(seg?.carrier_type_code)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {seg?.operating_airline_code && seg.operating_airline_code !== airlineCode && (
                  <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
                    {t.operatedBy} {getCarrierDisplayName(seg.operating_airline_code, undefined, '', language)}
                  </p>
                )}
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {amenityDetails.length > 0 ? amenityDetails.map((detail, index) => {
                    const value = getFareDetailText(detail);
                    return (
                      <p key={`${detail.detail_code || detail.detail_type}-${index}`} className="mb-1 flex items-start gap-2 text-xs text-slate-600 last:mb-0">
                        <i className={`fa-solid ${getAmenityIcon(detail)} mt-0.5 text-slate-400`} aria-hidden="true" />
                        <span>
                          <span className="font-medium text-slate-700">{getFareDetailLabel(detail, language)}</span>
                          {` · ${value}`}
                        </span>
                      </p>
                    );
                  }) : (
                    <p className="text-xs text-slate-500">
                      {language === 'EN'
                        ? 'Baggage and onboard amenity details are not provided by the airline.'
                        : 'Rincian bagasi dan fasilitas penerbangan belum tersedia dari maskapai.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-4">
              <div className="shrink-0 text-center">
                <p className="flex items-baseline justify-center gap-1 text-xl font-bold leading-none text-slate-800">
                  {departureTime}
                  {formatTimezone(seg?.origin_utc) && <span className="text-[9px] font-semibold text-slate-400">{formatTimezone(seg?.origin_utc)}</span>}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">{airportLabel(originCode)}</p>
              </div>

              <div className="group relative flex min-w-0 flex-1 justify-center px-1" data-flight-tooltip-root>
                <button
                  type="button"
                  className="peer flex w-full min-w-0 flex-col items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  onClick={() => toggleTooltip('transit')}
                  aria-expanded={activeTooltip === 'transit'}
                  aria-describedby={activeTooltip === 'transit' ? `itinerary-tooltip-${airlineCode}-${flightNum}` : undefined}
                  aria-label={tpl(t.flightDetailAria, { stops: stopsCount === 0 ? t.nonstop : tpl(t.stopsCount, { count: stopsCount }) })}
                >
                  <span className="text-xs text-slate-500">{formatDuration(journey.elapsed_time)}</span>
                  <span className="my-1 flex w-full items-center gap-1">
                    <span className="h-px flex-1 bg-slate-300" />
                    <i className="fa-solid fa-plane text-[10px] text-sky-600" aria-hidden="true" />
                    <span className="h-px flex-1 bg-slate-300" />
                  </span>
                  <span className={`text-[11px] font-medium ${stopsCount > 0 ? 'text-sky-700 underline decoration-dotted underline-offset-2' : 'text-slate-500'}`}>
                    {stopsCount === 0 ? t.directOnly : tpl(t.stopsCount, { count: stopsCount })}
                  </span>
                </button>
                <div
                  id={`itinerary-tooltip-${airlineCode}-${flightNum}`}
                  role="tooltip"
                  className={`fixed bottom-3 left-3 right-3 top-auto z-[1000] max-h-[70dvh] w-auto overflow-y-auto rounded-xl border border-slate-100 bg-white p-4 text-left shadow-xl transition md:absolute md:bottom-auto md:left-1/2 md:right-auto md:top-full md:mt-2 md:max-h-[min(60vh,24rem)] md:w-[min(25rem,calc(100vw-2rem))] md:-translate-x-1/2 ${activeTooltip === 'transit' ? 'visible opacity-100' : 'invisible opacity-0 md:group-hover:visible md:group-hover:opacity-100'}`}
                >
                  <div className="space-y-2">
                    {routeLegs.map((leg, index) => (
                      <div key={`${leg.carrier_code || airlineCode}-${leg.carrier_number || flightNum}-${leg.departure_date}-${index}`}>
                        <div className="relative grid grid-cols-[44px_18px_minmax(0,1fr)] gap-x-2">
                          <span className="absolute bottom-3 left-[61px] top-3 w-px bg-slate-200" aria-hidden="true" />
                          <div className="relative z-10 py-0.5 text-right">
                            <p className="text-xs font-bold leading-4 text-slate-800">{formatTime(leg.departure_date)}</p>
                            <p className="mt-1 text-[10px] text-slate-500">{dateLabel(leg.departure_date, language === 'EN' ? 'en-US' : 'id-ID')}</p>
                          </div>
                          <div className="relative z-10 flex justify-center pt-1">
                            <span className="h-3 w-3 rounded-full border border-sky-500 bg-white" />
                          </div>
                          <div className="min-w-0 pb-1">
                            <p className="text-xs font-semibold leading-5 text-slate-800">{fullAirportLabel(leg.origin)}</p>
                            {leg.origin_terminal && <p className="text-[11px] leading-4 text-slate-500">Terminal {leg.origin_terminal}</p>}
                          </div>

                          <div className="py-2 text-center text-[10px] text-slate-500">{formatDuration(leg.elapsed_time)}</div>
                          <div className="relative z-10 flex items-center justify-center bg-white text-[10px] text-sky-600">
                            <i className="fa-solid fa-plane" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 py-2 text-[10px] text-slate-500">
                            {getCarrierDisplayName(leg.carrier_code, leg.carrier_name, airlineName, language)}
                            {leg.carrier_number && !leg.carrier_name?.includes(leg.carrier_number) ? ` · ${leg.carrier_number}` : ''}
                          </div>

                          <div className="relative z-10 py-0.5 text-right">
                            <p className="text-xs font-bold leading-4 text-slate-800">{formatTime(leg.arrival_date)}</p>
                            <p className="mt-1 text-[10px] text-slate-500">{dateLabel(leg.arrival_date, language === 'EN' ? 'en-US' : 'id-ID')}</p>
                          </div>
                          <div className="relative z-10 flex justify-center pt-1">
                            <span className="h-3 w-3 rounded-full bg-sky-600" />
                          </div>
                          <div className="min-w-0 pt-0.5">
                            <p className="text-xs font-semibold leading-5 text-slate-800">{fullAirportLabel(leg.destination)}</p>
                            {leg.destination_terminal && <p className="text-[11px] leading-4 text-slate-500">Terminal {leg.destination_terminal}</p>}
                          </div>
                        </div>
                        {index < routeLegs.length - 1 && (
                          <div className="ml-[64px] mt-2 border-l border-dashed border-amber-300 py-1 pl-3">
                            <p className="text-[10px] font-medium text-amber-800">
                              {language === 'EN' ? 'Transit' : 'Transit'}
                              {(leg.transit_duration || calculateLayover(leg.arrival_date, routeLegs[index + 1]?.departure_date))
                                ? ` · ${formatDuration(leg.transit_duration || calculateLayover(leg.arrival_date, routeLegs[index + 1]?.departure_date))}`
                                : ''}
                              {leg.destination ? ` · ${airportCity(leg.destination)}` : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-center">
                <p className="flex items-baseline justify-center gap-1 text-xl font-bold leading-none text-slate-800">
                  {arrivalTime}
                  {formatTimezone(lastSeg?.destination_utc) && <span className="text-[9px] font-semibold text-slate-400">{formatTimezone(lastSeg?.destination_utc)}</span>}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">{airportLabel(destCode)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <div className="min-w-0">
              {isCheapest && (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <i className="fa-solid fa-tag" aria-hidden="true" /> {t.cheapest}
                </span>
              )}
              <p className="whitespace-nowrap text-lg font-bold leading-tight text-orange-600">{fmtIDR(lowestPrice)}</p>
              {fares[0]?.fare_name && <p className="truncate text-[11px] text-slate-500">{fares[0].fare_name}</p>}
            </div>
            <button
              type="button"
              onClick={openFarePicker}
              disabled={isSelecting || !fares.length}
              className="shrink-0 rounded-lg bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.selectFlight}
            </button>
          </div>
        </div>

      </article>

      {farePickerOpen && (
        <div
          className="fixed inset-0 z-[2500] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flight-fare-picker-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSelecting) setFarePickerOpen(false);
          }}
        >
          <section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
                  {logoFailed ? (
                    <span className="text-xs font-bold text-slate-500">{airlineCode}</span>
                  ) : (
                    <img
                      src={getAirlineLogoUrl(airlineCode)}
                      alt=""
                      className="h-8 w-8 object-contain"
                      onError={() => setLogoFailed(true)}
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 id="flight-fare-picker-title" className="truncate text-base font-bold text-slate-800 sm:text-lg">
                    {airportLabel(originCode)} <span className="text-slate-400">→</span> {airportLabel(destCode)}
                  </h2>
                  <p className="truncate text-xs text-slate-500">
                    {airlineName}{flightNum ? ` · ${airlineCode} ${flightNum}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-[3px]">
                <FavoriteButton
                  entityType="flight"
                  dedupeKey={`flight:${airlineCode}${flightNum}:${(seg?.departure_date || '').slice(0, 10)}:${originCode}-${destCode}`}
                  title={favoriteTitle}
                  subtitle={favoriteSubtitle}
                  price={lowestPrice}
                  image={getAirlineLogoUrl(airlineCode)}
                  searchParams={favoriteSearchParams}
                  iconOnly
                  className="relative z-auto"
                />
                <button
                  type="button"
                  onClick={openShareDialog}
                  aria-label={language === 'EN' ? 'Share flight' : 'Bagikan penerbangan'}
                  title={language === 'EN' ? 'Share flight' : 'Bagikan penerbangan'}
                  className="flex h-9 w-9 items-center justify-center text-[15px] text-slate-900 transition hover:text-sky-700"
                >
                  <i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setFarePickerOpen(false)}
                  autoFocus
                  aria-label={t.closeFareOptions}
                  className="flex h-9 w-9 shrink-0 items-center justify-center text-[15px] text-slate-900 transition hover:text-sky-700"
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800">{formatDate(seg?.departure_date || '', language === 'EN' ? 'en-US' : 'id-ID')}</span>
                  <span className="rounded-full bg-white px-2 py-1">{formatDuration(journey.elapsed_time)}</span>
                  <span className="rounded-full bg-white px-2 py-1">{stopsCount === 0 ? (language === 'EN' ? 'Nonstop' : 'Langsung') : `${stopsCount} ${language === 'EN' ? 'stop(s)' : 'transit'}`}</span>
                </div>
                <div className="space-y-2">
                  {routeLegs.map((leg, index) => (
                    <div key={`${leg.carrier_code}-${leg.carrier_number}-${leg.departure_date}-${index}`} className="rounded-lg bg-white px-3 py-2.5">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-tight text-slate-800">{formatTime(leg.departure_date)}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-600">{airportLabel(leg.origin)}{leg.origin_terminal ? ` · T${leg.origin_terminal}` : ''}</p>
                        </div>
                        <div className="flex min-w-[5.5rem] flex-col items-center text-[10px] text-slate-500">
                          <span>{formatDuration(leg.elapsed_time)}</span>
                          <span className="my-1 flex w-full items-center gap-1 text-sky-600">
                            <span className="h-px flex-1 bg-slate-200" />
                            <i className="fa-solid fa-plane text-[10px]" aria-hidden="true" />
                            <span className="h-px flex-1 bg-slate-200" />
                          </span>
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-sm font-bold leading-tight text-slate-800">{formatTime(leg.arrival_date)}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-600">{airportLabel(leg.destination)}{leg.destination_terminal ? ` · T${leg.destination_terminal}` : ''}</p>
                        </div>
                      </div>
                      <p className="mt-2 truncate border-t border-slate-100 pt-1.5 text-center text-[10px] text-slate-500">
                        {getCarrierDisplayName(leg.carrier_code, leg.carrier_name, airlineName, language)}
                        {leg.carrier_number ? ` ${leg.carrier_number}` : ''}
                        {getAircraftName(leg.carrier_type_code) ? ` · ${getAircraftName(leg.carrier_type_code)}` : ''}
                      </p>
                      {index < routeLegs.length - 1 && (
                        <div className="mt-2 text-center text-[10px] font-medium text-amber-800">
                          {language === 'EN' ? 'Transit' : 'Transit'}
                          {(leg.transit_duration || calculateLayover(leg.arrival_date, routeLegs[index + 1]?.departure_date))
                            ? ` · ${formatDuration(leg.transit_duration || calculateLayover(leg.arrival_date, routeLegs[index + 1]?.departure_date))}`
                            : ''}
                          {leg.destination ? ` · ${airportCity(leg.destination)}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 p-3 sm:p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{language === 'EN' ? 'Choose a fare' : 'Pilih tarif penerbangan'}</h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {language === 'EN' ? 'Displayed price is per adult passenger.' : 'Harga ditampilkan per penumpang dewasa.'}
                      {adultCount > 1 ? ` ${adultCount} ${language === 'EN' ? 'adults' : 'dewasa'}.` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sortedFares.length > 1 && (
                      <span className="text-xs text-slate-500">
                        {sortedFares.length} {language === 'EN' ? 'fare options' : 'opsi tarif'}
                      </span>
                    )}
                    {fareScroll.hasOverflow && (
                      <div className="flex items-center gap-1" aria-label={language === 'EN' ? 'Fare navigation' : 'Navigasi pilihan tarif'}>
                        <button
                          type="button"
                          onClick={() => fareStripRef.current?.scrollBy({ left: -Math.max(240, (fareStripRef.current?.clientWidth || 0) * 0.75), behavior: 'smooth' })}
                          disabled={!fareScroll.canScrollLeft}
                          aria-label={language === 'EN' ? 'Scroll fares left' : 'Geser tarif ke kiri'}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => fareStripRef.current?.scrollBy({ left: Math.max(240, (fareStripRef.current?.clientWidth || 0) * 0.75), behavior: 'smooth' })}
                          disabled={!fareScroll.canScrollRight}
                          aria-label={language === 'EN' ? 'Scroll fares right' : 'Geser tarif ke kanan'}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-2 text-[10px] leading-relaxed text-slate-500">
                  <i className="fa-solid fa-circle-info shrink-0 text-sky-600" aria-hidden="true" />
                  <p>
                    {language === 'EN'
                      ? 'Fare price and seat availability will be checked again with the airline before checkout.'
                      : 'Harga dan ketersediaan kursi akan dikonfirmasi kembali oleh maskapai sebelum checkout.'}
                  </p>
                </div>

                <div
                  ref={fareStripRef}
                  onScroll={updateFareScroll}
                  onWheel={(event) => {
                    if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && fareScroll.hasOverflow) {
                      event.preventDefault();
                      event.currentTarget.scrollBy({ left: event.deltaY });
                    }
                  }}
                  className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1"
                >
                  {sortedFares.map((fare, index) => {
                    const farePrice = farePricePerPassenger(fare);
                    const fareDetails = (fare.fare_details || []).filter((detail) => getFareDetailText(detail));
                    const fareRules = (fare.fare_rules || []).flatMap((rule) =>
                      Array.isArray(rule.description) ? rule.description : []
                    ).filter(Boolean);
                    const fareBenefitGroups = getFareBenefitGroups(fareDetails, fareRules, language);
                    const isLowestFare = index === 0 && farePrice > 0;
                    const bookingClass = fare.class_of_service?.trim() || '';
                    const isBookingClassCode = /^[A-Z]$/i.test(bookingClass);
                    const cabinClassLabel = getCabinClassLabel(fare.cabin_class, language);
                    const fareClassLabel = cabinClassLabel || (!isBookingClassCode ? bookingClass : '');

                    return (
                      <article key={`${fare.fare_code || fare.fare_name}-${index}`} className={`flex w-[min(78vw,18rem)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-white ${isLowestFare ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-200'}`}>
                        <div className="p-2.5">
                          <p className="whitespace-nowrap text-base font-bold leading-tight text-orange-600">
                            {farePrice > 0 ? fmtIDR(farePrice) : (language === 'EN' ? 'Price unavailable' : 'Harga belum tersedia')}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {language === 'EN' ? 'per adult passenger' : 'per penumpang dewasa'}
                          </p>
                          {isLowestFare && (
                            <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                              {language === 'EN' ? 'Lowest fare' : 'Tarif termurah'}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 border-t border-slate-100 px-2.5 py-2">
                          <h4 className="truncate text-xs font-bold text-slate-800">
                            {fare.fare_name || fareClassLabel || (fare.cabin_class === 'C' ? tf.business : tf.economy)}
                          </h4>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {fareClassLabel && (
                              <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                {fareClassLabel}
                              </span>
                            )}
                            {isBookingClassCode && (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700"
                                title={language === 'EN'
                                  ? 'Airline booking-class code. It identifies an inventory/fare bucket and is not the cabin class.'
                                  : 'Kode kelas pemesanan dari maskapai untuk kelompok tarif/ketersediaan. Ini bukan kelas kabin.'}
                              >
                                {language === 'EN' ? 'Booking class' : 'Kelas pemesanan'}: {bookingClass.toUpperCase()}
                                <i className="fa-solid fa-circle-info text-slate-400" aria-hidden="true" />
                              </span>
                            )}
                            {fare.available_count !== undefined && fare.available_count !== null && (
                              <span className="text-[10px] text-slate-500">
                                {fare.available_count} {language === 'EN' ? 'available' : 'tersedia'}
                              </span>
                            )}
                          </div>
                          {fareBenefitGroups.length > 0 && (
                            <ul className="mt-2 space-y-1.5">
                              {fareBenefitGroups.map((group) => (
                                <li key={group.id} className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-600">
                                  <i className={`fa-solid ${group.icon} mt-0.5 w-3 shrink-0 text-center text-sky-600`} aria-hidden="true" />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-700">{group.label}</p>
                                    <ul className="mt-0.5">
                                      {group.values.map((value, valueIndex) => (
                                        <li key={`${group.id}-${valueIndex}`} className="line-clamp-1" title={value}>{value}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                          {fareRules.length > 0 && (
                            <details className="mt-2 border-t border-slate-100 pt-1.5">
                              <summary className="cursor-pointer text-[10px] font-semibold text-sky-700">
                                {language === 'EN' ? `Full fare rules (${fareRules.length})` : `Baca ketentuan lengkap (${fareRules.length})`}
                              </summary>
                              <ul className="mt-2 space-y-2">
                                {fareRules.map((rule, ruleIndex) => (
                                  <li key={`${fare.fare_code}-rule-${ruleIndex}`} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600">
                                    <i className="fa-solid fa-circle-info mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                    <span>{rule}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>

                        <div className="border-t border-slate-100 p-2">
                          <button
                            type="button"
                            onClick={() => chooseFare(fare)}
                            disabled={isSelecting || farePrice <= 0}
                            className="w-full rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {language === 'EN' ? 'Choose this fare' : 'Pilih tarif ini'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
          {shareOpen && (
            <div
              className="fixed inset-0 z-[2600] flex items-center justify-center bg-slate-950/45 p-4"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setShareOpen(false);
              }}
            >
              <section
                className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="flight-share-title"
              >
                <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h3 id="flight-share-title" className="text-sm font-bold text-slate-800">
                    {language === 'EN' ? 'Share this flight' : 'Bagikan penerbangan ini'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShareOpen(false)}
                    aria-label={language === 'EN' ? 'Close share dialog' : 'Tutup dialog bagikan'}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                  </button>
                </header>

                <div className="flex gap-3 bg-slate-50 p-4">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
                    {logoFailed ? (
                      <i className="fa-solid fa-plane text-sky-600" aria-hidden="true" />
                    ) : (
                      <img src={getAirlineLogoUrl(airlineCode)} alt="" className="h-12 w-12 object-contain" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800">
                      {language === 'EN' ? 'Route:' : 'Rute:'} {favoriteTitle}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600">{shareTitle}</p>
                    <div className="mt-2 flex gap-2">
                      <input
                        readOnly
                        value={shareUrl}
                        aria-label={language === 'EN' ? 'Share link' : 'Tautan untuk dibagikan'}
                        onFocus={(event) => event.currentTarget.select()}
                        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none"
                      />
                      <button
                        type="button"
                        onClick={copyShareLink}
                        className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-sky-700"
                      >
                        {language === 'EN' ? 'Copy link' : 'Salin tautan'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 px-4 py-4">
                  {[
                    {
                      label: 'WhatsApp',
                      icon: 'fa-brands fa-whatsapp',
                      color: 'text-emerald-500',
                      href: `https://wa.me/?text=${encodeURIComponent(`${shareTitle} ${shareUrl}`)}`,
                    },
                    {
                      label: 'Telegram',
                      icon: 'fa-brands fa-telegram',
                      color: 'text-sky-500',
                      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
                    },
                    {
                      label: 'Facebook',
                      icon: 'fa-brands fa-facebook',
                      color: 'text-blue-600',
                      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
                    },
                    {
                      label: 'X',
                      icon: 'fa-brands fa-x-twitter',
                      color: 'text-slate-800',
                      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
                    },
                  ].map((option) => (
                    <a
                      key={option.label}
                      href={option.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      <i className={`${option.icon} ${option.color} text-xl`} aria-hidden="true" />
                      {option.label}
                    </a>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default memo(FlightCard);
