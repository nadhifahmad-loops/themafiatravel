'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { CARRIER_CODE_TO_AIRLINE, PROVIDER_ID_TO_LABEL } from '@/lib/providers';
import { getVendorLogo } from '@/lib/vendor-logo';
import { getSupportWhatsAppUrl, SUPPORT_EMAIL } from '@/lib/support';
import { downloadTicketPdf } from '@/lib/download-ticket';
import TrainSeatPicker from '@/components/train/TrainSeatPicker';
import TicketStub from '@/components/ticket/TicketStub';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  RotateCcw,
  CalendarDays,
  Users,
  Ticket,
  CreditCard,
  Mail,
  Headphones,
  ArrowUpRight,
  Plane,
  BedDouble,
  TrainFront,
  ShieldCheck,
  Hash,
  MapPin,
  Phone,
  Utensils,
  FileText,
  StickyNote,
  RefreshCw,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { getPaymentCountdown as getCountdown, PAYMENT_URGENCY_MS } from '@/lib/payment-window';
import type { NormalizedHotelBookingStatus } from '@/lib/hotel-booking-status';

function fmtIDR(n: number) { if (!n || isNaN(n)) return 'Rp 0'; return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function fmtDate(d: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
function fmtDateShort(d: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtTime(d: string) { if (!d) return '--:--'; return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
function fmtDuration(dep: string, arr: string) {
  if (!dep || !arr) return '-';
  const diff = new Date(arr).getTime() - new Date(dep).getTime();
  if (diff <= 0) return '-';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}
function nightCount(ci: string, co: string) {
  if (!ci || !co) return 1;
  const diff = new Date(co).getTime() - new Date(ci).getTime();
  return Math.max(1, Math.round(diff / 86400000));
}
function formatMealType(value?: string | null) {
  if (!value) return '-';
  const key = value.trim().toUpperCase();
  const labels: Record<string, string> = {
    RO: 'Kamar saja',
    BB: 'Termasuk sarapan',
    HB: 'Setengah penginapan',
    FB: 'Penginapan penuh',
    AI: 'All inclusive',
  };
  return labels[key] || value;
}
function formatHotelVendorState(state?: string | null, description?: string | null, isEN = false) {
  switch ((state || '').toLowerCase()) {
    case 'issued':
      return isEN ? 'Voucher issued by vendor' : 'Voucher diterbitkan vendor';
    case 'cancel':
    case 'cancelled':
      return isEN ? 'Cancelled by vendor' : 'Dibatalkan vendor';
    case 'refund':
    case 'refunded':
      return isEN ? 'Refunded by vendor' : 'Refund diproses vendor';
    default:
      return description || state || (isEN ? 'Vendor status' : 'Status vendor');
  }
}
function resolveAirlineName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  const upper = trimmed.toUpperCase();
  if (CARRIER_CODE_TO_AIRLINE[upper]) return CARRIER_CODE_TO_AIRLINE[upper];
  const lower = trimmed.toLowerCase();
  if (PROVIDER_ID_TO_LABEL[lower]) return PROVIDER_ID_TO_LABEL[lower];
  const first = trimmed.split(/\s+/)[0]?.toUpperCase();
  if (first && CARRIER_CODE_TO_AIRLINE[first]) return CARRIER_CODE_TO_AIRLINE[first];
  for (const len of [3, 2]) {
    if (trimmed.length > len) {
      const code = trimmed.substring(0, len).toUpperCase();
      if (CARRIER_CODE_TO_AIRLINE[code]) return CARRIER_CODE_TO_AIRLINE[code];
    }
  }
  return trimmed;
}

function PaymentCountdown({ createdAt }: { createdAt: string }) {
  // Komponen ini hanya dirender setelah data booking diambil di client,
  // jadi Date.now() aman dipakai untuk nilai awal (tanpa hydration mismatch).
  const [cd, setCd] = useState(() => getCountdown(createdAt));

  useEffect(() => {
    const timer = setInterval(() => setCd(getCountdown(createdAt)), 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

  if (cd.expired) {
    return (
      <p className="text-sm font-bold text-red-700">Waktu pembayaran habis</p>
    );
  }

  // Merah hanya di 15 menit terakhir — window pembayaran 1 jam (ambang lama
  // "total < 1 jam" membuat countdown merah sejak detik pertama).
  const urgency = cd.total < PAYMENT_URGENCY_MS;
  const box = urgency ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800';

  return (
    <div className="flex items-center gap-1.5" aria-live="polite">
      {[
        { v: cd.hours, s: 'j' },
        { v: cd.minutes, s: 'm' },
        { v: cd.seconds, s: 'd' },
      ].map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className={`px-2 py-1 rounded-md font-mono text-sm font-bold tabular-nums ${box}`}>
            {String(item.v).padStart(2, '0')}{item.s}
          </span>
          {i < 2 && <span className={`text-xs font-bold ${urgency ? 'text-red-300' : 'text-amber-400'}`}>:</span>}
        </span>
      ))}
    </div>
  );
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  issued: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  pending_payment: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  payment_failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  cancelled: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  expired: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  refund_requested: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  refund: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
};

const TYPE_ICON: Record<string, LucideIcon> = {
  flight: Plane,
  hotel: BedDouble,
  train: TrainFront,
  insurance: ShieldCheck,
};

type PassengerRecord = {
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  pax_type?: string | null;
  seat?: string | null;
  ticket_number?: string | null;
};

type SegmentRecord = {
  origin?: string | null;
  destination?: string | null;
  origin_name?: string | null;
  origin_display_name?: string | null;
  destination_name?: string | null;
  destination_display_name?: string | null;
  origin_terminal?: string | null;
  destination_terminal?: string | null;
  departure_date?: string | null;
  arrival_date?: string | null;
  carrier_name?: string | null;
  flight_number?: string | null;
  cabin_baggage?: string | null;
  passengers?: Array<{
    passenger_number?: number | null;
    number?: number | null;
    seat?: string | null;
    seat_code?: string | null;
    seat_assignment?: string | null;
  }>;
};

type BookingDataRaw = {
  /** Segmen ternormalisasi dari API (rute, nama kota, jadwal). */
  segments?: SegmentRecord[];
  provider_bookings?: Array<{
    segments?: Array<{
      origin_name?: string;
      origin_display_name?: string;
      destination_name?: string;
      destination_display_name?: string;
      arrival_date?: string;
      cabin_baggage?: string;
      baggage_allowance?: string;
      passengers?: Array<{
        passenger_number?: number;
        number?: number;
        seat?: string;
        seat_code?: string;
        seat_assignment?: string;
      }>;
    }>;
    journeys?: Array<{
      seats?: Array<{
        passenger_sequence?: number;
        seat?: string;
        seat_code?: string;
      }>;
    }>;
  }>;
  arrival_date_from_search?: string;
  cabin_class?: string;
  subclass?: string;
  roomType?: string;
  refundable?: boolean;
  is_refundable?: boolean;
  fare_refundable?: boolean;
  coverage?: string;
};

type BookingDetail = {
  id: string;
  orderNumber?: string | null;
  bookingType?: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  paidAt?: string | null;
  paymentType?: string | null;
  snapToken?: string | null;
  discountAmount?: number | null;
  couponCode?: string | null;
  pnr?: string | null;
  provider?: string | null;
  airlineName?: string | null;
  flightNumber?: string | null;
  origin?: string | null;
  destination?: string | null;
  routeLabel?: string | null;
  departureDate?: string | null;
  hotelName?: string | null;
  checkinDate?: string | null;
  checkoutDate?: string | null;
  roomCount?: number | null;
  roomDescription?: string | null;
  mealType?: string | null;
  nights?: number | null;
  bookingData?: unknown;
  passengerData?: unknown;
  verificationCode?: string;
  verificationHref?: string;
};

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-[13px] font-semibold text-brand-ink mt-0.5 break-words ${mono ? 'font-mono' : ''}`}>{value || '-'}</p>
    </div>
  );
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { language } = useLanguage();
  const isEN = language === 'EN';
  const t = i18n.bookingDetail[language];

  const statusLabel = (key: string) => (t.statusMap as Record<string, string | undefined>)[key] ?? key;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [paying, setPaying] = useState(false);
  const [hotelStatus, setHotelStatus] = useState<NormalizedHotelBookingStatus | null>(null);
  const [hotelStatusError, setHotelStatusError] = useState('');
  const [hotelStatusRefresh, setHotelStatusRefresh] = useState(0);
  const hotelOrderNumber = booking?.bookingType === 'hotel' ? booking.orderNumber : null;
  const hotelStatusLoading = Boolean(hotelOrderNumber) && hotelStatus === null && !hotelStatusError;

  usePageTitle(booking ? `Detail Pesanan: ${booking.orderNumber || booking.id}` : 'Detail Pesanan');

  const fetchBooking = async () => {
    const r = await fetch(`/api/bookings/${id}`);
    const json = await r.json();
    if (json.success) setBooking(json.data as BookingDetail);
    else setFetchError(json.message || t.notFound);
  };

  useEffect(() => {
    if (!id) return;
    fetch(`/api/bookings/${id}`)
      .then((r) => r.json())
      .then((r) => { if (r.success) setBooking(r.data as BookingDetail); else setFetchError(r.message || t.notFound); })
      .catch(() => setFetchError('Gagal memuat data pesanan'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id || !booking || booking.status !== 'pending_payment') return;
    let stopped = false;

    const check = async () => {
      try {
        const r = await fetch(`/api/bookings/${id}/check-payment`);
        const json = await r.json();
        if (!stopped && json.success && json.data?.updated) await fetchBooking();
      } catch {
        // diamkan — polling berikutnya akan mencoba lagi
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => { stopped = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, booking?.status]);

  useEffect(() => {
    if (!hotelOrderNumber) return;

    let active = true;

    fetch('/api/hotel/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_number: hotelOrderNumber }),
    })
      .then(async (response) => {
        const json = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok || !json?.success) {
          setHotelStatusError(
            typeof json?.error === 'string'
              ? json.error
              : 'Status voucher hotel belum dapat dimuat. Data lokal tetap ditampilkan.'
          );
          return;
        }
        setHotelStatusError('');
        setHotelStatus(json.data as NormalizedHotelBookingStatus);
      })
      .catch(() => {
        if (active) {
          setHotelStatusError('Status voucher hotel belum dapat dimuat. Data lokal tetap ditampilkan.');
        }
      });

    return () => { active = false; };
  }, [hotelOrderNumber, hotelStatusRefresh]);

  const handlePayNow = () => {
    if (paying) return;
    setPaying(true);
    router.push(`/payment/${id}`);
  };

  const handleDownloadPDF = async () => {
    if (!booking || downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadTicketPdf({ id: booking.id });
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : t.pdfFailed);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bgLight pt-[64px] md:pt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-4 w-24 rounded bg-slate-200/70 animate-pulse" />
          <div className="mt-4 h-8 w-64 rounded bg-slate-200/70 animate-pulse" />
          <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-5">
            <div className="space-y-4">
              <div className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            </div>
            <div className="h-80 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-brand-bgLight pt-[64px] md:pt-20 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm font-semibold text-brand-ink">{fetchError || t.notFound}</p>
          <Link href="/bookings" className="inline-flex items-center gap-1.5 mt-4 text-sm text-brand-blue hover:text-brand-orange transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t.backToList}
          </Link>
        </div>
      </div>
    );
  }

  const bType = booking.bookingType || 'flight';
  const status = booking.status;
  const isFlight = bType === 'flight';
  const isTrain = bType === 'train';
  const isHotel = bType === 'hotel';
  const isInsurance = bType === 'insurance';
  const isTransport = isFlight || isTrain;
  const isPending = status === 'pending_payment';
  const isPaid = status === 'paid' || status === 'issued';
  const isFailed = status === 'payment_failed' || status === 'cancelled';
  const isExpired = isPending && getCountdown(booking.createdAt).expired;
  const canPay = isPending && !isExpired && booking.snapToken;
  const canDownload = isPaid;

  const bookingDataRaw = (typeof booking.bookingData === 'object' && booking.bookingData ? booking.bookingData : {}) as BookingDataRaw;
  const passengers: PassengerRecord[] = Array.isArray(booking.passengerData)
    ? (booking.passengerData as PassengerRecord[]).filter((p) => p.first_name)
    : [];

  let arrivalDate: string | null = null;
  let originDisplayName = '';
  let destDisplayName = '';
  let baggageAllowance = '';

  const seatMapByPax: Record<number, string> = {};
  if (isTransport) {
    const providerBookings = bookingDataRaw?.provider_bookings || [];
    // Utamakan segmen ternormalisasi dari API; fallback ke bentuk lama.
    const segments: SegmentRecord[] =
      bookingDataRaw?.segments && bookingDataRaw.segments.length > 0
        ? bookingDataRaw.segments
        : providerBookings.flatMap((pb) => pb.segments || []);
    const lastSeg = segments[segments.length - 1] || {};
    const firstSeg = segments[0] || {};
    arrivalDate = lastSeg.arrival_date || bookingDataRaw.arrival_date_from_search || null;
    originDisplayName = firstSeg.origin_name || firstSeg.origin_display_name || '';
    destDisplayName = lastSeg.destination_name || lastSeg.destination_display_name || '';
    baggageAllowance = firstSeg.cabin_baggage || '';

    // Kursi per penumpang: `passenger_sequence` vendor bisa 0-based maupun 1-based.
    for (const seg of segments) {
      for (const sp of seg.passengers || []) {
        const pNum = Number(sp.passenger_number ?? sp.number);
        const seat = sp.seat || sp.seat_code || sp.seat_assignment || '';
        if (Number.isFinite(pNum) && seat) seatMapByPax[pNum] = seat;
      }
    }
    if (isTrain) {
      for (const pb of providerBookings) {
        for (const j of Array.isArray(pb?.journeys) ? pb.journeys : []) {
          for (const s of Array.isArray(j?.seats) ? j.seats : []) {
            const pNum = Number(s.passenger_sequence);
            const seat = s.seat || (s.seat_code ? `Kursi ${s.seat_code}` : '');
            if (Number.isFinite(pNum) && seat) seatMapByPax[pNum] = seat;
          }
        }
      }
    }
  }

  const enrichedPassengers = passengers.map((p, i) => {
    const seat = p.seat || seatMapByPax[i] || seatMapByPax[i + 1] || '';
    return seat ? { ...p, seat } : p;
  });

  const segmentCount = isTransport
    ? (bookingDataRaw?.segments?.length || bookingDataRaw?.provider_bookings?.[0]?.segments?.length || 1)
    : 1;
  const startDate = (isHotel && hotelStatus?.checkin_date)
    ? hotelStatus.checkin_date
    : booking.departureDate || booking.checkinDate || '';
  const endDate = (isHotel && hotelStatus?.checkout_date)
    ? hotelStatus.checkout_date
    : arrivalDate || booking.checkoutDate || startDate;
  const originCode = booking.origin || '';
  const destCode = booking.destination || '';
  const originName = originDisplayName || originCode;
  const destName = destDisplayName || destCode;
  const itemName = isTrain
    ? resolveAirlineName(booking.airlineName || '') || 'Kereta Api'
    : isHotel
      ? (hotelStatus?.hotel_name || booking.hotelName || 'Hotel')
      : isInsurance
        ? (bookingDataRaw?.coverage || 'Asuransi Perjalanan')
        : resolveAirlineName(booking.airlineName || '') || 'Maskapai';
  const itemCode = booking.flightNumber || '';
  const subclass = bookingDataRaw?.cabin_class || bookingDataRaw?.subclass || booking.roomDescription || bookingDataRaw?.roomType || '';
  const refundable = bookingDataRaw?.refundable === true || bookingDataRaw?.is_refundable === true || bookingDataRaw?.fare_refundable === true;
  const hotelVendorState = (hotelStatus?.state || '').toLowerCase();
  const hotelVendorCancelled = ['cancel', 'cancelled', 'refund', 'refunded'].includes(hotelVendorState);
  // Hotel tidak menyimpan flag refundable seperti flight. paid/issued berarti
  // voucher sudah terbit dan pembatalan dapat dicek langsung ke vendor.
  const canCancel = isHotel
    ? isPaid && !hotelVendorCancelled
    : isPaid && refundable;
  const voucherIssued = isHotel ? isPaid && !hotelVendorCancelled : status === 'issued';
  const displayStatusLabel = isHotel && voucherIssued
    ? (isEN ? 'Voucher issued' : 'Voucher terbit')
    : statusLabel(status);
  const st = STATUS_STYLE[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
  const TypeIcon = TYPE_ICON[bType] || Plane;
  const vendorLogo = getVendorLogo(bType, booking.provider || '', booking.airlineName || '');

  const docLabel = isHotel ? 'VOUCHER' : isInsurance ? 'POLIS' : 'E-TICKET';
  const downloadLabel = isHotel ? t.downloadVoucher : isInsurance ? t.downloadPolicy : t.download;
  const stubDate = isHotel
    ? `${fmtDateShort(startDate)} — ${fmtDateShort(endDate)}`
    : isTransport
      ? `${fmtDateShort(startDate)} · ${fmtTime(startDate)}`
      : `${fmtDateShort(startDate)} — ${fmtDateShort(endDate)}`;
  const stubSubtitle = isHotel
    ? `${nightCount(startDate, endDate)} ${t.hotel.night}${booking.roomCount ? ` · ${booking.roomCount} ${t.hotel.room}` : ''}`
    : isTransport
      ? `${originCode} → ${destCode}${itemCode ? ` · ${itemCode}` : ''}`
      : `${passengers.length || 1} ${t.people}`;

  const typeLabel = isHotel ? t.hotel.title : isInsurance ? t.insurance.title : isTrain ? t.train.title : t.flight.title;

  return (
    <div className="min-h-screen bg-brand-bgLight pt-[64px] md:pt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-brand-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.back}
        </Link>

        {/* Header */}
        <div className="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{typeLabel}</p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-brand-ink tracking-tight mt-1 truncate">
              {booking.orderNumber || booking.id}
            </h1>
            <p className="text-xs text-slate-500 mt-1">{t.createdAt}: {fmtDate(booking.createdAt)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.totalAmount}</p>
            <p className="text-lg sm:text-xl font-extrabold text-brand-ink">{fmtIDR(booking.totalAmount)}</p>
            <span className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {displayStatusLabel}
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
          {/* ── Main ── */}
          <div className="space-y-4 min-w-0">
            {/* Status notice */}
            {isPending && !isExpired && (
              <div className="bg-white rounded-2xl border border-amber-200 shadow-card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-brand-ink">{t.statusMap.pending_payment}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isEN ? 'Complete the payment to confirm this booking.' : 'Selesaikan pembayaran untuk mengonfirmasi pesanan.'}
                    </p>
                    <div className="mt-3">
                      <PaymentCountdown createdAt={booking.createdAt} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-emerald-700 leading-relaxed">{t.pendingEmailNotice}</p>
                </div>
                {canPay && (
                  <button
                    type="button"
                    onClick={handlePayNow}
                    disabled={paying}
                    className="mt-3 w-full py-3 rounded-xl bg-brand-orange hover:bg-orange-dark disabled:opacity-60 text-white text-sm font-bold transition-colors"
                  >
                    {paying ? (isEN ? 'Redirecting to payment...' : 'Mengarahkan ke pembayaran...') : `${t.payNow} ${fmtIDR(booking.totalAmount)}`}
                  </button>
                )}
              </div>
            )}

            {isExpired && (
              <div className="bg-white rounded-2xl border border-red-200 shadow-card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <XCircle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-700">{isEN ? 'Payment expired' : 'Pembayaran kedaluwarsa'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isEN ? 'The payment window has closed. Please create a new booking.' : 'Waktu pembayaran telah habis. Silakan buat pesanan baru.'}
                    </p>
                  </div>
                </div>
                <Link href="/" className="mt-3 block w-full py-3 rounded-xl bg-brand-ink hover:bg-slate-800 text-white text-sm font-bold text-center transition-colors">
                  {isEN ? 'Create New Booking' : 'Buat Pesanan Baru'}
                </Link>
              </div>
            )}

            {isFailed && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    {status === 'cancelled' ? <Ban className="w-4 h-4 text-slate-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-brand-ink">{statusLabel(status)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {status === 'cancelled'
                        ? (isEN ? 'This booking has been cancelled.' : 'Pesanan ini telah dibatalkan.')
                        : (isEN ? 'The payment could not be processed.' : 'Pembayaran tidak berhasil diproses.')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(status === 'refund_requested' || status === 'refund') && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${status === 'refund_requested' ? 'bg-orange-50' : 'bg-violet-50'}`}>
                    <RotateCcw className={`w-4 h-4 ${status === 'refund_requested' ? 'text-orange-500' : 'text-violet-500'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-brand-ink">{statusLabel(status)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {status === 'refund_requested'
                        ? (isEN ? 'Your refund request is being processed.' : 'Permintaan refund sedang kami proses.')
                        : (isEN ? 'The refund has been returned.' : 'Dana refund telah dikembalikan.')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isPaid && (
              <div className="bg-white rounded-2xl border border-emerald-200 shadow-card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-emerald-700">
                      {isHotel
                        ? (isEN ? 'Hotel voucher issued' : 'Voucher hotel sudah diterbitkan')
                        : status === 'issued'
                          ? (isEN ? 'Ticket issued' : 'Tiket sudah diterbitkan')
                          : (isEN ? 'Payment confirmed' : 'Pembayaran terkonfirmasi')}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isHotel
                        ? (isEN
                            ? 'Present this voucher at the hotel reception when checking in.'
                            : 'Tunjukkan voucher ini saat check-in di resepsionis hotel.')
                        : status === 'issued'
                          ? (isEN ? 'Your e-ticket/voucher is ready to download.' : 'E-tiket/voucher Anda sudah siap diunduh.')
                          : (isEN ? 'We have received your payment.' : 'Pembayaran sudah kami terima.')}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-emerald-700 leading-relaxed">{t.paidEmailNotice}</p>
                </div>
              </div>
            )}

            {/* Trip card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                {vendorLogo ? (
                  <div className="w-11 h-11 rounded-xl border border-slate-100 bg-white flex items-center justify-center p-2 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={vendorLogo} alt={itemName} className="max-w-full max-h-full object-contain" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <TypeIcon className="w-5 h-5 text-slate-500" strokeWidth={2} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand-ink truncate">{itemName}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {[itemCode, subclass].filter(Boolean).join(' · ') || (isHotel ? t.hotel.title : typeLabel)}
                  </p>
                </div>
                {isTransport && (
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-md shrink-0 ${refundable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {refundable ? t.refundable : t.nonRefundable}
                  </span>
                )}
              </div>

              <div className="px-4 sm:px-5 py-5">
                <p className="text-[11px] font-semibold text-slate-400 mb-4">
                  {isHotel || isInsurance ? t.periodBooking : fmtDate(startDate)}
                </p>

                {isTransport ? (
                  <div className="flex items-start gap-3 sm:gap-5">
                    <div className="flex-1 min-w-0">
                      <p className="text-2xl sm:text-3xl font-extrabold text-brand-ink tabular-nums leading-none">{fmtTime(startDate)}</p>
                      <p className="text-sm font-bold text-brand-ink mt-2">{originCode || '-'}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{originName}</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center pt-2">
                      <p className="text-[11px] text-slate-400">{fmtDuration(startDate, endDate)}</p>
                      <div className="relative w-full h-px bg-slate-200 mt-3 mb-2">
                        <span className="absolute left-0 -top-1 w-2 h-2 rounded-full bg-brand-ink" />
                        <span className="absolute right-0 -top-1 w-2 h-2 rounded-full border-2 border-brand-ink bg-white" />
                      </div>
                      <p className="text-[10px] text-slate-400">{segmentCount <= 1 ? t.direct : `${segmentCount - 1} Transit`}</p>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-2xl sm:text-3xl font-extrabold text-brand-ink tabular-nums leading-none">{fmtTime(endDate)}</p>
                      <p className="text-sm font-bold text-brand-ink mt-2">{destCode || '-'}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{destName}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-lg sm:text-xl font-extrabold text-brand-ink">{fmtDateShort(startDate)}</p>
                      <p className="text-[11px] font-semibold text-slate-500 mt-1">{isHotel ? t.hotel.checkin : t.starts}</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center">
                      <div className="relative w-full h-px bg-slate-200">
                        <span className="absolute left-0 -top-1 w-2 h-2 rounded-full bg-brand-ink" />
                        <span className="absolute right-0 -top-1 w-2 h-2 rounded-full border-2 border-brand-ink bg-white" />
                      </div>
                      {isHotel && <p className="text-[11px] text-slate-400 mt-2">{nightCount(startDate, endDate)} {t.hotel.night}</p>}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-lg sm:text-xl font-extrabold text-brand-ink">{fmtDateShort(endDate)}</p>
                      <p className="text-[11px] font-semibold text-slate-500 mt-1">{isHotel ? t.hotel.checkout : t.ends}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 sm:px-5 pb-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 pt-4 border-t border-slate-100">
                  {isFlight && baggageAllowance && <Meta label={t.baggage} value={baggageAllowance} />}
                  {isTrain && subclass && <Meta label={t.classType} value={subclass} />}
                  {isHotel && subclass && <Meta label={t.roomType} value={subclass} />}
                  {isInsurance && <Meta label={t.protection} value={bookingDataRaw?.coverage || 'Full Trip'} />}
                  <Meta label={isHotel ? t.guests : t.passengers} value={`${passengers.length || 1} ${t.people}`} />
                  {booking.paymentType && <Meta label={language === 'ID' ? 'Metode Bayar' : 'Payment Method'} value={booking.paymentType.replace(/_/g, ' ')} />}
                  {booking.paidAt && <Meta label={language === 'ID' ? 'Dibayar' : 'Paid'} value={fmtDateShort(booking.paidAt)} />}
                  <Meta label={t.orderNo} value={booking.id} mono />
                </div>
              </div>
            </div>

            {/* Hotel voucher information (live from vendor) */}
            {isHotel && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
                <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {isEN ? 'Hotel voucher information' : 'Informasi Voucher Hotel'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isEN ? 'Live status from the hotel vendor.' : 'Status live dari vendor hotel.'}
                    </p>
                  </div>
                  {hotelStatusLoading ? (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />
                  ) : hotelStatus ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {formatHotelVendorState(hotelStatus.state, hotelStatus.state_description, isEN)}
                    </span>
                  ) : null}
                </div>

                <div className="p-4 sm:p-5">
                  {hotelStatusLoading && !hotelStatus ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-3 w-2/3 rounded bg-slate-100" />
                      <div className="h-3 w-1/2 rounded bg-slate-100" />
                      <div className="h-3 w-3/4 rounded bg-slate-100" />
                    </div>
                  ) : hotelStatus ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                        <div className="sm:col-span-2 flex items-start gap-2.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {isEN ? 'Address' : 'Alamat'}
                            </p>
                            <p className="text-[12px] font-semibold text-brand-ink mt-0.5 break-words">
                              {hotelStatus.hotel_address || '-'}
                              {hotelStatus.hotel_city_name ? `, ${hotelStatus.hotel_city_name}` : ''}
                            </p>
                          </div>
                        </div>
                        {hotelStatus.hotel_phone && (
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Phone className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                {isEN ? 'Hotel phone' : 'Telepon hotel'}
                              </p>
                              <p className="text-[12px] font-semibold text-brand-ink mt-0.5 break-words">{hotelStatus.hotel_phone}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-2.5 min-w-0">
                          <BedDouble className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {isEN ? 'Room' : 'Kamar'}
                            </p>
                            <p className="text-[12px] font-semibold text-brand-ink mt-0.5 break-words">
                              {hotelStatus.room_name || booking.roomDescription || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Utensils className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {isEN ? 'Meal' : 'Makan'}
                            </p>
                            <p className="text-[12px] font-semibold text-brand-ink mt-0.5 break-words">
                              {formatMealType(hotelStatus.meal_type || booking.mealType)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Users className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {isEN ? 'Guests' : 'Tamu'}
                            </p>
                            <p className="text-[12px] font-semibold text-brand-ink mt-0.5">
                              {hotelStatus.guest_count || passengers.length || 1} {t.people}
                              {hotelStatus.room_count ? ` · ${hotelStatus.room_count} ${t.hotel.room}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>

                      {hotelStatus.cancellation_policy.length > 0 && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                          <FileText className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-amber-800">
                              {isEN ? 'Cancellation policy' : 'Kebijakan pembatalan'}
                            </p>
                            {hotelStatus.cancellation_policy.map((policy, index) => (
                              <p key={`${policy}-${index}`} className="text-[11px] leading-relaxed text-amber-700 mt-0.5 break-words">
                                {policy}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {hotelStatus.special_request && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <StickyNote className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-700">
                              {isEN ? 'Special request' : 'Permintaan khusus'}
                            </p>
                            <p className="text-[11px] leading-relaxed text-slate-600 mt-0.5 break-words">
                              {hotelStatus.special_request}
                            </p>
                          </div>
                        </div>
                      )}

                      {hotelStatusError && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-700">
                          <RotateCcw className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{hotelStatusError}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-slate-500">
                      <RotateCcw className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                      <div>
                        <p>{hotelStatusError || (isEN ? 'Voucher status is not available yet.' : 'Status voucher belum tersedia.')}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setHotelStatus(null);
                            setHotelStatusError('');
                            setHotelStatusRefresh((value) => value + 1);
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {isEN ? 'Retry' : 'Coba lagi'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Passengers */}
            {passengers.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
                <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {isHotel ? t.guestData : t.passengerData}
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {enrichedPassengers.map((p, i) => (
                    <div key={i} className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-500 shrink-0">
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-brand-ink truncate">
                            {[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {p.pax_type === 'ADT' ? t.adult : p.pax_type === 'CHD' ? t.child : t.infant}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-right">
                        {isTransport && p.ticket_number && (
                          <div>
                            <p className="text-[9px] uppercase tracking-wide text-slate-400">E-Ticket</p>
                            <p className="text-[11px] font-bold font-mono text-slate-600">{p.ticket_number}</p>
                          </div>
                        )}
                        {p.seat && (
                          <div>
                            <p className="text-[9px] uppercase tracking-wide text-slate-400">{isEN ? 'Seat' : 'Kursi'}</p>
                            <span className="inline-block text-[11px] font-bold font-mono text-brand-orange bg-orange-50 px-1.5 py-0.5 rounded">
                              {p.seat}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t.paymentSummary}</p>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <span className="text-slate-500">{t.totalAmount}</span>
                  <span className="font-extrabold text-brand-ink">{fmtIDR(booking.totalAmount)}</span>
                </div>
                {(booking.discountAmount ?? 0) > 0 && (
                  <div className="flex items-center justify-between gap-4 text-[13px]">
                    <span className="text-slate-500">
                      {t.discount}{booking.couponCode ? ` (${booking.couponCode})` : ''}
                    </span>
                    <span className="font-semibold text-emerald-600">- {fmtIDR(booking.discountAmount ?? 0)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <span className="text-slate-500">{t.paymentMethod}</span>
                  <span className="font-semibold text-brand-ink">
                    {booking.paymentType ? booking.paymentType.replace(/_/g, ' ') : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <span className="text-slate-500">{t.paidAt}</span>
                  <span className="font-semibold text-brand-ink">{booking.paidAt ? fmtDateShort(booking.paidAt) : '-'}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {(canCancel || (isTrain && isPaid && booking.orderNumber)) && (
              <div className="flex flex-col sm:flex-row gap-3">
                {canCancel && (
                  <Link
                    href={`/bookings/${id}/cancel`}
                    className="flex-1 py-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold text-center transition-colors"
                  >
                    {isHotel ? (isEN ? 'Cancel & Request Refund' : 'Batalkan & Ajukan Refund') : t.cancelBooking}
                  </Link>
                )}
                {isTrain && isPaid && booking.orderNumber && (
                  <TrainSeatPicker
                    orderId={booking.id}
                    providerBookings={Array.isArray(bookingDataRaw?.provider_bookings) ? (bookingDataRaw.provider_bookings as Array<Record<string, unknown>>) : []}
                    passengers={passengers}
                    onSaved={fetchBooking}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Aside ── */}
          <aside className="space-y-4">
            <TicketStub
              orderNumber={booking.orderNumber || booking.id}
              documentLabel={docLabel}
              statusLabel={displayStatusLabel}
              title={itemName}
              subtitle={stubSubtitle}
              dateText={stubDate}
              dateLabel={t.date}
              pnr={isTransport ? booking.pnr : null}
              verifyCode={booking.verificationCode || ''}
              verifyHref={booking.verificationHref || '#'}
              verifyLabel={t.verify}
              verifyHint={t.verifyHint}
              downloadLabel={downloadLabel}
              downloadingLabel={t.preparingDoc}
              downloading={downloading}
              onDownload={handleDownloadPDF}
              downloadable={canDownload}
              unavailableLabel={
                isEN
                  ? 'The document can be downloaded once payment is confirmed.'
                  : 'Dokumen dapat diunduh setelah pembayaran dikonfirmasi.'
              }
            />

            {downloadError && (
              <p className="text-[11px] text-red-600 leading-relaxed px-1">{downloadError}</p>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Headphones className="w-4 h-4 text-slate-400" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t.contactUs}</p>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {isEN
                  ? '24-hour support for schedule changes, cancellations, or document issues.'
                  : 'Layanan bantuan 24 jam untuk perubahan jadwal, pembatalan, atau kendala dokumen.'}
              </p>
              <div className="mt-3 space-y-2">
                <a
                  href={getSupportWhatsAppUrl(
                    isEN
                      ? `Hello, I need help with booking ${booking.orderNumber || booking.id}.`
                      : `Halo, saya butuh bantuan untuk pesanan ${booking.orderNumber || booking.id}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 text-[12px] font-semibold text-brand-ink hover:text-brand-orange transition-colors"
                >
                  WhatsApp Support
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-center justify-between gap-2 text-[12px] font-semibold text-brand-ink hover:text-brand-orange transition-colors"
                >
                  {SUPPORT_EMAIL}
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">{t.orderSummary}</p>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400">{t.orderNo}</p>
                    <p className="text-[11px] font-semibold font-mono text-brand-ink break-all">{booking.id}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400">{t.createdAt}</p>
                    <p className="text-[11px] font-semibold text-brand-ink">{fmtDateShort(booking.createdAt)}</p>
                  </div>
                </div>
                {(booking.origin || booking.destination) && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400">{isEN ? 'Route' : 'Rute'}</p>
                      <p className="text-[11px] font-semibold text-brand-ink">{booking.origin} → {booking.destination}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <Ticket className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400">{t.bookingType}</p>
                    <p className="text-[11px] font-semibold text-brand-ink">{typeLabel}</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed px-1">
              {isEN
                ? 'Official document issued electronically by The Mafia Travel.'
                : 'Dokumen resmi diterbitkan secara elektronik oleh The Mafia Travel.'}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
