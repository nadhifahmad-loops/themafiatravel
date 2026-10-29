'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { CARRIER_CODE_TO_AIRLINE, PROVIDER_ID_TO_LABEL } from '@/lib/providers';
import { getVendorLogo } from '@/lib/vendor-logo';
import { Plane, BedDouble, TrainFront, ShieldCheck, HelpCircle, type LucideIcon } from 'lucide-react';

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
  provider?: string | null;
  pnr?: string | null;
  passengerData?: unknown;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PAYMENT_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function getCountdown(createdAt: string) {
  if (!createdAt) return { expired: true, hours: 0, minutes: 0, seconds: 0 };
  const created = typeof createdAt === 'string' ? new Date(createdAt).getTime() : new Date(String(createdAt)).getTime();
  if (isNaN(created)) return { expired: true, hours: 0, minutes: 0, seconds: 0 };
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

function formatCurrency(amount: number) {
  if (!amount || isNaN(amount)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

function resolveAirlineName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  const upper = trimmed.toUpperCase();
  if (CARRIER_CODE_TO_AIRLINE[upper]) return CARRIER_CODE_TO_AIRLINE[upper];
  const lower = trimmed.toLowerCase();
  if (PROVIDER_ID_TO_LABEL[lower]) return PROVIDER_ID_TO_LABEL[lower];
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    const upperFirst = (parts[0] || '').toUpperCase();
    if (CARRIER_CODE_TO_AIRLINE[upperFirst]) return CARRIER_CODE_TO_AIRLINE[upperFirst];
  }
  for (const len of [3, 2]) {
    if (trimmed.length > len) {
      const code = trimmed.substring(0, len).toUpperCase();
      if (CARRIER_CODE_TO_AIRLINE[code]) return CARRIER_CODE_TO_AIRLINE[code];
    }
  }
  return trimmed;
}

function formatDate(dateString: string) {
  if (!dateString) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateString));
}

function formatShortDate(dateString: string) {
  if (!dateString) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(new Date(dateString));
}

function getNights(checkin: string, checkout: string) {
  const diff = new Date(checkout).getTime() - new Date(checkin).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getPassengerCount(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  return 0;
}

function getTimeGroup(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = startOfToday.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Hari ini';
  if (diffDays === 1) return 'Kemarin';
  if (diffDays <= 6) return 'Minggu ini';
  if (diffDays <= 30) return 'Bulan ini';
  return 'Lebih lama';
}

const TIME_GROUP_ORDER = ['Hari ini', 'Kemarin', 'Minggu ini', 'Bulan ini', 'Lebih lama'];

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  pending_payment: { label: 'Menunggu Pembayaran', dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  paid:            { label: 'Terkonfirmasi', dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  issued:          { label: 'Selesai', dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  payment_failed:  { label: 'Pembayaran Gagal', dot: 'bg-red-400', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  cancelled:       { label: 'Dibatalkan', dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
  expired:         { label: 'Kedaluwarsa', dot: 'bg-red-400', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  refund_requested:{ label: 'Refund Diproses', dot: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  refund:          { label: 'Berhasil Direfund', dot: 'bg-purple-400', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
};

const TYPE_CONFIG: Record<string, { icon: LucideIcon; gradient: string }> = {
  flight:    { icon: Plane, gradient: 'from-blue-500 to-blue-600' },
  hotel:     { icon: BedDouble, gradient: 'from-purple-500 to-purple-600' },
  train:     { icon: TrainFront, gradient: 'from-emerald-500 to-emerald-600' },
  insurance: { icon: ShieldCheck, gradient: 'from-orange-500 to-orange-600' },
};

const ITEMS_PER_PAGE = 6;

// ─── Countdown Component ──────────────────────────────────────────────────────
function PaymentCountdownBar({ createdAt }: { createdAt: string }) {
  const [cd, setCd] = useState({ expired: true, hours: 0, minutes: 0, seconds: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCd(getCountdown(createdAt));
    const timer = setInterval(() => {
      const next = getCountdown(createdAt);
      setCd(next);
      if (next.expired) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

  if (!mounted) return null;

  const urgency = cd.hours < 2;

  return (
    <div className={`px-3 sm:px-4 py-2.5 sm:py-3 border-t flex items-center justify-between gap-2 sm:gap-3 flex-wrap xs:flex-nowrap ${urgency ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <i className={`fa-solid fa-clock ${urgency ? 'text-red-500' : 'text-amber-500'} text-[11px] sm:text-xs shrink-0`}></i>
        <span className={`text-[11px] sm:text-xs font-medium ${urgency ? 'text-red-700' : 'text-amber-700'} shrink-0`}>
          Sisa waktu:
        </span>
        <div className="flex items-center gap-1">
          <span className={`text-[11px] sm:text-xs font-bold tabular-nums px-1.5 py-0.5 rounded ${urgency ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
            {String(cd.hours).padStart(2, '0')}j
          </span>
          <span className={`text-[11px] sm:text-xs ${urgency ? 'text-red-400' : 'text-amber-400'}`}>:</span>
          <span className={`text-[11px] sm:text-xs font-bold tabular-nums px-1.5 py-0.5 rounded ${urgency ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
            {String(cd.minutes).padStart(2, '0')}m
          </span>
          <span className={`text-[11px] sm:text-xs ${urgency ? 'text-red-400' : 'text-amber-400'}`}>:</span>
          <span className={`text-[11px] sm:text-xs font-bold tabular-nums px-1.5 py-0.5 rounded ${urgency ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
            {String(cd.seconds).padStart(2, '0')}d
          </span>
        </div>
      </div>
      <span className={`text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all ml-auto ${
        urgency ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
      }`}>
        Bayar Sekarang
        <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px]"></i>
      </span>
    </div>
  );
}

const TABS = [
  { id: 'all', icon: 'fa-ticket' },
  { id: 'flight', icon: 'fa-plane' },
  { id: 'hotel', icon: 'fa-bed' },
  { id: 'train', icon: 'fa-train' },
  { id: 'insurance', icon: 'fa-shield-halved' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { language } = useLanguage();
  const t = i18n.bookings[language];
  const tc = i18n.common[language];

  const tabLabel = (id: string) => (id === 'all' ? t.tabs.all : t[id as 'flight' | 'hotel' | 'train' | 'insurance']);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  usePageTitle(
    activeTab === 'all' ? 'Pesanan Saya' : `Pesanan ${tabLabel(activeTab)}`
  );

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
    const interval = setInterval(fetchBookings, 30000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const filtered = useMemo(
    () => bookings.filter(b => activeTab === 'all' || b.bookingType === activeTab),
    [bookings, activeTab]
  );

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-brand-bgLight flex items-center justify-center pt-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-[3px] border-brand-orange border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">{tc.loading}</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedBookings = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const stats = {
    total: bookings.length,
    active: bookings.filter(b => ['paid', 'issued'].includes(b.status)).length,
    pending: bookings.filter(b => b.status === 'pending_payment').length,
    cancelled: bookings.filter(b => ['cancelled', 'payment_failed'].includes(b.status)).length,
    flight: bookings.filter(b => b.bookingType === 'flight').length,
    hotel: bookings.filter(b => b.bookingType === 'hotel').length,
    train: bookings.filter(b => b.bookingType === 'train').length,
    insurance: bookings.filter(b => b.bookingType === 'insurance').length,
  };

  return (
    <div className="min-h-screen bg-brand-bgLight">
      {/* ── Header Hero ── */}
      <div className="bg-brand-bgLight pt-[64px] md:pt-20 pb-4 sm:pb-6 px-3 sm:px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center text-brand-ink transition-all shadow-card shrink-0"
            >
              <i className="fa-solid fa-arrow-left text-xs sm:text-sm"></i>
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-brand-ink tracking-tight truncate">{t.title}</h1>
              <p className="text-brand-neutral text-xs sm:text-sm mt-1 sm:mt-1.5 line-clamp-2 sm:truncate">{t.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-16 space-y-3 sm:space-y-4">
        {/* Stat cards */}
        {bookings.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-floating p-3 sm:p-4 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Total Pesanan', value: stats.total, icon: 'fa-ticket', cls: 'text-brand-blue bg-brand-blue/10' },
              { label: 'Aktif', value: stats.active, icon: 'fa-circle-check', cls: 'text-emerald-600 bg-emerald-50' },
              { label: 'Menunggu Bayar', value: stats.pending, icon: 'fa-clock', cls: 'text-amber-600 bg-amber-50' },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left gap-1.5 sm:gap-3 px-1 sm:px-3 py-1.5 sm:py-2 rounded-xl">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${s.cls} flex items-center justify-center shrink-0`}>
                  <i className={`fa-solid ${s.icon} text-sm sm:text-base`}></i>
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-base sm:text-xl font-extrabold text-brand-ink leading-none">{s.value}</p>
                  <p className="text-[9px] sm:text-[11px] text-slate-400 font-semibold mt-1 truncate">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        {bookings.length > 0 && (
          <div className="relative bg-white rounded-2xl border border-slate-200 shadow-card">
            <div className="flex gap-1 p-1.5 pr-6 overflow-x-auto scrollbar-hide scroll-smooth snap-x">
              {TABS.map(tab => {
                const count = tab.id === 'all' ? stats.total : stats[tab.id as keyof typeof stats] || 0;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-semibold whitespace-nowrap transition-all shrink-0 snap-start ${
                      isActive
                        ? 'bg-gradient-to-r from-brand-orange to-orange-dark text-white shadow-glow-orange'
                        : 'text-slate-500 hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    {tab.id !== 'all' && <i className={`fa-solid ${tab.icon} text-[10px] sm:text-xs ${isActive ? 'text-white/90' : 'text-slate-400'}`}></i>}
                    {tabLabel(tab.id)}
                    <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Fade hint so the last tab doesn't look clipped when it overflows on mobile */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 rounded-r-2xl bg-gradient-to-l from-white to-transparent sm:hidden"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 sm:p-8 text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <i className="fa-solid fa-circle-exclamation text-red-400 text-lg sm:text-xl"></i>
            </div>
            <p className="text-slate-700 font-semibold text-sm sm:text-base">{error}</p>
            <button
              onClick={() => {
                setError('');
                setLoading(true);
                fetch('/api/user/bookings')
                  .then(r => r.json())
                  .then(data => {
                    if (data.bookings) setBookings(data.bookings);
                    else throw new Error(data.error);
                  })
                  .catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat'))
                  .finally(() => setLoading(false));
              }}
              className="mt-4 w-full sm:w-auto px-5 py-3 sm:py-2.5 bg-gradient-to-r from-brand-orange to-orange-dark hover:opacity-90 active:opacity-100 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 shadow-glow-orange"
            >
              <i className="fa-solid fa-arrow-rotate-right"></i>
              {tc.retry}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!error && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 sm:p-12 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-brand-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <i className="fa-solid fa-ticket text-brand-blue text-xl sm:text-2xl"></i>
            </div>
            <p className="text-slate-700 font-semibold text-base sm:text-lg">{t.empty}</p>
            <p className="text-slate-400 text-sm mt-1 mb-5 sm:mb-6">{t.emptySub}</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-brand-orange to-orange-dark hover:opacity-90 active:opacity-100 text-white text-sm font-semibold rounded-xl transition-opacity shadow-glow-orange"
            >
              <i className="fa-solid fa-magnifying-glass"></i>
              {t.searchBtn}
            </Link>
          </div>
        )}

        {/* Booking Cards */}
        {!error && paginatedBookings.length > 0 && (
          <div className="space-y-4 sm:space-y-5">
            {(() => {
              const groups: Record<string, typeof paginatedBookings> = {};
              for (const b of paginatedBookings) {
                const g = getTimeGroup(b.createdAt);
                if (!groups[g]) groups[g] = [];
                groups[g].push(b);
              }
              return TIME_GROUP_ORDER.filter(g => groups[g]?.length).map(group => (
                <div key={group}>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-2.5 px-1">{group}</h3>
                  <div className="space-y-3 sm:space-y-3.5">
                    {groups[group].map(booking => {
                      const statusCfg = STATUS_CONFIG[booking.status] || { dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', label: booking.status };
                      const typeCfg = TYPE_CONFIG[booking.bookingType] || { icon: HelpCircle, gradient: 'from-slate-400 to-slate-500' };
                      const TypeIcon = typeCfg.icon;
                      const vendorLogo = getVendorLogo(booking.bookingType, booking.provider || '', booking.airlineName || '');
                      const isHotel = booking.bookingType === 'hotel';
                      const isFlight = booking.bookingType === 'flight';
                      const isTrain = booking.bookingType === 'train';

                      const mainInfo = isHotel
                        ? booking.hotelName || '-'
                        : booking.routeLabel || `${booking.origin || ''} → ${booking.destination || ''}`;

                      const dateInfo = isHotel && booking.checkinDate && booking.checkoutDate
                        ? `${formatShortDate(booking.checkinDate)} — ${formatShortDate(booking.checkoutDate)}`
                        : booking.departureDate
                          ? formatDate(booking.departureDate)
                          : formatDate(booking.createdAt);

                      const subtitleInfo = isHotel
                        ? booking.checkinDate && booking.checkoutDate
                          ? `${getNights(booking.checkinDate, booking.checkoutDate)} ${t.night}`
                          : null
                        : (isFlight || isTrain) && booking.airlineName
                          ? resolveAirlineName(booking.airlineName)
                          : null;

                      const paxCount = getPassengerCount(booking.passengerData);
                      const hasPnr = !!booking.pnr;
                      const hasFlightNo = !!booking.flightNumber;

                      return (
                        <div
                          key={booking.id}
                          className="group bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden hover:shadow-floating hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
                        >
                          <div className={`h-1 bg-gradient-to-r ${typeCfg.gradient}`}></div>
                          <Link href={`/bookings/${booking.id}`} className="block">
                            <div className="p-3.5 sm:p-4 md:p-5">
                              <div className="flex items-start gap-2.5 sm:gap-3.5">
                                {/* Type Icon */}
                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl shrink-0 shadow-card overflow-hidden relative bg-gradient-to-br ${typeCfg.gradient}`}>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <TypeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.2} />
                                  </div>
                                  {vendorLogo && (
                                    <img
                                      src={vendorLogo}
                                      alt={booking.airlineName || ''}
                                      className="relative w-full h-full object-contain bg-white p-2 sm:p-2.5"
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  )}
                                </div>

                                {/* Main Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <span className="font-extrabold text-brand-ink text-xs sm:text-sm">{booking.orderNumber || booking.id}</span>
                                    <span className={`inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${booking.status === 'pending_payment' ? 'animate-pulse' : ''}`}></span>
                                      {statusCfg.label}
                                    </span>
                                  </div>
                                  <p className="text-slate-700 font-semibold text-xs sm:text-sm mt-1 truncate">{mainInfo}</p>
                                  {subtitleInfo && (
                                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                      <i className={`fa-solid ${isHotel ? 'fa-moon' : 'fa-plane'} text-[10px]`}></i>
                                      {subtitleInfo}
                                    </p>
                                  )}
                                </div>

                                {/* Price + CTA */}
                                <div className="text-right shrink-0">
                                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.startsFrom}</p>
                                  <p className="mt-0.5 font-extrabold text-brand-ink text-sm sm:text-base whitespace-nowrap">{formatCurrency(booking.totalAmount)}</p>
                                  <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-brand-blue group-hover:text-brand-orange transition-colors">
                                    {t.viewDetails}
                                    <i className="fa-solid fa-chevron-right text-[10px] group-hover:translate-x-0.5 transition-transform"></i>
                                  </span>
                                  <i className="fa-solid fa-chevron-right text-[10px] text-brand-blue sm:hidden"></i>
                                </div>
                              </div>

                              {/* Card Footer - Details */}
                              <div className="mt-3 sm:mt-3.5 pt-3 sm:pt-3.5 border-t border-dashed border-slate-100 flex flex-wrap items-center gap-x-3 sm:gap-x-5 gap-y-1.5 sm:gap-y-2 text-[11px] sm:text-xs text-slate-400">
                                <span className="flex items-center gap-1.5">
                                  <i className="fa-regular fa-calendar text-[11px] text-brand-blue"></i>
                                  {dateInfo}
                                </span>

                                {paxCount > 0 && (
                                  <span className="flex items-center gap-1.5">
                                    <i className="fa-solid fa-users text-[11px] text-brand-blue"></i>
                                    <span className="font-medium text-slate-500">{paxCount} {t.pax}</span>
                                  </span>
                                )}

                                {hasFlightNo && (
                                  <span className="flex items-center gap-1.5">
                                    <i className="fa-solid fa-plane text-[10px] text-brand-blue"></i>
                                    <span className="font-medium text-slate-500">{booking.flightNumber}</span>
                                  </span>
                                )}

                                {hasPnr && (
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-brand-orange bg-orange-light px-2 py-0.5 rounded-md">
                                    <i className="fa-solid fa-qrcode text-[10px]"></i>
                                    PNR {booking.pnr}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>

                          {/* Payment Action - only for pending */}
                          {booking.status === 'pending_payment' && (
                            <Link href={`/payment/${booking.id}`} className="block">
                              <PaymentCountdownBar createdAt={booking.createdAt} />
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* Pagination */}
        {!error && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mt-2 pt-2 px-1">
            <p className="text-xs sm:text-sm text-slate-400 text-center sm:text-left">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}—{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} {language === 'ID' ? 'dari' : 'of'} {filtered.length}
            </p>
            <div className="flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 sm:w-9 sm:h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:bg-brand-orange/5 hover:text-brand-orange hover:border-brand-orange/30 active:bg-brand-orange/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all shrink-0 ${
                    currentPage === page
                      ? 'bg-gradient-to-r from-brand-orange to-orange-dark text-white shadow-glow-orange'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-brand-orange/30 hover:text-brand-orange active:bg-brand-orange/10'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:bg-brand-orange/5 hover:text-brand-orange hover:border-brand-orange/30 active:bg-brand-orange/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
