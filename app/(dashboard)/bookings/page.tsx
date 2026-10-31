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
import AccountSidebar from '@/components/account/AccountSidebar';
import {
  Plane,
  BedDouble,
  TrainFront,
  ShieldCheck,
  Search,
  X,
  CalendarDays,
  Users,
  Ticket,
  Clock,
  ChevronRight,
  ArrowRight,
  Inbox,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

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
  paidAt?: string | null;
  discountAmount?: number | null;
  couponCode?: string | null;
  roomCount?: number | null;
  adultCount?: number | null;
  childCount?: number | null;
  nights?: number | null;
  roomDescription?: string | null;
  mealType?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PAYMENT_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 8;

const TYPE_META: Record<string, { icon: LucideIcon; tile: string; labelKey: 'flight' | 'hotel' | 'train' | 'insurance' }> = {
  flight: { icon: Plane, tile: 'bg-blue-50 text-brand-blue', labelKey: 'flight' },
  hotel: { icon: BedDouble, tile: 'bg-violet-50 text-violet-600', labelKey: 'hotel' },
  train: { icon: TrainFront, tile: 'bg-emerald-50 text-emerald-600', labelKey: 'train' },
  insurance: { icon: ShieldCheck, tile: 'bg-orange-50 text-brand-orange', labelKey: 'insurance' },
};

function getCountdown(createdAt: string) {
  const created = createdAt ? new Date(createdAt).getTime() : NaN;
  if (isNaN(created)) return { expired: true, hours: 0, minutes: 0, seconds: 0 };
  const remaining = created + PAYMENT_TIMEOUT_MS - Date.now();
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
  const first = trimmed.split(/\s+/)[0]?.toUpperCase();
  if (first && CARRIER_CODE_TO_AIRLINE[first]) return CARRIER_CODE_TO_AIRLINE[first];
  for (const len of [3, 2]) {
    if (trimmed.length > len) {
      const code = trimmed.substring(0, len).toUpperCase();
      if (CARRIER_CODE_TO_AIRLINE[code]) return CARRIER_CODE_TO_AIRLINE[code];
    }
  }
  return trimmed;
}

function formatDate(dateString: string | null | undefined, language: string) {
  if (!dateString) return '-';
  return new Intl.DateTimeFormat(language === 'ID' ? 'id-ID' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString));
}

function formatDateRange(start?: string | null, end?: string | null, language = 'ID') {
  if (!start) return '-';
  if (!end) return formatDate(start, language);
  return `${formatDate(start, language)} — ${formatDate(end, language)}`;
}

function getNights(checkin?: string | null, checkout?: string | null, fallback?: number | null) {
  if (fallback) return fallback;
  if (!checkin || !checkout) return 1;
  const diff = new Date(checkout).getTime() - new Date(checkin).getTime();
  if (diff <= 0) return 1;
  return Math.max(1, Math.round(diff / 86400000));
}

function getPassengerCount(data: unknown): number {
  return Array.isArray(data) ? data.length : 0;
}

function passengerSearchText(data: unknown): string {
  if (!Array.isArray(data)) return '';
  return data
    .map((p: Record<string, unknown>) => `${p?.title || ''} ${p?.first_name || ''} ${p?.last_name || ''}`)
    .join(' ');
}

function bookingEndDate(b: Booking): Date | null {
  const raw = b.bookingType === 'hotel' ? b.checkoutDate || b.checkinDate : b.departureDate;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function isPastBooking(b: Booking): boolean {
  const end = bookingEndDate(b);
  if (!end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end.getTime() < today.getTime();
}

function isActiveBooking(b: Booking): boolean {
  if (b.status === 'pending_payment' || b.status === 'paid') return true;
  if (b.status === 'issued') return !isPastBooking(b);
  return false;
}

function monthLabel(dateString: string | null | undefined, language: string) {
  const d = dateString ? new Date(dateString) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  return new Intl.DateTimeFormat(language === 'ID' ? 'id-ID' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(safe);
}

const STATUS_STYLE: Record<string, { text: string; bg: string; dot: string }> = {
  pending_payment: { text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  paid: { text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  issued: { text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  payment_failed: { text: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
  expired: { text: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
  cancelled: { text: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  refund_requested: { text: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  refund: { text: 'text-violet-700', bg: 'bg-violet-50', dot: 'bg-violet-500' },
};

// ─── Countdown bar ────────────────────────────────────────────────────────────
function PaymentBar({ createdAt, labels }: { createdAt: string; labels: { payWithin: string; payNow: string } }) {
  const [cd, setCd] = useState(() => getCountdown(createdAt));

  useEffect(() => {
    const timer = setInterval(() => setCd(getCountdown(createdAt)), 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

  if (cd.expired) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-red-50 border-t border-red-100">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700">
          <Clock className="w-3.5 h-3.5" />
          {labels.payWithin}: 00:00:00
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-red-600 px-2.5 py-1 rounded-md">
          {labels.payNow}
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    );
  }

  const urgency = cd.hours < 2;
  const tone = urgency ? 'bg-red-50 border-red-100 text-red-700' : 'bg-amber-50 border-amber-100 text-amber-800';
  const btn = urgency ? 'bg-red-600' : 'bg-brand-orange';

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 border-t ${tone}`}>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
        <Clock className="w-3.5 h-3.5" />
        {labels.payWithin}
        <span className="font-mono tabular-nums">
          {String(cd.hours).padStart(2, '0')}:{String(cd.minutes).padStart(2, '0')}:{String(cd.seconds).padStart(2, '0')}
        </span>
      </span>
      <span className={`inline-flex items-center gap-1 text-[11px] font-bold text-white ${btn} px-2.5 py-1 rounded-md`}>
        {labels.payNow}
        <ArrowRight className="w-3 h-3" />
      </span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function BookingSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 animate-pulse">
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-xl bg-slate-100 shrink-0" />
        <div className="flex-1 space-y-2.5 py-0.5">
          <div className="h-2.5 w-28 rounded bg-slate-100" />
          <div className="h-3.5 w-2/3 rounded bg-slate-100" />
          <div className="h-2.5 w-1/2 rounded bg-slate-100" />
        </div>
        <div className="hidden sm:block w-20 space-y-2 py-1">
          <div className="h-2.5 w-full rounded bg-slate-100" />
          <div className="h-3.5 w-full rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BookingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { language } = useLanguage();
  const t = i18n.bookings[language];

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [service, setService] = useState<'all' | 'flight' | 'hotel' | 'train' | 'insurance'>('all');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  usePageTitle(t.title);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const resetVisible = () => setVisible(PAGE_SIZE);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    async function load(silent = false) {
      if (!silent) setLoading(true);
      try {
        const res = await fetch('/api/user/bookings');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat pesanan');
        if (!cancelled) {
          setBookings(Array.isArray(data.bookings) ? data.bookings : []);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat pesanan');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status]);

  const activeBookings = useMemo(() => {
    return bookings
      .filter(isActiveBooking)
      .sort((a, b) => {
        const aPending = a.status === 'pending_payment' ? 0 : 1;
        const bPending = b.status === 'pending_payment' ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        const aDate = bookingEndDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDate = bookingEndDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });
  }, [bookings]);

  const historyBookings = useMemo(() => {
    return bookings
      .filter((b) => !isActiveBooking(b))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings]);

  const source = tab === 'active' ? activeBookings : historyBookings;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter((b) => {
      if (service !== 'all' && b.bookingType !== service) return false;
      if (!q) return true;
      const haystack = [
        b.orderNumber,
        b.id,
        b.routeLabel,
        b.hotelName,
        b.airlineName,
        b.origin,
        b.destination,
        b.flightNumber,
        b.pnr,
        passengerSearchText(b.passengerData),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [source, service, query]);

  const shown = filtered.slice(0, visible);

  const statusLabel = (key: string) => (t.statusMap as Record<string, string | undefined>)[key] || key;

  const renderCard = (b: Booking) => {
    const meta = TYPE_META[b.bookingType] || TYPE_META.flight;
    const Icon = meta.icon;
    const statusStyle = STATUS_STYLE[b.status] || STATUS_STYLE.cancelled;
    const isHotel = b.bookingType === 'hotel';
    const isTransport = b.bookingType === 'flight' || b.bookingType === 'train';
    const logo = getVendorLogo(b.bookingType, b.provider || '', b.airlineName || '');
    const pax = b.adultCount || b.childCount ? (b.adultCount || 0) + (b.childCount || 0) : getPassengerCount(b.passengerData);

    const title = isHotel
      ? b.hotelName || '-'
      : b.bookingType === 'insurance'
        ? t.services.insurance
        : b.routeLabel || `${b.origin || ''}${b.origin && b.destination ? ' → ' : ''}${b.destination || ''}`;

    const subtitle = isHotel
      ? [
          `${getNights(b.checkinDate, b.checkoutDate, b.nights)} ${t.night}`,
          b.roomCount ? `${b.roomCount} ${t.room}` : null,
          b.roomDescription,
        ].filter(Boolean).join(' · ')
      : isTransport
        ? [b.airlineName ? (b.bookingType === 'flight' ? resolveAirlineName(b.airlineName) : b.airlineName) : null, b.flightNumber]
            .filter(Boolean)
            .join(' · ')
        : 'Perlindungan perjalanan';

    const dateText = isHotel
      ? formatDateRange(b.checkinDate, b.checkoutDate, language)
      : formatDate(b.departureDate || b.createdAt, language);

    return (
      <article
        key={b.id}
        className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden hover:border-slate-300 transition-colors"
      >
        <Link href={`/bookings/${b.id}`} className="block p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="shrink-0 flex flex-col gap-2">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${meta.tile}`}>
                <Icon className="w-5 h-5" strokeWidth={2} />
              </div>
              {logo ? (
                <div className="w-11 h-11 rounded-lg border border-slate-100 bg-white flex items-center justify-center p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      const el = e.currentTarget.parentElement;
                      if (el) el.style.display = 'none';
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] text-slate-400">{b.orderNumber || b.id}</span>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                  {statusLabel(b.status)}
                </span>
              </div>

              <h3 className="mt-1 text-sm sm:text-[15px] font-bold text-brand-ink truncate">{title}</h3>
              {subtitle ? <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p> : null}

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                  {dateText}
                </span>
                {pax > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {pax} {t.pax}
                  </span>
                )}
                {b.pnr && (
                  <span className="inline-flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">{t.pnr} {b.pnr}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-end justify-between self-stretch shrink-0 text-right">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{t.total}</p>
                <p className="text-sm font-extrabold text-brand-ink whitespace-nowrap">{formatCurrency(b.totalAmount)}</p>
              </div>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-blue">
                {t.viewDetails}
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          <div className="sm:hidden mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{t.total}</p>
              <p className="text-sm font-extrabold text-brand-ink">{formatCurrency(b.totalAmount)}</p>
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-blue">
              {t.viewDetails}
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

        {b.status === 'pending_payment' && (
          <Link href={`/payment/${b.id}`} aria-label={`${t.payNow} ${b.orderNumber || b.id}`}>
            <PaymentBar createdAt={b.createdAt} labels={{ payWithin: t.payWithin, payNow: t.payNow }} />
          </Link>
        )}
      </article>
    );
  };

  // Group riwayat per bulan; pesanan aktif tetap urut jadwal.
  const grouped = useMemo(() => {
    if (tab === 'active') return [{ label: '', items: shown }];
    const map = new Map<string, Booking[]>();
    for (const b of shown) {
      const label = monthLabel(b.departureDate || b.checkinDate || b.createdAt, language);
      const list = map.get(label) || [];
      list.push(b);
      map.set(label, list);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [shown, tab, language]);

  const isLoading = status === 'loading' || loading;

  return (
    <div className="min-h-screen bg-brand-bgLight pt-[64px] md:pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          <AccountSidebar />

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="mb-5 sm:mb-6">
              <h1 className="text-xl sm:text-2xl font-extrabold text-brand-ink tracking-tight">{t.title}</h1>
              <p className="text-sm text-brand-neutral mt-1">{t.subtitle}</p>
            </div>

            {/* Tabs + search */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 pt-1.5 sm:pt-0">
                <div className="flex items-center gap-6">
                  {(['active', 'history'] as const).map((key) => {
                    const count = key === 'active' ? activeBookings.length : historyBookings.length;
                    const isOn = tab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setTab(key); resetVisible(); }}
                        className={`relative py-3.5 text-sm font-bold transition-colors ${
                          isOn ? 'text-brand-ink' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {t.tabs[key]}
                        <span
                          className={`ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                            isOn ? 'bg-orange-50 text-brand-orange' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                        {isOn && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-orange rounded-full" />}
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-64 pb-3 sm:pb-0">
                  <Search className="absolute left-3 top-[calc(50%-6px)] -translate-y-1/2 w-4 h-4 text-slate-400 sm:top-1/2" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); resetVisible(); }}
                    placeholder={t.searchPlaceholder}
                    aria-label={t.searchAria}
                    className="w-full h-10 pl-9 pr-9 rounded-xl border border-slate-200 bg-slate-50/60 text-[13px] text-brand-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/40 transition"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => { setQuery(''); resetVisible(); }}
                      aria-label="Clear"
                      className="absolute right-2.5 top-[calc(50%-6px)] -translate-y-1/2 sm:top-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter chips */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-5 py-3 border-t border-slate-100">
                {(['all', 'flight', 'hotel', 'train', 'insurance'] as const).map((key) => {
                  const isOn = service === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setService(key); resetVisible(); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        isOn
                          ? 'bg-brand-ink border-brand-ink text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {t.filters[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="mt-4 sm:mt-5">
              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => <BookingSkeleton key={i} />)}
                </div>
              ) : error ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 text-center">
                  <p className="text-sm font-semibold text-brand-ink">{error}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-ink text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <Loader2 className="w-4 h-4" />
                    {language === 'ID' ? 'Coba lagi' : 'Try again'}
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-10 sm:p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Inbox className="w-5 h-5 text-slate-400" strokeWidth={1.8} />
                  </div>
                  <p className="text-sm font-bold text-brand-ink">
                    {query || service !== 'all'
                      ? t.noResult
                      : tab === 'active'
                        ? t.emptyActive
                        : t.emptyHistory}
                  </p>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                    {query || service !== 'all'
                      ? t.noResultSub
                      : tab === 'active'
                        ? t.emptyActiveSub
                        : t.emptyHistorySub}
                  </p>
                  {tab === 'active' && !query && service === 'all' && (
                    <Link
                      href="/"
                      className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-orange-dark transition-colors"
                    >
                      {language === 'ID' ? 'Cari Perjalanan' : 'Find a Trip'}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  {grouped.map((group) => (
                    <section key={group.label || 'active'}>
                      {group.label && (
                        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                          {group.label}
                        </h2>
                      )}
                      <div className="space-y-3">
                        {group.items.map(renderCard)}
                      </div>
                    </section>
                  ))}

                  {filtered.length > visible && (
                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => setVisible((v) => v + PAGE_SIZE)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-brand-ink hover:border-slate-300 transition-colors"
                      >
                        {t.loadMore}
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
