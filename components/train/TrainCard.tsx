'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n, tpl } from '@/lib/i18n';
import { STATION_COORDS } from '@/lib/geo';

const CABIN_LABEL_KEYS: Record<string, 'cabinExecutive' | 'cabinBusiness' | 'cabinEconomy' | 'cabinPriority'> = {
  E: 'cabinExecutive', B: 'cabinBusiness', K: 'cabinEconomy', P: 'cabinPriority',
};

type TrainFare = {
  fare_code?: string;
  fare_name?: string;
  class_of_service?: string;
  service_charge_summary?: {
    total_price?: number | string;
    base_price?: number | string;
    base_fare?: number | string;
    base_tax?: number | string;
    service_charges?: {
      name?: string;
      type?: string;
      description?: string;
      total?: number | string;
    }[];
  }[];
  fare_details?: {
    detail_name?: string;
    detail_type?: string;
    amount?: number | string;
    unit?: string;
    description?: string[] | string;
  }[];
  fare_rules?: ({ description?: string[] | string } | string)[];
};

type TrainJourney = {
  fares?: TrainFare[];
  carrier_name?: string;
  carrier_code?: string;
  carrier_number?: string;
  departure_date?: string;
  arrival_date?: string;
  elapsed_time?: string;
  origin?: string;
  origin_name?: string;
  origin_city?: string;
  destination?: string;
  destination_name?: string;
  destination_city?: string;
  available_count?: number | string;
  cabin_class?: string;
  class_of_service?: string;
  journey_code?: string;
};

function formatDuration(elapsed: string | undefined) {
  if (!elapsed) return '-';
  const parts = elapsed.split(':');
  if (parts.length >= 2) {
    const h = Number.parseInt(parts[0], 10);
    const m = Number.parseInt(parts[1], 10);
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  }
  return elapsed;
}

function formatTime(dt: string | undefined) {
  if (!dt) return '--:--';
  return dt.split(' ')[1]?.substring(0, 5) || dt.substring(11, 16);
}

function formatDate(dt: string | undefined, language: string) {
  if (!dt) return '';
  const date = new Date(dt.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language === 'EN' ? 'en-US' : 'id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtIDR(n: number) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function farePrice(fare: TrainFare) {
  const summary = fare.service_charge_summary?.[0];
  return Number(summary?.total_price || summary?.base_price || summary?.base_fare) || 0;
}

function getFareRuleText(rule: NonNullable<TrainFare['fare_rules']>[number]) {
  const description = typeof rule === 'string' ? rule : rule.description;
  return Array.isArray(description) ? description.filter(Boolean) : [description].filter((text): text is string => Boolean(text));
}

function getFareDetailText(detail: NonNullable<TrainFare['fare_details']>[number]) {
  const description = Array.isArray(detail.description) ? detail.description.filter(Boolean).join(', ') : detail.description;
  const label = detail.detail_name || detail.detail_type;
  const quantity = [detail.amount, detail.unit].filter(Boolean).join(' ');
  const parts = [label, description, quantity].filter((part): part is string => Boolean(part));
  return parts.join(' · ');
}

function stationName(code: string, suppliedName?: string) {
  return suppliedName || STATION_COORDS[code]?.name || code;
}

function stationCity(code: string, suppliedCity?: string) {
  if (suppliedCity) return suppliedCity;
  if (['GMR', 'PSE', 'JAKK', 'JNG', 'BKS', 'CKR'].includes(code)) return 'Jakarta';
  return STATION_COORDS[code]?.name || code;
}

function formatStationLabel(name: string, code: string) {
  if (!code || name.toLowerCase().includes(`(${code.toLowerCase()})`)) return name || code;
  return `${name} (${code})`;
}

function TrainCard({ journey, onSelect, adultCount, isCheapest = false }: { journey: TrainJourney; onSelect: (journey: TrainJourney, fare: TrainFare) => void; adultCount: number; isCheapest?: boolean; }) {
  const { language } = useLanguage();
  const t = i18n.trainSearch[language];
  const tc = i18n.common[language];
  const [activePanel, setActivePanel] = useState<'journey' | 'info' | null>(null);
  const [showFares, setShowFares] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  const fares = useMemo(() => journey.fares || [], [journey]);
  const trainName = journey.carrier_name || t.trainKai;
  const trainNum = journey.carrier_number || '';
  const departureTime = formatTime(journey.departure_date);
  const arrivalTime = formatTime(journey.arrival_date);
  const departureDate = formatDate(journey.departure_date, language);
  const arrivalDate = formatDate(journey.arrival_date, language);
  const originCode = journey.origin || '';
  const destinationCode = journey.destination || '';
  const originName = stationName(originCode, journey.origin_name);
  const destinationName = stationName(destinationCode, journey.destination_name);
  const originCity = stationCity(originCode, journey.origin_city);
  const destinationCity = stationCity(destinationCode, journey.destination_city);

  const lowestFare = useMemo(() => fares.reduce<TrainFare | undefined>((lowest, fare) => {
    if (!lowest) return fare;
    return farePrice(fare) < farePrice(lowest) ? fare : lowest;
  }, undefined), [fares]);
  const lowestPrice = useMemo(() => {
    return lowestFare ? farePrice(lowestFare) : 0;
  }, [lowestFare]);
  const totalPrice = lowestPrice * adultCount;
  const fareSummary = lowestFare?.service_charge_summary?.[0];
  const fareRules = lowestFare?.fare_rules?.flatMap(getFareRuleText).filter(Boolean) || [];
  const fareDetails = lowestFare?.fare_details?.map(getFareDetailText).filter(Boolean) || [];

  const handleSelect = useCallback(async (fare: TrainFare | undefined) => {
    if (isSelecting || !fare) return;
    setIsSelecting(true);
    try { await onSelect(journey, fare); }
    catch (err) { console.error(err); }
    finally { setIsSelecting(false); }
  }, [journey, onSelect, isSelecting]);

  const seatAvail = Number(journey.available_count) || 0;
  const cabinKey = CABIN_LABEL_KEYS[journey.cabin_class || ''];
  const cabinLabel = cabinKey ? t[cabinKey] : `${t.class} ${journey.cabin_class || ''}`;
  const isOvernight = journey.departure_date && journey.arrival_date
    && new Date(journey.arrival_date.replace(' ', 'T')).toDateString() !== new Date(journey.departure_date.replace(' ', 'T')).toDateString();

  const togglePanel = (panel: 'journey' | 'info') => {
    setActivePanel(current => current === panel ? null : panel);
  };

  return (
    <>
      {isSelecting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl bg-white p-8 shadow-2xl">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-[6px] border-orange-100"></div>
              <div className="absolute inset-0 animate-spin rounded-full border-[6px] border-orange-500 border-t-transparent"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fa-solid fa-ticket text-2xl text-orange-600"></i>
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-brand-ink">{t.processing}</h3>
              <p className="mt-2 text-sm text-slate-500">{t.pleaseWait}</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-3/4 animate-pulse bg-orange-500"></div>
            </div>
          </div>
        </div>
      )}

      <article
        onClick={event => {
          const target = event.target;
          if (!(target instanceof Element) || !target.closest('[data-train-card-summary]') || target.closest('button')) return;
          setActivePanel(current => current ? null : 'journey');
        }}
        className={`overflow-hidden rounded-2xl border bg-white shadow-card transition-all hover:shadow-md ${isCheapest ? 'border-orange-300' : 'border-slate-100'}`}
      >
        <div data-train-card-summary className="grid cursor-pointer grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(170px,1fr)_minmax(260px,1.6fr)_minmax(145px,auto)] md:items-center md:gap-5 md:px-5">
          <div className="min-w-0">
            {isCheapest && (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <i className="fa-solid fa-tags" aria-hidden="true"></i> {t.cheapest}
              </span>
            )}
            <h2 className="truncate text-base font-bold text-brand-ink">{trainName}{trainNum ? ` (${trainNum})` : ''}</h2>
            <p className="mt-1 text-sm text-slate-500">{cabinLabel}{journey.class_of_service ? ` (${journey.class_of_service})` : ''}</p>
            <div className="mt-3 flex items-center gap-5">
              <button
                type="button"
                onClick={() => togglePanel('journey')}
                aria-expanded={activePanel === 'journey'}
                className={`relative py-1 text-sm font-semibold transition-colors ${activePanel === 'journey' ? 'text-sky-600' : 'text-slate-500 hover:text-sky-600'}`}
              >
                {t.journeyDetail}
                {activePanel === 'journey' && <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-sky-500" />}
              </button>
              <button
                type="button"
                onClick={() => togglePanel('info')}
                aria-expanded={activePanel === 'info'}
                className={`relative py-1 text-sm font-semibold transition-colors ${activePanel === 'info' ? 'text-sky-600' : 'text-slate-500 hover:text-sky-600'}`}
              >
                Info
                {activePanel === 'info' && <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-sky-500" />}
              </button>
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-[420px] grid-cols-3 items-center gap-1 sm:gap-2">
            <div className="text-center">
              <p className="text-xl font-bold leading-none text-slate-900">{departureTime}</p>
              <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{originCode}</span>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-medium text-slate-500">{formatDuration(journey.elapsed_time)}</p>
              <div className="my-1 flex items-center gap-1">
                <span className="h-px flex-1 bg-slate-300" />
                <i className="fa-solid fa-train text-[10px] text-slate-400" aria-hidden="true"></i>
                <span className="h-px flex-1 bg-slate-300" />
              </div>
              <p className="text-[9px] text-slate-500">{t.direct}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold leading-none text-slate-900">{arrivalTime}</p>
              <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{destinationCode}</span>
              {isOvernight && <span className="ml-1 align-top text-[9px] text-slate-500">{t.nextDay}</span>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 md:flex-col md:items-end md:border-0 md:pt-0">
            <div className="text-left md:text-right">
              <p className="text-lg font-bold leading-tight text-orange-600">{fmtIDR(lowestPrice)}<span className="text-sm font-normal text-slate-500">{t.perPax}</span></p>
              {seatAvail > 0 && seatAvail <= 7 && <p className="text-[10px] font-medium text-red-500">{tpl(t.seatsLeft, { count: seatAvail })}</p>}
            </div>
            <button
              type="button"
              onClick={() => handleSelect(lowestFare)}
              disabled={isSelecting || !lowestFare || seatAvail === 0}
              className="shrink-0 rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {seatAvail === 0 ? t.soldOut : t.selectTrain}
            </button>
          </div>
        </div>

        {activePanel === 'journey' && (
          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 md:px-5">
            <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-3">
              <div className="row-span-3 flex flex-col items-center py-1">
                <span className="h-2.5 w-2.5 rounded-full border border-sky-500 bg-white" />
                <span className="my-1 w-px flex-1 border-l border-dashed border-slate-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              </div>
              <div className="min-w-0 pb-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <strong className="text-sm font-bold text-slate-900">{departureTime}</strong>
                  <span className="text-sm font-semibold text-slate-800">{formatStationLabel(originName, originCode)}</span>
                </div>
                <p className="text-xs text-slate-500">{departureDate} · {originCity}</p>
              </div>
              <div className="py-1">
                <span className="text-xs text-slate-500">{formatDuration(journey.elapsed_time)}</span>
              </div>
              <div className="min-w-0 pt-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <strong className="text-sm font-bold text-slate-900">{arrivalTime}</strong>
                  <span className="text-sm font-semibold text-slate-800">{formatStationLabel(destinationName, destinationCode)}</span>
                </div>
                <p className="text-xs text-slate-500">{arrivalDate}{isOvernight ? t.nextDayShort : ''} · {destinationCity}</p>
              </div>
            </div>
          </div>
        )}

        {activePanel === 'info' && (
          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 text-xs leading-relaxed text-slate-700 md:px-5">
            <section>
              <h3 className="font-bold text-slate-900">{t.priceBreakdown}</h3>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>{lowestFare?.fare_name || lowestFare?.class_of_service || `${trainName} ${t.adultLabel}`} × {adultCount}</span>
                <span className="shrink-0">{fmtIDR(lowestPrice)}</span>
              </div>
              {fareSummary?.service_charges?.map((charge, index) => (
                <div key={`${charge.type || charge.name || 'charge'}-${index}`} className="mt-1 flex items-center justify-between gap-3 text-slate-500">
                  <span>{charge.name || charge.description || charge.type || t.serviceFee}</span>
                  <span className="shrink-0">{fmtIDR(Number(charge.total) || 0)}</span>
                </div>
              ))}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-300 pt-2 font-bold text-slate-900">
                <span>{t.totalPrice}{adultCount > 1 ? ` (${adultCount} ${tc.adult.toLowerCase()})` : ''}</span>
                <span>{fmtIDR(totalPrice)}</span>
              </div>
            </section>

            {fareDetails.length > 0 && (
              <section className="mt-4 border-t border-slate-200 pt-3">
                <h3 className="font-bold text-slate-900">{t.fareDetails}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {fareDetails.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}
                </ul>
              </section>
            )}

            <section className="mt-4 border-t border-slate-200 pt-3">
              <h3 className="font-bold text-slate-900">{t.importantPolicy}</h3>
              {fareRules.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {fareRules.map((rule, index) => <li key={`${rule}-${index}`}>{rule}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-slate-500">{t.policyUnavailable}</p>
              )}
            </section>

            {fares.length > 1 && (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFares(open => !open)}
                  aria-expanded={showFares}
                  className="text-sm font-semibold text-sky-700 hover:text-sky-800"
                >
                  {showFares ? t.hideFares : tpl(t.showFares, { count: fares.length })}
                </button>
                {showFares && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {fares.map((fare, index) => {
                      const price = farePrice(fare) * adultCount;
                      return (
                        <button
                          key={fare.fare_code || index}
                          type="button"
                          onClick={() => handleSelect(fare)}
                          disabled={isSelecting || seatAvail === 0}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="text-xs font-semibold text-slate-700">{fare.class_of_service || fare.fare_name || fare.fare_code || t.fareLabel}</span>
                          <span className="text-sm font-bold text-orange-600">{fmtIDR(price)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </article>
    </>
  );
}

export default memo(TrainCard);
