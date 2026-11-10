'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import AccountSidebar from '@/components/account/AccountSidebar';
import ReschedulePanel from './ReschedulePanel';
import { Hotel, Plane, ShieldCheck, TrainFront, type LucideIcon } from 'lucide-react';
import { hasFlightDeparted } from '@/lib/orbis-post-booking';

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
  pnr?: string;
  bookingData?: unknown;
  passengerData?: unknown;
  createdAt?: string;
  cancelType?: string | null;
  cancelledAt?: string | null;
  roomCount?: number | null;
  adultCount?: number | null;
  childCount?: number | null;
  nights?: number | null;
  mealType?: string | null;
};

const fmtRp = (n: number, cur = 'IDR') =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (v?: string) => {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ELIGIBLE_STATUSES    = ['paid', 'issued'];
const IN_PROGRESS_STATUSES = ['refund_requested'];
const COMPLETED_STATUSES   = ['refund'];

const isRefundInProgress = (booking: { status?: string }) =>
  IN_PROGRESS_STATUSES.includes(booking.status || '');
const isRefundCompleted = (booking: { status?: string; cancelType?: string | null }) =>
  COMPLETED_STATUSES.includes(booking.status || '')
  || (booking.status === 'cancelled' && booking.cancelType === 'refund');
const isRefundListed = (booking: { status?: string; cancelType?: string | null }) =>
  ELIGIBLE_STATUSES.includes(booking.status || '')
  || isRefundInProgress(booking)
  || isRefundCompleted(booking);

const SVC_CONFIG: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  hotel:     { icon: Hotel, label: 'Hotel', color: 'bg-violet-50 text-violet-600' },
  flight:    { icon: Plane, label: 'Pesawat', color: 'bg-blue-50 text-brand-blue' },
  train:     { icon: TrainFront, label: 'Kereta', color: 'bg-emerald-50 text-emerald-600' },
  insurance: { icon: ShieldCheck, label: 'Asuransi', color: 'bg-orange-50 text-brand-orange' },
};

export default function RefundsPage() {
  const { language } = useLanguage();
  const t  = i18n.bookingDetail[language];
  const tc = i18n.common[language];
  const router       = useRouter();
  usePageTitle('Refund & Reschedule');

  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const [fetchWarnings, setFetchWarnings] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'refund' | 'reschedule'>('refund');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setFetchError(null);
      setFetchWarnings([]);

      const types = ['flight', 'hotel', 'train', 'insurance'] as const;
      const results = await Promise.all(types.map(async (type) => {
        try {
          const response = await fetch(`/api/${type}/booking`);
          const data = await response.json().catch(() => null);
          if (!response.ok || !data?.success || !Array.isArray(data.data)) {
            return {
              type,
              bookings: [] as Booking[],
              error: typeof data?.error === 'string'
                ? data.error
                : `Respons API booking ${SVC_CONFIG[type].label} tidak valid.`,
            };
          }
          return {
            type,
            bookings: data.data.map((b: Booking) => ({ ...b, serviceType: type })),
            error: null,
          };
        } catch {
          return {
            type,
            bookings: [] as Booking[],
            error: `Gagal memuat booking ${SVC_CONFIG[type].label}.`,
          };
        }
      }));

      const combined = results.flatMap((result) => result.bookings);
      const unique = Array.from(new Map(combined.map(b => [b.id || b.orderNumber, b])).values());
      unique.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setBookings(unique);

      const failures = results.filter((result) => result.error);
      if (unique.length === 0 && failures.length === types.length) {
        setFetchError('Semua layanan pesanan sedang tidak dapat diakses. Silakan coba lagi beberapa saat.');
      } else {
        setFetchWarnings(failures.map((result) => result.error as string));
      }
      setLoading(false);
    };
    load();
  }, []);

  const allEligible = bookings.filter(isRefundListed);

  const filtered = allEligible.filter(b => {
    const sType = b.serviceType || b.bookingType;
    return serviceFilter === 'all' || sType === serviceFilter;
  });

  const flightDeparted = (b: Booking) =>
    (b.serviceType || b.bookingType) === 'flight' && hasFlightDeparted(b);
  const canCancel     = (b: Booking) =>
    ELIGIBLE_STATUSES.includes(b.status || '') && !flightDeparted(b);
  const inProgress    = (b: Booking) => isRefundInProgress(b);
  const completed     = (b: Booking) => isRefundCompleted(b);

  const svcFilters = [
    { key: 'all',       label: 'Semua',    icon: 'fa-layer-group' },
    { key: 'hotel',     label: 'Hotel',    icon: 'fa-hotel' },
    { key: 'flight',    label: 'Pesawat',  icon: 'fa-plane' },
    { key: 'train',     label: 'Kereta',   icon: 'fa-train' },
    { key: 'insurance', label: 'Asuransi', icon: 'fa-shield-halved' },
  ];

  return (
    <div className="min-h-screen bg-brand-bgLight pt-[64px] md:pt-20">
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <AccountSidebar />
          <main className="min-w-0 flex-1">
            <header className="mb-5 sm:mb-6">
              <h1 className="text-xl font-extrabold tracking-tight text-brand-ink sm:text-2xl">Refund &amp; Reschedule</h1>
              <p className="mt-1 text-sm text-brand-neutral">Kelola refund dan perubahan jadwal tiket sebelum waktu keberangkatan.</p>
            </header>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="flex items-center gap-6 px-4 sm:px-5">
                {([
                  { key: 'refund', label: 'Refund', icon: 'fa-rotate-left' },
                  { key: 'reschedule', label: 'Reschedule', icon: 'fa-calendar-days' },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative inline-flex items-center gap-2 py-3.5 text-sm font-bold transition-colors ${
                      activeTab === tab.key ? 'text-brand-ink' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <i className={`fa-solid ${tab.icon} text-xs`}></i>
                    {tab.label}
                    {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-orange" />}
                  </button>
                ))}
              </div>
          </div>

            {activeTab === 'refund' ? (
              <>
                <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
                  <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {svcFilters.map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setServiceFilter(filter.key)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                          serviceFilter === filter.key
                            ? 'border-brand-ink bg-brand-ink text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <i className={`fa-solid ${filter.icon} text-[10px]`}></i>
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!loading && !fetchError && fetchWarnings.length > 0 && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                    <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0"></i>
                    <div className="space-y-1">
                      <p className="font-bold">Sebagian data pesanan belum dapat dimuat.</p>
                      {fetchWarnings.map((warning) => (
                        <p key={warning}>{warning} Data lain tetap ditampilkan; coba muat ulang halaman nanti.</p>
                      ))}
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
                      <p className="text-sm text-slate-400">{tc.loading}</p>
                    </div>
                  </div>
                ) : fetchError ? (
                  <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-card">
                    <p className="mb-1 font-bold text-brand-ink">{tc.error}</p>
                    <p className="text-sm text-red-600">{fetchError}</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card sm:p-10">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-400">
                      <i className="fa-solid fa-suitcase-rolling"></i>
                    </div>
                    <h2 className="text-sm font-bold text-brand-ink">Tidak ada pesanan untuk ditampilkan</h2>
                    <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
                      {serviceFilter !== 'all'
                        ? `Tidak ada pesanan ${SVC_CONFIG[serviceFilter]?.label || serviceFilter} yang memenuhi syarat refund.`
                        : 'Refund tersedia untuk pesanan yang sudah dibayar atau tiket yang sudah diterbitkan.'}
                    </p>
                    <Link
                      href="/bookings"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Lihat Pesanan Saya
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
            {filtered.map((b, index) => {
              const sType  = b.serviceType || b.bookingType || 'hotel';
              const cfg    = SVC_CONFIG[sType] || SVC_CONFIG.hotel;
                const ServiceIcon = cfg.icon;
                const cancelUrl = `/bookings/${b.id || b.orderNumber}/cancel`;
                const departed = flightDeparted(b);
                const refunding = inProgress(b);
                const refundFinished = completed(b);

              const hotelMeta = [
                `Check-in ${fmtDate(b.checkinDate)}`,
                b.checkoutDate ? `Check-out ${fmtDate(b.checkoutDate)}` : '',
                b.nights ? `${b.nights} malam` : '',
                b.roomCount ? `${b.roomCount} kamar` : '',
              ].filter(Boolean).join(' · ');

              const detailLabel = sType === 'hotel'
                ? `${b.hotelName || 'Hotel'} • ${hotelMeta}`
                : `${b.routeLabel || `${b.origin || '-'} → ${b.destination || '-'}`} • ${fmtDate(b.departureDate)}`;

              return (
                <div
                  key={`${b.id}-${index}`}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-colors hover:border-slate-300"
                >
                  {/* Top row */}
                  <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
                        <ServiceIcon className="h-5 w-5" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-400">{b.orderNumber || b.id}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            refundFinished
                              ? 'bg-violet-50 text-violet-700'
                              : refunding
                                ? 'bg-orange-50 text-orange-700'
                                : departed
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${refundFinished ? 'bg-violet-500' : refunding ? 'bg-orange-500' : departed ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                            {refundFinished ? 'Refund selesai' : refunding ? 'Refund diproses' : departed ? 'Perjalanan lewat' : 'Bisa diajukan'}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-brand-ink">{detailLabel.split(' • ')[0]}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{detailLabel.split(' • ').slice(1).join(' · ') || cfg.label}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                      <div>
                        <p className="mb-0.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.totalAmount}</p>
                        <p className="text-right text-sm font-extrabold text-brand-ink">{fmtRp(b.totalAmount ?? 0, b.currency)}</p>
                      </div>

                      <div className="flex gap-2 flex-wrap justify-end">
                        {/* Tombol utama: Batalkan / Refund */}
                        {canCancel(b) ? (
                          <button
                            onClick={() => router.push(cancelUrl)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-dark"
                          >
                            <i className="fa-solid fa-xmark text-xs"></i>
                            {sType === 'hotel' ? 'Batalkan & Ajukan Refund' : t.cancelBooking}
                          </button>
                        ) : refunding ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-orange-100 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700">
                            <i className="fa-solid fa-rotate text-xs animate-spin"></i>
                            {t.processing}
                          </span>
                        ) : refundFinished ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700">
                            <i className="fa-solid fa-circle-check text-xs"></i>
                            Refund selesai
                          </span>
                        ) : departed ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-500">
                            <i className="fa-solid fa-lock text-xs"></i>
                            Refund mandiri ditutup
                          </span>
                        ) : null}

                        {/* Tombol lihat detail */}
                        <button
                          onClick={() => router.push(`/bookings/${b.id || b.orderNumber}`)}
                          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          {t.detail}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* In-progress info bar */}
                  {refunding && (
                    <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs font-medium text-slate-600">
                      <i className="fa-solid fa-circle-info text-slate-400"></i>
                      Permintaan refund sudah diterima dan menunggu review admin sebelum dana dikembalikan. Cek email untuk update status.
                    </div>
                  )}

                  {/* Completed info bar */}
                  {refundFinished && (
                    <div className="flex items-center gap-2 border-t border-violet-100 bg-violet-50/60 px-5 py-3 text-xs font-medium text-violet-700">
                      <i className="fa-solid fa-circle-check text-violet-500"></i>
                      Refund untuk pesanan ini sudah selesai diproses.
                    </div>
                  )}

                  {/* Eligible info bar */}
                  {canCancel(b) && (
                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <i className="fa-solid fa-circle-exclamation text-slate-400"></i>
                        Estimasi refund ditampilkan saat kamu mulai proses pembatalan
                      </span>
                      <span className="font-semibold text-brand-blue">
                        Proses &gt;
                      </span>
                    </div>
                  )}
                  {departed && !refunding && !refundFinished && (
                    <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-600">
                      <i className="fa-solid fa-circle-info mt-0.5 text-slate-400"></i>
                      <span>
                        Waktu keberangkatan sudah lewat. Refund mandiri tidak tersedia; hubungi customer service untuk memeriksa apakah aturan maskapai menyediakan pengecualian.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Support note */}
            <div className="mt-2 flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500 shadow-card">
              <span className="shrink-0 text-slate-400"><i className="fa-solid fa-circle-info"></i></span>
              <p>
                Semua permintaan refund dikonfirmasi oleh tim Orbisway. Estimasi bersifat indikatif dan dapat berbeda dengan nilai aktual yang ditentukan vendor.
                Butuh bantuan? Hubungi <strong className="text-orange-700">CS The Mafia Travel</strong> di 0812-3233-1581.
              </p>
            </div>
          </div>
        )}
        </>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">{tc.loading}</p>
            </div>
          </div>
        ) : fetchError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="mb-1 font-bold text-red-800">{tc.error}</p>
            <p className="text-sm text-red-600">{fetchError}</p>
          </div>
        ) : (
          <ReschedulePanel
            bookings={bookings}
            onRescheduled={(bookingId, departureDate) => {
              setBookings((previous) => previous.map((booking) =>
                booking.id === bookingId
                  ? { ...booking, ...(departureDate ? { departureDate } : {}) }
                  : booking
              ));
            }}
          />
        )}
          </main>
        </div>
      </div>
    </div>
  );
}
