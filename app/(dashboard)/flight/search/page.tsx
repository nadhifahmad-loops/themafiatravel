'use client';
import { useState, useMemo, Suspense, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FlightSearchForm from '@/components/flight/FlightSearchForm';
import FlightCard from '@/components/flight/FlightCard';
import { CalendarField } from '@/components/common/CalendarField';
import { FLIGHT_PROVIDERS, CARRIER_CODE_TO_AIRLINE } from '@/lib/providers';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtIDR(n: number) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Hitung total harga per penumpang dari fare (termasuk admin fee/charge lain) */
type FarePriceSummary = {
  service_charges?: { total?: number | string }[];
  base_fare?: number | string;
  base_tax?: number | string;
};

type JourneyPriceData = {
  transit_count?: number | string | null;
  segments?: {
    legs?: unknown[];
    fares?: { service_charge_summary?: FarePriceSummary[] }[];
  }[];
};
type FlightCoupon = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  category: string;
  minOrderAmount: number;
  maxDiscount: number | null;
  endDate: string | null;
};

function calcFarePerPax(summary: FarePriceSummary | undefined): number {
  if (!summary) return 0;
  let total = 0;
  for (const ch of (summary.service_charges || [])) {
    total += Number(ch.total) || 0;
  }
  // Fallback jika service_charges kosong
  if (total === 0) {
    total = (Number(summary.base_fare) || 0) + (Number(summary.base_tax) || 0);
  }
  return total;
}
function getJourneyTransitCount(journey: JourneyPriceData): number {
  const transitCount = Number(journey?.transit_count);
  if (journey?.transit_count !== undefined && journey?.transit_count !== null && Number.isFinite(transitCount)) {
    return transitCount;
  }
  const legCount = journey?.segments?.reduce(
    (count, segment) => count + (segment.legs?.length || 1),
    0
  ) || 1;
  return Math.max(0, legCount - 1);
}
function getJourneyStartingPrice(journey: JourneyPriceData): number {
  const prices = (journey?.segments?.[0]?.fares || [])
    .map(fare => calcFarePerPax(fare.service_charge_summary?.[0]))
    .filter((price: number) => price > 0);
  return prices.length ? Math.min(...prices) : 0;
}
function fmtTime(dt: string) {
  if (!dt) return '--:--';
  return dt.split(' ')[1]?.substring(0, 5) || dt.substring(11, 16);
}
function fmtDate(dt: string) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDuration(elapsed: string) {
  if (!elapsed) return '';
  const parts = elapsed.split(':').map(Number);
  if (parts.length === 4) return `${parts[0] * 24 + parts[1]}j ${parts[2]}m`;
  if (parts.length >= 2) return `${parts[0]}j ${parts[1]}m`;
  return elapsed;
}

function matchesTimeFilter(value: string | undefined, filters: string[]) {
  if (filters.length === 0) return true;
  if (!value) return false;
  const hour = Number.parseInt(fmtTime(value).slice(0, 2), 10);
  if (!Number.isFinite(hour)) return false;
  const ranges = [
    { id: 'early', start: 0, end: 6 },
    { id: 'morning', start: 6, end: 12 },
    { id: 'afternoon', start: 12, end: 18 },
    { id: 'evening', start: 18, end: 24 },
  ];
  return ranges.some(range => filters.includes(range.id) && hour >= range.start && hour < range.end);
}

function FilterSection({
  title,
  children,
  initiallyOpen = true,
  activeCount = 0,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
  activeCount?: number;
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  return (
    <section className="border-b border-slate-100 pb-3">
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between py-1 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
          {title}
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-100 px-1 text-[9px] font-bold text-sky-700">
              {activeCount}
            </span>
          )}
        </span>
        <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-[10px] text-slate-400`} aria-hidden="true" />
      </button>
      {isOpen && <div className="pt-2">{children}</div>}
    </section>
  );
}

const POPULAR_DESTINATIONS = [
  { code: 'DPS', name: 'Bali',        nameEN: 'Bali',         price: 599000,  img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80' },
  { code: 'SIN', name: 'Singapura',   nameEN: 'Singapore',    price: 1199000, img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80' },
  { code: 'KUL', name: 'Malaysia',    nameEN: 'Malaysia',     price: 899000,  img: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&q=80' },
  { code: 'BKK', name: 'Thailand',    nameEN: 'Thailand',     price: 1300000, img: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80' },
  { code: 'ICN', name: 'Korea Selatan', nameEN: 'South Korea', price: 2499000, img: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=600&q=80' },
  { code: 'NRT', name: 'Jepang',      nameEN: 'Japan',        price: 3100000, img: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&q=80' },
];

// ─── Parse journeys dari respons API ─────────────────────────────────────────
// Mengembalikan array per-schedule: index 0 = outbound, 1 = return, dst (multi)
function parseSchedules(apiData: any): any[][] {
  const d = apiData;
  if (!d) return [[]];

  let schedules: any[] = [];

  if (d?.schedules?.length) {
    schedules = d.schedules;
  } else if (d?.response?.schedules?.length) {
    schedules = d.response.schedules;
  } else if (Array.isArray(d)) {
    // flat array fallback — bungkus jadi satu schedule
    return [d];
  }

  if (!schedules.length) return [[]];

  // Attach provider + sequence ke setiap journey agar bisa dipakai di price/book
  return schedules.map((sched: any) => {
    const provider = sched.provider || '';
    const sequence = sched.sequence || 1;
    return (sched.journeys || []).map((j: any) => ({
      ...j,
      provider:            j.provider || provider,
      schedule_provider:   provider,
      schedule_sequence:   j.sequence || sequence,
      schedule_origin:     sched.origin,
      schedule_destination: sched.destination,
    }));
  });
}

// ─── Review Panel (Panel kanan konfirmasi) ────────────────────────────────────
function ReviewPanel({ isOpen, onClose, onConfirm, selectedLegs, searchMeta, loading }: any) {
  const { language } = useLanguage();
  const t = i18n.flightSearch[language];
  const tf = i18n.searchForm[language].flight;
  const tc = i18n.common[language];
  if (!isOpen) return null;

  const isRT    = searchMeta?.direction === 'RT';
  const isMulti = searchMeta?.direction === 'Multi';

  function JourneyBlock({ journey, fare, label, color }: any) {
    if (!journey) return null;
    const seg     = journey.segments?.[0];
    const lastSeg = journey.segments?.[journey.segments.length - 1];
    const summary = fare?.service_charge_summary?.[0];
    const price   = calcFarePerPax(summary) * (searchMeta?.adult || 1);
    const transitCount = getJourneyTransitCount(journey);
    const transitLabel = transitCount === 0
      ? t.directOnly
      : `${transitCount} ${language === 'EN' ? 'stop(s)' : 'transit'}`;
    return (
      <div>
        <div className="bg-slate-50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-card overflow-hidden">
              <img
                src={`https://assets.wego.com/image/upload/h_72,c_fit,f_auto,fl_lossy,q_auto/v20250101/flights/airlines_square/${seg?.carrier_code}.png`}
                alt={seg?.carrier_name}
                className="w-7 h-7 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <p className="font-black text-brand-ink text-sm">{CARRIER_CODE_TO_AIRLINE[seg?.carrier_code] || seg?.carrier_name || seg?.carrier_code}</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                {fare?.fare_name || fare?.class_of_service || 'Economy'} · {transitLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-black text-brand-ink">{fmtTime(seg?.departure_date)}</p>
              <p className="text-xs font-bold text-slate-500">{seg?.origin || journey.origin}</p>
            </div>
            <div className="flex flex-col items-center flex-1 px-3">
              <p className="text-[10px] text-slate-400 font-semibold mb-1">{fmtDuration(journey.elapsed_time)}</p>
              <div className="w-full flex items-center gap-1">
                <div className="flex-1 h-px bg-slate-300"></div>
                <i className="fa-solid fa-plane text-orange-500 text-[10px]"></i>
                <div className="flex-1 h-px bg-slate-300"></div>
              </div>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">
                {transitLabel}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-brand-ink">{fmtTime(lastSeg?.arrival_date)}</p>
              <p className="text-xs font-bold text-slate-500">{lastSeg?.destination || journey.destination}</p>
            </div>
          </div>
          {price > 0 && <p className="text-right text-xs text-orange-600 font-bold mt-2">{fmtIDR(price)}/org</p>}
        </div>
      </div>
    );
  }

  const COLORS = ['bg-orange-600', 'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-rose-600'];
  const LEG_LABELS = isRT
    ? ['Pergi', 'Pulang']
    : isMulti
    ? (searchMeta?.routes || []).map((_: any, i: number) => `Kota ${i + 1}`)
    : ['Penerbangan'];

  const totalPrice = selectedLegs.reduce((sum: number, leg: any) => {
    if (!leg) return sum;
    const summary = leg.fare?.service_charge_summary?.[0];
    return sum + calcFarePerPax(summary) * (searchMeta?.adult || 1);
  }, 0);

  const allSelected = isRT
    ? !!(selectedLegs[0] && selectedLegs[1])
    : isMulti
    ? selectedLegs.every((l: any) => !!l)
    : !!selectedLegs[0];

  // Cari leg berikutnya yang belum dipilih
  const nextMissingLeg  = selectedLegs.findIndex((l: any) => !l);
  const nextMissingLabel = nextMissingLeg >= 0 ? LEG_LABELS[nextMissingLeg] : null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-end p-0 md:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full md:w-[480px] md:rounded-3xl shadow-2xl max-h-[95vh] overflow-y-auto animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <i className="fa-solid fa-xmark text-gray-500"></i>
            </button>
            <h2 className="text-base font-black text-brand-ink">Review Penerbanganmu</h2>
          </div>
          {/* Step pills */}
          {(isRT || isMulti) && (
            <div className="flex items-center gap-1">
              {LEG_LABELS.map((lbl: string, i: number) => (
                <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                  selectedLegs[i] ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {selectedLegs[i] ? '✓' : i + 1}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          {LEG_LABELS.map((label: string, i: number) => (
            <div key={i}>
              {selectedLegs[i] ? (
                <JourneyBlock
                  journey={selectedLegs[i].journey}
                  fare={selectedLegs[i].fare}
                  label={label}
                  color={COLORS[i % COLORS.length]}
                />
              ) : (
                /* Slot penerbangan yang belum dipilih */
                <div
                  onClick={onConfirm}
                  className={`rounded-2xl border-2 border-dashed p-4 flex items-center gap-3 cursor-pointer transition-all group ${
                    i === nextMissingLeg
                      ? 'border-orange-400 bg-orange-50 hover:bg-orange-100'
                      : 'border-slate-200 bg-slate-50 opacity-50 pointer-events-none'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    i === nextMissingLeg ? 'bg-orange-600' : 'bg-slate-200'
                  }`}>
                    <i className={`fa-solid fa-plane text-sm ${i === nextMissingLeg ? 'text-white' : 'text-slate-400'}`}></i>
                  </div>
                  <div className="flex-1">
                    <p className={`font-black text-sm ${i === nextMissingLeg ? 'text-orange-700' : 'text-slate-500'}`}>
                      Pilih Penerbangan {label}
                    </p>
                    {i === nextMissingLeg && (
                      <p className="text-xs text-orange-500 font-semibold mt-0.5">
                        Klik untuk memilih →
                      </p>
                    )}
                  </div>
                  {i === nextMissingLeg && (
                    <i className="fa-solid fa-chevron-right text-orange-500 text-sm group-hover:translate-x-1 transition-transform"></i>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Total harga (hanya tampil jika ada leg yang sudah dipilih) */}
          {totalPrice > 0 && (
            <div className="flex items-end justify-between pt-2 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-400 font-semibold">
                  {searchMeta?.adult || 1} {t.adults.toLowerCase()} · {isRT ? tf.roundTrip : isMulti ? tf.multiCity : tf.oneWay}
                  {!allSelected && ' · estimasi'}
                </p>
                <p className={`text-2xl font-black ${allSelected ? 'text-orange-600' : 'text-slate-400'}`}>
                  {fmtIDR(totalPrice)}
                </p>
                <p className="text-xs text-slate-400">
                  {allSelected ? 'Total sudah termasuk pajak' : 'Harga belum final, pilih semua penerbangan'}
                </p>
              </div>
            </div>
          )}

          {/* CTA button — kontekstual */}
          {allSelected ? (
            /* Semua leg sudah dipilih → lanjut ke checkout */
            <button
              onClick={onConfirm}
              disabled={loading}
              className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Memvalidasi harga...</>
              ) : (
                <>Lanjutkan ke Pemesanan <i className="fa-solid fa-arrow-right"></i></>
              )}
            </button>
          ) : (
            /* Ada leg yang belum dipilih → arahkan pilih leg berikutnya */
            <button
              onClick={onConfirm}
              className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              Pilih Penerbangan {nextMissingLabel} <i className="fa-solid fa-plane-departure"></i>
            </button>
          )}

          <button onClick={onClose} className="text-sm text-slate-400 text-center hover:text-slate-600 transition-colors py-1 w-full">
            {allSelected ? 'Kembali pilih penerbangan lain' : tc.close}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Provider Search Progress ─────────────────────────────────────────────────
function ProviderProgress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-700">
          <div className="relative">
            <div className="w-5 h-5 border-2 border-orange-200 rounded-full"></div>
            <div className="absolute inset-0 w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          Sedang mencari penerbangan terbaik...
        </div>
        <span className="text-xs font-black text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">{pct}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-700 ease-out relative"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite]"></div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Skeleton ────────────────────────────────────────────────────────
function FilterSkeleton() {
  return (
    <div className="w-full lg:w-64 shrink-0 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden sticky top-24 animate-pulse">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <div className="w-4 h-4 bg-slate-200 rounded"></div>
          <div className="h-3 w-16 bg-slate-200 rounded"></div>
        </div>
        <div className="p-4 space-y-5">
          {/* Price */}
          <div>
            <div className="h-2.5 w-20 bg-slate-200 rounded mb-3"></div>
            <div className="flex gap-1.5 mb-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-6 w-14 bg-slate-100 rounded-lg"></div>)}
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full mt-2"></div>
          </div>
          <div className="h-px bg-slate-100"></div>
          {/* Transit */}
          <div>
            <div className="h-2.5 w-14 bg-slate-200 rounded mb-3"></div>
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-100 rounded"></div><div className="h-2.5 w-20 bg-slate-100 rounded"></div></div>)}
            </div>
          </div>
          <div className="h-px bg-slate-100"></div>
          {/* Airline */}
          <div>
            <div className="h-2.5 w-16 bg-slate-200 rounded mb-3"></div>
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-100 rounded"></div><div className="h-2.5 w-24 bg-slate-100 rounded"></div></div><div className="w-5 h-4 bg-slate-100 rounded"></div></div>)}
            </div>
          </div>
          <div className="h-px bg-slate-100"></div>
          {/* Time */}
          <div>
            <div className="h-2.5 w-24 bg-slate-200 rounded mb-3"></div>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl"></div>)}
            </div>
          </div>
          <div className="h-px bg-slate-100"></div>
          {/* Sort */}
          <div>
            <div className="h-2.5 w-12 bg-slate-200 rounded mb-3"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-100 rounded"></div><div className="h-2.5 w-28 bg-slate-100 rounded"></div></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── No Results with Alternatives ───────────────────────────────────────────
function NoResultsWithAlternatives({ searchMeta, onSearch, onRetry }: { searchMeta: any; onSearch: (p: any) => void; onRetry?: () => void }) {
  const { language } = useLanguage();
  const t = i18n.flightSearch[language];
  const isEN = language === 'EN';

  const quickFlight = (dest: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    onSearch({
      origin: searchMeta?.origin || 'CGK',
      destination: dest,
      departure_date: formatLocalDate(d),
      adult: searchMeta?.adult || 1,
      child: searchMeta?.child || 0,
      infant: searchMeta?.infant || 0,
      cabin_class: searchMeta?.cabin_class || 'Y',
      direction: searchMeta?.direction || 'OW',
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      {/* No results header */}
      <div className="px-6 py-10 text-center">
        <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-plane text-3xl text-orange-300"></i>
        </div>
        <h3 className="font-black text-brand-ink text-lg mb-1.5">{t.noResultTitle}</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">{t.noResultDesc}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm hover:bg-orange-700 transition-colors">
            <i className="fa-solid fa-rotate-right"></i> Coba Lagi
          </button>
        )}
      </div>

      {/* Alternative destinations */}
      <div className="border-t border-slate-100 bg-slate-50 px-6 py-6">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t.alternativeTitle}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {POPULAR_DESTINATIONS.filter(d => d.code !== searchMeta?.destination).map(d => (
            <button key={d.code} onClick={() => quickFlight(d.code)}
              className="group relative overflow-hidden rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-left">
              <div className="aspect-[16/10] relative">
                <img src={d.img} alt={isEN ? d.nameEN : d.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? d.nameEN : d.name}</p>
                  <p className="text-orange-300 text-[10px] sm:text-xs font-semibold mt-0.5">
                    Mulai dari IDR {(d.price / 1000).toLocaleString('id-ID')}K
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── No Results untuk satu leg (RT/Multi) ─────────────────────────────────────
// Ditampilkan ketika sebuah leg tidak punya penerbangan, TANPA mereset leg lain
// yang sudah dipilih user. User bisa cari ulang leg ini, ganti tanggal leg ini,
// atau menukar asal/tujuan leg ini.
function LegNoResults({ legIndex, totalLegs, legRoute, legDate, isRT, onRetry, onDateChange, onSwap }: {
  legIndex: number;
  totalLegs: number;
  legRoute: { origin?: string; destination?: string };
  legDate?: string;
  isRT: boolean;
  onRetry: () => void;
  onDateChange: (date: string) => void;
  onSwap: () => void;
}) {
  const { language } = useLanguage();
  const t = i18n.flightSearch[language];

  const legLabel = isRT ? (legIndex === 0 ? 'Pergi' : 'Pulang') : `Kota ${legIndex + 1}`;
  const base = legDate ? parseLocalDate(legDate) : new Date();
  const offsets = [-2, -1, 0, 1, 2];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      <div className="px-6 py-8 text-center">
        <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-plane-slash text-2xl text-orange-300"></i>
        </div>
        <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider mb-1">
          {legLabel} · {legIndex + 1}/{totalLegs}
        </p>
        <h3 className="font-black text-brand-ink text-lg mb-1.5">{t.legNoResultTitle}</h3>
        {legRoute?.origin && legRoute?.destination && (
          <p className="text-slate-600 text-sm font-bold">{legRoute.origin} → {legRoute.destination}{legDate ? ` · ${legDate}` : ''}</p>
        )}
        <p className="text-slate-400 text-xs max-w-md mx-auto mt-1">{t.legNoResultDesc}</p>

        {/* Date strip khusus leg ini */}
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-5 mb-2">{t.legOtherDate}</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {offsets.map(offset => {
            const d = new Date(base);
            d.setDate(d.getDate() + offset);
            const dateStr = formatLocalDate(d);
            const isActive = offset === 0;
            return (
              <button key={offset} onClick={() => onDateChange(dateStr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isActive ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300'}`}>
                {d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-5">
          <button onClick={onRetry} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm hover:bg-orange-700 transition-colors">
            <i className="fa-solid fa-rotate-right"></i> {t.legRetry}
          </button>
          <button onClick={onSwap} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-slate-600 font-bold rounded-xl text-sm border border-slate-200 hover:border-orange-300 transition-colors">
            <i className="fa-solid fa-right-left"></i> {t.legSwap}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-emerald-50/60 px-6 py-3 flex items-center gap-2 justify-center">
        <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
        <p className="text-xs text-emerald-700 font-semibold">{t.legKept}</p>
      </div>
    </div>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row gap-4 animate-pulse">
          <div className="flex items-center gap-3 md:w-48">
            <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
            <div className="space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded"></div>
              <div className="h-2 w-16 bg-slate-200 rounded"></div>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-between">
            <div className="h-8 w-16 bg-slate-200 rounded"></div>
            <div className="flex-1 mx-4 h-px bg-slate-200"></div>
            <div className="h-8 w-16 bg-slate-200 rounded"></div>
          </div>
          <div className="md:w-52 space-y-2">
            <div className="h-4 w-20 bg-slate-200 rounded ml-auto"></div>
            <div className="h-7 w-28 bg-orange-200 rounded ml-auto"></div>
            <div className="h-9 w-full bg-slate-200 rounded-xl"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Compact Search Bar ───────────────────────────────────────────────────────
function CompactSearchBar({ searchMeta, onSearch, loading }: { searchMeta: any; onSearch: (p: any) => void; loading: boolean }) {
  const { language } = useLanguage();
  const t = i18n.flightSearch[language];
  const tf = i18n.searchForm[language].flight;
  const [collapsed, setCollapsed] = useState(true);
  if (collapsed) {
    const dirLabel = searchMeta?.direction === 'RT' ? tf.roundTrip : searchMeta?.direction === 'Multi' ? tf.multiCity : tf.oneWay;
    const routeLabel = searchMeta?.direction === 'Multi'
      ? (searchMeta?.routes || []).map((r: any) => `${r.origin}→${r.destination}`).join(', ')
      : `${searchMeta?.origin} → ${searchMeta?.destination}`;
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 cursor-pointer" onClick={() => setCollapsed(false)}>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-plane text-orange-600"></i>
          </div>
          <div>
            <p className="font-black text-brand-ink text-sm">{routeLabel}</p>
            <p className="text-xs text-slate-500">
              {searchMeta?.departure_date} · {dirLabel} · {searchMeta?.adult || 1} {t.adults}
            </p>
          </div>
        </div>
        <button className="px-4 py-2 bg-orange-100 text-orange-700 font-bold text-xs rounded-xl hover:bg-orange-200 transition-colors shrink-0">
          Ubah Pencarian
        </button>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 relative z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-brand-ink text-sm">Ubah Pencarian</h3>
        <button onClick={() => setCollapsed(true)} className="text-slate-400 hover:text-brand-ink transition-colors">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <FlightSearchForm onSearch={(p) => { onSearch(p); setCollapsed(true); }} loading={loading} initialData={searchMeta} variant="light" />
    </div>
  );
}

// ─── Landing (default, belum mencari) ────────────────────────────────────────
function FlightLanding({ onSearch, loading }: { onSearch: (p: any) => void; loading: boolean }) {
  const { language } = useLanguage();
  const t = i18n.flightSearch[language];
  const isEN = language === 'EN';

  const quickSearch = (dest: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    onSearch({ origin: 'CGK', destination: dest, departure_date: formatLocalDate(d), adult: 1, child: 0, infant: 0, cabin_class: 'Y', direction: 'OW' });
  };

  return (
    <>
      <section className="relative z-20 overflow-visible pt-4 md:pt-8 pb-2">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
              {t.landing.title}
            </h1>
            <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium">{t.landing.subtitle}</p>
          </div>

          <div className="bg-white rounded-2xl md:rounded-3xl shadow-floating border border-slate-100/80 p-4 sm:p-6 transition-all">
            <FlightSearchForm onSearch={onSearch} loading={loading} variant="light" />
          </div>
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <div className="mb-5">
          <h2 className="text-lg sm:text-xl font-black text-brand-ink">{t.landing.popularTitle}</h2>
          <p className="text-brand-neutral text-xs sm:text-sm mt-1">{t.landing.popularSub}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {POPULAR_DESTINATIONS.map(d => (
            <button key={d.code} onClick={() => quickSearch(d.code)}
              className="group relative overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-left">
              <div className="aspect-[4/3] relative">
                <img src={d.img} alt={isEN ? d.nameEN : d.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
                  <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? d.nameEN : d.name}</p>
                  <p className="text-orange-300 text-[10px] sm:text-xs font-semibold mt-0.5">{t.landing.startingFrom} {fmtIDR(d.price)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function FlightSearchContent() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const t = i18n.flightSearch[language];
  const tf = i18n.searchForm[language].flight;
  const searchParamsHook = useSearchParams();
  const router = useRouter();

  usePageTitle(
    searchParamsHook.get('origin') && searchParamsHook.get('destination')
      ? `Pencarian Pesawat: ${searchParamsHook.get('origin')} → ${searchParamsHook.get('destination')}`
      : 'Pencarian Pesawat'
  );

  // ── TAMBAHAN: Ref ID Pencarian (Mencegah Bug Race Condition) ──
  const searchIdRef = useRef(0);

  // ── Data state ──
  // scheduleResults: array per-leg [ [outbound journeys], [return journeys], ... ]
  const [hasSearched, setHasSearched] = useState(false);
  const [scheduleResults, setScheduleResults] = useState<any[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Progress multi-provider
  const [providersDone, setProvidersDone] = useState(0);
  const [providersTotal, setProvidersTotal] = useState(0);
  const [searchedProviders, setSearchedProviders] = useState<string[]>([]);

  const [searchMeta, setSearchMeta] = useState<any>({
    origin:         searchParamsHook.get('origin')         || 'CGK',
    destination:    searchParamsHook.get('destination')    || 'DPS',
    departure_date: searchParamsHook.get('departure_date') || '',
    return_date:    searchParamsHook.get('return_date')    || '',
    adult:          searchParamsHook.get('adult')          || '1',
    child:          searchParamsHook.get('child')          || '0',
    infant:         searchParamsHook.get('infant')         || '0',
    cabin_class:    searchParamsHook.get('cabin_class')    || 'Y',
    direction:      searchParamsHook.get('direction')      || 'OW',
  });

  // Default "hari ini" dihitung sekali saat mount (stabil & idempotent)
  const [todayDefault] = useState(() => formatLocalDate(new Date()));

  // ── Step state (untuk RT & multi-city) ──
  // currentLegStep: 0 = outbound/leg1, 1 = return/leg2, dst.
  const [currentLegStep, setCurrentLegStep] = useState(0);
  // selectedLegs: array selection per leg [ { journey, fare } | null ]
  const [selectedLegs, setSelectedLegs] = useState<(null | { journey: any; fare: any })[]>([null]);

  // ── Filter & Sort ──
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'earliest' | 'latest'>('price_asc');
  const [filterTransit, setFilterTransit] = useState<string[]>([]);
  const [filterAirlines, setFilterAirlines] = useState<string[]>([]);
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | null>(null);
  const [filterDepartureTime, setFilterDepartureTime] = useState<string[]>([]);
  const [filterArrivalTime, setFilterArrivalTime] = useState<string[]>([]);
  const [airlineSearch, setAirlineSearch] = useState('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [flightCoupons, setFlightCoupons] = useState<FlightCoupon[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [copiedPromo, setCopiedPromo] = useState('');
  const [promoCopyError, setPromoCopyError] = useState('');
  const [minimumFlightDate] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });

  // ── Review panel ──
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (!promoOpen) return;
    let isCurrent = true;
    setPromoLoading(true);
    setPromoError('');
    fetch('/api/coupons/active?category=flight&limit=100')
      .then(async response => {
        if (!response.ok) throw new Error(`Coupon request failed (${response.status})`);
        return response.json();
      })
      .then(data => {
        if (isCurrent) setFlightCoupons(Array.isArray(data.coupons) ? data.coupons : []);
      })
      .catch(error => {
        console.error('[FLIGHT PROMO] Failed to load active coupons:', error);
        if (isCurrent) setPromoError('Promo gagal dimuat. Periksa koneksi lalu coba lagi.');
      })
      .finally(() => {
        if (isCurrent) setPromoLoading(false);
      });
    return () => { isCurrent = false; };
  }, [promoOpen]);

  useEffect(() => {
    if (!promoOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPromoOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [promoOpen]);

  const copyFlightCoupon = async (code: string) => {
    setPromoCopyError('');
    try {
      await navigator.clipboard.writeText(code);
      setCopiedPromo(code);
      toast(language === 'EN' ? 'Promo code copied!' : 'Kode promo berhasil disalin!', { variant: 'success' });
      window.setTimeout(() => setCopiedPromo(current => current === code ? '' : current), 2000);
    } catch (error) {
      console.error('[FLIGHT PROMO] Failed to copy coupon:', error);
      setPromoCopyError('Kode promo tidak dapat disalin. Silakan salin kode secara manual.');
      toast(language === 'EN' ? 'Could not copy the promo code.' : 'Kode promo gagal disalin.', { variant: 'error' });
    }
  };

  // Compute total legs expected
  const totalLegs = useMemo(() => {
    if (searchMeta?.direction === 'RT') return 2;
    if (searchMeta?.direction === 'Multi') return (searchMeta?.routes?.length || 2);
    return 1;
  }, [searchMeta]);

  // Current leg journeys to display
  const currentJourneys = useMemo(() => {
    return scheduleResults[currentLegStep] || [];
  }, [scheduleResults, currentLegStep]);

  // ── handleSearch: search semua provider secara paralel ──
  const handleSearch = async (params: any) => {
    // 1. Buat ID pencarian baru setiap kali tombol search ditekan
    searchIdRef.current += 1;
    const currentSearchId = searchIdRef.current;

    setLoading(true);
    setError('');
    setScheduleResults([]);
    setHasSearched(true);
    setCurrentLegStep(0);
    setSelectedLegs(new Array(params.direction === 'RT' ? 2 : params.direction === 'Multi' ? (params.routes?.length || 2) : 1).fill(null));
    setFilterAirlines([]);
    setFilterTransit([]);
    setFilterMaxPrice(null);
    setFilterDepartureTime([]);
    setFilterArrivalTime([]);
    setAirlineSearch('');
    setSearchMeta(params);

    // Ambil providers yang akan dicari
    const providers = FLIGHT_PROVIDERS.map(p => p.id);
    setSearchedProviders(providers);
    setProvidersTotal(providers.length);
    setProvidersDone(0);

    // Akumulasi per-schedule index
    // scheduleMap: { [scheduleIndex]: journey[] }
    const scheduleMap: Map<number, any[]> = new Map();

    // Hitung provider yang gagal karena koneksi / server (untuk pesan error yang tepat)
    let networkFailures = 0;
    let serverFailures = 0;

    const searchOne = async (provider: string) => {
      try {
        const res = await fetch('/api/flight/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, provider }),
        });
        const data = await res.json();

        // CEK PENTING: Jika user sudah menekan tombol search baru, buang hasil dari search lama ini
        if (searchIdRef.current !== currentSearchId) return;

        if (!res.ok || !data.success) {
          if (searchIdRef.current === currentSearchId) serverFailures++;
          return;
        }

        const perSchedule = parseSchedules(data.data);
        
        // Merge ke scheduleMap dengan Smart Deduplication (Ambil harga termurah)
        perSchedule.forEach((journeys, idx) => {
          const existing = scheduleMap.get(idx) || [];
          const updatedExisting = [...existing];

          journeys.forEach(newJ => {
            const key = newJ.journey_code || newJ.segments?.[0]?.segment_code;
            const existingIdx = updatedExisting.findIndex(e => (e.journey_code || e.segments?.[0]?.segment_code) === key);

            if (existingIdx >= 0) {
              // Jika penerbangan sama sudah ada, bandingkan harganya!
              const oldFare = updatedExisting[existingIdx].segments?.[0]?.fares?.[0]?.service_charge_summary?.[0];
              const newFare = newJ.segments?.[0]?.fares?.[0]?.service_charge_summary?.[0];

              const oldPrice = calcFarePerPax(oldFare);
              const newPrice = calcFarePerPax(newFare);

              // Jika harga yang baru lebih murah (dan valid), timpa yang lama
              if (newPrice > 0 && (newPrice < oldPrice || oldPrice === 0)) {
                updatedExisting[existingIdx] = newJ;
              }
            } else {
              // Jika belum ada, masukkan sebagai penerbangan baru
              updatedExisting.push(newJ);
            }
          });

          scheduleMap.set(idx, updatedExisting);
        });

        // Update state secara streaming (tampilkan hasil yang sudah ada)
        const merged: any[][] = [];
        const maxIdx = Math.max(...Array.from(scheduleMap.keys()), 0);
        for (let i = 0; i <= maxIdx; i++) {
          merged.push(scheduleMap.get(i) || []);
        }
        setScheduleResults([...merged]);
      } catch {
        // Provider gagal — catat bila ini murni kegagalan koneksi
        if (searchIdRef.current === currentSearchId) networkFailures++;
      } finally {
        // Update progress bar hanya jika ini adalah pencarian yang masih aktif
        if (searchIdRef.current === currentSearchId) {
          setProvidersDone(d => d + 1);
        }
      }
    };

    // Jalankan semua providers paralel dengan stagger 150ms
    await Promise.all(providers.map((p, i) => new Promise<void>(r => setTimeout(() => searchOne(p).finally(r), i * 150))));

    // Jika ini masih pencarian yang aktif, tutup loading
    if (searchIdRef.current === currentSearchId) {
      setLoading(false);

      // Cek apakah ada hasil sama sekali
      const total = Array.from(scheduleMap.values()).reduce((s, a) => s + a.length, 0);
      if (total === 0) {
        if (networkFailures >= providers.length) {
          setError(
            typeof navigator !== 'undefined' && navigator.onLine === false
              ? 'Koneksi internet terputus. Periksa sinyalmu lalu coba lagi.'
              : 'Gagal terhubung ke maskapai. Cek koneksi internetmu lalu coba lagi.'
          );
        } else if (serverFailures >= providers.length) {
          setError('Gagal mendapatkan jadwal dari maskapai. Silakan coba lagi beberapa saat lagi.');
        } else {
          setError('Tidak ada penerbangan ditemukan untuk rute ini. Coba ubah tanggal atau rute.');
        }
      }
    }
  };

  // ── handleSearchLeg: cari ulang SATU leg saja (RT/Multi) ──
  // Tidak mereset leg lain yang sudah dipilih user. Hasil hanya ditulis ke
  // scheduleResults[legIndex].
  const handleSearchLeg = useCallback(async (
    legIndex: number,
    overrides?: { origin?: string; destination?: string; departure_date?: string }
  ) => {
    const direction = searchMeta?.direction || 'OW';
    let journey: { origin: string; destination: string; departure_date: string } | null = null;
    let nextMeta = { ...searchMeta };

    if (direction === 'RT') {
      if (legIndex === 0) {
        journey = {
          origin: overrides?.origin || searchMeta.origin,
          destination: overrides?.destination || searchMeta.destination,
          departure_date: overrides?.departure_date || searchMeta.departure_date,
        };
        nextMeta = { ...nextMeta, origin: journey.origin, destination: journey.destination, departure_date: journey.departure_date };
      } else {
        journey = {
          origin: overrides?.origin || searchMeta.destination,
          destination: overrides?.destination || searchMeta.origin,
          departure_date: overrides?.departure_date || searchMeta.return_date,
        };
        nextMeta = { ...nextMeta, return_date: journey.departure_date };
      }
    } else if (direction === 'Multi') {
      const r = (searchMeta.routes || [])[legIndex] || {};
      journey = {
        origin: overrides?.origin || r.origin || '',
        destination: overrides?.destination || r.destination || '',
        departure_date: overrides?.departure_date || r.departure_date || '',
      };
      const newRoutes = (searchMeta.routes || []).map((rr: any, i: number) => (i === legIndex ? { ...rr, ...journey } : rr));
      nextMeta = { ...nextMeta, routes: newRoutes };
    } else {
      journey = {
        origin: overrides?.origin || searchMeta.origin,
        destination: overrides?.destination || searchMeta.destination,
        departure_date: overrides?.departure_date || searchMeta.departure_date,
      };
      nextMeta = { ...nextMeta, origin: journey.origin, destination: journey.destination, departure_date: journey.departure_date };
    }

    if (!journey.origin || !journey.destination || !journey.departure_date) return;
    const legJourney = journey;

    searchIdRef.current += 1;
    const currentSearchId = searchIdRef.current;

    setLoading(true);
    setError('');
    setSearchMeta(nextMeta);
    setCurrentLegStep(legIndex);
    // Kosongkan hanya pilihan leg ini; leg lain tetap.
    setSelectedLegs(prev => {
      const next = [...prev];
      while (next.length < totalLegs) next.push(null);
      next[legIndex] = null;
      return next;
    });
    setScheduleResults(prev => {
      const next = [...prev];
      while (next.length < totalLegs) next.push([]);
      next[legIndex] = [];
      return next;
    });
    setFilterAirlines([]);
    setFilterTransit([]);
    setFilterMaxPrice(null);
    setFilterDepartureTime([]);
    setFilterArrivalTime([]);
    setAirlineSearch('');

    const providers = FLIGHT_PROVIDERS.map(p => p.id);
    setSearchedProviders(providers);
    setProvidersTotal(providers.length);
    setProvidersDone(0);

    const scheduleMap: Map<number, any[]> = new Map();
    let networkFailures = 0;
    let serverFailures = 0;

    const searchOne = async (provider: string) => {
      try {
        const res = await fetch('/api/flight/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            direction: 'OW',
            origin: legJourney.origin,
            destination: legJourney.destination,
            departure_date: legJourney.departure_date,
            adult: searchMeta?.adult || 1,
            child: searchMeta?.child || 0,
            infant: searchMeta?.infant || 0,
            cabin_class: searchMeta?.cabin_class || 'Y',
            provider,
          }),
        });
        const data = await res.json();
        if (searchIdRef.current !== currentSearchId) return;
        if (!res.ok || !data.success) { serverFailures++; return; }

        const perSchedule = parseSchedules(data.data);
        const journeys = perSchedule[0] || [];
        const existing = scheduleMap.get(0) || [];
        const updatedExisting = [...existing];

        journeys.forEach((newJ: any) => {
          const key = newJ.journey_code || newJ.segments?.[0]?.segment_code;
          const existingIdx = updatedExisting.findIndex(e => (e.journey_code || e.segments?.[0]?.segment_code) === key);
          if (existingIdx >= 0) {
            const oldFare = updatedExisting[existingIdx].segments?.[0]?.fares?.[0]?.service_charge_summary?.[0];
            const newFare = newJ.segments?.[0]?.fares?.[0]?.service_charge_summary?.[0];
            const oldPrice = calcFarePerPax(oldFare);
            const newPrice = calcFarePerPax(newFare);
            if (newPrice > 0 && (newPrice < oldPrice || oldPrice === 0)) updatedExisting[existingIdx] = newJ;
          } else {
            updatedExisting.push(newJ);
          }
        });

        scheduleMap.set(0, updatedExisting);
        setScheduleResults(prev => {
          const next = [...prev];
          while (next.length < totalLegs) next.push([]);
          next[legIndex] = [...updatedExisting];
          return next;
        });
      } catch {
        if (searchIdRef.current === currentSearchId) networkFailures++;
      } finally {
        if (searchIdRef.current === currentSearchId) setProvidersDone(d => d + 1);
      }
    };

    await Promise.all(providers.map((p, i) => new Promise<void>(r => setTimeout(() => searchOne(p).finally(r), i * 150))));

    if (searchIdRef.current === currentSearchId) {
      setLoading(false);
      const total = Array.from(scheduleMap.values()).reduce((s, a) => s + a.length, 0);
      if (total === 0) {
        if (networkFailures >= providers.length) {
          setError(
            typeof navigator !== 'undefined' && navigator.onLine === false
              ? 'Koneksi internet terputus. Periksa sinyalmu lalu coba lagi.'
              : 'Gagal terhubung ke maskapai. Cek koneksi internetmu lalu coba lagi.'
          );
        } else if (serverFailures >= providers.length) {
          setError('Gagal mendapatkan jadwal dari maskapai. Silakan coba lagi beberapa saat lagi.');
        } else {
          setError('Tidak ada penerbangan ditemukan untuk rute ini. Coba ubah tanggal atau rute.');
        }
      }
    }
  }, [searchMeta, totalLegs]);

  // ── Auto-search on mount ──
  useEffect(() => {
    const origin         = searchParamsHook.get('origin');
    const destination    = searchParamsHook.get('destination');
    const departure_date = searchParamsHook.get('departure_date');
    const direction      = searchParamsHook.get('direction') || 'OW';
    const routesRaw      = searchParamsHook.get('routes');

    const isMulti = direction === 'Multi' && routesRaw;
    const isOWRT  = origin && destination && departure_date;

    if (isMulti || isOWRT) {
      const params: any = {
        origin:       origin       || undefined,
        destination:  destination  || undefined,
        departure_date: departure_date || undefined,
        return_date:  searchParamsHook.get('return_date')  || undefined,
        adult:        searchParamsHook.get('adult')        || 1,
        child:        searchParamsHook.get('child')        || 0,
        infant:       searchParamsHook.get('infant')       || 0,
        cabin_class:  searchParamsHook.get('cabin_class')  || 'Y',
        direction,
      };
      if (isMulti) {
        try { params.routes = JSON.parse(routesRaw); } catch {}
      }
      handleSearch(params);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Airline list dari current leg ──
  const airlineList = useMemo(() => {
    const map = new Map<string, { name: string; code: string; count: number }>();
    currentJourneys.forEach(j => {
      const journeyCarriers = new Set<string>();
      j.segments?.forEach((seg: { carrier_code?: string; carrier_name?: string }) => {
        const code = seg?.carrier_code || '';
        if (!code) return;
        journeyCarriers.add(code);
        const name = CARRIER_CODE_TO_AIRLINE[code] || seg?.carrier_name || code;
        const existing = map.get(code);
        if (!existing) map.set(code, { name, code, count: 0 });
      });
      journeyCarriers.forEach(code => {
        const airline = map.get(code);
        if (airline) airline.count++;
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [currentJourneys]);

  const transitOptions = useMemo(() => {
    const counts = new Map<number, { count: number; lowestPrice: number }>();
    currentJourneys.forEach(journey => {
      const stops = getJourneyTransitCount(journey);
      const price = getJourneyStartingPrice(journey);
      const current = counts.get(stops) || { count: 0, lowestPrice: 0 };
      counts.set(stops, {
        count: current.count + 1,
        lowestPrice: price > 0 && (current.lowestPrice === 0 || price < current.lowestPrice)
          ? price
          : current.lowestPrice,
      });
    });
    return Array.from(counts.entries())
      .sort(([stopsA], [stopsB]) => stopsA - stopsB)
      .map(([stops, summary]) => ({
        id: `stops-${stops}`,
        stops,
        count: summary.count,
        lowestPrice: summary.lowestPrice,
        label: stops === 0 ? t.directOnly : `${stops} Transit`,
      }));
  }, [currentJourneys, t.directOnly]);

  // ── Price range ──
  const priceRange = useMemo(() => {
    if (!currentJourneys.length) return { min: 0, max: 0 };
    let min = Infinity, max = 0;
    currentJourneys.forEach(j => {
      const price = getJourneyStartingPrice(j);
      if (price > 0) { min = Math.min(min, price); max = Math.max(max, price); }
    });
    return { min: min === Infinity ? 0 : min, max };
  }, [currentJourneys]);

  // ── Filter + Sort ──
  const filtered = useMemo(() => {
    let arr = [...currentJourneys];

    if (filterTransit.length > 0) {
      arr = arr.filter(j => {
        return filterTransit.includes(`stops-${getJourneyTransitCount(j)}`);
      });
    }
    if (filterAirlines.length > 0) {
      arr = arr.filter(j => j.segments?.some((segment: { carrier_code?: string }) => filterAirlines.includes(segment.carrier_code || '')));
    }
    if (filterMaxPrice !== null) {
      arr = arr.filter(j => {
        const price = getJourneyStartingPrice(j);
        return price > 0 && price <= filterMaxPrice;
      });
    }
    if (filterDepartureTime.length > 0) {
      arr = arr.filter(j => matchesTimeFilter(j.segments?.[0]?.departure_date, filterDepartureTime));
    }
    if (filterArrivalTime.length > 0) {
      arr = arr.filter(j => {
        const lastSegment = j.segments?.[j.segments.length - 1];
        return matchesTimeFilter(lastSegment?.arrival_date, filterArrivalTime);
      });
    }

    arr.sort((a, b) => {
      const pA = getJourneyStartingPrice(a);
      const pB = getJourneyStartingPrice(b);
      const tA = new Date(a.segments?.[0]?.departure_date || 0).getTime();
      const tB = new Date(b.segments?.[0]?.departure_date || 0).getTime();
      if (sortBy === 'price_asc')  return pA - pB;
      if (sortBy === 'price_desc') return pB - pA;
      if (sortBy === 'earliest')   return tA - tB;
      if (sortBy === 'latest')     return tB - tA;
      return 0;
    });

    return arr;
  }, [currentJourneys, sortBy, filterTransit, filterAirlines, filterMaxPrice, filterDepartureTime, filterArrivalTime]);

  // ── Indeks penerbangan termurah (untuk badge highlight) ──
  const cheapestIdx = useMemo(() => {
    let bestIdx = -1;
    let bestPrice = Infinity;
    filtered.forEach((j, i) => {
      const price = getJourneyStartingPrice(j);
      if (price > 0 && price < bestPrice) {
        bestPrice = price;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [filtered]);

  // ── Pilih flight ──
  const handleSelectFlight = useCallback(async (journey: any, fare: any) => {
    const newLegs = [...selectedLegs];
    newLegs[currentLegStep] = { journey, fare };
    setSelectedLegs(newLegs);
    // Selalu buka review panel — di dalam panel user bisa lanjut ke leg berikutnya
    setIsReviewOpen(true);
  }, [currentLegStep, selectedLegs]);

  // ── Konfirmasi review → price → checkout ──
  const handleConfirmReview = async () => {
    // Cek apakah semua leg sudah dipilih
    const allSelected = selectedLegs.every((l: any) => !!l);

    if (!allSelected) {
      // Temukan leg berikutnya yang belum dipilih
      const nextStep = selectedLegs.findIndex((l: any) => !l);
      if (nextStep >= 0) {
        // Tutup panel & pindah ke step berikutnya
        setIsReviewOpen(false);
        setCurrentLegStep(nextStep);
        setFilterAirlines([]);
        setFilterTransit([]);
        setFilterDepartureTime([]);
        setFilterArrivalTime([]);
        // Scroll ke atas daftar penerbangan
        window.scrollTo({ top: 300, behavior: 'smooth' });
        return;
      }
    }

    // Semua leg sudah dipilih → lanjut ke price & checkout
    setReviewLoading(true);
    try {
      // Bangun schedules sesuai format Orbis
      const formattedSchedules = selectedLegs.map((leg, idx) => {
        if (!leg) return null;
        const { journey, fare } = leg;
        return {
          provider: journey.provider || journey.schedule_provider || searchMeta?.provider || 'citilink',
          sequence: idx + 1,
          journeys: [{
            segments: (journey.segments || []).map((seg: any) => ({
              segment_code: seg.segment_code,
              fare_code:    fare?.fare_code || seg.fares?.[0]?.fare_code || '',
            }))
          }]
        };
      }).filter(Boolean);

      const isRT    = searchMeta?.direction === 'RT';
      const isMulti = searchMeta?.direction === 'Multi';

      const priceBody: any = {
        provider:       formattedSchedules[0]?.provider || 'citilink',
        adult:          parseInt(searchMeta?.adult  || '1'),
        child:          parseInt(searchMeta?.child  || '0'),
        infant:         parseInt(searchMeta?.infant || '0'),
        cabin_class:    searchMeta?.cabin_class || 'Y',
        is_combo_price: isRT || isMulti,
        schedules:      formattedSchedules,
      };

      const priceRes  = await fetch('/api/flight/price', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(priceBody),
      });
      const priceData = await priceRes.json();

      // Outbound display info
      const outLeg    = selectedLegs[0];
      const outSeg    = outLeg?.journey?.segments?.[0];
      const lastSeg   = outLeg?.journey?.segments?.[outLeg?.journey?.segments?.length - 1];

      // Untuk RT/Multi: kumpulkan semua leg info
      const allLegsDisplay = selectedLegs.map((leg, i) => {
        if (!leg) return null;
        const s = leg.journey?.segments?.[0];
        const l = leg.journey?.segments?.[leg.journey?.segments?.length - 1];
        return {
          legIndex:    i,
          carrier:     s?.carrier_name,
          origin:      s?.origin || leg.journey?.origin,
          destination: l?.destination || leg.journey?.destination,
          departure:   s?.departure_date,
          arrival:     l?.arrival_date,
          flight_num:  `${s?.carrier_code}${s?.carrier_number}`,
          elapsed:     leg.journey?.elapsed_time,
        };
      });

      const flightPricedData = {
        display: {
          carrier:     outSeg?.carrier_name,
          origin:      outSeg?.origin || outLeg?.journey?.origin,
          destination: lastSeg?.destination || outLeg?.journey?.destination,
          departure:   outSeg?.departure_date,
          arrival:     lastSeg?.arrival_date,
          flight_num:  `${outSeg?.carrier_code}${outSeg?.carrier_number}`,
          elapsed:     outLeg?.journey?.elapsed_time,
        },
        allLegsDisplay,
        priceResponse: priceData.data,
        priceBody,
        searchMeta,
      };

      sessionStorage.setItem('flight_priced_data', JSON.stringify(flightPricedData));
      router.push('/flight/checkout');
    } catch (err: any) {
      // Fallback tanpa price validation
      const outLeg  = selectedLegs[0];
      const outSeg  = outLeg?.journey?.segments?.[0];
      const lastSeg = outLeg?.journey?.segments?.[outLeg?.journey?.segments?.length - 1];

      const formattedSchedulesFallback = selectedLegs.map((leg, idx) => {
        if (!leg) return null;
        const { journey, fare } = leg;
        return {
          provider: journey.provider || journey.schedule_provider || 'citilink',
          sequence: idx + 1,
          journeys: [{ segments: [{ segment_code: journey.journey_code || journey.segments?.[0]?.segment_code, fare_code: fare?.fare_code }] }]
        };
      }).filter(Boolean);

      const allLegsDisplay = selectedLegs.map((leg, i) => {
        if (!leg) return null;
        const s = leg.journey?.segments?.[0];
        const l = leg.journey?.segments?.[leg.journey?.segments?.length - 1];
        return { legIndex: i, carrier: s?.carrier_name, origin: s?.origin, destination: l?.destination, departure: s?.departure_date, arrival: l?.arrival_date, flight_num: `${s?.carrier_code}${s?.carrier_number}` };
      });

      sessionStorage.setItem('flight_priced_data', JSON.stringify({
        display: { carrier: outSeg?.carrier_name, origin: outSeg?.origin, destination: lastSeg?.destination, departure: outSeg?.departure_date, arrival: lastSeg?.arrival_date, flight_num: `${outSeg?.carrier_code}${outSeg?.carrier_number}` },
        allLegsDisplay,
        priceResponse: null,
        priceBody: { provider: 'citilink', adult: parseInt(searchMeta?.adult || '1'), child: parseInt(searchMeta?.child || '0'), infant: parseInt(searchMeta?.infant || '0'), schedules: formattedSchedulesFallback, is_combo_price: searchMeta?.direction !== 'OW' },
        searchMeta,
      }));
      router.push('/flight/checkout');
    } finally {
      setReviewLoading(false);
    }
  };

  const isRT    = searchMeta?.direction === 'RT';
  const isMulti = searchMeta?.direction === 'Multi';

  // Rute & tanggal untuk leg yang sedang aktif (dipakai panel no-result per leg)
  const currentLegRoute = useMemo(() => {
    if (isRT) {
      return currentLegStep === 0
        ? { origin: searchMeta?.origin, destination: searchMeta?.destination }
        : { origin: searchMeta?.destination, destination: searchMeta?.origin };
    }
    if (isMulti) {
      const r = (searchMeta?.routes || [])[currentLegStep];
      return { origin: r?.origin, destination: r?.destination };
    }
    return { origin: searchMeta?.origin, destination: searchMeta?.destination };
  }, [isRT, isMulti, currentLegStep, searchMeta]);

  const currentLegDate = useMemo(() => {
    if (isRT) return currentLegStep === 0 ? searchMeta?.departure_date : searchMeta?.return_date;
    if (isMulti) return (searchMeta?.routes || [])[currentLegStep]?.departure_date;
    return searchMeta?.departure_date;
  }, [isRT, isMulti, currentLegStep, searchMeta]);

  // Tampilkan panel "leg tidak tersedia" kalau ini trip multi-leg dan sudah ada
  // leg yang dipilih (agar tidak mereset pilihan user).
  const showLegNoResults = totalLegs > 1 && (currentLegStep > 0 || selectedLegs.some(Boolean));

  const toggleFilter = (arr: string[], val: string, setArr: (a: string[]) => void) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };
  const activeFilterCount =
    filterTransit.length +
    filterAirlines.length +
    (filterMaxPrice !== null ? 1 : 0) +
    filterDepartureTime.length +
    filterArrivalTime.length;
  const resetFilters = () => {
    setFilterTransit([]);
    setFilterAirlines([]);
    setFilterMaxPrice(null);
    setFilterDepartureTime([]);
    setFilterArrivalTime([]);
    setAirlineSearch('');
    setSortBy('price_asc');
  };

  // Label step saat ini
  const stepLabel = useMemo(() => {
    if (!isRT && !isMulti) return null;
    if (isRT) return currentLegStep === 0 ? '✈️ Pilih Penerbangan Pergi' : '✈️ Pilih Penerbangan Pulang';
    const routes = searchMeta?.routes || [];
    const r = routes[currentLegStep];
    return r ? `✈️ Pilih Penerbangan ${r.origin} → ${r.destination} (Kota ${currentLegStep + 1})` : `Kota ${currentLegStep + 1}`;
  }, [isRT, isMulti, currentLegStep, searchMeta]);

  const isSearching = loading || providersDone < providersTotal;
  const hasResults = currentJourneys.length > 0;
  const noResultsAfterSearch = !isSearching && hasSearched && !hasResults && !error;

  return (
    <div className="bg-brand-bgLight min-h-screen pt-20">

      {!hasSearched ? (
        <FlightLanding onSearch={handleSearch} loading={isSearching} />
      ) : (
      <>
      {/* ─── Sticky Compact Search Bar ─────────────────────────────────────── */}
      <div data-compact-search className="sticky top-0 z-[900] border-b border-slate-200/60 bg-white shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3">
          <CompactSearchBar searchMeta={searchMeta} onSearch={handleSearch} loading={isSearching} />
        </div>
      </div>

      {/* ─── Content below sticky bar ──────────────────────────────────────── */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-5 pb-10">
        {/* ─── Step indicator untuk RT & Multi ──────────────────────────── */}
        {(isRT || isMulti) && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 mb-5">
            <div className="flex items-center gap-2 overflow-x-auto">
              {Array.from({ length: totalLegs }).map((_, i) => {
                const isActive  = i === currentLegStep;
                const isDone    = !!selectedLegs[i];
                const isLocked  = i > currentLegStep;
                const routes    = searchMeta?.routes || [];
                const legLabel  = isRT ? (i === 0 ? 'Pergi' : 'Pulang') : `Kota ${i + 1}`;
                const subLabel  = isRT
                  ? (i === 0 ? `${searchMeta.origin}→${searchMeta.destination}` : `${searchMeta.destination}→${searchMeta.origin}`)
                  : routes[i] ? `${routes[i].origin}→${routes[i].destination}` : '';
                return (
                  <div key={i} className="flex items-center gap-2 shrink-0">
                    {i > 0 && <i className="fa-solid fa-arrow-right text-slate-300 text-[10px]"></i>}
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${isActive ? 'bg-orange-50 border-2 border-orange-400' : isDone ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-slate-50 border-2 border-slate-200 opacity-50'}`}
                      onClick={() => { if (isDone || isActive) { setCurrentLegStep(i); setFilterAirlines([]); } }}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${isActive ? 'bg-orange-600 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <div>
                        <p className={`text-xs font-black ${isActive ? 'text-orange-700' : isDone ? 'text-emerald-700' : 'text-slate-500'}`}>{legLabel}</p>
                        {subLabel && <p className="text-[10px] text-slate-400">{subLabel}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {stepLabel && (
              <div className="mt-3 text-sm font-bold text-orange-700 bg-orange-50 rounded-xl px-3 py-2">
                {stepLabel}
              </div>
            )}
          </div>
        )}

        {/* Main layout */}
        <div className="flex flex-col items-start gap-5 lg:flex-row lg:items-start">

          {/* Mobile filter toggle */}
          {!isSearching && !noResultsAfterSearch && currentJourneys.length > 0 && (
            <div className="lg:hidden w-full">
              <button
                onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-sliders text-orange-500 text-xs"></i>
                  {t.filterTitle} & {t.sort}
                  {activeFilterCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-100 px-1.5 text-[10px] font-bold text-orange-700">
                      {activeFilterCount}
                    </span>
                  )}
                </span>
                <i className={`fa-solid fa-chevron-${mobileFilterOpen ? 'up' : 'down'} text-xs text-slate-400`}></i>
              </button>
            </div>
          )}

          {/* ─── Sidebar Filter ──────────────────────────────────────────── */}
          {isSearching && currentJourneys.length === 0 && <FilterSkeleton />}
          {!isSearching && !noResultsAfterSearch && currentJourneys.length > 0 && (
          <div className={`${mobileFilterOpen ? 'block' : 'hidden'} w-full shrink-0 lg:sticky lg:top-32 lg:block lg:max-h-[calc(100dvh-9rem)] lg:w-72 lg:overflow-y-auto lg:overscroll-contain`}>
            <div className="flex items-center justify-between px-1 pb-3">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-sliders text-sky-600 text-sm"></i>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{t.filterTitle}</h3>
                  <p className="text-[10px] text-slate-500">
                    {language === 'EN'
                      ? `${filtered.length} of ${currentJourneys.length} flights`
                      : `${filtered.length} dari ${currentJourneys.length} penerbangan`}
                  </p>
                </div>
              </div>
              <button
                onClick={resetFilters}
                className="text-sky-700 text-xs font-semibold hover:underline"
              >{t.resetFilter}</button>
            </div>

            <div className="space-y-3 px-1 pb-2">
                {/* Price Range */}
                {priceRange.max > 0 && (
                  <FilterSection
                    title={language === 'EN' ? 'Price per passenger' : 'Harga per penumpang'}
                    activeCount={filterMaxPrice !== null ? 1 : 0}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[10px] text-slate-500">
                        {language === 'EN' ? 'Show fares up to' : 'Tampilkan tarif hingga'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setFilterMaxPrice(null)}
                        disabled={filterMaxPrice === null}
                        className="text-[11px] font-semibold text-sky-700 transition hover:text-sky-800 disabled:cursor-default disabled:text-slate-400"
                      >
                        {language === 'EN' ? 'Reset' : 'Reset'}
                      </button>
                    </div>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <p className="block text-[10px] font-medium text-slate-500">{language === 'EN' ? 'From' : 'Mulai dari'}</p>
                        <p className="mt-0.5 truncate text-xs font-bold text-slate-700">{fmtIDR(priceRange.min)}</p>
                      </div>
                      <div className="min-w-0 rounded-lg border border-sky-200 bg-sky-50/60 px-2.5 py-2">
                        <label htmlFor="flight-filter-price-max" className="block text-[10px] font-medium text-slate-500">
                          {language === 'EN' ? 'Maximum' : 'Maksimum'}
                        </label>
                        <input
                          id="flight-filter-price-max"
                          type="number"
                          min={priceRange.min}
                          max={priceRange.max}
                          step={Math.max(100000, Math.round((priceRange.max - priceRange.min) / 20))}
                          value={filterMaxPrice ?? priceRange.max}
                          onChange={e => {
                            const value = Number(e.target.value);
                            if (Number.isFinite(value)) setFilterMaxPrice(Math.min(priceRange.max, Math.max(priceRange.min, value)));
                          }}
                          className="mt-0.5 w-full min-w-0 bg-transparent text-xs font-bold text-sky-800 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          aria-label={language === 'EN' ? 'Maximum price per passenger' : 'Harga maksimum per penumpang'}
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={priceRange.min}
                      max={priceRange.max}
                      step={Math.max(100000, Math.round((priceRange.max - priceRange.min) / 20))}
                      value={filterMaxPrice ?? priceRange.max}
                      onChange={e => setFilterMaxPrice(parseInt(e.target.value))}
                      aria-label={language === 'EN' ? 'Maximum price per passenger' : 'Rentang harga maksimum per penumpang'}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] font-medium text-slate-500">{fmtIDR(priceRange.min)}</span>
                      <span className="text-[10px] font-medium text-slate-500">{fmtIDR(priceRange.max)}</span>
                    </div>
                  </FilterSection>
                )}

                {/* Transit */}
                <FilterSection title={t.stops} activeCount={filterTransit.length}>
                  <div className="space-y-1.5">
                    {transitOptions.map(opt => (
                      <label key={opt.id} className={`group flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 transition-colors ${filterTransit.includes(opt.id) ? 'border-sky-300 bg-sky-50' : 'border-transparent hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={filterTransit.includes(opt.id)}
                          onChange={() => toggleFilter(filterTransit, opt.id, setFilterTransit)}
                          className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-sky-600 accent-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-slate-700 group-hover:text-slate-900">{opt.label}</span>
                          <span className="mt-0.5 block text-[10px] text-slate-500">
                            {language === 'EN'
                              ? `${opt.count} flights${opt.lowestPrice > 0 ? ` · from ${fmtIDR(opt.lowestPrice)}` : ''}`
                              : `${opt.count} penerbangan${opt.lowestPrice > 0 ? ` · mulai ${fmtIDR(opt.lowestPrice)}` : ''}`}
                          </span>
                        </span>
                        {filterTransit.includes(opt.id) && <i className="fa-solid fa-check text-xs text-sky-700" aria-hidden="true" />}
                      </label>
                    ))}
                  </div>
                </FilterSection>

                {/* Maskapai */}
                {airlineList.length > 0 && (
                  <FilterSection title={t.airline} activeCount={filterAirlines.length}>
                    {airlineList.length > 5 && (
                      <label className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 focus-within:border-sky-400">
                        <i className="fa-solid fa-magnifying-glass text-[10px] text-slate-400" aria-hidden="true" />
                        <input
                          type="search"
                          value={airlineSearch}
                          onChange={event => setAirlineSearch(event.target.value)}
                          placeholder={language === 'EN' ? 'Search airlines' : 'Cari maskapai'}
                          aria-label={language === 'EN' ? 'Search airlines' : 'Cari maskapai'}
                          className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                        />
                        {airlineSearch && (
                          <button type="button" onClick={() => setAirlineSearch('')} aria-label="Hapus pencarian maskapai" className="text-slate-400 hover:text-slate-700">
                            <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
                          </button>
                        )}
                      </label>
                    )}
                    <div className="space-y-1.5">
                      {airlineList
                        .filter(airline => airline.name.toLowerCase().includes(airlineSearch.trim().toLowerCase()))
                        .map(airline => (
                        <label key={airline.code} className={`group flex min-h-9 cursor-pointer items-center justify-between gap-2 rounded-lg px-2 transition-colors ${filterAirlines.includes(airline.code) ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
                          <div className="flex min-w-0 items-center gap-2">
                            <input type="checkbox" checked={filterAirlines.includes(airline.code)}
                              onChange={() => toggleFilter(filterAirlines, airline.code, setFilterAirlines)}
                              className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-sky-600 accent-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2" />
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden">
                              <img
                                src={`https://assets.wego.com/image/upload/h_72,c_fit,f_auto,fl_lossy,q_auto/v20250101/flights/airlines_square/${airline.code.toUpperCase()}.png`}
                                alt=""
                                className="h-4 w-4 object-contain"
                                onError={(event) => { event.currentTarget.style.display = 'none'; }}
                              />
                            </span>
                            <span className="truncate text-xs font-medium text-slate-700 group-hover:text-slate-900">{airline.name}</span>
                          </div>
                          <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-500">{airline.count}</span>
                        </label>
                      ))}
                      {airlineList.every(airline => !airline.name.toLowerCase().includes(airlineSearch.trim().toLowerCase())) && (
                        <p className="px-2 py-3 text-xs text-slate-500">
                          {language === 'EN' ? 'No airlines found.' : 'Maskapai tidak ditemukan.'}
                        </p>
                      )}
                    </div>
                  </FilterSection>
                )}

                {/* Waktu */}
                <FilterSection title={language === 'EN' ? 'Time' : 'Waktu'} activeCount={filterDepartureTime.length + filterArrivalTime.length}>
                  {[
                    { title: language === 'EN' ? 'Departure from' : 'Berangkat dari', filters: filterDepartureTime, setter: setFilterDepartureTime },
                    { title: language === 'EN' ? 'Arrival at destination' : 'Tiba di tujuan', filters: filterArrivalTime, setter: setFilterArrivalTime },
                  ].map(group => (
                    <div key={group.title} className="mb-3 last:mb-0">
                      <p className="mb-1.5 text-[10px] font-semibold text-slate-500">{group.title}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'early', label: language === 'EN' ? 'Early morning' : 'Dini hari', range: '00:00–06:00', icon: 'fa-moon' },
                          { id: 'morning', label: language === 'EN' ? 'Morning' : 'Pagi', range: '06:00–12:00', icon: 'fa-sun' },
                          { id: 'afternoon', label: language === 'EN' ? 'Afternoon' : 'Siang–sore', range: '12:00–18:00', icon: 'fa-cloud-sun' },
                          { id: 'evening', label: language === 'EN' ? 'Evening' : 'Malam', range: '18:00–00:00', icon: 'fa-moon' },
                        ].map(option => {
                          const selected = group.filters.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleFilter(group.filters, option.id, group.setter)}
                              className={`flex min-h-12 items-center gap-2 rounded-lg border px-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${selected ? 'border-sky-400 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                            >
                              <i className={`fa-solid ${option.icon} w-4 text-center text-xs ${selected ? 'text-sky-600' : 'text-slate-400'}`} aria-hidden="true" />
                              <span className="min-w-0">
                                <span className="block text-[10px] font-semibold">{option.label}</span>
                                <span className="block text-[9px] text-slate-400">{option.range}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </FilterSection>

                {/* Urutkan */}
                <FilterSection title={t.sort} initiallyOpen={false}>
                  <div className="space-y-1.5">
                    {[
                      { id: 'price_asc',  label: t.sortBy.price },
                      { id: 'earliest',   label: t.sortBy.departure },
                      { id: 'latest',     label: 'Berangkat Paling Akhir' },
                      { id: 'price_desc', label: 'Harga Tertinggi' },
                    ].map(opt => (
                      <label key={opt.id} className="group flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-slate-50">
                        <input type="radio" name="sortBy" checked={sortBy === opt.id} onChange={() => setSortBy(opt.id as any)}
                          className="h-4 w-4 shrink-0 cursor-pointer border-slate-300 text-sky-600 accent-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2" />
                        <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  </FilterSection>
              </div>
          </div>
          )}

          {/* ─── Results ─────────────────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-3">

            {/* Progress bar saat search paralel */}
            {isSearching && providersDone < providersTotal && (
              <ProviderProgress
                done={providersDone}
                total={providersTotal}
              />
            )}

            {/* Summary */}
            {!isSearching && currentJourneys.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-neutral">
                  <span className="font-black text-brand-ink">{filtered.length}</span> {t.flightsFound}
                  {(isRT || isMulti) && <span className="ml-2 text-xs text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full">Leg {currentLegStep + 1}/{totalLegs}</span>}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <CalendarField
                    value={parseLocalDate(currentLegDate || searchMeta.departure_date || todayDefault)}
                    onChange={date => {
                      if (!date) return;
                      const departureDate = formatLocalDate(date);
                      if (isRT || isMulti) {
                        handleSearchLeg(currentLegStep, { departure_date: departureDate });
                      } else {
                        handleSearch({ ...searchMeta, departure_date: departureDate });
                      }
                    }}
                    minDate={minimumFlightDate}
                    defaultMonth={parseLocalDate(currentLegDate || searchMeta.departure_date || todayDefault)}
                  >
                    <button
                      type="button"
                      disabled={isSearching}
                      className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <i className="fa-regular fa-calendar text-sky-600" aria-hidden="true"></i>
                      <span className="hidden sm:inline">{language === 'EN' ? 'Calendar' : 'Kalender'}</span>
                      <span className="sm:hidden">{formatLocalDate(parseLocalDate(currentLegDate || searchMeta.departure_date || todayDefault)).slice(5)}</span>
                    </button>
                  </CalendarField>
                  <button
                    type="button"
                    onClick={() => { setPromoCopyError(''); setPromoOpen(true); }}
                    className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                  >
                    <i className="fa-solid fa-ticket text-sky-600" aria-hidden="true"></i>
                    {language === 'EN' ? 'Promo' : 'Promo'}
                  </button>
                </div>
              </div>
            )}

            {isSearching && currentJourneys.length === 0 && <SkeletonLoader />}

            {/* Streaming results saat masih loading */}
            {isSearching && currentJourneys.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700 font-semibold flex items-center gap-2 mb-2">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
                Menampilkan {currentJourneys.length} hasil... masih mencari penerbangan lainnya
              </div>
            )}

            {error && (
              showLegNoResults ? (
                <LegNoResults
                  legIndex={currentLegStep}
                  totalLegs={totalLegs}
                  legRoute={currentLegRoute}
                  legDate={currentLegDate}
                  isRT={isRT}
                  onRetry={() => handleSearchLeg(currentLegStep)}
                  onDateChange={(date) => handleSearchLeg(currentLegStep, { departure_date: date })}
                  onSwap={() => handleSearchLeg(currentLegStep, { origin: currentLegRoute.destination, destination: currentLegRoute.origin })}
                />
              ) : (
                <NoResultsWithAlternatives searchMeta={searchMeta} onSearch={handleSearch} onRetry={() => handleSearch(searchMeta)} />
              )
            )}

            {filtered.map((j, i) => (
              <FlightCard
                key={`flight-${currentLegStep}-${i}`}
                journey={j}
                onSelect={handleSelectFlight}
                adultCount={parseInt(searchMeta?.adult || '1')}
                isCheapest={cheapestIdx === i}
                searchParams={searchMeta}
              />
            ))}

            {!isSearching && currentJourneys.length > 0 && filtered.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-plane-slash text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-black text-brand-ink mb-2">Tidak Ada Hasil Filter</h3>
                <p className="text-slate-500 text-sm">Coba ubah filter atau reset pilihan.</p>
                <button onClick={resetFilters}
                  className="mt-4 px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm hover:bg-orange-700 transition-all">
                  {t.resetFilter}
                </button>
              </div>
            )}

            {!isSearching && currentJourneys.length === 0 && !error && (
              showLegNoResults ? (
                <LegNoResults
                  legIndex={currentLegStep}
                  totalLegs={totalLegs}
                  legRoute={currentLegRoute}
                  legDate={currentLegDate}
                  isRT={isRT}
                  onRetry={() => handleSearchLeg(currentLegStep)}
                  onDateChange={(date) => handleSearchLeg(currentLegStep, { departure_date: date })}
                  onSwap={() => handleSearchLeg(currentLegStep, { origin: currentLegRoute.destination, destination: currentLegRoute.origin })}
                />
              ) : (
                <NoResultsWithAlternatives searchMeta={searchMeta} onSearch={handleSearch} />
              )
            )}
          </div>
        </div>
      </div>
      {promoOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setPromoOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="flight-promo-title"
            className="flex max-h-[min(80vh,42rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 id="flight-promo-title" className="text-base font-bold text-slate-800">
                  {language === 'EN' ? 'Flight promos' : 'Promo Penerbangan'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {language === 'EN' ? 'Copy an available coupon code' : 'Salin kode promo yang tersedia'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPromoOpen(false)}
                aria-label={language === 'EN' ? 'Close promos' : 'Tutup promo'}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </header>
            <div className="overflow-y-auto p-5 sm:p-6">
              {promoLoading ? (
                <div className="flex min-h-40 items-center justify-center gap-3 text-sm font-medium text-slate-500">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600"></span>
                  {language === 'EN' ? 'Loading promos...' : 'Memuat promo...'}
                </div>
              ) : promoError ? (
                <div className="py-10 text-center">
                  <p role="alert" className="text-sm text-rose-600">{promoError}</p>
                  <button
                    type="button"
                    onClick={() => { setFlightCoupons([]); setPromoOpen(false); window.setTimeout(() => setPromoOpen(true), 0); }}
                    className="mt-3 text-xs font-bold text-sky-700 hover:underline"
                  >
                    {language === 'EN' ? 'Try again' : 'Coba lagi'}
                  </button>
                </div>
              ) : flightCoupons.length === 0 ? (
                <div className="py-12 text-center">
                  <i className="fa-solid fa-ticket text-3xl text-slate-300" aria-hidden="true"></i>
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {language === 'EN' ? 'No active flight promos' : 'Belum ada promo penerbangan aktif'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {flightCoupons.map(coupon => (
                    <article key={coupon.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800">{coupon.name}</p>
                          {coupon.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{coupon.description}</p>}
                        </div>
                        <span className="shrink-0 rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700">
                          {coupon.type === 'percentage' ? `${coupon.value}%` : fmtIDR(coupon.value)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-3">
                        <code className="min-w-0 truncate rounded bg-slate-100 px-2 py-1 text-xs font-bold tracking-wide text-slate-700">{coupon.code}</code>
                        <button
                          type="button"
                          onClick={() => void copyFlightCoupon(coupon.code)}
                          className="shrink-0 text-xs font-bold text-sky-700 hover:text-sky-900"
                        >
                          {copiedPromo === coupon.code
                            ? (language === 'EN' ? 'Copied' : 'Tersalin')
                            : (language === 'EN' ? 'Copy' : 'Salin')}
                        </button>
                      </div>
                      {coupon.minOrderAmount > 0 && (
                        <p className="mt-2 text-[11px] text-slate-500">
                          {language === 'EN' ? 'Minimum transaction' : 'Min. transaksi'} {fmtIDR(coupon.minOrderAmount)}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {promoCopyError && <p role="alert" className="mt-3 text-xs text-rose-600">{promoCopyError}</p>}
            </div>
          </section>
        </div>
      )}
      </>
      )}

      {/* ─── Review Panel ─────────────────────────────────────────────────── */}
      <ReviewPanel
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onConfirm={handleConfirmReview}
        selectedLegs={selectedLegs}
        searchMeta={searchMeta}
        loading={reviewLoading}
      />

      <style jsx global>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }

        /* Saat halaman hasil pencarian flight: navbar ikut terscroll,
           hanya "Ubah Pencarian" yang sticky di atas. */
        body:has([data-compact-search]) header.fixed {
          position: absolute;
        }
      `}</style>
    </div>
  );
}

export default function FlightSearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-brand-bgLight">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    }>
      <FlightSearchContent />
    </Suspense>
  );
}
