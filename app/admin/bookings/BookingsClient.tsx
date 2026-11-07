'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Search, Plane, Hotel, Train, Shield, CheckCircle, XCircle, Clock, AlertTriangle, Banknote, type LucideIcon } from 'lucide-react';
import Pagination from '@/components/admin/Pagination';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

interface AdminBooking {
  id: string;
  orderNumber?: string | null;
  bookingType: string;
  status: string;
  totalAmount: number;
  pnr?: string | null;
  routeLabel?: string | null;
  hotelName?: string | null;
  /** 'settlement' | 'pending' | 'expire' | 'late_settlement' | ... */
  paymentStatus?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
  createdAt: string | Date;
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

const TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'flight', label: 'Pesawat' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'train', label: 'Kereta' },
  { id: 'insurance', label: 'Asuransi' },
];

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  pending_payment: { label: 'Menunggu',       cls: 'bg-amber-100 text-amber-700', icon: Clock },
  paid:            { label: 'Dibayar',        cls: 'bg-blue-100 text-blue-700',   icon: CheckCircle },
  issued:          { label: 'Issued',         cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  payment_failed:  { label: 'Pembayaran Gagal', cls: 'bg-red-100 text-red-600',   icon: AlertTriangle },
  cancelled:       { label: 'Batal',          cls: 'bg-red-100 text-red-600',      icon: XCircle },
  expired:         { label: 'Kedaluwarsa',    cls: 'bg-red-100 text-red-600',      icon: AlertTriangle },
  refund_requested:{ label: 'Refund Diminta', cls: 'bg-orange-100 text-orange-700', icon: Clock },
  refund:          { label: 'Refund Proses',  cls: 'bg-purple-100 text-purple-700', icon: Clock },
};

// Pembayaran yang masuk SETELAT setelah window 1 jam (lib/late-settlement.ts):
// status booking tidak diubah ke paid, tapi uangnya sudah diterima Midtrans —
// wajib ketahuan kasir untuk ditindaklanjuti (refund manual).
export const LATE_SETTLEMENT_LABEL = 'Dana Telat — Refund';

const TYPE_ICON: Record<string, LucideIcon> = { flight: Plane, hotel: Hotel, train: Train, insurance: Shield };

export default function BookingsClient({
  initialBookings,
  initialTotal,
  initialPage,
  initialTab,
  initialQuery,
}: {
  initialBookings: AdminBooking[];
  initialTotal: number;
  initialPage: number;
  initialTab: string;
  initialQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);
  const bookings = initialBookings || [];

  const timeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  const apply = (next: { tab?: string; q?: string; p?: number }) => {
    const params = new URLSearchParams();
    const tab = next.tab ?? activeTab;
    if (tab && tab !== 'all') params.set('tab', tab);
    const q = (next.q !== undefined ? next.q : searchQuery).trim();
    if (q) params.set('q', q);
    params.set('page', String(next.p ?? 1));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(initialTotal / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Manajemen Pesanan</h1>
          <p className="text-brand-neutral text-sm mt-0.5">Cari pesanan dan buka detail untuk melihat pembayaran, perjalanan, serta tindakan yang tersedia.</p>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex overflow-x-auto scrollbar-hide gap-2">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); apply({ tab: tab.id, p: 1 }); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >{tab.label}</button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Cari Order ID, PNR, Nama..." value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
                timeoutRef.current = window.setTimeout(() => apply({ q: value, p: 1 }), SEARCH_DEBOUNCE_MS);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Order ID & Waktu</th>
                <th className="px-5 py-4">Pelanggan</th>
                <th className="px-5 py-4">Layanan</th>
                <th className="px-5 py-4">Total Harga</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {bookings.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Tidak ada pesanan ditemukan.</td></tr>
              ) : (
                bookings.map((b) => {
                  const badge = STATUS_BADGE[b.status] || { label: b.status, cls: 'bg-slate-100 text-slate-700', icon: Clock };
                  const TypeIcon = TYPE_ICON[b.bookingType] || Plane;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">{b.orderNumber || b.id}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{format(new Date(b.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-700">{b.user?.name || 'Guest'}</div>
                        <div className="text-[11px] text-slate-500">{b.user?.email || '-'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600"><TypeIcon className="w-3.5 h-3.5" /></div>
                          <span className="font-medium text-slate-700 capitalize text-xs">{b.bookingType}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600">{b.routeLabel || b.hotelName || '-'}</div>
                        {b.pnr && <div className="text-[10px] font-bold text-orange-600 mt-0.5">PNR: {b.pnr}</div>}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-800">{formatRupiah(b.totalAmount)}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${badge.cls}`}>
                          <badge.icon className="w-3.5 h-3.5" />{badge.label}
                        </span>
                        {b.paymentStatus === 'late_settlement' && (
                          <a
                            href={`/admin/bookings/${b.id}`}
                            title="Pembayaran masuk lewat dari batas 1 jam — booking tidak diterbitkan, dana perlu direfund manual."
                            className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200 transition-colors"
                          >
                            <Banknote className="w-3.5 h-3.5" />{LATE_SETTLEMENT_LABEL}
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                        >
                          Lihat detail
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={initialTotal}
          pageSize={PAGE_SIZE}
          itemLabel="pesanan"
          onPageChange={(p) => { setPage(p); apply({ p }); }}
        />
      </div>
    </div>
  );
}