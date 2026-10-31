'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { GUEST_BOOKING_CREDS_KEY, getBookingStatusMeta } from '@/lib/booking-meta';
import { CARRIER_CODE_TO_AIRLINE, PROVIDER_ID_TO_LABEL } from '@/lib/providers';
import Footer from '@/components/layout/Footer';
import TrainSeatPicker from '@/components/train/TrainSeatPicker';
import { downloadTicketPdf } from '@/lib/download-ticket';

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
  const t = i18n.findBooking[language];
  const searchParams = useSearchParams();

  // Kredensial tamu: utama dari sessionStorage (halaman cari menyimpannya
  // sebelum navigasi — no. HP tidak pernah dibawa lewat URL). Fallback param
  // URL lama (orderNumber&phone) agar link lawas tetap terbuka.
  const urlOrderNumber = (searchParams.get('orderNumber') || '').replace(/\s+/g, '');
  const urlPhone = searchParams.get('phone') || '';
  const [creds, setCreds] = useState<{ orderNumber: string; phone: string } | null>(
    urlOrderNumber && urlPhone ? { orderNumber: urlOrderNumber, phone: urlPhone } : null
  );
  const [credsReady, setCredsReady] = useState<boolean>(Boolean(urlOrderNumber && urlPhone));

  const orderNumber = creds?.orderNumber || '';
  const phone = creds?.phone || '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload guest-detail tidak punya skema ketat; field dibaca sesuai kebutuhan
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [, setCountdownTick] = useState(0); // pemaksa re-render tiap detik (countdown diturunkan saat render)
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  // Ambil kredensial dari sessionStorage bila tidak ada di URL — jalur normal
  // dari halaman cari. Ditunda lewat timer agar tidak ada setState sinkron di
  // effect (initial render tetap "loading" → aman hydration); selama belum
  // siap, load() menunggu lewat guard credsReady.
  useEffect(() => {
    if (credsReady) return;
    const timer = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(GUEST_BOOKING_CREDS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { orderNumber?: unknown; phone?: unknown };
          if (typeof parsed.orderNumber === 'string' && typeof parsed.phone === 'string' && parsed.orderNumber && parsed.phone) {
            setCreds({ orderNumber: parsed.orderNumber, phone: parsed.phone });
          }
        }
      } catch { /* storage tidak tersedia / rusak — abaikan */ }
      setCredsReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [credsReady]);

  const load = useCallback(async () => {
    if (!credsReady) return; // kredensial belum siap — biarkan tetap loading
    await Promise.resolve();
    if (!orderNumber || !phone) {
      setError(isEN ? 'Invalid access. Please search again.' : 'Akses tidak valid. Silakan cari ulang.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/booking/guest-detail?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`, {
        headers: { 'Accept-Language': language },
      });
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
  }, [credsReady, orderNumber, phone, isEN]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Auto-check payment status
  useEffect(() => {
    if (!booking || booking.status !== 'pending_payment' || !orderNumber || !phone) return;

    const checkPayment = async () => {
      try {
        const res = await fetch(`/api/booking/guest-check-payment?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`, {
        headers: { 'Accept-Language': language },
      });
        const data = await res.json();
        if (data.success && data.updated) {
          setBooking((prev: Record<string, unknown> | null) => (prev ? { ...prev, status: data.status } : prev));
        }
      } catch {
        // silent fail
      }
    };

    checkPayment();
    const interval = setInterval(checkPayment, 10000);
    return () => clearInterval(interval);
  }, [booking?.status, orderNumber, phone]);

  // Tick per detik selama menunggu pembayaran — nilai countdown diturunkan
  // saat render, jadi effect ini cukup memicu re-render (tanpa setState sinkron).
  useEffect(() => {
    if (!booking || booking.status !== 'pending_payment' || !booking.createdAt) return;
    const timer = setInterval(() => setCountdownTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [booking]);

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

  // Label+style status dari helper bersama (lib/booking-meta) — teks dari i18n.
  const st = getBookingStatusMeta(booking?.status || '', t);

  const airlineName = resolveAirlineName(booking?.airlineName || '', booking?.provider || '');
  const cabinClass = booking?.cabinClass || '';
  const cabinLabel = cabinClass === 'Y' ? 'Economy' : cabinClass === 'C' ? 'Business' : cabinClass === 'F' ? 'First Class' : cabinClass || '';
  const airlineLogo = booking?.provider ? `/images/airlines/${booking.provider.toLowerCase()}.png` : '';

  const isPending = booking?.status === 'pending_payment';
  // Sisa waktu bayar — diturunkan dari createdAt saat render (efek tick di
  // atas hanya memaksa re-render per detik).
  const countdown = isPending && booking?.createdAt
    ? getCountdown(booking.createdAt)
    : { expired: true, hours: 0, minutes: 0, seconds: 0 };
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

  const bType = booking?.bookingType || 'flight';
  const isTrain = bType === 'train';
  const isHotel = bType === 'hotel';
  const isInsurance = bType === 'insurance';
  const canDownload = booking?.status === 'paid' || booking?.status === 'issued';

  // Jumlah malam (hotel) — dihitung dari tanggal check-in/out yang tersedia.
  const hotelNights = isHotel && booking?.checkinDate && booking?.checkoutDate
    ? Math.max(1, Math.round((new Date(booking.checkoutDate).getTime() - new Date(booking.checkinDate).getTime()) / 86400000))
    : 0;

  // Nama stasiun asal/tujuan dari journey pertama (KAI) untuk kartu kereta.
  const firstJourney = (() => {
    const pb = providerBookings[0];
    const journeys = pb && Array.isArray(pb.journeys) ? (pb.journeys as unknown[]) : [];
    const j = journeys[0] as Record<string, unknown> | undefined;
    return {
      originName: j && typeof j.origin_name === 'string' ? j.origin_name : '',
      destName: j && typeof j.destination_name === 'string' ? j.destination_name : '',
    };
  })();

  const handleDownloadPDF = async () => {
    if (!booking || downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadTicketPdf({ id: booking.id, phone });
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : (isEN ? 'Failed to create document. Please try again.' : 'Gagal membuat dokumen. Silakan coba lagi.')
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col">
      <div className="bg-white border-b border-slate-200 pt-24 md:pt-28 pb-7 px-4">
        <div className="max-w-xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-orange">The Mafia Travel</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-brand-ink tracking-tight mt-1.5">
            {isEN ? 'Booking Details' : 'Detail Pesanan'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEN ? 'Here are your booking details' : 'Berikut rincian pesananmu'}
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-5 flex-1 w-full mb-16">
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

            {/* Train Card */}
            {isTrain && (booking.origin || booking.destination) && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-3">
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                      <i className="fa-solid fa-train text-emerald-600 text-sm"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{airlineName || t.typeTrain}</p>
                      {booking.flightNumber && (
                        <p className="text-[10px] text-slate-400 font-semibold">{booking.flightNumber}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-slate-500 mb-1 text-[10px] font-bold uppercase tracking-wider">{t.labelDeparture}</p>
                      <p className="text-lg font-black text-slate-900">{fmtTime(booking.departureDate)}</p>
                      <p className="text-xs font-bold text-slate-600 mt-0.5">
                        {booking.origin}{firstJourney.originName ? ` · ${firstJourney.originName}` : ''}
                      </p>
                      {booking.departureDate && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{fmtDateShort(booking.departureDate)}</p>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-slate-500 mb-1 text-[10px] font-bold uppercase tracking-wider">{t.labelDestination}</p>
                      <p className="text-lg font-black text-slate-900">{booking.destination || '--'}</p>
                      {firstJourney.destName && (
                        <p className="text-xs font-bold text-slate-600 mt-0.5">{firstJourney.destName}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hotel Card */}
            {isHotel && booking.hotelName && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-3">
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                      <i className="fa-solid fa-hotel text-purple-600 text-sm"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{booking.hotelName}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{t.labelHotelVoucher}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-slate-500 mb-1 text-[10px] font-bold uppercase tracking-wider">Check-in</p>
                      <p className="text-sm font-black text-slate-800">{fmtDateShort(booking.checkinDate)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-slate-500 mb-1 text-[10px] font-bold uppercase tracking-wider">Check-out</p>
                      <p className="text-sm font-black text-slate-800">{fmtDateShort(booking.checkoutDate)}</p>
                    </div>
                  </div>
                  {hotelNights > 0 && (
                    <p className="text-[11px] text-slate-400 text-center mt-2">
                      {hotelNights} {t.labelNights}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Insurance Card */}
            {isInsurance && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-3">
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                      <i className="fa-solid fa-shield-halved text-blue-600 text-sm"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">
                        {booking.hotelName || t.insuranceName}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold">{t.labelCoverage}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-slate-500 mb-1 text-[10px] font-bold uppercase tracking-wider">{t.labelCoverageArea}</p>
                      <p className="text-sm font-black text-slate-800">{booking.coverage || (isEN ? 'Worldwide' : 'Seluruh Dunia')}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-slate-500 mb-1 text-[10px] font-bold uppercase tracking-wider">{t.labelCoveragePeriod}</p>
                      <p className="text-sm font-black text-slate-800">
                        {booking.departureDate ? fmtDateShort(booking.departureDate) : '—'}
                        {booking.arrivalDate ? ` → ${fmtDateShort(booking.arrivalDate)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50 rounded-xl p-3 mt-3 border border-amber-100">
                    <div className="flex items-center gap-2 mb-1">
                      <i className="fa-solid fa-users text-amber-500 text-xs"></i>
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                        {isEN ? 'Insured' : 'Tertanggung'}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{booking.passengers?.length || 1} {isEN ? 'person' : 'orang'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Penumpang & Kursi */}
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
                  {(booking.origin && booking.destination) && (
                    <div className="flex justify-between gap-4 text-slate-600">
                      <span>{isEN ? 'Route' : 'Rute'}</span>
                      <span className="font-semibold text-right">{booking.origin} → {booking.destination}</span>
                    </div>
                  )}
                  {isHotel && (booking.checkinDate || booking.checkoutDate) && (
                    <div className="flex justify-between gap-4 text-slate-600">
                      <span>Check-in / Check-out</span>
                      <span className="font-semibold text-right">
                        {fmtDateShort(booking.checkinDate)}
                        {booking.checkoutDate ? ` → ${fmtDateShort(booking.checkoutDate)}` : ''}
                      </span>
                    </div>
                  )}
                  {booking.departureDate && (
                    <div className="flex justify-between gap-4 text-slate-600">
                      <span>{isEN ? 'Date' : 'Tanggal'}</span>
                      <span className="font-semibold text-right">{fmtDate(booking.departureDate)}</span>
                    </div>
                  )}
                  {booking.flightNumber && (
                    <div className="flex justify-between gap-4 text-slate-600">
                      <span>{isTrain ? (isEN ? 'Train' : 'Kereta') : (isEN ? 'Flight' : 'Penerbangan')}</span>
                      <span className="font-semibold text-right">{airlineName} {booking.flightNumber}</span>
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

            {/* Actions — aksi utama di baris atas, navigasi di baris bawah */}
            <div className="space-y-3">
              {(canDownload || (isTrainPaid && booking.id && providerBookings.length > 0)) && (
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
                </div>
              )}
              <div className="flex gap-3">
                <Link
                  href="/find-booking"
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <i className="fa-solid fa-magnifying-glass text-xs"></i>
                  {isEN ? 'New Search' : 'Cari Lagi'}
                </Link>
                <Link
                  href="/"
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <i className="fa-solid fa-house text-xs"></i>
                  {isEN ? 'Home' : 'Beranda'}
                </Link>
              </div>
              {downloadError && (
                <p className="text-[11px] text-red-600 leading-relaxed px-1">{downloadError}</p>
              )}
            </div>
          </>
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
