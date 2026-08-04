'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking {
  id: string;
  orderNumber: string;
  bookingType: string;
  status: string;
  totalAmount: number;
  currency: string;
  routeLabel?: string | null;
  hotelName?: string | null;
  origin?: string | null;
  destination?: string | null;
  departureDate?: string | null;
  checkinDate?: string | null;
  checkoutDate?: string | null;
  flightNumber?: string | null;
  airlineName?: string | null;
  pnr?: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateString));
}

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending_payment: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  paid:            { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  issued:          { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  payment_failed:  { color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  cancelled:       { color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  refund_requested:{ color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  refund:          { color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
};

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  flight:    { label: 'Penerbangan', icon: 'fa-plane', color: 'text-blue-500 bg-blue-50' },
  hotel:     { label: 'Hotel', icon: 'fa-hotel', color: 'text-purple-500 bg-purple-50' },
  train:     { label: 'Kereta', icon: 'fa-train', color: 'text-emerald-500 bg-emerald-50' },
  insurance: { label: 'Asuransi', icon: 'fa-shield-halved', color: 'text-orange-500 bg-orange-50' },
};

const TABS = [
  { id: 'all' },
  { id: 'flight' },
  { id: 'hotel' },
  { id: 'train' },
  { id: 'insurance' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { language } = useLanguage();
  const t = i18n.bookings[language];
  const tc = i18n.common[language];
  const td = i18n.bookingDetail[language];

  const statusLabel = (key: string) =>
    (t.status as Record<string, string | undefined>)[key] ?? (td.statusMap as Record<string, string>)[key] ?? key;
  const tabLabel = (id: string) => (id === 'all' ? t.tabs.all : t[id as 'flight' | 'hotel' | 'train' | 'insurance']);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    async function fetchBookings() {
      try {
        const res = await fetch('/api/user/bookings');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat pesanan');
        setBookings(data.bookings || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal memuat pesanan';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchBookings();
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center pt-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">{tc.loading}</p>
        </div>
      </div>
    );
  }

  const filtered = bookings.filter(b => activeTab === 'all' || b.bookingType === activeTab);

  const stats = {
    total: bookings.length,
    flight: bookings.filter(b => b.bookingType === 'flight').length,
    hotel: bookings.filter(b => b.bookingType === 'hotel').length,
    train: bookings.filter(b => b.bookingType === 'train').length,
    insurance: bookings.filter(b => b.bookingType === 'insurance').length,
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] pt-28 pb-16">
      <div className="max-w-4xl mx-auto px-4 flex flex-col gap-6">

        {/* ── Header ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <button onClick={() => router.back()} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#ea580c'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
              <i className="fa-solid fa-arrow-left" style={{ fontSize: '13px', color: '#64748b' }}></i>
            </button>
            <h1 className="text-2xl font-black text-slate-800">{t.title}</h1>
          </div>
          <p className="text-slate-500 text-sm">{t.subtitle}</p>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: tc.total, value: stats.total, icon: 'fa-receipt', color: 'text-slate-600 bg-slate-50' },
            { label: t.flight, value: stats.flight, icon: 'fa-plane', color: 'text-blue-600 bg-blue-50' },
            { label: t.hotel, value: stats.hotel, icon: 'fa-hotel', color: 'text-purple-600 bg-purple-50' },
            { label: t.train, value: stats.train, icon: 'fa-train', color: 'text-emerald-600 bg-emerald-50' },
            { label: t.insurance, value: stats.insurance, icon: 'fa-shield-halved', color: 'text-orange-600 bg-orange-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                <i className={`fa-solid ${s.icon} text-sm`}></i>
              </div>
              <div>
                <p className="text-xl font-black text-slate-800 leading-none">{s.value}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs & Content ── */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex overflow-x-auto gap-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all
                  ${activeTab === tab.id
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                {tabLabel(tab.id)}
                {tab.id !== 'all' && (
                  <span className="ml-1.5 text-xs opacity-70">
                    {tab.id === 'flight' ? stats.flight : tab.id === 'hotel' ? stats.hotel : tab.id === 'train' ? stats.train : stats.insurance}
                  </span>
                )}
              </button>
            ))}
          </div>

          {error ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-circle-exclamation text-red-400 text-lg"></i>
              </div>
              <p className="text-slate-500 text-sm">{error}</p>
              <button
                onClick={() => { setError(''); setLoading(true); fetch('/api/user/bookings').then(r => r.json()).then(data => { if (data.bookings) setBookings(data.bookings); else throw new Error(data.error); }).catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat')).finally(() => setLoading(false)); }}
                className="mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors"
              >
                <i className="fa-solid fa-arrow-rotate-right mr-1.5"></i>{tc.retry}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-ticket text-slate-300 text-2xl"></i>
              </div>
              <p className="text-slate-500 font-bold text-sm">{t.empty}</p>
              <p className="text-slate-400 text-xs mt-1">Pesanan kamu akan muncul di sini</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors"
              >
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
                {t.searchBtn}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(booking => {
                const statusCfg = STATUS_CONFIG[booking.status] || { color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' };
                const typeCfg = TYPE_CONFIG[booking.bookingType] || { label: booking.bookingType, icon: 'fa-circle-question', color: 'text-slate-500 bg-slate-50' };

                return (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    className="block px-5 py-4 hover:bg-slate-50/80 transition-colors group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Type Icon */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${typeCfg.color}`}>
                        <i className={`fa-solid ${typeCfg.icon} text-sm`}></i>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-800 text-sm">{booking.orderNumber || booking.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.color}`}>
                            {statusLabel(booking.status)}
                          </span>
                        </div>

                        <p className="text-slate-500 text-xs mt-1 font-medium">
                          {booking.bookingType === 'hotel'
                            ? booking.hotelName || '-'
                            : booking.routeLabel || `${booking.origin || ''} → ${booking.destination || ''}`
                          }
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                          {booking.flightNumber && (
                            <span><i className="fa-solid fa-plane text-[9px] mr-1"></i>{booking.flightNumber}</span>
                          )}
                          {booking.airlineName && (
                            <span>{booking.airlineName}</span>
                          )}
                          {booking.pnr && (
                            <span className="font-bold text-orange-500">PNR: {booking.pnr}</span>
                          )}
                          <span><i className="fa-regular fa-calendar text-[9px] mr-1"></i>{formatDate(booking.departureDate || booking.checkinDate || booking.createdAt)}</span>
                        </div>
                      </div>

                      {/* Price & Arrow */}
                      <div className="text-right shrink-0">
                        <p className="font-black text-slate-800 text-sm">{formatCurrency(booking.totalAmount)}</p>
                        <i className="fa-solid fa-chevron-right text-slate-300 text-xs mt-2 group-hover:text-orange-400 transition-colors"></i>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
