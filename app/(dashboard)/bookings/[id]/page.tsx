'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { useLanguage } from '@/contexts/LanguageContext';
import Image from 'next/image';
import { i18n } from '@/lib/i18n';

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
function fmtDateShortPdf(d: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
function nightCount(ci: string, co: string) {
  if (!ci || !co) return 1;
  const diff = new Date(co).getTime() - new Date(ci).getTime();
  return Math.max(1, Math.round(diff / 86400000));
}

function getCountdown(createdAt: string) {
  const deadline = new Date(new Date(createdAt).getTime() + PAYMENT_TIMEOUT_MS);
  const now = Date.now();
  const remaining = deadline.getTime() - now;
  if (remaining <= 0) return { expired: true, hours: 0, minutes: 0, seconds: 0, total: 0 };
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return { expired: false, hours, minutes, seconds, total: remaining };
}

function PaymentCountdown({ createdAt }: { createdAt: string }) {
  const [cd, setCd] = useState(() => getCountdown(createdAt));

  useEffect(() => {
    const timer = setInterval(() => setCd(getCountdown(createdAt)), 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

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
        margin: 0, filename: `Dokumen_${booking.orderNumber || booking.id}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 3, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(el).save();
    } finally { setDownloading(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto"/>
        <p className="text-slate-400 text-sm">{t.loading}</p>
      </div>
    </div>
  );

  if (!booking) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
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
  const itemName = isTrain ? (booking.airlineName || 'Kereta Api') : isHotel ? (booking.hotelName || 'Hotel') : isInsurance ? (booking.hotelName || 'Asuransi') : (booking.airlineName || 'Maskapai');
  const itemCode = booking.flightNumber || '';
  const subclass = bookingDataRaw?.cabin_class || bookingDataRaw?.subclass || bookingDataRaw?.roomType || '';
  const refundable = bookingDataRaw?.refundable === true || bookingDataRaw?.is_refundable === true;
  const canCancel = isPaid && refundable;
  const st = STATUS_CONFIG[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-[800px] mx-auto h-14 flex items-center justify-between px-5">
          <Link href="/bookings" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">← {t.back}</Link>
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">{t.detail} {bType}</p>
          <div className="w-12" />
        </div>
      </nav>

      <div className="max-w-[800px] mx-auto px-5 pt-8 pb-20 space-y-4">

        {/* Payment status banner */}
        {isPending && !isExpired && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">{t.statusMap.pending_payment}</p>
                <p className="text-xs text-slate-400 mt-0.5">Selesaikan pembayaran untuk mengkonfirmasi pesanan Anda.</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${st.bg} ${st.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                {statusLabel(status)}
              </span>
            </div>
            <PaymentCountdown createdAt={booking.createdAt} />
            {checking && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                Memeriksa status pembayaran...
              </div>
            )}
            {canPay && (
              <button
                onClick={handlePayNow}
                disabled={paying}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-sm rounded-lg transition-all active:scale-[0.98]"
              >
                {paying ? 'Mengarahkan ke pembayaran...' : `${t.payNow} ${fmtIDR(booking.totalAmount)}`}
              </button>
            )}
          </div>
        )}

        {isExpired && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-red-600">Pembayaran Kedaluwarsa</p>
                <p className="text-xs text-slate-400 mt-0.5">Waktu pembayaran telah habis.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Kedaluwarsa
              </span>
            </div>
            <Link href="/" className="block w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-lg transition-all text-center active:scale-[0.98]">
              Buat Pesanan Baru
            </Link>
          </div>
        )}

        {isFailed && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-red-600">{status === 'cancelled' ? t.statusMap.cancelled : t.statusMap.payment_failed}</p>
                <p className="text-xs text-slate-400 mt-0.5">{status === 'cancelled' ? 'Pesanan ini telah dibatalkan.' : 'Pembayaran tidak berhasil diproses.'}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${st.bg} ${st.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                {statusLabel(status)}
              </span>
            </div>
          </div>
        )}

        {isPaid && (
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-800">{status === 'issued' ? 'Tiket Sudah Diterbitkan' : 'Pembayaran Terkonfirmasi'}</p>
                <p className="text-xs text-emerald-600 mt-0.5">{status === 'issued' ? 'E-tiket/voucher Anda sudah siap untuk diunduh.' : 'Pembayaran Anda sudah kami terima dan terverifikasi.'}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {statusLabel(status)}
              </span>
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Booking ID</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">{booking.orderNumber || booking.id}</p>
              {isTransport && booking.pnr && (
                <p className="text-xs text-slate-400 mt-0.5">PNR: <span className="font-bold text-slate-600">{booking.pnr}</span></p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tc.total}</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">{fmtIDR(booking.totalAmount)}</p>
            </div>
          </div>

          {/* Vendor */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isFlight && booking.provider ? (
                <img src={`/images/airlines/${booking.provider.toLowerCase()}.png`} alt={itemName} className="h-8 w-auto object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
              ) : (
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  {isTrain ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><circle cx="8" cy="19" r="2"/><circle cx="16" cy="19" r="2"/></svg>
                  ) : isHotel ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/><path d="M9 21V13h6v8"/><path d="M3 9h18"/></svg>
                  ) : isInsurance ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
                  )}
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-slate-800">{itemName}</p>
                {itemCode && <p className="text-[11px] text-slate-400">{itemCode}{subclass ? ` — ${subclass}` : ''}</p>}
              </div>
            </div>
            {isTransport && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${refundable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {refundable ? t.refundable : t.nonRefundable}
              </span>
            )}
          </div>

          {/* Route / Period */}
          <div className="px-5 py-5">
            <p className="text-xs font-semibold text-slate-400 mb-3">{isHotel || isInsurance ? t.periodBooking : fmtDate(startDate)}</p>

            {isTransport ? (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-2xl font-black text-slate-900">{fmtTime(startDate)}</p>
                  <p className="text-sm font-bold text-slate-600 mt-1">{originCode}</p>
                  <p className="text-[11px] text-slate-400">{originName}</p>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <p className="text-[11px] text-slate-400 font-semibold mb-2">{fmtDuration(startDate, endDate)}</p>
                  <div className="w-full h-px bg-slate-200 relative">
                    <div className="absolute left-0 top-[-3px] w-2 h-2 rounded-full bg-slate-800"></div>
                    <div className="absolute right-0 top-[-3px] w-2 h-2 rounded-full border-2 border-slate-800 bg-white"></div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">{segmentCount <= 1 ? t.direct : `${segmentCount - 1} Transit`}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-2xl font-black text-slate-900">{fmtTime(endDate)}</p>
                  <p className="text-sm font-bold text-slate-600 mt-1">{destCode}</p>
                  <p className="text-[11px] text-slate-400">{destName}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-lg font-black text-slate-900">{fmtDateShort(startDate)}</p>
                  <p className="text-xs font-bold text-slate-600 mt-1">{isHotel ? t.hotel.checkin : t.starts}</p>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-full h-px bg-slate-200 relative">
                    <div className="absolute left-0 top-[-3px] w-2 h-2 rounded-full bg-slate-800"></div>
                    <div className="absolute right-0 top-[-3px] w-2 h-2 rounded-full border-2 border-slate-800 bg-white"></div>
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-lg font-black text-slate-900">{fmtDateShort(endDate)}</p>
                  <p className="text-xs font-bold text-slate-600 mt-1">{isHotel ? t.hotel.checkout : t.ends}</p>
                </div>
              </div>
            )}

            {/* Info chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
              {isFlight && baggageAllowance && <InfoRow label={t.baggage} value={baggageAllowance} />}
              {isTrain && subclass && <InfoRow label={t.classType} value={subclass} />}
              {isHotel && subclass && <InfoRow label={t.roomType} value={subclass} />}
              {isInsurance && <InfoRow label={t.protection} value={bookingDataRaw?.coverage || 'Full Trip'} />}
              <InfoRow label={isHotel ? t.guests : t.passengers} value={`${passengers.length || 1} ${t.people}`} />
              <InfoRow label={t.orderNo} value={booking.id} />
            </div>
          </div>

          {/* Passengers */}
          {passengers.length > 0 && isPaid && (
            <div className="px-5 pb-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">{isHotel ? t.guestData : t.passengerData}</p>
              <div className="space-y-2">
                {passengers.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-500">{i + 1}</div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}</p>
                        <p className="text-[11px] text-slate-400">{p.pax_type === 'ADT' ? t.adult : p.pax_type === 'CHD' ? t.child : t.infant}</p>
                      </div>
                    </div>
                    {isTransport && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-semibold">E-Ticket</p>                        <p className="text-xs font-bold text-slate-600 font-mono">{p.ticket_number || booking.pnr || '-'}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {canDownload && (
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-sm rounded-lg transition-all active:scale-[0.98]"
            >
              {downloading ? t.preparingDoc : t.downloadPdf}
            </button>
          )}
          {canCancel && (
            <Link
              href={`/bookings/${id}/cancel`}
              className="flex-1 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm rounded-lg transition-all text-center"
            >
              {t.cancelBooking}
            </Link>
          )}
          {!canPay && !canDownload && !canCancel && !isExpired && !isFailed && (
            <div className="flex-1 py-3 bg-slate-50 border border-slate-200 text-slate-400 font-bold text-sm rounded-lg text-center">
              Tidak ada aksi tersedia
            </div>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
      <p className="text-[10px] text-slate-400 font-semibold uppercase">{label}</p>
      <p className="text-xs font-bold text-slate-700 mt-0.5">{value || '-'}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────── */
/* PDF TEMPLATES — Traveloka-style E-Ticket                                     */
/* ────────────────────────────────────────────────────────────────────────────── */

const DC = { primary: '#EA580C', primaryDark: '#C2410C', dark: '#111827', primaryLight: '#FFF7ED', primaryBorder: '#FED7AA', light: '#F9FAFB', border: '#E5E7EB', muted: '#6B7280', text: '#111827', white: '#FFFFFF', greenBg: '#ECFDF5', green: '#059669', greenBorder: '#A7F3D0' };

function PdfTemplate({ booking, bType, passengers, enrichedPassengers, savedBaggage, isTransport, isFlight, isTrain, isHotel, isInsurance, startDate, endDate, originCode, destCode, originName, destName, itemName, itemCode, subclass, baggageAllowance, segmentCount, bookingDataRaw, refundable }: any) {
  const { language } = useLanguage();
  const t = i18n.bookingDetail[language];
  const bookingId = booking.orderNumber || booking.id;

  const wrapper = (children: React.ReactNode) => (
    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
      <div id="ticket-print" style={{ width: '210mm', minHeight: '297mm', background: '#F3F4F6', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontSize: '13px', color: DC.text, padding: '0' }}>
        {children}
      </div>
    </div>
  );

  if (isFlight) {
    const firstSeg = bookingDataRaw?.provider_bookings?.[0]?.segments?.[0] || {};
    const lastSeg = bookingDataRaw?.provider_bookings?.[0]?.segments?.slice(-1)?.[0] || {};
    const terminal_dep = firstSeg.origin_terminal || firstSeg.terminal || '';
    const terminal_arr = lastSeg.destination_terminal || lastSeg.terminal || '';

    return wrapper(
      <>
        {/* ── BLUE CURVED HEADER ── */}
        <div style={{ background: DC.primary, padding: '32px 40px 56px', borderRadius: '0 0 32px 32px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>{isFlight ? t.eTicketFlight : t.eTicketTrain}</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: DC.white, marginTop: '6px' }}>Departure Flight</div>
            </div>
            <img src="/images/logo.png" alt="The Mafia Travel" crossOrigin="anonymous" style={{ height: '40px', width: '40px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          </div>
        </div>

        {/* ── SINGLE UNIFIED CARD ── */}
        <div style={{ margin: '-32px 28px 28px', background: DC.white, borderRadius: '16px', border: `1px solid ${DC.border}`, overflow: 'hidden', position: 'relative', zIndex: 2 }}>

          {/* Airline info bar */}
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${DC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {booking.provider && <img src={`/images/airlines/${booking.provider.toLowerCase()}.png`} alt={itemName} crossOrigin="anonymous" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} />}
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{itemName}</div>
                {subclass && <div style={{ fontSize: '12px', color: DC.muted }}>{subclass}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {booking.pnr && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.bookingCode}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: DC.primary, letterSpacing: '1px' }}>{booking.pnr}</div>
                </div>
              )}
              <div style={{ background: DC.greenBg, border: `1px solid ${DC.greenBorder}`, borderRadius: '20px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                <span style={{ fontSize: '11px', fontWeight: 700, color: DC.green, textTransform: 'uppercase', lineHeight: 1 }}>{booking.status === 'issued' ? t.statusMap.issued : t.statusMap.paid}</span>
              </div>
            </div>
          </div>

          {/* Flight route */}
          <div style={{ padding: '28px 32px', borderBottom: `1px solid ${DC.border}` }}>
            <div style={{ fontSize: '11px', color: DC.muted, fontWeight: 600, marginBottom: '4px' }}>{fmtDate(startDate)}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
              {/* Departure */}
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1 }}>{fmtTime(startDate)}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: DC.text, marginTop: '8px' }}>{originCode}</div>
                <div style={{ fontSize: '12px', color: DC.muted, marginTop: '4px' }}>{originName}</div>
                {terminal_dep && <div style={{ fontSize: '10px', color: DC.muted, marginTop: '2px' }}>{terminal_dep}</div>}
              </div>
              {/* Plane + line */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px' }}>
                <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 600, marginBottom: '8px' }}>{fmtDuration(startDate, endDate)}</div>
                <div style={{ width: '100%', position: 'relative', height: '20px' }}>
                  <div style={{ position: 'absolute', top: '9px', left: '8px', right: '8px', height: '2px', background: DC.border }}></div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={DC.primary} style={{ position: 'absolute', left: '50%', top: '0', transform: 'translateX(-50%)' }}>
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                  </svg>
                  <div style={{ position: 'absolute', left: '4px', top: '6px', width: '8px', height: '8px', borderRadius: '50%', background: DC.primary }}></div>
                  <div style={{ position: 'absolute', right: '4px', top: '6px', width: '8px', height: '8px', borderRadius: '50%', border: `2px solid ${DC.primary}`, background: DC.white }}></div>
                </div>
                <div style={{ fontSize: '10px', color: DC.muted, marginTop: '6px' }}>{segmentCount <= 1 ? t.direct : `${segmentCount - 1} Transit`}</div>
              </div>
              {/* Arrival */}
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1 }}>{fmtTime(endDate)}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: DC.text, marginTop: '8px' }}>{destCode}</div>
                <div style={{ fontSize: '12px', color: DC.muted, marginTop: '4px' }}>{destName}</div>
                {terminal_arr && <div style={{ fontSize: '10px', color: DC.muted, marginTop: '2px' }}>{terminal_arr}</div>}
              </div>
            </div>
          </div>

          {/* Booking info strip */}
          <div style={{ padding: '14px 24px', borderBottom: passengers.length > 0 ? `1px solid ${DC.border}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '32px' }}>
              {passengers[0]?.ticket_number && (
                <div>
                  <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.eTicketNo}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>{passengers[0].ticket_number}</div>
                </div>
              )}
              {baggageAllowance && (
                <div>
                  <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.baggage}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{baggageAllowance}</div>
                </div>
              )}
              {subclass && (
                <div>
                  <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.classType}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{subclass}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: refundable ? DC.green : '#DC2626' }}>{refundable ? t.refundable : t.nonRefundable}</span>
            </div>
          </div>

          {/* Important notices */}
          <div style={{ padding: '16px 24px', display: 'flex', gap: '16px', borderBottom: `1px solid ${DC.border}` }}>
            {[
              { svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="15" r="1.5" fill={DC.primary}/></svg>, title: 'Identitas', desc: t.showId },
              { svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, title: t.hotel.checkin, desc: t.checkinNotice },
              { svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>, title: 'Zona Waktu', desc: t.localTime },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: DC.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.svg}</div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: '9px', color: DC.muted, marginTop: '1px', lineHeight: 1.3 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* TABEL PENUMPANG */}
          {enrichedPassengers.length > 0 && (
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${DC.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '32px' }}>{t.no}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}` }}>{t.name}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '60px' }}>{t.type}</th>
                    {enrichedPassengers.some((p: any) => p.ticket_number || booking.pnr) && (
                      <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}` }}>{t.ticketPnr}</th>
                    )}
                    {enrichedPassengers.some((p: any) => p.seat) && (
                      <th style={{ padding: '8px 6px', textAlign: 'center', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '50px' }}>{t.flight.seat}</th>
                    )}
                    {(baggageAllowance || savedBaggage) && (
                      <th style={{ padding: '8px 6px', textAlign: 'center', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '60px' }}>{t.baggage}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {enrichedPassengers.map((p: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, color: DC.primary, borderBottom: `1px solid ${DC.border}` }}>{i + 1}</td>
                      <td style={{ padding: '10px 6px', fontWeight: 700, textTransform: 'uppercase', color: DC.dark, borderBottom: `1px solid ${DC.border}` }}>{[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}</td>
                      <td style={{ padding: '10px 6px', color: DC.muted, fontWeight: 600, borderBottom: `1px solid ${DC.border}` }}>{p.pax_type === 'ADT' ? t.adult : p.pax_type === 'CHD' ? t.child : t.infant}</td>
                      {enrichedPassengers.some((pp: any) => pp.ticket_number || booking.pnr) && (
                        <td style={{ padding: '10px 6px', color: DC.dark, fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', borderBottom: `1px solid ${DC.border}` }}>{p.ticket_number || booking.pnr || '-'}</td>
                      )}
                      {enrichedPassengers.some((pp: any) => pp.seat) && (
                        <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', fontSize: '11px', color: DC.dark, borderBottom: `1px solid ${DC.border}` }}>{p.seat || '-'}</td>
                      )}
                      {(baggageAllowance || savedBaggage) && (
                        <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: '11px', color: DC.dark, borderBottom: `1px solid ${DC.border}` }}>
                          {savedBaggage?.kg ? `${savedBaggage.kg} KG` : baggageAllowance || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{t.help24h}</div>
              <div style={{ fontSize: '12px', color: DC.muted, marginTop: '6px', lineHeight: 1.8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>0804-1500-308</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span>support@themafiatravel.com</span></div>
              </div>
              <div style={{ fontSize: '10px', color: DC.muted, marginTop: '8px', fontStyle: 'italic' }}>Tunjukkan e-ticket ini melalui smartphone Anda. Tidak perlu mencetak.</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <QRCode value={`https://themafiatravel.com/verify/${booking.id}`} size={64} style={{ padding: '4px', background: 'white', border: `1px solid ${DC.border}`, borderRadius: '8px' }} />
              <div style={{ fontSize: '8px', color: DC.muted, marginTop: '4px' }}>{t.scanVerify}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isTrain) {
    return wrapper(
      <>
        <div style={{ background: DC.primary, padding: '32px 40px 56px', borderRadius: '0 0 32px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>{isFlight ? t.eTicketFlight : t.eTicketTrain}</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: DC.white, marginTop: '6px' }}>Departure Train</div>
            </div>
            <img src="/images/logo.png" alt="The Mafia Travel" crossOrigin="anonymous" style={{ height: '40px', width: '40px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          </div>
        </div>

        {/* ── SINGLE UNIFIED CARD ── */}
        <div style={{ margin: '-32px 28px 28px', background: DC.white, borderRadius: '16px', border: `1px solid ${DC.border}`, overflow: 'hidden', position: 'relative', zIndex: 2 }}>
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${DC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DC.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><circle cx="8" cy="19" r="2"/><circle cx="16" cy="19" r="2"/><path d="M6 17l-2 4"/><path d="M18 17l2 4"/></svg>
                </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{itemName}</div>
                <div style={{ fontSize: '12px', color: DC.muted }}>{subclass || 'Ekonomi'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {booking.pnr && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.bookingCode}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: DC.primary, letterSpacing: '1px' }}>{booking.pnr}</div>
                </div>
              )}
              <div style={{ background: DC.greenBg, border: `1px solid ${DC.greenBorder}`, borderRadius: '20px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                <span style={{ fontSize: '11px', fontWeight: 700, color: DC.green, textTransform: 'uppercase', lineHeight: 1 }}>{booking.status === 'issued' ? t.statusMap.issued : t.statusMap.paid}</span>
              </div>
            </div>
          </div>

          <div style={{ padding: '28px 32px', borderBottom: `1px solid ${DC.border}` }}>
            <div style={{ fontSize: '11px', color: DC.muted, fontWeight: 600, marginBottom: '4px' }}>{fmtDate(startDate)}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1 }}>{fmtTime(startDate)}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{originCode}</div>
                <div style={{ fontSize: '12px', color: DC.muted, marginTop: '4px' }}>{originName}</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px' }}>
                <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 600, marginBottom: '8px' }}>{fmtDuration(startDate, endDate)}</div>
                <div style={{ width: '100%', position: 'relative', height: '20px' }}>
                  <div style={{ position: 'absolute', top: '9px', left: '8px', right: '8px', height: '2px', background: DC.border }}></div>
                  <div style={{ position: 'absolute', left: '4px', top: '6px', width: '8px', height: '8px', borderRadius: '50%', background: DC.primary }}></div>
                  <div style={{ position: 'absolute', right: '4px', top: '6px', width: '8px', height: '8px', borderRadius: '50%', border: `2px solid ${DC.primary}`, background: DC.white }}></div>
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1 }}>{fmtTime(endDate)}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{destCode}</div>
                <div style={{ fontSize: '12px', color: DC.muted, marginTop: '4px' }}>{destName}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 24px', display: 'flex', gap: '32px' }}>
            <div>
              <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase' }}>{t.date}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{fmtDateShortPdf(startDate)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase' }}>{t.classType}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{subclass || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase' }}>Kebijakan</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px', color: refundable ? DC.green : '#DC2626' }}>{refundable ? t.refundable : t.nonRefundable}</div>
            </div>
          </div>

          {/* TABEL PENUMPANG */}
          {enrichedPassengers.length > 0 && (
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${DC.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '32px' }}>{t.no}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}` }}>{t.name}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '60px' }}>{t.type}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}` }}>{t.ticketPnr}</th>
                    {subclass && (
                      <th style={{ padding: '8px 6px', textAlign: 'center', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '60px' }}>{t.classType}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {enrichedPassengers.map((p: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, color: DC.primary, borderBottom: `1px solid ${DC.border}` }}>{i + 1}</td>
                      <td style={{ padding: '10px 6px', fontWeight: 700, textTransform: 'uppercase', color: DC.dark, borderBottom: `1px solid ${DC.border}` }}>{[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}</td>
                      <td style={{ padding: '10px 6px', color: DC.muted, fontWeight: 600, borderBottom: `1px solid ${DC.border}` }}>{p.pax_type === 'ADT' ? t.adult : p.pax_type === 'CHD' ? t.child : t.infant}</td>
                      <td style={{ padding: '10px 6px', color: DC.dark, fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', borderBottom: `1px solid ${DC.border}` }}>{p.ticket_number || booking.pnr || '-'}</td>
                      {subclass && (
                        <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: '11px', color: DC.dark, borderBottom: `1px solid ${DC.border}` }}>{subclass}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ padding: '20px 24px', borderTop: `1px solid ${DC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{t.help24h}</div>
              <div style={{ fontSize: '12px', color: DC.muted, marginTop: '6px', lineHeight: 1.8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>0804-1500-308</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span>support@themafiatravel.com</span></div>
              </div>
              <div style={{ fontSize: '10px', color: DC.muted, marginTop: '8px', fontStyle: 'italic' }}>Tunjukkan e-ticket ini melalui smartphone Anda. Tidak perlu mencetak.</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <QRCode value={`https://themafiatravel.com/verify/${booking.id}`} size={64} style={{ padding: '4px', background: 'white', border: `1px solid ${DC.border}`, borderRadius: '8px' }} />
              <div style={{ fontSize: '8px', color: DC.muted, marginTop: '4px' }}>{t.scanVerify}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isHotel) {
    const nights = nightCount(booking.checkinDate, booking.checkoutDate);
    return wrapper(
      <>
        <div style={{ background: DC.primary, padding: '32px 40px 56px', borderRadius: '0 0 32px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>{t.voucherHotel}</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: DC.white, marginTop: '6px' }}>Hotel Reservation</div>
            </div>
            <img src="/images/logo.png" alt="The Mafia Travel" crossOrigin="anonymous" style={{ height: '40px', width: '40px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          </div>
        </div>

        {/* ── SINGLE UNIFIED CARD ── */}
        <div style={{ margin: '-32px 28px 28px', background: DC.white, borderRadius: '16px', border: `1px solid ${DC.border}`, overflow: 'hidden', position: 'relative', zIndex: 2 }}>
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${DC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DC.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/><path d="M9 21V13h6v8"/><path d="M3 9h18"/></svg>
                </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{itemName}</div>
                <div style={{ fontSize: '12px', color: DC.muted }}>{subclass || 'Standard Room'}</div>
              </div>
            </div>
            <div style={{ background: DC.greenBg, border: `1px solid ${DC.greenBorder}`, borderRadius: '20px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              <span style={{ fontSize: '11px', fontWeight: 700, color: DC.green, textTransform: 'uppercase', lineHeight: 1 }}>{t.statusMap.paid}</span>
            </div>
          </div>

          <div style={{ padding: '28px 32px', borderBottom: `1px solid ${DC.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center', minWidth: '120px' }}>
                <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.hotel.checkin}</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{fmtDateShortPdf(booking.checkinDate)}</div>
                <div style={{ fontSize: '11px', color: DC.muted, marginTop: '4px' }}>Mulai pukul 14:00</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: DC.primary }}>{nights}</div>
                <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 600 }}>{t.hotel.night}</div>
                <div style={{ width: '100%', position: 'relative', height: '20px', marginTop: '4px' }}>
                  <div style={{ position: 'absolute', top: '9px', left: '8px', right: '8px', height: '2px', background: DC.border }}></div>
                  <div style={{ position: 'absolute', left: '4px', top: '6px', width: '8px', height: '8px', borderRadius: '50%', background: DC.primary }}></div>
                  <div style={{ position: 'absolute', right: '4px', top: '6px', width: '8px', height: '8px', borderRadius: '50%', border: `2px solid ${DC.primary}`, background: DC.white }}></div>
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: '120px' }}>
                <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.hotel.checkout}</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{fmtDateShortPdf(booking.checkoutDate)}</div>
                <div style={{ fontSize: '11px', color: DC.muted, marginTop: '4px' }}>Sebelum pukul 12:00</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 24px', borderBottom: `1px solid ${DC.border}`, display: 'flex', gap: '32px' }}>
            <div>
              <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase' }}>{t.hotel.guest}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{passengers.length || 1} {t.people}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase' }}>{t.totalAmount}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{fmtIDR(booking.totalAmount)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase' }}>{t.orderNo}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>{booking.id}</div>
            </div>
          </div>

          {/* Notice */}
          <div style={{ padding: '14px 24px', background: DC.greenBg, borderBottom: `1px solid ${DC.border}` }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#065F46' }}>Mohon simpan dokumen ini sebagai bukti voucher hotel Anda. Tunjukkan saat check-in.</div>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{t.help24h}</div>
              <div style={{ fontSize: '12px', color: DC.muted, marginTop: '6px', lineHeight: 1.8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>0804-1500-308</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span>support@themafiatravel.com</span></div>
              </div>
              <div style={{ fontSize: '10px', color: DC.muted, marginTop: '8px', fontStyle: 'italic' }}>Tunjukkan voucher ini melalui smartphone Anda. Tidak perlu mencetak.</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <QRCode value={`https://themafiatravel.com/verify/${booking.id}`} size={64} style={{ padding: '4px', background: 'white', border: `1px solid ${DC.border}`, borderRadius: '8px' }} />
              <div style={{ fontSize: '8px', color: DC.muted, marginTop: '4px' }}>{t.scanVerify}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Insurance
  return wrapper(
    <>
      <div style={{ background: DC.primary, padding: '32px 40px 56px', borderRadius: '0 0 32px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>{t.policyInsurance}</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: DC.white, marginTop: '6px' }}>Travel Insurance</div>
          </div>
          <img src="/images/logo.png" alt="The Mafia Travel" crossOrigin="anonymous" style={{ height: '40px', width: '40px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
      </div>

      {/* ── SINGLE UNIFIED CARD ── */}
      <div style={{ margin: '-32px 28px 28px', background: DC.white, borderRadius: '16px', border: `1px solid ${DC.border}`, overflow: 'hidden', position: 'relative', zIndex: 2 }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${DC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DC.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{itemName}</div>
              <div style={{ fontSize: '12px', color: DC.muted }}>{bookingDataRaw?.coverage || 'Full Trip Protection'}</div>
            </div>
          </div>
          <div style={{ background: DC.greenBg, border: `1px solid ${DC.greenBorder}`, borderRadius: '20px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            <span style={{ fontSize: '11px', fontWeight: 700, color: DC.green, textTransform: 'uppercase', lineHeight: 1 }}>Active</span>
          </div>
        </div>

        <div style={{ padding: '28px 32px', borderBottom: `1px solid ${DC.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'center', minWidth: '140px' }}>
              <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tanggal Mulai</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '8px' }}>{fmtDateShortPdf(booking.checkinDate || startDate)}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px' }}>
              <div style={{ width: '100%', position: 'relative', height: '20px' }}>
                <div style={{ position: 'absolute', top: '9px', left: '8px', right: '8px', height: '2px', background: DC.border }}></div>
                <div style={{ position: 'absolute', left: '4px', top: '6px', width: '8px', height: '8px', borderRadius: '50%', background: DC.primary }}></div>
                <div style={{ position: 'absolute', right: '4px', top: '6px', width: '8px', height: '8px', borderRadius: '50%', border: `2px solid ${DC.primary}`, background: DC.white }}></div>
              </div>
            </div>
            <div style={{ textAlign: 'center', minWidth: '140px' }}>
              <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tanggal Berakhir</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '8px' }}>{fmtDateShortPdf(booking.checkoutDate || endDate)}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderBottom: `1px solid ${DC.border}`, display: 'flex', gap: '32px' }}>
          <div>
            <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase' }}>{t.insurance.insured}</div>
            <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{passengers.length || 1} {t.people}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase' }}>Total Premi</div>
            <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{fmtIDR(booking.totalAmount)}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: DC.muted, fontWeight: 600, textTransform: 'uppercase' }}>No. Polis</div>
            <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>{booking.id}</div>
          </div>
        </div>

        {/* Notice */}
        <div style={{ padding: '14px 24px', background: DC.primaryLight, borderBottom: `1px solid ${DC.border}` }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A3412' }}>Simpan dokumen ini sebagai bukti polis asuransi Anda. Untuk klaim, hubungi layanan bantuan 24 jam kami.</div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{t.help24h}</div>
            <div style={{ fontSize: '12px', color: DC.muted, marginTop: '6px', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>0804-1500-308</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span>support@themafiatravel.com</span></div>
            </div>
            <div style={{ fontSize: '10px', color: DC.muted, marginTop: '8px', fontStyle: 'italic' }}>Tunjukkan dokumen ini melalui smartphone Anda. Tidak perlu mencetak.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <QRCode value={`https://themafiatravel.com/verify/${booking.id}`} size={64} style={{ padding: '4px', background: 'white', border: `1px solid ${DC.border}`, borderRadius: '8px' }} />
            <div style={{ fontSize: '8px', color: DC.muted, marginTop: '4px' }}>Scan untuk verifikasi</div>
          </div>
        </div>
      </div>
    </>
  );
}
