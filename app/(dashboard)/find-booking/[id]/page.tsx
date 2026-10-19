'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { CARRIER_CODE_TO_AIRLINE, PROVIDER_ID_TO_LABEL } from '@/lib/providers';
import Footer from '@/components/layout/Footer';
import TrainSeatPicker from '@/components/train/TrainSeatPicker';
import { PdfTemplate } from '@/components/ticket/PdfTemplate';

const PAYMENT_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function resolveAirlineName(airlineName: string, provider: string): string {
  const name = (airlineName || '').trim().toUpperCase();
  if (CARRIER_CODE_TO_AIRLINE[name]) return CARRIER_CODE_TO_AIRLINE[name];
  const prov = (provider || '').trim().toLowerCase();
  if (PROVIDER_ID_TO_LABEL[prov]) return PROVIDER_ID_TO_LABEL[prov];
  return airlineName || provider || '';
}

function getCountdown(createdAt: string) {
  if (!createdAt) return { expired: true, hours: 0, minutes: 0, seconds: 0 };
  const created = new Date(createdAt).getTime();
  const deadline = created + PAYMENT_TIMEOUT_MS;
  const remaining = deadline - Date.now();
  if (remaining <= 0) return { expired: true, hours: 0, minutes: 0, seconds: 0 };
  return {
    expired: false,
    hours: Math.floor(remaining / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
  };
}

function GuestBookingDetailContent() {
  const { language } = useLanguage();
  const isEN = language === 'EN';
  const searchParams = useSearchParams();

  const orderNumber = searchParams.get('orderNumber') || '';
  const phone = searchParams.get('phone') || '';

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [countdown, setCountdown] = useState({ expired: true, hours: 0, minutes: 0, seconds: 0 });
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    await Promise.resolve();
    if (!orderNumber || !phone) {
      setError(isEN ? 'Invalid access. Please search again.' : 'Akses tidak valid. Silakan cari ulang.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/booking/guest-detail?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || (isEN ? 'Booking not found.' : 'Pesanan tidak ditemukan.'));
      } else {
        setBooking(data.booking);
      }
    } catch {
      setError(isEN ? 'Failed to connect to server.' : 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [orderNumber, phone, isEN]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Auto-check payment status
  useEffect(() => {
    if (!booking || booking.status !== 'pending_payment' || !orderNumber || !phone) return;

    const checkPayment = async () => {
      try {
        setCheckingPayment(true);
        const res = await fetch(`/api/booking/guest-check-payment?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (data.success && data.updated) {
          setBooking((prev: any) => prev ? { ...prev, status: data.status } : prev);
        }
      } catch {
        // silent fail
      } finally {
        setCheckingPayment(false);
      }
    };

    checkPayment();
    const interval = setInterval(checkPayment, 10000);
    return () => clearInterval(interval);
  }, [booking?.status, orderNumber, phone]);

  // Countdown timer
  useEffect(() => {
    if (!booking || booking.status !== 'pending_payment' || !booking.createdAt) return;

    setCountdown(getCountdown(booking.createdAt));
    const timer = setInterval(() => setCountdown(getCountdown(booking.createdAt)), 1000);
    return () => clearInterval(timer);
  }, [booking?.status, booking?.createdAt]);

  const handlePayNow = async () => {
    if (!booking) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/booking/guest-check-payment?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data.snapToken) {
        const snapUrl = `https://app.sandbox.midtrans.com/snap/v2/embedded/${data.snapToken}`;
        window.location.href = data.snapRedirectUrl || snapUrl;
      } else if (data.snapRedirectUrl) {
        window.location.href = data.snapRedirectUrl;
      }
    } catch {
      // redirect fallback
    } finally {
      setPaying(false);
    }
  };

  const fmtIDR = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '--';
  const fmtDateShort = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';
  const fmtTime = (d: string) => d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const statusConfig: Record<string, { text: string; color: string; icon: string }> = {
    pending_payment: { text: isEN ? 'Awaiting Payment' : 'Menunggu Pembayaran', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'fa-clock' },
    paid:            { text: isEN ? 'Paid' : 'Dibayar', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'fa-check-circle' },
    confirmed:       { text: isEN ? 'Confirmed' : 'Terkonfirmasi', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'fa-check-circle' },
    processing:      { text: isEN ? 'Processing' : 'Diproses', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: 'fa-spinner' },
    issued:          { text: isEN ? 'Issued' : 'Issued', color: 'bg-green-100 text-green-700 border-green-200', icon: 'fa-ticket' },
    completed:       { text: isEN ? 'Completed' : 'Selesai', color: 'bg-green-100 text-green-700 border-green-200', icon: 'fa-check-double' },
    cancelled:       { text: isEN ? 'Cancelled' : 'Dibatalkan', color: 'bg-red-100 text-red-700 border-red-200', icon: 'fa-times-circle' },
    payment_failed:  { text: isEN ? 'Payment Failed' : 'Pembayaran Gagal', color: 'bg-red-100 text-red-700 border-red-200', icon: 'fa-xmark' },
  };

  const st = statusConfig[booking?.status] || { text: booking?.status || '--', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'fa-circle-info' };

  const airlineName = resolveAirlineName(booking?.airlineName || '', booking?.provider || '');
  const cabinClass = booking?.cabinClass || '';
  const cabinLabel = cabinClass === 'Y' ? 'Economy' : cabinClass === 'C' ? 'Business' : cabinClass === 'F' ? 'First Class' : cabinClass || '';
  const airlineLogo = booking?.provider ? `/images/airlines/${booking.provider.toLowerCase()}.png` : '';

  const isPending = booking?.status === 'pending_payment';
  const isExpired = isPending && countdown.expired;

  // Journeys train (KAI) — subset aman tanpa harga, dipakai tampilan/ubah kursi.
  const providerBookings = Array.isArray(booking?.providerBookings)
    ? (booking.providerBookings as Array<Record<string, unknown>>)
    : [];

  // Kursi train hasil assign otomatis ada di journeys[].seats[].
  const seatMapByPax: Record<number, string> = {};
  providerBookings.forEach((pb) => {
    const journeys = Array.isArray(pb.journeys) ? (pb.journeys as unknown[]) : [];
    journeys.forEach((jRaw) => {
      const j = jRaw as Record<string, unknown>;
      const seats = Array.isArray(j.seats) ? (j.seats as unknown[]) : [];
      seats.forEach((sRaw) => {
        const s = sRaw as Record<string, unknown>;
        const pn = Number(s.passenger_sequence);
        if (pn && (s.seat || s.seat_code)) seatMapByPax[pn] = String(s.seat || `Kursi ${s.seat_code}`);
      });
    });
  });

  type PassengerRow = { name?: string; type?: string; nationality?: string | null; seat?: string | null };
  const rawPassengers = Array.isArray(booking?.passengers) ? (booking.passengers as PassengerRow[]) : [];
  const displayPassengers = rawPassengers.map((p, i) => {
    const seat = p.seat || seatMapByPax[i + 1] || null;
    return seat ? { ...p, seat } : p;
  });

  const isTrainPaid = booking?.bookingType === 'train' && (booking?.status === 'paid' || booking?.status === 'issued');

  // ── Props untuk template PDF (disamakan dengan halaman pesanan login) ──
  const bType = booking?.bookingType || 'flight';
  const isFlight = bType === 'flight';
  const isTrain = bType === 'train';
  const isHotel = bType === 'hotel';
  const isInsurance = bType === 'insurance';
  const isTransport = isFlight || isTrain;
  const canDownload = booking?.status === 'paid' || booking?.status === 'issued';

  // Booking "mentah" untuk template: field yang dipakai PdfTemplate.
  const pdfBooking = booking ? {
    id: booking.id,
    orderNumber: booking.orderNumber,
    bookingType: booking.bookingType,
    status: booking.status,
    pnr: booking.pnr,
    provider: booking.provider,
    airlineName: booking.airlineName,
    hotelName: booking.hotelName || null,
    totalAmount: booking.totalAmount,
    origin: booking.origin,
    destination: booking.destination,
    departureDate: booking.departureDate,
    arrivalDate: booking.arrivalDate || null,
    checkinDate: booking.checkinDate || null,
    checkoutDate: booking.checkoutDate || null,
  } : null;

  const flightSegments = Array.isArray(booking?.flightSegments) ? booking.flightSegments : [];
  const firstSeg = flightSegments[0] || {};
  const lastSeg = flightSegments[flightSegments.length - 1] || {};

  // bookingDataRaw tiruan untuk kebutuhan template (bagasi, cabin, coverage).
  const bookingDataRaw = booking ? {
    provider_bookings: flightSegments.length > 0 ? [{ segments: flightSegments }] : [],
    selectedBaggage: booking.selectedBaggage || null,
    cabin_class: booking.cabinClass || '',
    coverage: booking.coverage || null,
  } : null;

  const pdfStartDate = booking?.departureDate || booking?.checkinDate || null;
  const pdfEndDate = booking?.arrivalDate || booking?.checkoutDate || pdfStartDate;
  const originDisplayName = firstSeg.origin_name || '';
  const destDisplayName = lastSeg.destination_name || '';
  const pdfOriginName = originDisplayName || booking?.origin || '';
  const pdfDestName = destDisplayName || booking?.destination || '';
  const baggageAllowance = firstSeg.baggage_allowance || '';
  const segmentCount = flightSegments.length || 1;
  const pdfItemName = isTrain
    ? (airlineName || (isEN ? 'Train' : 'Kereta Api'))
    : isHotel
      ? (booking?.hotelName || (isEN ? 'Hotel' : 'Hotel'))
      : isInsurance
        ? (booking?.hotelName || (isEN ? 'Insurance' : 'Asuransi'))
        : (airlineName || (isEN ? 'Airline' : 'Maskapai'));
  const pdfSubclass = booking?.cabinClass || '';
  const pdfRefundable = booking?.refundable === true;

  const handleDownloadPDF = async () => {
    const el = document.getElementById('ticket-print');
    if (!el) return;
    setDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [0, 0, 0, 0],
        filename: `TMT_${booking.orderNumber || booking.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 4, useCORS: true, backgroundColor: '#ffffff', letterRendering: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(el).save();
    } finally { setDownloading(false); }
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col">
      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 pt-28 pb-12 px-4">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-2xl font-black text-white mb-1">
            {isEN ? 'Booking Details' : 'Detail Pesanan'}
          </h1>
          <p className="text-orange-100 text-sm">
            {isEN ? 'Here are your booking details' : 'Berikut rincian pesananmu'}
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-6 flex-1 w-full mb-16">
        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">{isEN ? 'Loading...' : 'Memuat...'}</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-circle-exclamation text-red-500 text-xl"></i>
            </div>
            <p className="text-red-600 font-semibold text-sm mb-4">{error}</p>
            <Link
              href="/find-booking"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all text-sm"
            >
              <i className="fa-solid fa-magnifying-glass text-xs"></i>
              {isEN ? 'Search Again' : 'Cari Ulang'}
            </Link>
          </div>
        )}

        {booking && (
          <>
            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-3">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-lg font-black text-slate-900 tracking-wider">{booking.orderNumber}</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${st.color}`}>
                    <i className={`fa-solid ${st.icon} mr-1`}></i>{st.text}
                  </span>
                </div>
                {booking.pnr && (
                  <p className="text-xs text-slate-500">PNR: <span className="font-mono font-bold text-slate-700">{booking.pnr}</span></p>
                )}
              </div>
            </div>

            {/* Email notice — pembayaran sukses */}
            {(booking.status === 'paid' || booking.status === 'issued') && (
              <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 overflow-hidden mb-3">
                <div className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-envelope text-emerald-500 text-sm"></i>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    {isEN
                      ? `We have sent your payment confirmation and order code to ${booking.bookerEmail || 'your email'}. Please check your inbox (or spam folder).`
                      : `Konfirmasi pembayaran dan kode pesanan sudah kami kirim ke ${booking.bookerEmail || 'email Anda'}. Silakan cek inbox (atau folder spam).`}
                  </p>
                </div>
              </div>
            )}

            {/* Payment Pending Banner */}
            {isPending && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-3">
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isExpired ? 'bg-red-100' : 'bg-amber-100'}`}>
                      <i className={`fa-solid ${isExpired ? 'fa-circle-xmark text-red-500' : 'fa-clock text-amber-600'}`}></i>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${isExpired ? 'text-red-600' : 'text-slate-800'}`}>
                        {isExpired
                          ? (isEN ? 'Payment Expired' : 'Pembayaran Kedaluwarsa')
                          : (isEN ? 'Complete Your Payment' : 'Selesaikan Pembayaran Anda')
                        }
                      </p>
                      <p className="text-xs text-slate-400">
                        {isExpired
                          ? (isEN ? 'Payment time has run out' : 'Waktu pembayaran telah habis')
                          : (isEN ? 'Complete payment to confirm your booking' : 'Selesaikan pembayaran untuk mengkonfirmasi pesanan')
                        }
                      </p>
                    </div>
                  </div>

                  {!isExpired && (
                    <>
                      {/* Countdown */}
                      <div className="flex items-center justify-center gap-4 mb-4 py-3 bg-amber-50 rounded-xl">
                        <div className="text-center">
                          <p className="text-2xl font-black text-amber-700 font-mono">{String(countdown.hours).padStart(2, '0')}</p>
                          <p className="text-[10px] text-amber-500 font-semibold">{isEN ? 'Hours' : 'Jam'}</p>
                        </div>
                        <p className="text-2xl font-black text-amber-400">:</p>
                        <div className="text-center">
                          <p className="text-2xl font-black text-amber-700 font-mono">{String(countdown.minutes).padStart(2, '0')}</p>
                          <p className="text-[10px] text-amber-500 font-semibold">{isEN ? 'Minutes' : 'Menit'}</p>
                        </div>
                        <p className="text-2xl font-black text-amber-400">:</p>
                        <div className="text-center">
                          <p className="text-2xl font-black text-amber-700 font-mono">{String(countdown.seconds).padStart(2, '0')}</p>
                          <p className="text-[10px] text-amber-500 font-semibold">{isEN ? 'Seconds' : 'Detik'}</p>
                        </div>
                      </div>

                      {/* Pay Now Button */}
                      <button
                        onClick={handlePayNow}
                        disabled={paying}
                        className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        {paying ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{isEN ? 'Redirecting...' : 'Mengarahkan...'}</>
                        ) : (
                          <><i className="fa-solid fa-credit-card text-xs"></i>{isEN ? 'Pay Now' : 'Bayar Sekarang'} {fmtIDR(booking.totalAmount)}</>
                        )}
                      </button>
                    </>
                  )}

                  {isExpired && (
                    <Link
                      href="/"
                      className="block w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all text-center"
                    >
                      {isEN ? 'Create New Booking' : 'Buat Pesanan Baru'}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Flight Card */}
            {booking.bookingType === 'flight' && (booking.origin || booking.flightNumber) && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-3">
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm overflow-hidden">
                      {airlineLogo ? (
                        <img
                          src={airlineLogo}
                          alt={airlineName}
                          className="w-7 h-7 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <i className="fa-solid fa-plane text-orange-500 text-sm"></i>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{airlineName || (isEN ? 'Airline' : 'Maskapai')}</p>
                      {booking.flightNumber && (
                        <p className="text-[10px] text-slate-400 font-semibold">{booking.flightNumber}{cabinLabel ? ` · ${cabinLabel}` : ''}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="text-center">
                      <p className="text-xl font-black text-slate-900">{fmtTime(booking.departureDate)}</p>
                      <p className="text-xs font-bold text-slate-500 mt-0.5">{booking.origin}</p>
                      {booking.departureDate && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{fmtDateShort(booking.departureDate)}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-center flex-1 px-3">
                      {booking.departureDate && booking.arrivalDate && (
                        <p className="text-[10px] text-slate-400 font-semibold mb-1">
                          {(() => {
                            const diff = new Date(booking.arrivalDate).getTime() - new Date(booking.departureDate).getTime();
                            const h = Math.floor(diff / 3600000);
                            const m = Math.floor((diff % 3600000) / 60000);
                            return h > 0 ? `${h}j ${m}m` : `${m}m`;
                          })()}
                        </p>
                      )}
                      <div className="w-full flex items-center gap-1">
                        <div className="flex-1 h-px bg-slate-300"></div>
                        <i className="fa-solid fa-plane text-orange-500 text-[10px]"></i>
                        <div className="flex-1 h-px bg-slate-300"></div>
                      </div>
                      <p className="text-[10px] text-emerald-600 font-bold mt-1">
                        {isEN ? 'Direct' : 'Langsung'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black text-slate-900">
                        {booking.arrivalDate ? fmtTime(booking.arrivalDate) : '--:--'}
                      </p>
                      <p className="text-xs font-bold text-slate-500 mt-0.5">{booking.destination}</p>
                      {booking.arrivalDate && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{fmtDateShort(booking.arrivalDate)}</p>
                      )}
                    </div>
                  </div>

                  {booking.selectedBaggage && (() => {
                    const bag = booking.selectedBaggage;
                    const items: string[] = [];
                    if (bag.adult) items.push(`${isEN ? 'Adult' : 'Dewasa'}: ${bag.adult}kg`);
                    if (bag.child) items.push(`${isEN ? 'Child' : 'Anak'}: ${bag.child}kg`);
                    if (bag.infant) items.push(`${isEN ? 'Infant' : 'Bayi'}: ${bag.infant}kg`);
                    if (items.length === 0 && bag.kg) items.push(`${bag.kg}kg`);
                    if (items.length === 0) return null;
                    return (
                      <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2">
                        <i className="fa-solid fa-suitcase text-slate-400 text-xs"></i>
                        <p className="text-xs text-slate-600">{isEN ? 'Baggage' : 'Bagasi'}: <span className="font-bold">{items.join(' · ')}</span></p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Passengers + Seats */}
            {displayPassengers.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-3">
                <div className="p-5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    {isEN ? 'Passengers & Seats' : 'Penumpang & Kursi'}
                  </h3>
                  <div className="space-y-2">
                    {displayPassengers.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-xs font-bold text-orange-600">
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{p.name}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">
                              {p.type === 'ADT' ? (isEN ? 'Adult' : 'Dewasa') : p.type === 'CHD' ? (isEN ? 'Child' : 'Anak') : (isEN ? 'Infant' : 'Bayi')}
                              {p.nationality ? ` · ${p.nationality}` : ''}
                            </p>
                          </div>
                        </div>
                        {p.seat && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400">{isEN ? 'Seat' : 'Kursi'}</p>
                            <p className="text-sm font-black text-orange-500 font-mono">{p.seat}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Price Summary */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-3">
              <div className="p-5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  {isEN ? 'Price Summary' : 'Ringkasan Harga'}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>{isEN ? 'Route' : 'Rute'}</span>
                    <span className="font-semibold">{booking.origin} → {booking.destination}</span>
                  </div>
                  {booking.departureDate && (
                    <div className="flex justify-between text-slate-600">
                      <span>{isEN ? 'Date' : 'Tanggal'}</span>
                      <span className="font-semibold">{fmtDate(booking.departureDate)}</span>
                    </div>
                  )}
                  {booking.flightNumber && (
                    <div className="flex justify-between text-slate-600">
                      <span>{isEN ? 'Flight' : 'Penerbangan'}</span>
                      <span className="font-semibold">{airlineName} {booking.flightNumber}</span>
                    </div>
                  )}
                  {cabinLabel && (
                    <div className="flex justify-between text-slate-600">
                      <span>{isEN ? 'Class' : 'Kelas'}</span>
                      <span className="font-semibold">{cabinLabel}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>{isEN ? 'Passengers' : 'Penumpang'}</span>
                    <span className="font-semibold">{booking.passengers?.length || 0} {isEN ? 'person' : 'orang'}</span>
                  </div>
                  {booking.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>{isEN ? 'Discount' : 'Diskon'}</span>
                      <span className="font-semibold">-{fmtIDR(booking.discountAmount)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between items-center">
                    <span className="font-bold text-slate-800">{isEN ? 'Total' : 'Total'}</span>
                    <span className="font-black text-orange-600 text-lg">{fmtIDR(booking.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Booker Info */}
            {booking.bookerName && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-3">
                <div className="p-5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    {isEN ? 'Booker Information' : 'Informasi Pemesan'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>{isEN ? 'Name' : 'Nama'}</span>
                      <span className="font-semibold">{booking.bookerName}</span>
                    </div>
                    {booking.bookerEmail && (
                      <div className="flex justify-between text-slate-600">
                        <span>Email</span>
                        <span className="font-semibold">{booking.bookerEmail}</span>
                      </div>
                    )}
                    {booking.bookerPhone && (
                      <div className="flex justify-between text-slate-600">
                        <span>{isEN ? 'Phone' : 'Telepon'}</span>
                        <span className="font-semibold">{booking.bookerPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {canDownload && (
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {downloading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{isEN ? 'Preparing...' : 'Menyiapkan...'}</>
                  ) : (
                    <><i className="fa-solid fa-file-pdf text-xs"></i>{isEN ? 'Download Ticket (PDF)' : 'Unduh Tiket (PDF)'}</>
                  )}
                </button>
              )}
              {isTrainPaid && booking.id && providerBookings.length > 0 && (
                <TrainSeatPicker
                  orderId={booking.id}
                  providerBookings={providerBookings}
                  passengers={rawPassengers.map((p) => ({ pax_type: p.type || 'ADT' }))}
                  bookerEmail={booking.bookerEmail || undefined}
                  orderNumber={orderNumber}
                  phone={phone}
                  onSaved={load}
                />
              )}
              <Link
                href="/find-booking"
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
                {isEN ? 'New Search' : 'Cari Lagi'}
              </Link>
              <Link
                href="/"
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm"
              >
                {isEN ? 'Home' : 'Beranda'}
              </Link>
            </div>
          </>
        )}

        {/* PDF template (hidden) — dirender off-screen lalu di-capture html2pdf.js */}
        {booking && pdfBooking && (
          <PdfTemplate
            booking={pdfBooking}
            bType={bType}
            passengers={displayPassengers}
            enrichedPassengers={displayPassengers}
            savedBaggage={booking.selectedBaggage || null}
            isTransport={isTransport}
            isFlight={isFlight}
            isTrain={isTrain}
            isHotel={isHotel}
            isInsurance={isInsurance}
            startDate={pdfStartDate}
            endDate={pdfEndDate}
            originCode={booking.origin || ''}
            destCode={booking.destination || ''}
            originName={pdfOriginName}
            destName={pdfDestName}
            itemName={pdfItemName}
            itemCode={booking.flightNumber || ''}
            subclass={pdfSubclass}
            baggageAllowance={baggageAllowance}
            segmentCount={segmentCount}
            bookingDataRaw={bookingDataRaw}
            refundable={pdfRefundable}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}

export default function GuestBookingDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    }>
      <GuestBookingDetailContent />
    </Suspense>
  );
}
