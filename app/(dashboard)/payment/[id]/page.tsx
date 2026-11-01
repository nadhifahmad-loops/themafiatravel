'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { loadSnap, getSnapRedirectUrl } from '@/lib/snap-pay';
import { getPaymentCountdown as getCountdown, PAYMENT_URGENCY_MS } from '@/lib/payment-window';

function fmtIDR(n: number) {
  if (!n || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function PaymentCountdown({ createdAt }: { createdAt: string }) {
  const { language } = useLanguage();
  const t = i18n.paymentPage[language];
  const [cd, setCd] = useState({ expired: true, hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCd(getCountdown(createdAt));
    const timer = setInterval(() => setCd(getCountdown(createdAt)), 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

  if (!mounted) return null;

  // Merah hanya di 15 menit terakhir (window pembayaran cuma 1 jam —
  // ambang lama "total < 1 jam" akan membuat semua countdown merah dari awal).
  const urgency = cd.total < PAYMENT_URGENCY_MS;

  return (
    <div className={`rounded-xl p-4 ${urgency ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
      <p className="text-xs font-semibold text-slate-500 mb-2">{t.countdownTitle}</p>
      <div className="flex items-center gap-3">
        {[
          { val: cd.hours, label: t.hours },
          { val: cd.minutes, label: t.minutes },
          { val: cd.seconds, label: t.seconds },
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
    </div>
  );
}

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { language } = useLanguage();
  const t = i18n.paymentPage[language];
  const router = useRouter();
  const { data: session } = useSession();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [embedError, setEmbedError] = useState(false);
  const [embedReady, setEmbedReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const embedStartedRef = useRef(false);

  usePageTitle('Pembayaran');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/bookings/${id}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setBooking(r.data);
        else setLoadError(r.message || t.notFound);
      })
      .catch(() => setLoadError(t.loadError))
      .finally(() => setLoading(false));
  }, [id, t.loadError, t.notFound]);

  useEffect(() => {
    if (!booking || embedStartedRef.current) return;
    if (booking.status !== 'pending_payment') return;
    if (!booking.snapToken) {
      setEmbedError(true);
      return;
    }
    embedStartedRef.current = true;
    setEmbedError(false);
    setEmbedReady(false);

    loadSnap()
      .then((snap) => {
        const el = document.getElementById('snap-embed');
        if (el) el.innerHTML = '';
        snap.embed(booking.snapToken, {
          embedId: 'snap-embed',
          onSuccess: () => {
            if (session?.user) {
              router.push(`/bookings/${id}`);
            } else {
              router.push(`/find-booking?orderId=${booking.orderNumber || id}&result=success`);
            }
          },
          onPending: () => {
            if (session?.user) {
              router.push(`/bookings/${id}`);
            } else {
              router.push(`/find-booking?orderId=${booking.orderNumber || id}&result=pending`);
            }
          },
          onError: (e: any) => {
            console.error('[Payment] snap.embed onError:', e);
            setEmbedError(true);
          },
          onClose: () => {},
        });
        setEmbedReady(true);
      })
      .catch((err: any) => {
        console.error('[Payment] loadSnap/embed error:', err);
        setEmbedError(true);
      });
  }, [booking, id, retryCount, router]);

  const handleRetry = () => {
    setTokenError('');
    embedStartedRef.current = false;
    setEmbedError(false);
    setRetryCount((c) => c + 1);
  };

  // Token Snap hanya berlaku ±5 menit. Saat embed gagal (biasanya token
  // kedaluwarsa), buat token baru di server lalu embed ulang.
  const handleRefreshToken = async () => {
    setRefreshingToken(true);
    setTokenError('');
    try {
      const res = await fetch(`/api/bookings/${id}/snap-token`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message);
      }
      setBooking((prev: any) => ({
        ...prev,
        snapToken: data.snapToken,
        snapRedirectUrl: data.redirectUrl || data.snapRedirectUrl,
      }));
      setEmbedError(false);
      embedStartedRef.current = false;
      setRetryCount((c) => c + 1);
    } catch (e: any) {
      setTokenError(e.message);
    } finally {
      setRefreshingToken(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-[1000px] mx-auto px-4 pt-28 pb-10">
          <Link href="/bookings" className="text-sm text-slate-500 hover:text-slate-800">
            &larr; {t.back}
          </Link>
          <div className="flex flex-col items-center justify-center gap-3 py-32">
            <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-400">{t.loading}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !booking) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-[1000px] mx-auto px-4 pt-28 pb-10">
          <Link href="/bookings" className="text-sm text-slate-500 hover:text-slate-800">
            &larr; {t.back}
          </Link>
          <div className="bg-white rounded-2xl border border-slate-200 p-10 mt-6 text-center">
            <i className="fa-solid fa-circle-exclamation text-red-400 text-4xl mb-4"></i>
            <p className="text-slate-700 font-semibold">{loadError || t.notFound}</p>
            <button
              onClick={() => {
                setLoadError('');
                setBooking(null);
                setLoading(true);
                setRetryCount((c) => c + 1);
                window.location.reload();
              }}
              className="mt-6 px-6 py-3 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800"
            >
              {t.retry}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPaid = booking.status === 'paid' || booking.status === 'issued';
  const isExpired = booking.status === 'pending_payment' && getCountdown(booking.createdAt).expired;
  const isInactive = booking.status === 'cancelled' || booking.status === 'payment_failed' || booking.status === 'expired';

  if (isPaid) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-md mx-auto px-4 pt-28 pb-20 text-center">
          <div className="bg-white rounded-2xl border border-slate-200 p-10 shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-5">
              <i className="fa-solid fa-check text-emerald-500 text-2xl"></i>
            </div>
            <h1 className="text-lg font-bold text-slate-900">{t.alreadyPaid}</h1>
            <p className="text-sm text-slate-500 mt-2">{t.alreadyPaidSub}</p>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-left">
              <i className="fa-solid fa-envelope text-emerald-500 mt-0.5 text-xs"></i>
              <p className="text-xs text-emerald-700 leading-relaxed">{t.paidEmailNotice}</p>
            </div>
            <Link
              href={session?.user ? `/bookings/${id}` : `/find-booking?orderId=${booking.orderNumber || id}&result=success`}
              className="mt-6 inline-block px-6 py-3 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800"
            >
              {t.viewBooking}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isExpired || isInactive) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-md mx-auto px-4 pt-28 pb-20 text-center">
          <div className="bg-white rounded-2xl border border-slate-200 p-10 shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-5">
              <i className="fa-solid fa-hourglass-end text-red-400 text-2xl"></i>
            </div>
            <h1 className="text-lg font-bold text-slate-900">{isExpired ? t.countdownExpired : t.inactive}</h1>
            <Link
              href={session?.user ? `/bookings/${id}` : `/find-booking?orderId=${booking.orderNumber || id}`}
              className="mt-6 inline-block px-6 py-3 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800"
            >
              {t.back}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const serviceLabel = t[booking.bookingType as 'flight' | 'hotel' | 'train' | 'insurance'] || booking.bookingType;

  return (
    <div className="min-h-screen bg-slate-50">
        <div className="max-w-[1000px] mx-auto px-4 pt-28 pb-8">
          <div className="flex items-center justify-between mb-6">
          <Link href={`/bookings/${id}`} className="text-sm text-slate-500 hover:text-slate-800">
            &larr; {t.back}
          </Link>
          <div className="text-right">
            <h1 className="text-lg font-bold text-slate-900">{t.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {t.orderNumber}: {booking.orderNumber || booking.id}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-6 max-w-2xl">{t.subtitle}</p>

        {/* Pemberitahuan email checkout — user tahu bahwa konfirmasi + kode pesanan
            sudah dikirim ke email pemesan sebelum/sementara menunggu pembayaran. */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <i className="fa-solid fa-envelope text-emerald-500 mt-0.5"></i>
          <p className="text-xs text-emerald-700 leading-relaxed">{t.checkoutEmailNotice}</p>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 lg:sticky lg:top-24">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center">
                <i className="fa-solid fa-wallet text-orange-600"></i>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">{t.serviceType}</p>
                <p className="font-bold text-slate-900">{serviceLabel}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-500">{t.orderNumber}</span>
                <span className="font-semibold text-slate-900 font-mono text-xs">{booking.orderNumber || booking.id}</span>
              </div>
              <div className="flex justify-between items-end pt-3 border-t border-slate-100">
                <span className="text-slate-500">{t.total}</span>
                <span className="text-2xl font-black text-slate-900">{fmtIDR(booking.totalAmount)}</span>
              </div>
            </div>

            {booking.createdAt && !getCountdown(booking.createdAt).expired && (
              <PaymentCountdown createdAt={booking.createdAt} />
            )}

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-start gap-2 text-xs text-slate-500">
              <i className="fa-solid fa-headset text-orange-500 mt-0.5"></i>
              <p>{t.support}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 min-h-[520px]">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">{t.chooseMethod}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{t.chooseMethodSub}</p>
            </div>

            {embedError ? (
              <div className="text-center py-16">
                <i className="fa-solid fa-triangle-exclamation text-red-400 text-3xl mb-3"></i>
                <p className="text-sm text-slate-600 font-medium mb-2">{t.embedError}</p>
                {tokenError && <p className="text-xs text-red-500 font-semibold mb-5">{tokenError}</p>}
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={handleRefreshToken}
                    disabled={refreshingToken}
                    className="w-full max-w-[260px] py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    {refreshingToken ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t.loadingPayment}
                      </span>
                    ) : (
                      t.retryToken
                    )}
                  </button>
                  <button
                    onClick={handleRetry}
                    className="w-full max-w-[260px] py-3 border border-slate-300 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                  >
                    {t.retry}
                  </button>
                  {booking.snapRedirectUrl && (
                    <a
                      href={booking.snapRedirectUrl || getSnapRedirectUrl(booking.snapToken || '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2"
                    >
                      {t.payRedirect}
                    </a>
                  )}
                </div>
              </div>
            ) : !embedReady ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                <p className="text-sm text-slate-400">{t.loadingPayment}</p>
              </div>
            ) : null}

            <div id="snap-embed" className="w-full" style={{ minHeight: 520 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
