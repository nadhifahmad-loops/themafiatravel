'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

function FindBookingContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { language } = useLanguage();
  const t = i18n.findBooking[language];

  const [orderNumber, setOrderNumber] = useState('');
  const [phone,       setPhone]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // Auto-fill nomor pesanan dari query param ?order=
  // Di-set dari redirect checkout setelah pembayaran (user belum login)
  useEffect(() => {
    const order = searchParams.get('order');
    if (order) setOrderNumber(order);
  }, [searchParams]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !phone.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/booking/find', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderNumber: orderNumber.trim(), phone: phone.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || t.notFound);
        setLoading(false);
      } else {
        router.push(`/bookings/${data.bookingId}`);
      }
    } catch {
      setError(t.connectionError);
      setLoading(false);
    }
  };

  const fromCheckout = !!searchParams.get('order');

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center relative overflow-hidden p-4">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2000')" }}
      />

      <div className="relative z-10 w-full max-w-md">

        {/* Banner sukses booking — tampil hanya jika redirect dari checkout */}
        {fromCheckout && (
          <div className="mb-5 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl p-4 flex items-start gap-3 backdrop-blur-sm">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <i className="fa-solid fa-check text-white text-sm"></i>
            </div>
            <div>
              <p className="text-emerald-300 font-black text-sm">{t.successTitle}</p>
              <p className="text-emerald-400/80 text-xs mt-0.5">
                {t.successSub}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-orange-600/20 border border-orange-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-ticket text-orange-400 text-2xl"></i>
            </div>
            <h1 className="text-2xl font-black text-white mb-1">{t.title}</h1>
            <p className="text-gray-400 text-sm">{t.subtitle}</p>
          </div>

          {error && (
            <div className="mb-5 p-4 bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl text-sm flex items-start gap-2">
              <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                {t.orderLabel}
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                placeholder={t.orderPlaceholder}
                required
                className="w-full px-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                {t.phoneLabel}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder={t.phonePlaceholder}
                required
                className="w-full px-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !orderNumber.trim() || !phone.trim()}
              className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.searching}</>
                : <><i className="fa-solid fa-magnifying-glass" />{t.submitBtn}</>
              }
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 space-y-2 text-center">
            <p className="text-gray-500 text-xs">{t.loginInfo}</p>
            <Link
              href="/login"
              className="text-orange-400 hover:text-orange-300 text-sm font-bold transition-colors"
            >
              {t.loginLink}
            </Link>
          </div>
        </div>

        <div className="mt-5 text-center">
          <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            {t.backHome}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FindBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <FindBookingContent />
    </Suspense>
  );
}
