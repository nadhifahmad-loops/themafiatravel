'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

type Booking = {
  id: string;
  orderNumber?: string;
  bookingType?: string;
  serviceType?: string;
  status?: string;
  totalAmount?: number;
  currency?: string;
  routeLabel?: string;
  origin?: string;
  destination?: string;
  checkinDate?: string;
  checkoutDate?: string;
  departureDate?: string;
  hotelName?: string;
  flightNumber?: string;
  airlineName?: string;
  provider?: string;
  createdAt?: string;
};

const fmtRp = (n: number, cur = 'IDR') =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (v?: string) => {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ELIGIBLE_STATUSES   = ['paid', 'issued'];
const IN_PROGRESS_STATUSES = ['refund_requested', 'refund'];
const ALL_REFUND_STATUSES  = [...ELIGIBLE_STATUSES, ...IN_PROGRESS_STATUSES];

const SVC_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  hotel:     { icon: '🏨', label: 'Hotel',    color: 'bg-orange-100 text-orange-700' },
  flight:    { icon: '✈️',  label: 'Pesawat',  color: 'bg-sky-100 text-sky-700' },
  train:     { icon: '🚆', label: 'Kereta',   color: 'bg-green-100 text-green-700' },
  insurance: { icon: '🛡️', label: 'Asuransi', color: 'bg-purple-100 text-purple-700' },
};

export default function RefundsPage() {
  const { language } = useLanguage();
  const t  = i18n.bookingDetail[language];
  const tc = i18n.common[language];
  const router       = useRouter();

  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const results = await Promise.allSettled([
          fetch('/api/flight/booking'),
          fetch('/api/hotel/booking'),
          fetch('/api/train/booking'),
          fetch('/api/insurance/booking'),
        ]);

        const types   = ['flight', 'hotel', 'train', 'insurance'];
        let combined: Booking[] = [];

        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status === 'fulfilled' && r.value.ok) {
            const data = await r.value.json();
            if (data?.success && Array.isArray(data.data)) {
              combined = [...combined, ...data.data.map((b: Booking) => ({ ...b, serviceType: types[i] }))];
            }
          }
        }

        const unique = Array.from(new Map(combined.map(b => [b.id || b.orderNumber, b])).values());
        unique.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setBookings(unique);
      } catch (e: any) {
        setFetchError(e.message || 'Gagal memuat data booking');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const allEligible = bookings.filter(b => b.status && ALL_REFUND_STATUSES.includes(b.status));

  const filtered = allEligible.filter(b => {
    const sType = b.serviceType || b.bookingType;
    return serviceFilter === 'all' || sType === serviceFilter;
  });

  const canCancel     = (b: Booking) => ELIGIBLE_STATUSES.includes(b.status || '');
  const inProgress    = (b: Booking) => IN_PROGRESS_STATUSES.includes(b.status || '');

  const svcFilters = [
    { key: 'all',       label: 'Semua',    icon: 'fa-layer-group' },
    { key: 'hotel',     label: 'Hotel',    icon: 'fa-hotel' },
    { key: 'flight',    label: 'Pesawat',  icon: 'fa-plane' },
    { key: 'train',     label: 'Kereta',   icon: 'fa-train' },
    { key: 'insurance', label: 'Asuransi', icon: 'fa-shield-halved' },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9ff] pb-24">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mb-5">
          <Link href="/" className="hover:text-orange-600 transition-colors">Beranda</Link>
          <span>/</span>
          <Link href="/bookings" className="hover:text-orange-600 transition-colors">Pesanan Saya</Link>
          <span>/</span>
          <span className="text-slate-600">Refund Saya</span>
        </div>

        {/* Page header */}
        <div className="rounded-3xl overflow-hidden mb-6" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
          <div className="px-7 py-8 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)' }} />
            <p className="text-orange-400 text-xs font-black uppercase tracking-widest mb-2">Refund Saya</p>
            <h1 className="text-3xl font-black text-white font-display tracking-tight mb-2">Batalkan &amp; Refund</h1>
            <p className="text-slate-400 text-sm max-w-lg">Pilih pesanan yang ingin dibatalkan, cek estimasi refund, lalu ikuti proses pembatalan step-by-step.</p>

            {/* Steps summary */}
            <div className="mt-5 flex gap-3 flex-wrap">
              {['1. Pilih pesanan eligible', '2. Cek estimasi refund', '3. Ikuti alur pembatalan'].map((s, i) => (
                <div key={i} className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-bold">{s}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Filter layanan */}
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide mb-5 py-1">
          {svcFilters.map(f => (
            <button
              key={f.key}
              onClick={() => setServiceFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 border flex-shrink-0 ${
                serviceFilter === f.key
                  ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-600/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:text-orange-600'
              }`}
            >
              <i className={`fa-solid ${f.icon} text-xs`}></i> {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">{tc.loading}</p>
            </div>
          </div>
        ) : fetchError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <p className="font-bold text-red-800 mb-1">{tc.error}</p>
            <p className="text-red-600 text-sm">{fetchError}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-14 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 text-slate-300">
              <i className="fa-solid fa-suitcase-rolling"></i>
            </div>
            <h2 className="font-black text-xl text-slate-900 font-display mb-2">Tidak ada pesanan eligible</h2>
            <p className="text-slate-500 text-sm mb-6">
              {serviceFilter !== 'all'
                ? `Tidak ada pesanan ${SVC_CONFIG[serviceFilter]?.label || serviceFilter} yang dapat direfund.`
                : 'Refund hanya tersedia untuk pesanan berstatus Terkonfirmasi atau Tiket Diterbitkan.'}
            </p>
            <Link
              href="/bookings"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20"
            >
              <i className="fa-solid fa-arrow-left text-xs"></i>
              Kembali ke Semua Pesanan
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((b, index) => {
              const sType  = b.serviceType || b.bookingType || 'hotel';
              const cfg    = SVC_CONFIG[sType] || SVC_CONFIG.hotel;
              const cancelUrl = `/bookings/${b.id || b.orderNumber}/cancel`;

              const detailLabel = sType === 'hotel'
                ? `${b.hotelName || 'Hotel'} • Check-in: ${fmtDate(b.checkinDate)}`
                : `${b.routeLabel || `${b.origin || '-'} → ${b.destination || '-'}`} • ${fmtDate(b.departureDate)}`;

              return (
                <div
                  key={`${b.id}-${index}`}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-orange-200"
                >
                  {/* Top row */}
                  <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-xl flex-shrink-0 border border-slate-200">
                        {cfg.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            inProgress(b)
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {inProgress(b) ? '🔄 Refund Diproses' : '✓ Eligible Refund'}
                          </span>
                        </div>
                        <p className="font-black text-slate-900 text-sm">{b.orderNumber || b.id}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{detailLabel}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold text-right mb-0.5">{t.totalAmount}</p>
                        <p className="font-black text-xl text-slate-900 text-right">{fmtRp(b.totalAmount ?? 0, b.currency)}</p>
                      </div>

                      <div className="flex gap-2 flex-wrap justify-end">
                        {/* Tombol utama: Batalkan / Refund */}
                        {canCancel(b) ? (
                          <button
                            onClick={() => router.push(cancelUrl)}
                            className="px-5 py-2.5 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-xmark text-xs"></i>
                            {t.cancelBooking}
                          </button>
                        ) : inProgress(b) ? (
                          <span className="px-5 py-2.5 bg-sky-50 border border-sky-200 text-sky-700 font-bold text-sm rounded-xl flex items-center gap-1.5">
                            <i className="fa-solid fa-rotate text-xs animate-spin"></i>
                            {t.processing}
                          </span>
                        ) : null}

                        {/* Tombol lihat detail */}
                        <button
                          onClick={() => router.push(`/bookings/${b.id || b.orderNumber}`)}
                          className="px-4 py-2.5 border-2 border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 transition-all"
                        >
                          {t.detail}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* In-progress info bar */}
                  {inProgress(b) && (
                    <div className="px-5 py-3 bg-sky-50 border-t border-sky-100 flex items-center gap-2 text-xs text-sky-700 font-medium">
                      <i className="fa-solid fa-circle-info text-sky-400"></i>
                      Permintaan refund sudah diterima dan menunggu review admin sebelum dana dikembalikan. Cek email untuk update status.
                    </div>
                  )}

                  {/* Eligible info bar */}
                  {canCancel(b) && (
                    <div className="px-5 py-3 bg-orange-50 border-t border-orange-100 flex items-center justify-between text-xs font-medium">
                      <span className="text-orange-700 flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-exclamation text-orange-400"></i>
                        Estimasi refund ditampilkan saat kamu mulai proses pembatalan
                      </span>
                      <span className="text-orange-500 font-bold">
                        Proses &gt;
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Support note */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-3 text-sm shadow-sm mt-2">
              <span className="text-slate-400 text-base flex-shrink-0">💡</span>
              <p className="text-slate-500">
                Semua permintaan refund dikonfirmasi oleh tim Orbisway. Estimasi bersifat indikatif dan dapat berbeda dengan nilai aktual yang ditentukan vendor.
                Butuh bantuan? Hubungi <strong className="text-orange-700">CS Orbisway</strong>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

