'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { CARRIER_CODE_TO_AIRLINE, PROVIDER_ID_TO_LABEL } from '@/lib/providers';
import { getVendorLogo } from '@/lib/vendor-logo';
import TrainSeatPicker from '@/components/train/TrainSeatPicker';
import { PdfTemplate } from '@/components/ticket/PdfTemplate';

const PAYMENT_TIMEOUT_MS = 24 * 60 * 60 * 1000;

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
function resolveAirlineName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  // 1) Full match langsung
  const upper = trimmed.toUpperCase();
  if (CARRIER_CODE_TO_AIRLINE[upper]) return CARRIER_CODE_TO_AIRLINE[upper];
  // 2) Provider ID match
  const lower = trimmed.toLowerCase();
  if (PROVIDER_ID_TO_LABEL[lower]) return PROVIDER_ID_TO_LABEL[lower];
  // 3) Split by spasi â†’ ambil bagian pertama
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    const upperFirst = (parts[0] || '').toUpperCase();
    if (CARRIER_CODE_TO_AIRLINE[upperFirst]) return CARRIER_CODE_TO_AIRLINE[upperFirst];
  }
  // 4) Tanpa spasi (misal "QZ806") â†’ coba 2-3 karakter pertama
  for (const len of [3, 2]) {
    if (trimmed.length > len) {
      const code = trimmed.substring(0, len).toUpperCase();
      if (CARRIER_CODE_TO_AIRLINE[code]) return CARRIER_CODE_TO_AIRLINE[code];
    }
  }
  return trimmed;
}

function getCountdown(createdAt: string) {
  if (!createdAt) return { expired: true, hours: 0, minutes: 0, seconds: 0, total: 0 };
  const created = typeof createdAt === 'string' ? new Date(createdAt).getTime() : new Date(String(createdAt)).getTime();
  if (isNaN(created)) return { expired: true, hours: 0, minutes: 0, seconds: 0, total: 0 };
  const deadline = created + PAYMENT_TIMEOUT_MS;
  const remaining = deadline - Date.now();
  if (remaining <= 0) return { expired: true, hours: 0, minutes: 0, seconds: 0, total: 0 };
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return { expired: false, hours, minutes, seconds, total: remaining };
}

function PaymentCountdown({ createdAt }: { createdAt: string }) {
  const [cd, setCd] = useState({ expired: true, hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCd(getCountdown(createdAt));
    const timer = setInterval(() => setCd(getCountdown(createdAt)), 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

  if (!mounted) {
    return (
      <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 animate-pulse">
        <p className="text-xs font-semibold text-slate-500 mb-2">Selesaikan pembayaran dalam</p>
        <div className="flex items-center gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-2xl font-black tabular-nums text-slate-800">00</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">{['Jam', 'Menit', 'Detik'][i]}</div>
              </div>
              {i < 2 && <span className="text-lg font-bold text-slate-300">:</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (cd.expired) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm font-bold text-red-700">Waktu pembayaran habis</p>
        <p className="text-xs text-red-500 mt-1">Pesanan ini tidak dapat dilanjutkan. Silakan buat pesanan baru.</p>
      </div>
    );
  }

  const urgency = cd.total < 3600000;

  return (
    <div className={`rounded-xl p-4 ${urgency ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
      <p className="text-xs font-semibold text-slate-500 mb-2">Selesaikan pembayaran dalam</p>
      <div className="flex items-center gap-3">
        {[
          { val: cd.hours, label: 'Jam' },
          { val: cd.minutes, label: 'Menit' },
          { val: cd.seconds, label: 'Detik' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="text-center">
              <div className={`text-2xl font-black tabular-nums ${urgency ? 'text-red-600' : 'text-slate-800'}`}>
                {String(item.val).padStart(2, '0')}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase">{item.label}</div>
            </div>
            {i < 2 && <span className={`text-lg font-bold ${urgency ? 'text-red-300' : 'text-slate-300'}`}>:</span>}
          </div>
        ))}
      </div>
      <p className={`text-xs mt-2 ${urgency ? 'text-red-500' : 'text-amber-600'}`}>
        {urgency ? 'Segera bayar, waktu hampir habis!' : 'Link pembayaran akan kedaluwarsa setelah waktu habis.'}
      </p>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  paid:             { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  issued:           { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  pending_payment:  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  payment_failed:   { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  cancelled:        { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
  refund_requested: { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  refund:           { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500' },
};

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { language } = useLanguage();
  const t = i18n.bookingDetail[language];
  const tc = i18n.common[language];

  const statusLabel = (key: string) => (t.statusMap as Record<string, string | undefined>)[key] ?? key;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);

  usePageTitle(
    booking
      ? `Detail Pesanan: ${booking.orderNumber || booking.id}`
      : 'Detail Pesanan'
  );

  const fetchBooking = async () => {
    const r = await fetch(`/api/bookings/${id}`);
    const json = await r.json();
    if (json.success) setBooking(json.data); else setFetchError(json.message || t.notFound);
  };

  useEffect(() => {
    if (!id) return;
    fetch(`/api/bookings/${id}`)
      .then(r => r.json())
      .then(r => { if (r.success) setBooking(r.data); else setFetchError(r.message || t.notFound); })
      .catch(() => setFetchError('Gagal memuat data pesanan'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !booking || booking.status !== 'pending_payment') return;
    const immediateCheck = async () => {
      setChecking(true);
      try {
        const r = await fetch(`/api/bookings/${id}/check-payment`);
        const json = await r.json();
        if (json.success && json.data?.updated) await fetchBooking();
      } catch { /* ignore */ }
      setChecking(false);
    };
    immediateCheck();
    const interval = setInterval(async () => {
      setChecking(true);
      try {
        const r = await fetch(`/api/bookings/${id}/check-payment`);
        const json = await r.json();
        if (json.success && json.data?.updated) await fetchBooking();
      } catch { /* ignore */ }
      setChecking(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [id, booking?.status]);

  const handlePayNow = () => {
    if (paying) return;
    setPaying(true);
    router.push(`/payment/${id}`);
  };

  const handleDownloadPDF = async () => {
    const el = document.getElementById('ticket-print');
    if (!el) return;
    setDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [0, 0, 0, 0],
        filename: `TMT_${booking.orderNumber || booking.id}_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 4, useCORS: true, backgroundColor: '#ffffff', letterRendering: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(el).save();
    } finally { setDownloading(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bgLight">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-[3px] border-brand-orange border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-slate-400 text-sm">{t.loading}</p>
      </div>
    </div>
  );

  if (!booking) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bgLight">
      <div className="text-center">
        <p className="text-slate-500 font-semibold">{fetchError || t.notFound}</p>
        <Link href="/bookings" className="inline-block mt-4 text-sm text-slate-600 underline">{t.backToList}</Link>
      </div>
    </div>
  );

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

  const bookingDataRaw = typeof booking.bookingData === 'object' && booking.bookingData ? booking.bookingData as any : {};
  const passengers = Array.isArray(booking.passengerData) ? booking.passengerData.filter((p: any) => p.first_name) : [];

  let arrivalDate: string | null = null;
  let originDisplayName = '';
  let destDisplayName = '';
  let baggageAllowance = '';

  // Extract seat assignments from Orbis segments (for old bookings without seat in passengerData)
  const seatMapByPax: Record<number, string> = {};
  if (isTransport) {
    const providerBookings = bookingDataRaw?.provider_bookings || [];
    const segments = providerBookings[0]?.segments || [];
    const lastSeg = segments[segments.length - 1] || {};
    const firstSeg = segments[0] || {};
    arrivalDate = lastSeg.arrival_date || bookingDataRaw.arrival_date_from_search || null;
    originDisplayName = firstSeg.origin_name || firstSeg.origin_display_name || '';
    destDisplayName = lastSeg.destination_name || lastSeg.destination_name || lastSeg.destination_display_name || '';
    baggageAllowance = firstSeg.cabin_baggage || firstSeg.baggage_allowance || '';

    // Try to extract seat from segments.passengers[]
    for (const seg of segments) {
      const segPassengers = seg.passengers || [];
      for (const sp of segPassengers) {
        const pNum = sp.passenger_number || sp.number;
        const seat = sp.seat || sp.seat_code || sp.seat_assignment || '';
        if (pNum && seat) seatMapByPax[pNum] = seat;
      }
    }

    // Train (KAI): kursi hasil assign otomatis ada di provider_bookings[].journeys[].seats
    if (isTrain) {
      for (const pb of providerBookings) {
        const journeys = Array.isArray(pb?.journeys) ? pb.journeys : [];
        for (const j of journeys) {
          const jSeats = Array.isArray(j?.seats) ? j.seats : [];
          for (const s of jSeats) {
            const pNum = Number(s.passenger_sequence);
            if (pNum && (s.seat || s.seat_code)) seatMapByPax[pNum] = s.seat || `Kursi ${s.seat_code}`;
          }
        }
      }
    }
  }

  // Enrich passengers: fill seat from seatMapByPax if missing in passengerData
  const enrichedPassengers = passengers.map((p: any, i: number) => {
    const pNum = i + 1;
    const seat = p.seat || seatMapByPax[pNum] || '';
    return seat ? { ...p, seat } : p;
  });

  // Read selectedBaggage from saved bookingData (new bookings)
  const savedBaggage = bookingDataRaw?.selectedBaggage || null;

  const segmentCount = isTransport ? ((bookingDataRaw?.provider_bookings?.[0]?.segments?.length) || 1) : 1;
  const startDate = booking.departureDate || booking.checkinDate || null;
  const endDate = arrivalDate || booking.checkoutDate || startDate;
  const originCode = booking.origin || '';
  const destCode = booking.destination || '';
  const originName = originDisplayName || originCode;
  const destName = destDisplayName || destCode;
  const itemName = isTrain ? resolveAirlineName(booking.airlineName || '') || 'Kereta Api' : isHotel ? (booking.hotelName || 'Hotel') : isInsurance ? (booking.hotelName || 'Asuransi') : resolveAirlineName(booking.airlineName || '') || 'Maskapai';
  const itemCode = booking.flightNumber || '';
  const subclass = bookingDataRaw?.cabin_class || bookingDataRaw?.subclass || bookingDataRaw?.roomType || '';
  const refundable = bookingDataRaw?.refundable === true || bookingDataRaw?.is_refundable === true;
  const canCancel = isPaid && refundable;
  const st = STATUS_CONFIG[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

  return (
    <div className="min-h-screen bg-brand-bgLight">
      {/* â”€â”€ Header Hero â”€â”€ */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-6 px-4">
        <div className="max-w-5xl mx-auto">
          <Link href="/bookings" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-4">
            <i className="fa-solid fa-arrow-left text-xs"></i>
            {t.back}
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">{t.detail} {bType}</p>
              <h1 className="text-xl font-bold text-white">{booking.orderNumber || booking.id}</h1>
              {isTransport && booking.pnr && (
                <p className="text-white/40 text-sm mt-1">PNR: <span className="text-white/70 font-mono font-semibold">{booking.pnr}</span></p>
              )}
            </div>
            <div className="text-right">
              <p className="text-white/50 text-xs">{tc.total}</p>
              <p className="text-white font-bold text-lg">{fmtIDR(booking.totalAmount)}</p>
              <span className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${st.bg} ${st.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                {statusLabel(status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-3 pb-16 space-y-4">

        {/* Status Banner */}
        {isPending && !isExpired && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-clock text-amber-600"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{t.statusMap.pending_payment}</p>
                  <p className="text-xs text-slate-400">Selesaikan pembayaran untuk mengkonfirmasi pesanan</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${st.bg} ${st.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                {statusLabel(status)}
              </span>
            </div>
            <PaymentCountdown createdAt={booking.createdAt} />
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
              <i className="fa-solid fa-envelope text-emerald-500 mt-0.5 text-xs"></i>
              <p className="text-xs text-emerald-700 leading-relaxed">{t.pendingEmailNotice}</p>
            </div>
            {canPay && (
              <button
                onClick={handlePayNow}
                disabled={paying}
                className="w-full mt-4 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
              >
                {paying ? 'Mengarahkan ke pembayaran...' : `${t.payNow} ${fmtIDR(booking.totalAmount)}`}
              </button>
            )}
          </div>
        )}

        {isExpired && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <i className="fa-solid fa-circle-xmark text-red-500"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-red-600">Pembayaran Kedaluwarsa</p>
                <p className="text-xs text-slate-400">Waktu pembayaran telah habis</p>
              </div>
            </div>
            <Link href="/" className="block w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all text-center">
              Buat Pesanan Baru
            </Link>
          </div>
        )}

        {isFailed && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <i className={`fa-solid ${status === 'cancelled' ? 'fa-ban' : 'fa-circle-exclamation'} text-red-500`}></i>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800">{status === 'cancelled' ? t.statusMap.cancelled : t.statusMap.payment_failed}</p>
                <p className="text-xs text-slate-400">{status === 'cancelled' ? 'Pesanan ini telah dibatalkan' : 'Pembayaran tidak berhasil diproses'}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${st.bg} ${st.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                {statusLabel(status)}
              </span>
            </div>
          </div>
        )}

        {(status === 'refund_requested' || status === 'refund') && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${status === 'refund_requested' ? 'bg-orange-100' : 'bg-purple-100'} rounded-xl flex items-center justify-center`}>
                <i className={`fa-solid fa-rotate-left ${status === 'refund_requested' ? 'text-orange-500' : 'text-purple-500'}`}></i>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800">{statusLabel(status)}</p>
                <p className="text-xs text-slate-400">{status === 'refund_requested' ? 'Permintaan refund sedang kami proses' : 'Dana refund telah dikembalikan'}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${st.bg} ${st.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                {statusLabel(status)}
              </span>
            </div>
          </div>
        )}

        {isPaid && (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <i className="fa-solid fa-check-circle text-emerald-500"></i>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-emerald-700">{status === 'issued' ? 'Tiket Sudah Diterbitkan' : 'Pembayaran Terkonfirmasi'}</p>
                <p className="text-xs text-emerald-600/70">{status === 'issued' ? 'E-tiket/voucher Anda sudah siap' : 'Pembayaran sudah kami terima'}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {statusLabel(status)}
              </span>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
              <i className="fa-solid fa-envelope text-emerald-500 mt-0.5 text-xs"></i>
              <p className="text-xs text-emerald-700 leading-relaxed">{t.paidEmailNotice}</p>
            </div>
          </div>
        )}

        {/* Vendor / Airline Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_10px_30px_-5px_rgba(31,29,22,0.06)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <i className="fa-solid fa-building text-brand-blue"></i>
              {isTrain ? t.train.title : isHotel ? t.hotel.title : isInsurance ? t.insurance.title : t.flight.title}
            </p>
            <div className="flex items-center gap-4">
              {(() => {
                const logo = getVendorLogo(booking.bookingType, booking.provider || '', booking.airlineName || '');
                return logo ? (
                  <img
                    src={logo}
                    alt={itemName}
                    className="h-10 w-auto object-contain"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isTrain ? 'bg-emerald-100' : isHotel ? 'bg-purple-100' : 'bg-orange-100'
                  }`}>
                    <i className={`fa-solid ${isTrain ? 'fa-train' : isHotel ? 'fa-bed' : 'fa-shield-halved'} ${
                      isTrain ? 'text-emerald-600' : isHotel ? 'text-purple-600' : 'text-orange-600'
                    } text-lg`}></i>
                  </div>
                );
              })()}
              <div className="flex-1">
                <p className="font-bold text-slate-800">{itemName}</p>
                {itemCode && <p className="text-sm text-slate-500">{itemCode}</p>}
                {subclass && <p className="text-xs text-slate-400 mt-0.5">{subclass}</p>}
              </div>
              {isTransport && (
                <span className={`text-xs font-semibold px-3 py-1 rounded-lg ${refundable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {refundable ? t.refundable : t.nonRefundable}
                </span>
              )}
            </div>
          </div>

          {/* Route / Period */}
          <div className="px-5 py-5">
            <p className="text-xs font-semibold text-slate-400 mb-4">{isHotel || isInsurance ? t.periodBooking : fmtDate(startDate)}</p>

            {isTransport ? (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-3xl font-black text-slate-900 tabular-nums">{fmtTime(startDate)}</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">{originCode}</p>
                  <p className="text-xs text-slate-400 truncate">{originName}</p>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <p className="text-xs text-slate-400 font-medium mb-3">{fmtDuration(startDate, endDate)}</p>
                  <div className="w-full h-px bg-slate-200 relative">
                    <div className="absolute left-0 top-[-3px] w-2.5 h-2.5 rounded-full bg-slate-800"></div>
                    <div className="absolute right-0 top-[-3px] w-2.5 h-2.5 rounded-full border-2 border-slate-800 bg-white"></div>
                    {isFlight && (
                      <div className="absolute left-1/2 top-[-8px] -translate-x-1/2">
                        <i className="fa-solid fa-plane text-slate-400 text-xs rotate-0"></i>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3">{segmentCount <= 1 ? t.direct : `${segmentCount - 1} Transit`}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-3xl font-black text-slate-900 tabular-nums">{fmtTime(endDate)}</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">{destCode}</p>
                  <p className="text-xs text-slate-400 truncate">{destName}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-xl font-black text-slate-900">{fmtDateShort(startDate)}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">{isHotel ? t.hotel.checkin : t.starts}</p>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-full h-px bg-slate-200 relative">
                    <div className="absolute left-0 top-[-3px] w-2.5 h-2.5 rounded-full bg-slate-800"></div>
                    <div className="absolute right-0 top-[-3px] w-2.5 h-2.5 rounded-full border-2 border-slate-800 bg-white"></div>
                  </div>
                  {isHotel && (
                    <p className="text-xs text-slate-400 mt-2">{nightCount(startDate, endDate)} malam</p>
                  )}
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xl font-black text-slate-900">{fmtDateShort(endDate)}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">{isHotel ? t.hotel.checkout : t.ends}</p>
                </div>
              </div>
            )}
          </div>

          {/* Info Chips */}
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {isFlight && baggageAllowance && <InfoRow icon="fa-briefcase" label={t.baggage} value={baggageAllowance} />}
              {isTrain && subclass && <InfoRow icon="fa-chair" label={t.classType} value={subclass} />}
              {isHotel && subclass && <InfoRow icon="fa-bed" label={t.roomType} value={subclass} />}
              {isInsurance && <InfoRow icon="fa-shield-halved" label={t.protection} value={bookingDataRaw?.coverage || 'Full Trip'} />}
              <InfoRow icon={isHotel ? 'fa-users' : 'fa-user-group'} label={isHotel ? t.guests : t.passengers} value={`${passengers.length || 1} ${t.people}`} />
              {booking.paymentType && <InfoRow icon="fa-credit-card" label={language === 'ID' ? 'Metode Bayar' : 'Payment'} value={booking.paymentType.replace('_', ' ')} />}
              {booking.paidAt && <InfoRow icon="fa-circle-check" label={language === 'ID' ? 'Dibayar' : 'Paid'} value={fmtDateShort(booking.paidAt)} />}
              <InfoRow icon="fa-calendar-days" label={t.createdAt} value={fmtDateShort(booking.createdAt)} />
              <InfoRow icon="fa-hashtag" label={t.orderNo} value={booking.id} />
            </div>
          </div>
        </div>

        {/* Passengers */}
        {passengers.length > 0 && isPaid && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <i className={`fa-solid ${isHotel ? 'fa-users' : 'fa-user-group'} text-brand-blue`}></i>
                {isHotel ? t.guestData : t.passengerData}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {passengers.map((p: any, i: number) => (
                <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-brand-blue/10 rounded-xl flex items-center justify-center text-sm font-extrabold text-brand-blue shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}</p>
                      <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        {p.pax_type === 'ADT' ? t.adult : p.pax_type === 'CHD' ? t.child : t.infant}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {isTransport && p.ticket_number && (
                      <div>
                        <p className="text-[10px] text-slate-400">E-Ticket</p>
                        <p className="text-xs font-bold text-slate-600 font-mono">{p.ticket_number}</p>
                      </div>
                    )}
                    {p.seat && (
                      <div className={p.ticket_number ? 'mt-1' : ''}>
                        <p className="text-[10px] text-slate-400">Kursi</p>
                        <span className="inline-block text-[11px] font-bold text-white bg-brand-orange px-2 py-0.5 rounded-md font-mono">
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {canDownload && (
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex-1 py-3.5 bg-gradient-to-r from-brand-orange to-orange-dark hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-glow-orange"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t.preparingDoc}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-download text-xs"></i>
                  {t.downloadPdf}
                </>
              )}
            </button>
          )}
          {canCancel && (
            <Link
              href={`/bookings/${id}/cancel`}
              className="flex-1 py-3.5 border-2 border-red-200 text-red-500 hover:bg-red-50 font-bold text-sm rounded-xl transition-all text-center"
            >
              <i className="fa-solid fa-ban text-xs mr-1.5"></i>
              {t.cancelBooking}
            </Link>
          )}
          {isTrain && isPaid && booking.orderNumber && (
            <TrainSeatPicker
              orderId={booking.id}
              providerBookings={Array.isArray(bookingDataRaw?.provider_bookings)
                ? (bookingDataRaw.provider_bookings as Array<Record<string, unknown>>)
                : []}
              passengers={passengers}
              onSaved={fetchBooking}
            />
          )}
        </div>
      </div>

      {/* PDF template (hidden) */}
      <PdfTemplate booking={booking} bType={bType} passengers={passengers} enrichedPassengers={enrichedPassengers} savedBaggage={savedBaggage} isTransport={isTransport} isFlight={isFlight} isTrain={isTrain} isHotel={isHotel} isInsurance={isInsurance}
        startDate={startDate} endDate={endDate} originCode={originCode} destCode={destCode} originName={originName} destName={destName}
        itemName={itemName} itemCode={itemCode} subclass={subclass} baggageAllowance={baggageAllowance} segmentCount={segmentCount}
        bookingDataRaw={bookingDataRaw} refundable={refundable} />
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon?: string; label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <i className={`fa-solid ${icon} text-[10px] text-brand-blue shrink-0`}></i>}
        <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{label}</p>
      </div>
      <p className="text-xs font-bold text-slate-700 truncate">{value || '-'}</p>
    </div>
  );
}
