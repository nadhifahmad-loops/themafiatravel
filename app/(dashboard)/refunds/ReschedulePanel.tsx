'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Loader2,
  Plane,
  RefreshCw,
} from 'lucide-react';
import { CalendarField } from '@/components/common/CalendarField';
import { getAirlineProviderBookings, hasFlightDeparted } from '@/lib/orbis-post-booking';

type Booking = {
  id: string;
  orderNumber?: string;
  bookingType?: string;
  status?: string;
  totalAmount?: number;
  currency?: string;
  routeLabel?: string;
  origin?: string;
  destination?: string;
  departureDate?: string;
  flightNumber?: string;
  airlineName?: string;
  provider?: string;
  pnr?: string;
  bookingData?: unknown;
};

type JsonRecord = Record<string, unknown>;

type ProviderAvailability = {
  pnr: string;
  provider?: string;
  status?: string;
  schedules: JsonRecord[];
};

type Completion = {
  amount?: number;
  departureDate?: string;
  warnings: string[];
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function dateOnly(value: string) {
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function localDate(value: string): Date | null {
  const date = dateOnly(value);
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day
    ? result
    : null;
}

function providerKey(provider: ProviderAvailability | { pnr: string; provider?: string }, index: number) {
  return `${provider.provider || 'provider'}:${provider.pnr}:${index}`;
}

function formatCurrency(value: number, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeAvailability(value: unknown): ProviderAvailability[] {
  const root = asRecord(value);
  const providers = Array.isArray(root?.reschedule_availability_provider)
    ? root.reschedule_availability_provider
    : [];
  return providers.flatMap((rawProvider) => {
    const provider = asRecord(rawProvider);
    if (!provider) return [];
    const schedules = Array.isArray(provider.schedules)
      ? provider.schedules.map(asRecord).filter((schedule): schedule is JsonRecord => Boolean(schedule))
      : [];
    return [{
      pnr: text(provider.pnr),
      provider: text(provider.provider) || undefined,
      status: text(provider.status) || undefined,
      schedules,
    }];
  });
}

function getScheduleSegments(schedule: JsonRecord) {
  const journeys = Array.isArray(schedule.journeys) ? schedule.journeys : [];
  return journeys.flatMap((rawJourney) => {
    const journey = asRecord(rawJourney);
    const segments = Array.isArray(journey?.segments) ? journey.segments : [];
    return segments.map(asRecord).filter((segment): segment is JsonRecord => Boolean(segment));
  });
}

function farePrice(fare: JsonRecord): number | null {
  if (typeof fare.total_price === 'number' && Number.isFinite(fare.total_price)) return fare.total_price;
  const summaries = Array.isArray(fare.service_charge_summary) ? fare.service_charge_summary : [];
  const summaryPrices = summaries
    .map(asRecord)
    .map((summary) => summary?.total_price)
    .filter((amount): amount is number => typeof amount === 'number' && Number.isFinite(amount));
  if (summaryPrices.length) return summaryPrices.reduce((sum, amount) => sum + amount, 0);

  const charges = Array.isArray(fare.service_charges) ? fare.service_charges : [];
  const chargeAmounts = charges
    .map(asRecord)
    .map((charge) => charge?.total ?? charge?.amount)
    .filter((amount): amount is number => typeof amount === 'number' && Number.isFinite(amount));
  return chargeAmounts.length ? chargeAmounts.reduce((sum, amount) => sum + amount, 0) : null;
}

function chosenSegments(schedule: JsonRecord): Array<Array<{ segment_code: string; fare_code: string }>> | null {
  const journeys = Array.isArray(schedule.journeys) ? schedule.journeys : [];
  const resolved = journeys.map((rawJourney) => {
    const journey = asRecord(rawJourney);
    const segments = Array.isArray(journey?.segments) ? journey.segments : [];
    return segments.map((rawSegment) => {
      const segment = asRecord(rawSegment);
      const fareList = Array.isArray(segment?.fares) ? segment.fares : [];
      const fare = asRecord(fareList[0]);
      const segmentCode = text(segment?.segment_code);
      const fareCode = text(fare?.fare_code) || text(segment?.fare_code);
      return segmentCode && fareCode ? { segment_code: segmentCode, fare_code: fareCode } : null;
    });
  });
  if (!resolved.length || resolved.some((journey) => !journey.length || journey.some((segment) => !segment))) return null;
  return resolved as Array<Array<{ segment_code: string; fare_code: string }>>;
}

export default function ReschedulePanel({
  bookings,
  onRescheduled,
}: {
  bookings: Booking[];
  onRescheduled: (bookingId: string, departureDate?: string) => void;
}) {
  const eligibleBookings = useMemo(
    () => bookings.filter((booking) => booking.bookingType === 'flight' && ['paid', 'issued'].includes(booking.status || '')),
    [bookings],
  );
  const [dates, setDates] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<Record<string, ProviderAvailability[]>>({});
  const [selectedSchedules, setSelectedSchedules] = useState<Record<string, Record<string, number>>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [manualReviewRequired, setManualReviewRequired] = useState<Record<string, boolean>>({});
  const [completions, setCompletions] = useState<Record<string, Completion>>({});

  const loadAvailability = async (booking: Booking) => {
    if (hasFlightDeparted(booking)) {
      setErrors((previous) => ({
        ...previous,
        [booking.id]: 'Jadwal penerbangan sudah lewat. Reschedule mandiri tidak tersedia.',
      }));
      return;
    }

    const providerBookings = getAirlineProviderBookings(booking);
    const bookingJourneyCount = providerBookings.reduce((total, item) => total + item.journeys.length, 0);
    if (!providerBookings.length || bookingJourneyCount === 0) {
      setErrors((previous) => ({ ...previous, [booking.id]: 'Data itinerary booking tidak lengkap.' }));
      return;
    }

    const today = localToday();
    const rescheduleList = providerBookings.map((providerBooking, providerIndex) => ({
      pnr: providerBooking.pnr,
      journeys: providerBooking.journeys.map((journey, index) => {
        const key = `${booking.id}:${providerKey(providerBooking, providerIndex)}:${index}`;
        const targetDate = dates[key] || dateOnly(journey.departure_date);
        return {
          origin: journey.origin,
          destination: journey.destination,
          departure_date: targetDate,
        };
      }),
    }));
    if (rescheduleList.some((providerBooking) => providerBooking.journeys.some(({ departure_date }) =>
      !departure_date || departure_date < today
    ))) {
      setErrors((previous) => ({ ...previous, [booking.id]: 'Pilih tanggal keberangkatan hari ini atau setelahnya.' }));
      return;
    }

    setLoadingId(booking.id);
    setErrors((previous) => ({ ...previous, [booking.id]: '' }));
    try {
      const response = await fetch('/api/flight/reschedule/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: booking.id, reschedule_list: rescheduleList }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal mencari jadwal baru.');
      }

      const providers = normalizeAvailability(result.data);
      setAvailability((previous) => ({ ...previous, [booking.id]: providers }));
      setSelectedSchedules((previous) => ({
        ...previous,
        [booking.id]: Object.fromEntries(providers.map((provider, index) => [providerKey(provider, index), 0])),
      }));
      if (!providers.some((provider) => provider.schedules.length)) {
        setErrors((previous) => ({ ...previous, [booking.id]: 'Vendor tidak menemukan jadwal yang tersedia untuk tanggal pilihan.' }));
      }
    } catch (error: unknown) {
      setErrors((previous) => ({
        ...previous,
        [booking.id]: error instanceof Error ? error.message : 'Gagal mencari jadwal baru.',
      }));
    } finally {
      setLoadingId(null);
    }
  };

  const confirmReschedule = async (booking: Booking) => {
    if (hasFlightDeparted(booking)) {
      setErrors((previous) => ({
        ...previous,
        [booking.id]: 'Jadwal penerbangan sudah lewat. Reschedule mandiri tidak tersedia.',
      }));
      return;
    }

    const providers = availability[booking.id] || [];
    if (!providers.length || providers.some((provider) => !provider.schedules.length)) {
      setErrors((previous) => ({ ...previous, [booking.id]: 'Pilih jadwal yang tersedia untuk setiap PNR.' }));
      return;
    }

    const schedules = providers.map((provider, providerIndex) => {
      const index = selectedSchedules[booking.id]?.[providerKey(provider, providerIndex)] ?? 0;
      const chosenSchedule = provider.schedules[index];
      const segments = chosenSchedule ? chosenSegments(chosenSchedule) : null;
      if (!chosenSchedule || !segments) return null;
      return {
        pnr: provider.pnr,
        journeys: segments.map((journeySegments) => ({ segments: journeySegments })),
      };
    });
    if (schedules.some((schedule) => !schedule)) {
      setErrors((previous) => ({ ...previous, [booking.id]: 'Pilihan jadwal tidak memiliki segment_code/fare_code yang valid.' }));
      return;
    }

    setProcessingId(booking.id);
    setErrors((previous) => ({ ...previous, [booking.id]: '' }));
    try {
      const response = await fetch('/api/flight/reschedule/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: booking.id, schedules }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        if (result.manualReviewRequired === true) {
          setManualReviewRequired((previous) => ({ ...previous, [booking.id]: true }));
          setAvailability((previous) => {
            const next = { ...previous };
            delete next[booking.id];
            return next;
          });
        }
        throw new Error(result.error || 'Gagal mengonfirmasi jadwal baru.');
      }

      const departureDate = providers
        .flatMap((provider, providerIndex) => getScheduleSegments(
          provider.schedules[selectedSchedules[booking.id]?.[providerKey(provider, providerIndex)] ?? 0],
        ))
        .map((segment) => text(segment.departure_date))
        .find(Boolean);
      const rawAmount = asRecord(result.data)?.total_price;
      const amount = typeof rawAmount === 'number' && Number.isFinite(rawAmount) ? rawAmount : undefined;
      const warnings = Array.isArray(result.warnings)
        ? result.warnings.filter((warning: unknown): warning is string => typeof warning === 'string')
        : [];
      setCompletions((previous) => ({ ...previous, [booking.id]: { amount, departureDate, warnings } }));
      setAvailability((previous) => {
        const next = { ...previous };
        delete next[booking.id];
        return next;
      });
      onRescheduled(booking.id, departureDate);
    } catch (error: unknown) {
      setErrors((previous) => ({
        ...previous,
        [booking.id]: error instanceof Error ? error.message : 'Gagal mengonfirmasi jadwal baru.',
      }));
    } finally {
      setProcessingId(null);
    }
  };

  if (!eligibleBookings.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card sm:p-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
          <Plane className="h-5 w-5 text-slate-400" strokeWidth={1.8} />
        </div>
        <h2 className="text-sm font-bold text-brand-ink">Belum ada penerbangan yang bisa di-reschedule</h2>
        <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-slate-500">
          Perubahan jadwal online saat ini tersedia untuk tiket pesawat aktif. Untuk kereta, hotel, dan asuransi, silakan hubungi layanan pelanggan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {eligibleBookings.map((booking) => {
        const providerBookings = getAirlineProviderBookings(booking);
        const departed = hasFlightDeparted(booking);
        const result = completions[booking.id];
        const options = availability[booking.id] || [];
        return (
          <article key={booking.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
                  <Plane className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-400">{booking.orderNumber || booking.id}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      departed ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${departed ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                      {departed ? 'Perjalanan lewat' : booking.status === 'issued' ? 'Tiket diterbitkan' : 'Terkonfirmasi'}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-brand-ink">{booking.routeLabel || `${booking.origin || '-'} → ${booking.destination || '-'}`}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                      Jadwal saat ini: {booking.departureDate ? formatDateTime(booking.departureDate) : '-'}
                    </span>
                    {booking.flightNumber ? <span>{booking.flightNumber}</span> : null}
                  </div>
                </div>
              </div>
            </div>

            {result ? (
              <div className="space-y-3 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-brand-ink">Reschedule berhasil dikonfirmasi ke maskapai.</p>
                    {result.departureDate ? <p className="mt-1 text-xs text-slate-600">Jadwal baru: {formatDateTime(result.departureDate)}</p> : null}
                    {result.amount !== undefined ? (
                      <p className="mt-1 text-xs text-slate-600">Total biaya perubahan: {formatCurrency(result.amount, booking.currency)}</p>
                    ) : null}
                  </div>
                </div>
                {result.warnings.map((warning) => (
                  <p key={warning} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">{warning}</p>
                ))}
              </div>
            ) : departed ? (
              <div className="flex items-start gap-3 bg-slate-50 p-4 text-sm text-slate-600 sm:p-5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p className="leading-relaxed">
                  Waktu keberangkatan sudah lewat sehingga reschedule mandiri tidak tersedia. Hubungi customer service jika ada kondisi khusus yang perlu diperiksa.
                </p>
              </div>
            ) : (
              <div className="space-y-4 p-4 sm:p-5">
                {providerBookings.map((providerBooking, providerIndex) => (
                  <div key={providerKey(providerBooking, providerIndex)} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        PNR {providerBooking.pnr}{providerBooking.provider ? ` · ${providerBooking.provider}` : ''}
                      </p>
                      <span className="text-[11px] text-slate-400">{providerBooking.journeys.length} perjalanan</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {providerBooking.journeys.map((journey, index) => {
                        const dateKey = `${booking.id}:${providerKey(providerBooking, providerIndex)}:${index}`;
                        const selectedDate = dates[dateKey] || dateOnly(journey.departure_date);
                        const calendarValue = localDate(selectedDate);
                        return (
                          <label key={dateKey} className="space-y-1.5">
                            <span className="block text-xs font-semibold text-slate-600">
                              {journey.origin} → {journey.destination} · tanggal keberangkatan
                            </span>
                            <CalendarField
                              value={calendarValue}
                              minDate={localDate(localToday()) ?? undefined}
                              onChange={(date) => {
                                if (date) {
                                  const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                  setDates((previous) => ({ ...previous, [dateKey]: value }));
                                  setAvailability((previous) => {
                                    const next = { ...previous };
                                    delete next[booking.id];
                                    return next;
                                  });
                                }
                              }}
                            >
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                              >
                                <CalendarDays className="h-4 w-4 text-slate-400" />
                                <span>
                                  {calendarValue
                                    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(calendarValue)
                                    : 'Pilih tanggal'}
                                </span>
                              </button>
                            </CalendarField>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {options.length ? (
                  <div className="space-y-4">
                    {options.map((provider, providerIndex) => (
                      <section key={providerKey(provider, providerIndex)} className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Pilih jadwal {provider.provider ? `· ${provider.provider}` : ''} · PNR {provider.pnr || '-'}
                        </h3>
                        {provider.schedules.length ? (
                          <div className="grid gap-3">
                            {provider.schedules.map((schedule, index) => {
                              const segments = getScheduleSegments(schedule);
                              const journey = segments[0];
                              const lastSegment = segments[segments.length - 1];
                              const departure = text(journey?.departure_date);
                              const arrival = text(lastSegment?.arrival_date);
                              const route = `${text(journey?.origin) || '-'} → ${text(lastSegment?.destination) || '-'}`;
                              const carriers = segments.map((segment) =>
                                `${text(segment.carrier_code)}${text(segment.carrier_number)}`.trim()
                              ).filter(Boolean).join(' · ');
                              const fares = segments.flatMap((segment) => Array.isArray(segment.fares) ? segment.fares : []);
                              const firstFare = asRecord(fares[0]);
                              const price = firstFare ? farePrice(firstFare) : null;
                              const selected = (selectedSchedules[booking.id]?.[providerKey(provider, providerIndex)] ?? 0) === index;
                              const scheduleUsable = chosenSegments(schedule) !== null;
                              return (
                                <button
                                  key={`${provider.pnr}-${index}`}
                                  type="button"
                                  disabled={!scheduleUsable}
                                  onClick={() => setSelectedSchedules((previous) => ({
                                    ...previous,
                                    [booking.id]: { ...previous[booking.id], [providerKey(provider, providerIndex)]: index },
                                  }))}
                                  className={`w-full rounded-2xl border p-4 text-left transition ${
                                    selected ? 'border-orange-300 bg-orange-50/60 ring-2 ring-orange-100' : 'border-slate-200 bg-white hover:border-slate-300'
                                  } ${!scheduleUsable ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                    <div>
                                      <p className="font-bold text-slate-900">{route}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {departure ? formatDateTime(departure) : 'Waktu berangkat mengikuti jadwal vendor'}
                                        {arrival ? ` — ${formatDateTime(arrival)}` : ''}
                                      </p>
                                      {carriers ? <p className="mt-1 text-xs font-semibold text-slate-500">{carriers}</p> : null}
                                      {firstFare ? (
                                        <p className="mt-1 text-xs text-slate-500">
                                          Kelas {text(firstFare.cabin_class) || text(firstFare.class_of_service) || 'tersedia'}
                                          {text(firstFare.fare_name) ? ` · ${text(firstFare.fare_name)}` : ''}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                                      {price !== null ? (
                                        <span className="text-sm font-black text-slate-900">{formatCurrency(price, booking.currency)}</span>
                                      ) : (
                                        <span className="text-xs text-slate-400">Biaya final dikonfirmasi saat pemesanan</span>
                                      )}
                                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 bg-white'}`}>
                                        {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                            Vendor tidak menyediakan jadwal baru untuk PNR ini. Pastikan tanggal yang dipilih benar.
                          </p>
                        )}
                      </section>
                    ))}
                    <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
                      Harga pada jadwal adalah indikasi dari API maskapai. Biaya akhir dan ketersediaan dikonfirmasi saat reschedule diproses.
                    </p>
                  </div>
                ) : null}

                {errors[booking.id] ? (
                  <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {errors[booking.id]}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => loadAvailability(booking)}
                    disabled={loadingId === booking.id || processingId === booking.id || manualReviewRequired[booking.id]}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-orange-200 hover:text-orange-700 disabled:opacity-50"
                  >
                    {loadingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : availability[booking.id] ? <RefreshCw className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                    {availability[booking.id] ? 'Cari ulang jadwal' : 'Cari jadwal baru'}
                  </button>
                  {availability[booking.id] ? (
                    <button
                      type="button"
                      onClick={() => confirmReschedule(booking)}
                      disabled={processingId === booking.id || manualReviewRequired[booking.id] || options.length === 0 || options.some((provider) => !provider.schedules.length)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {processingId === booking.id ? 'Memproses...' : 'Konfirmasi reschedule'}
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {result && result.amount === undefined ? (
              <div className="flex items-center gap-2 border-t border-emerald-100 bg-white px-5 py-3 text-xs text-slate-500">
                <CircleDollarSign className="h-4 w-4 text-slate-400" />
                Rincian biaya final mengikuti respons vendor.
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
