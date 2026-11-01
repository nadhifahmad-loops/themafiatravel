'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  BedDouble,
  Check,
  Clock3,
  CreditCard,
  Plane,
  ShieldCheck,
  TrainFront,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { getSupportWhatsAppUrl } from '@/lib/support';
import { getPaymentCountdown, type PaymentCountdown } from '@/lib/payment-window';

type BookingReview = {
  id: string;
  orderNumber?: string | null;
  bookingType: string;
  status: string;
  totalAmount: number;
  discountAmount?: number | null;
  couponCode?: string | null;
  createdAt: string;
  hotelName?: string | null;
  checkinDate?: string | null;
  checkoutDate?: string | null;
  roomCount?: number | null;
  roomDescription?: string | null;
  mealType?: string | null;
  adultCount?: number | null;
  childCount?: number | null;
  nights?: number | null;
  routeLabel?: string | null;
  origin?: string | null;
  destination?: string | null;
  departureDate?: string | null;
  airlineName?: string | null;
  flightNumber?: string | null;
  passengerData?: unknown;
  bookingData?: unknown;
};

type Passenger = {
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  pax_type?: string | null;
};

type Segment = {
  origin?: string | null;
  destination?: string | null;
  origin_name?: string | null;
  destination_name?: string | null;
  departure_date?: string | null;
  arrival_date?: string | null;
  carrier_name?: string | null;
  flight_number?: string | null;
};

type BookingData = {
  segments?: Segment[];
  cabin_class?: string | null;
  subclass?: string | null;
  coverage?: string | null;
};

const SERVICE: Record<string, { label: string; englishLabel: string; icon: LucideIcon }> = {
  flight: { label: 'Pesawat', englishLabel: 'Flight', icon: Plane },
  hotel: { label: 'Hotel', englishLabel: 'Hotel', icon: BedDouble },
  train: { label: 'Kereta', englishLabel: 'Train', icon: TrainFront },
  insurance: { label: 'Asuransi perjalanan', englishLabel: 'Travel insurance', icon: ShieldCheck },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatIdr(value: number) {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function getPassengers(value: unknown): Passenger[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((passenger) => ({
    title: typeof passenger.title === 'string' ? passenger.title : null,
    first_name: typeof passenger.first_name === 'string' ? passenger.first_name : null,
    last_name: typeof passenger.last_name === 'string' ? passenger.last_name : null,
    pax_type: typeof passenger.pax_type === 'string' ? passenger.pax_type : null,
  }));
}

function getBookingData(value: unknown): BookingData {
  if (!isRecord(value)) return {};
  const segments = Array.isArray(value.segments)
    ? value.segments.filter(isRecord).map((segment) => ({
        origin: typeof segment.origin === 'string' ? segment.origin : null,
        destination: typeof segment.destination === 'string' ? segment.destination : null,
        origin_name: typeof segment.origin_name === 'string' ? segment.origin_name : null,
        destination_name: typeof segment.destination_name === 'string' ? segment.destination_name : null,
        departure_date: typeof segment.departure_date === 'string' ? segment.departure_date : null,
        arrival_date: typeof segment.arrival_date === 'string' ? segment.arrival_date : null,
        carrier_name: typeof segment.carrier_name === 'string' ? segment.carrier_name : null,
        flight_number: typeof segment.flight_number === 'string' ? segment.flight_number : null,
      }))
    : [];
  return {
    segments,
    cabin_class: typeof value.cabin_class === 'string' ? value.cabin_class : null,
    subclass: typeof value.subclass === 'string' ? value.subclass : null,
    coverage: typeof value.coverage === 'string' ? value.coverage : null,
  };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-slate-800">{value || '-'}</dd>
    </div>
  );
}

export default function BookingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { language } = useLanguage();
  const isEnglish = language === 'EN';
  const [booking, setBooking] = useState<BookingReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [countdown, setCountdown] = useState<PaymentCountdown | null>(null);

  usePageTitle(isEnglish ? 'Review your order' : 'Review Pesanan');

  useEffect(() => {
    let active = true;
    fetch(`/api/bookings/${id}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || (isEnglish ? 'Could not load this order.' : 'Gagal memuat pesanan.'));
        }
        if (active) setBooking(result.data as BookingReview);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : (isEnglish ? 'Could not load this order.' : 'Gagal memuat pesanan.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, isEnglish]);

  useEffect(() => {
    if (!booking?.createdAt || booking.status !== 'pending_payment') return;
    const updateCountdown = () => setCountdown(getPaymentCountdown(booking.createdAt));
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [booking?.createdAt, booking?.status]);

  const service = booking ? SERVICE[booking.bookingType] ?? SERVICE.flight : SERVICE.flight;
  const ServiceIcon = service.icon;
  const passengers = getPassengers(booking?.passengerData);
  const bookingData = getBookingData(booking?.bookingData);
  const segments = bookingData.segments ?? [];
  const route = booking?.routeLabel
    || [booking?.origin, booking?.destination].filter(Boolean).join(' → ');
  const canPay = booking?.status === 'pending_payment' && countdown !== null && !countdown.expired;
  const supportUrl = getSupportWhatsAppUrl(
    booking ? `${isEnglish ? 'I need help reviewing order' : 'Saya perlu bantuan untuk review pesanan'} ${booking.orderNumber || booking.id}` : undefined
  );
  const backHref = booking && session?.user
    ? '/bookings'
    : booking
      ? `/find-booking?orderId=${encodeURIComponent(booking.orderNumber || booking.id)}`
      : '/find-booking';

  function continueToPayment() {
    if (!confirmed || !canPay) return;
    router.push(`/payment/${id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft size={16} />
          {isEnglish ? 'My bookings' : 'Pesanan saya'}
        </Link>

        <div className="mx-auto mt-7 max-w-3xl">
          <div className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold sm:gap-4 sm:text-sm">
            <span className="flex items-center gap-2 text-emerald-700"><span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100"><Check size={15} /></span>{isEnglish ? 'Details' : 'Data pesanan'}</span>
            <span className="h-px w-8 bg-orange-300 sm:w-16" />
            <span className="flex items-center gap-2 text-orange-700"><span className="grid h-7 w-7 place-items-center rounded-full bg-orange-100">2</span>{isEnglish ? 'Review' : 'Review'}</span>
            <span className="h-px w-8 bg-slate-200 sm:w-16" />
            <span className="flex items-center gap-2 text-slate-400"><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-200">3</span>{isEnglish ? 'Payment' : 'Pembayaran'}</span>
          </div>

          <header className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">{isEnglish ? 'Before payment' : 'Sebelum pembayaran'}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {isEnglish ? 'Review your order' : 'Periksa pesanan Anda'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isEnglish
                ? 'Make sure the trip details, passenger names, and total are correct before continuing.'
                : 'Pastikan detail perjalanan, nama penumpang, dan total tagihan sudah benar sebelum melanjutkan.'}
            </p>
          </header>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-orange-500" />
              <p className="mt-3 text-sm text-slate-500">{isEnglish ? 'Loading order details…' : 'Memuat detail pesanan…'}</p>
            </div>
          ) : error || !booking ? (
            <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
              <p className="font-semibold text-slate-900">{error || (isEnglish ? 'Order not found.' : 'Pesanan tidak ditemukan.')}</p>
              <Link href={backHref} className="mt-5 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">
                {isEnglish ? 'Find my booking' : 'Cari pesanan saya'}
              </Link>
            </div>
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-orange-600"><ServiceIcon size={21} /></div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{isEnglish ? 'Service' : 'Layanan'}</p>
                      <h2 className="font-bold text-slate-900">{isEnglish ? service.englishLabel : service.label}</h2>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{isEnglish ? 'Order number' : 'Nomor pesanan'}</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-slate-800">{booking.orderNumber || booking.id}</p>
                  </div>
                </div>

                <div className="grid gap-0 sm:grid-cols-[1fr_260px]">
                  <div className="p-5 sm:p-6">
                    <h3 className="mb-2 flex items-center gap-2 font-bold text-slate-900">
                      <ServiceIcon size={17} className="text-orange-500" />
                      {isEnglish ? 'Trip details' : 'Detail perjalanan'}
                    </h3>
                    <dl>
                      {booking.bookingType === 'flight' && (
                        <>
                          <InfoRow label={isEnglish ? 'Route' : 'Rute'} value={route || '-'} />
                          <InfoRow label={isEnglish ? 'Airline' : 'Maskapai'} value={booking.airlineName || '-'} />
                          <InfoRow label={isEnglish ? 'Flight number' : 'Nomor penerbangan'} value={booking.flightNumber || '-'} />
                          <InfoRow label={isEnglish ? 'Departure' : 'Keberangkatan'} value={formatDate(booking.departureDate, true)} />
                          {(bookingData.cabin_class || bookingData.subclass) && (
                            <InfoRow label={isEnglish ? 'Cabin' : 'Kelas kabin'} value={[bookingData.cabin_class, bookingData.subclass].filter(Boolean).join(' · ')} />
                          )}
                          {segments.map((segment, index) => (
                            <InfoRow
                              key={`${segment.origin || ''}-${segment.destination || ''}-${index}`}
                              label={`${isEnglish ? 'Segment' : 'Segmen'} ${index + 1}`}
                              value={`${segment.origin_name || segment.origin || '?'} → ${segment.destination_name || segment.destination || '?'}${segment.departure_date ? ` · ${formatDate(segment.departure_date, true)}` : ''}`}
                            />
                          ))}
                        </>
                      )}
                      {booking.bookingType === 'train' && (
                        <>
                          <InfoRow label={isEnglish ? 'Route' : 'Rute'} value={route || '-'} />
                          <InfoRow label={isEnglish ? 'Train' : 'Kereta'} value={booking.airlineName || '-'} />
                          <InfoRow label={isEnglish ? 'Train number' : 'Nomor kereta'} value={booking.flightNumber || '-'} />
                          <InfoRow label={isEnglish ? 'Departure' : 'Keberangkatan'} value={formatDate(booking.departureDate, true)} />
                        </>
                      )}
                      {booking.bookingType === 'hotel' && (
                        <>
                          <InfoRow label={isEnglish ? 'Hotel' : 'Hotel'} value={booking.hotelName || '-'} />
                          <InfoRow label={isEnglish ? 'Check-in' : 'Check-in'} value={formatDate(booking.checkinDate)} />
                          <InfoRow label={isEnglish ? 'Check-out' : 'Check-out'} value={formatDate(booking.checkoutDate)} />
                          <InfoRow label={isEnglish ? 'Room' : 'Kamar'} value={[booking.roomDescription, booking.mealType].filter(Boolean).join(' · ') || '-'} />
                          <InfoRow label={isEnglish ? 'Guests / rooms' : 'Tamu / kamar'} value={`${booking.adultCount ?? 0} ${isEnglish ? 'adults' : 'dewasa'}${booking.childCount ? `, ${booking.childCount} ${isEnglish ? 'children' : 'anak'}` : ''} · ${booking.roomCount ?? 1} ${isEnglish ? 'room(s)' : 'kamar'}`} />
                          <InfoRow label={isEnglish ? 'Length of stay' : 'Lama menginap'} value={`${booking.nights ?? 1} ${isEnglish ? 'night(s)' : 'malam'}`} />
                        </>
                      )}
                      {booking.bookingType === 'insurance' && (
                        <>
                          <InfoRow label={isEnglish ? 'Product' : 'Produk'} value={booking.hotelName || (isEnglish ? 'Travel insurance' : 'Asuransi perjalanan')} />
                          <InfoRow label={isEnglish ? 'Coverage period' : 'Periode perlindungan'} value={`${formatDate(booking.checkinDate)} – ${formatDate(booking.checkoutDate)}`} />
                          <InfoRow label={isEnglish ? 'Destination' : 'Tujuan'} value={route || '-'} />
                          {bookingData.coverage && <InfoRow label={isEnglish ? 'Coverage' : 'Perlindungan'} value={bookingData.coverage} />}
                        </>
                      )}
                    </dl>

                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
                        <Users size={17} className="text-orange-500" />
                        {isEnglish ? `Passengers / guests (${passengers.length})` : `Penumpang / tamu (${passengers.length})`}
                      </h3>
                      {passengers.length ? (
                        <ol className="grid gap-2 sm:grid-cols-2">
                          {passengers.map((passenger, index) => (
                            <li key={`${passenger.first_name || 'passenger'}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{isEnglish ? 'Passenger' : 'Penumpang'} {index + 1}{passenger.pax_type ? ` · ${passenger.pax_type}` : ''}</p>
                              <p className="mt-1 text-sm font-bold text-slate-800">
                                {[passenger.title, passenger.first_name, passenger.last_name].filter(Boolean).join(' ') || '-'}
                              </p>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-slate-500">{isEnglish ? 'Passenger details are unavailable.' : 'Detail penumpang belum tersedia.'}</p>
                      )}
                    </div>
                  </div>

                  <aside className="border-t border-slate-100 bg-slate-50/80 p-5 sm:border-l sm:border-t-0 sm:p-6">
                    <h3 className="font-bold text-slate-900">{isEnglish ? 'Payment summary' : 'Rincian pembayaran'}</h3>
                    <dl className="mt-3">
                      {booking.discountAmount ? (
                        <>
                          <InfoRow label={isEnglish ? 'Discount' : 'Diskon'} value={`− ${formatIdr(booking.discountAmount)}`} />
                          {booking.couponCode && <InfoRow label={isEnglish ? 'Promo code' : 'Kode promo'} value={booking.couponCode} />}
                        </>
                      ) : null}
                      <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-4">
                        <dt className="text-sm font-semibold text-slate-600">{isEnglish ? 'Total' : 'Total'}</dt>
                        <dd className="text-xl font-extrabold tracking-tight text-slate-900">{formatIdr(booking.totalAmount)}</dd>
                      </div>
                    </dl>

                    {booking.status === 'pending_payment' && (
                      <div className={`mt-5 flex items-start gap-2 rounded-xl border p-3 text-xs ${countdown?.expired ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        <Clock3 size={15} className="mt-0.5 shrink-0" />
                        <p>
                          {countdown?.expired
                            ? (isEnglish ? 'Payment time has expired. This order can no longer be paid.' : 'Waktu pembayaran sudah berakhir. Pesanan ini tidak dapat dibayar lagi.')
                            : countdown
                              ? `${isEnglish ? 'Complete payment within' : 'Selesaikan pembayaran dalam'} ${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`
                              : (isEnglish ? 'Checking payment deadline…' : 'Memeriksa batas waktu pembayaran…')}
                        </p>
                      </div>
                    )}
                    {booking.status !== 'pending_payment' && (
                      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                        {isEnglish ? 'This order is not awaiting payment. Open order details to see its current status.' : 'Pesanan ini tidak sedang menunggu pembayaran. Buka detail pesanan untuk melihat status terbaru.'}
                      </div>
                    )}
                  </aside>
                </div>
              </section>

              {booking.status === 'pending_payment' && !countdown?.expired ? (
                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      className="mt-1 h-4 w-4 accent-orange-600"
                    />
                    <span className="text-sm leading-6 text-slate-700">
                      {isEnglish
                        ? 'I have checked the trip details and passenger names. They are correct and match the travel documents.'
                        : 'Saya sudah memeriksa detail perjalanan dan nama penumpang. Semua sudah benar dan sesuai dokumen perjalanan.'}
                    </span>
                  </label>
                  <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="text-center text-sm font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800 sm:text-left">
                      {isEnglish ? 'Something is wrong? Contact support' : 'Ada yang tidak sesuai? Hubungi bantuan'}
                    </a>
                    <button
                      type="button"
                      onClick={continueToPayment}
                      disabled={!confirmed || !canPay}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                    >
                      <CreditCard size={17} />
                      {isEnglish ? 'Continue to payment' : 'Lanjut ke pembayaran'}
                    </button>
                  </div>
                </section>
              ) : (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/bookings/${id}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
                    {isEnglish ? 'View order details' : 'Lihat detail pesanan'}
                  </Link>
                  {booking.status === 'pending_payment' && countdown?.expired && (
                    <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      {isEnglish ? 'Contact support' : 'Hubungi bantuan'}
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
