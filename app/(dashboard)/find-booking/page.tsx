'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { i18n } from '@/lib/i18n';
import { GUEST_BOOKING_CREDS_KEY, getBookingStatusMeta, getBookingTypeMeta } from '@/lib/booking-meta';
import { vBtnSearch, vField, vInput, vLabel, vSub, vValue } from '@/lib/formVariants';
import Footer from '@/components/layout/Footer';

interface BookingResult {
  id: string;
  orderNumber: string;
  bookingType: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  origin: string | null;
  destination: string | null;
  departureDate: string | null;
  routeLabel?: string | null;
  hotelName?: string | null;
  checkinDate?: string | null;
  checkoutDate?: string | null;
}

function FindBookingContent() {
  const { language } = useLanguage();
  const { openLogin } = useAuthModal();
  const t = i18n.findBooking[language];
  const isEN = language === 'EN';
  const searchParams = useSearchParams();

  // Dari halaman pembayaran: ?orderId=KODE (+ result=success|pending)
  const orderIdParam = searchParams.get('orderId') || '';
  const resultParam = searchParams.get('result') || '';

  const [orderNumber, setOrderNumber] = useState(() => orderIdParam.toUpperCase());
  const [phone,       setPhone]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [result,      setResult]      = useState<BookingResult | null>(null);
  const [retryAfter,  setRetryAfter]  = useState<number | null>(null); // detik tersisa untuk rate-limit 429

  const bannerText = !orderIdParam
    ? ''
    : resultParam === 'success'
      ? t.bannerSuccess
      : resultParam === 'pending'
        ? t.bannerPending
        : t.bannerPrefill;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrder = orderNumber.replace(/\s+/g, '').toUpperCase();
    const cleanPhone = phone.trim();
    if (!cleanOrder || !cleanPhone) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/booking/find', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': language },
        body:    JSON.stringify({ orderNumber: cleanOrder, phone: cleanPhone }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 429 && data.retryAfter) {
          setRetryAfter(Number(data.retryAfter));
          setError(isEN ? 'Too many requests. Please wait before searching again.' : 'Terlalu banyak permintaan. Silakan tunggu sebelum mencari lagi.');
        } else {
          setError(data.error || t.notFound);
        }
      } else {
        setResult(data.booking);
        // Simpan kredensial di sessionStorage (bukan di URL) untuk halaman detail
        try {
          sessionStorage.setItem(GUEST_BOOKING_CREDS_KEY, JSON.stringify({ orderNumber: cleanOrder, phone: cleanPhone }));
        } catch { /* storage penuh/di-nonaktifkan — abaikan */ }
      }
    } catch {
      setError(t.connectionError);
    } finally {
      setLoading(false);
    }
  };

  // Hitung mundur rate-limit 429 — disable tombol search hingga habis.
  useEffect(() => {
    if (!retryAfter || retryAfter <= 0) return;
    const timer = setInterval(() => {
      setRetryAfter((prev) => (prev === null || prev <= 1 ? null : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const formatDateTime = (date: string) =>
    new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  // Tanggal bermakna per produk: hotel → check-in, transport → keberangkatan,
  // fallback → tanggal pemesanan.
  const isHotelResult = result?.bookingType === 'hotel';
  const dateLabel = isHotelResult
    ? (result?.checkinDate ? t.labelCheckin : t.labelBooked)
    : (result?.departureDate ? t.labelDeparture : t.labelBooked);
  const dateValue = isHotelResult
    ? (result?.checkinDate || result?.createdAt)
    : (result?.departureDate || result?.createdAt);

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col">

      {/* Orange Header */}
      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 pt-28 pb-16 px-4">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-2xl font-black text-white mb-1">{t.title}</h1>
          <p className="text-orange-100 text-sm">{t.subtitle}</p>
        </div>
      </div>

      {/* Search Card */}
      <div className="max-w-xl mx-auto px-4 -mt-8 flex-1 w-full mb-16">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="p-5">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-start gap-2">
                <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
                <span>{error}</span>
                {retryAfter && retryAfter > 0 && (
                  <span className="ml-2 font-bold text-red-700">{isEN ? `Retry in ${retryAfter}s` : `Coba lagi dalam ${retryAfter} detik`}</span>
                )}
              </div>
            )}

            {bannerText && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl text-xs flex items-start gap-2">
                <i className="fa-solid fa-circle-info mt-0.5 shrink-0"></i>
                <span>{bannerText}</span>
              </div>
            )}

            <form onSubmit={handleSearch} className="flex flex-col gap-4">
              <section>
                <label className={`mb-1.5 block text-xs font-semibold ${vValue('light')}`} htmlFor="order-number">
                  {t.orderLabel}
                </label>
                <div className={`flex min-h-11 items-center gap-2 rounded-md px-3 ${vField('light')}`}>
                  <i className="fa-solid fa-hashtag text-slate-400 text-[12px]" aria-hidden="true" />
                  <input
                    id="order-number"
                    type="text"
                    value={orderNumber}
                    onChange={e => setOrderNumber(e.target.value.toUpperCase())}
                    placeholder={t.orderPlaceholder}
                    required
                    autoFocus
                    inputMode="text"
                    autoComplete="off"
                    className={`flex-1 bg-transparent outline-none text-sm font-mono uppercase tracking-wider placeholder:text-slate-400 ${vValue('light')}`}
                  />
                </div>
                <p className={`mt-1 text-[11px] flex items-center gap-1.5 ${vSub('light')}`}>
                  <i className="fa-solid fa-envelope-open-text" aria-hidden="true" />
                  {t.orderHint}
                </p>
              </section>

              <section>
                <label className={`mb-1.5 block text-xs font-semibold ${vValue('light')}`} htmlFor="phone">
                  {t.phoneLabel}
                </label>
                <div className={`flex min-h-11 items-center gap-2 rounded-md px-3 ${vField('light')}`}>
                  <i className="fa-solid fa-phone text-slate-400 text-[12px]" aria-hidden="true" />
                  <input
                    id="phone"
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t.phonePlaceholder}
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    className={`flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400 ${vValue('light')}`}
                  />
                </div>
                <p className={`mt-1 text-[11px] flex items-center gap-1.5 ${vSub('light')}`}>
                  <i className="fa-solid fa-user" aria-hidden="true" />
                  {t.phoneHint}
                </p>
              </section>

              <button
                type="submit"
                disabled={loading || !orderNumber.trim() || !phone.trim() || (retryAfter ?? 0) > 0}
                className={`w-full ${vBtnSearch('light')}`}
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.searching}</>
                  : <><i className="fa-solid fa-magnifying-glass" aria-hidden="true" />{t.submitBtn}</>}
              </button>
            </form>
          </div>

          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
            <p className="text-slate-400 text-xs text-center">
              {t.noBooking}{' '}
              <Link href="/" className="text-orange-500 hover:text-orange-600 font-bold transition-colors">
                {t.bookNow}
              </Link>
            </p>
          </div>
        </div>

        {/* Kartu login — semua pesanan terlihat bila masuk akun */}
        <div className="mt-4 bg-white rounded-2xl shadow-lg border border-slate-100 px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <i className="fa-solid fa-user-circle text-blue-500 text-sm"></i>
            </div>
            <p className="text-xs text-slate-500 font-semibold truncate">{t.loginInfo}</p>
          </div>
          <button type="button" onClick={() => openLogin()} className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors whitespace-nowrap">
            {t.loginLink}
          </button>
        </div>

        {/* Hasil Pencarian */}
        {result && (() => {
          const statusMeta = getBookingStatusMeta(result.status, t);
          const typeMeta   = getBookingTypeMeta(result.bookingType, t);
          const isPending  = result.status === 'pending_payment';
          const nights = result.checkinDate && result.checkoutDate
            ? Math.max(1, Math.round((new Date(result.checkoutDate).getTime() - new Date(result.checkinDate).getTime()) / 86400000))
            : null;

          return (
            <div className="mt-6 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <i className={`fa-solid ${typeMeta.icon} text-orange-500`}></i>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{t.foundTitle}</p>
                    <p className="text-xs text-slate-500">{t.foundSub}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-lg font-black text-slate-900 tracking-wider">{result.orderNumber}</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${statusMeta.color}`}>
                    <i className={`fa-solid ${statusMeta.icon}`}></i>{statusMeta.text}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-500 mb-1">{t.labelType}</p>
                    <p className="font-bold text-slate-800">{typeMeta.label}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-500 mb-1">{dateLabel}</p>
                    <p className="font-bold text-slate-800">{dateValue ? formatDate(dateValue) : '--'}</p>
                  </div>

                  {result.hotelName ? (
                    <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                      <p className="text-slate-500 mb-1">{t.labelHotelName}</p>
                      <p className="font-bold text-slate-800">{result.hotelName}</p>
                      {result.checkinDate && result.checkoutDate && (
                        <p className="text-slate-400 mt-1">
                          {formatDateTime(result.checkinDate)} → {formatDateTime(result.checkoutDate)}
                          {nights ? ` · ${nights} ${nights > 1 ? (language === 'EN' ? 'nights' : 'malam') : (language === 'EN' ? 'night' : 'malam')}` : ''}
                        </p>
                      )}
                    </div>
                  ) : result.origin && result.destination ? (
                    <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                      <p className="text-slate-500 mb-1">{t.labelRoute}</p>
                      <p className="font-bold text-slate-800">{result.origin} → {result.destination}</p>
                    </div>
                  ) : null}

                  <div className="bg-orange-50 rounded-xl p-3 col-span-2">
                    <p className="text-orange-600 mb-1">{t.labelTotal}</p>
                    <p className="font-black text-orange-600 text-lg">{formatCurrency(result.totalAmount)}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 flex gap-3">
                <Link
                  href={`/find-booking/${result.id}`}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <i className={`fa-solid ${isPending ? 'fa-credit-card' : 'fa-eye'} text-xs`}></i>
                  {isPending ? t.continuePayment : t.viewDetail}
                </Link>
                <button
                  onClick={() => { setResult(null); setError(''); }}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm"
                >
                  {t.newSearch}
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      <Footer />
    </div>
  );
}

export default function FindBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    }>
      <FindBookingContent />
    </Suspense>
  );
}
