'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Search, Plane, Hotel, Train, Shield, CheckCircle, XCircle, Clock, AlertTriangle, Banknote, type LucideIcon } from 'lucide-react';
import Pagination from '@/components/admin/Pagination';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

interface AdminBooking {
  id: string;
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
  const [bookings, setBookings] = useState<AdminBooking[]>(initialBookings || []);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);

  const searchRef = useRef(searchQuery);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => { searchRef.current = searchQuery; }, [searchQuery]);

  // Sinkronkan state lokal saat server component merender ulang (navigasi URL).
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  useEffect(() => { setSearchQuery(initialQuery); }, [initialQuery]);
  useEffect(() => { setPage(initialPage); }, [initialPage]);
  useEffect(() => { setBookings(initialBookings || []); }, [initialBookings]);

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

  async function updateBookingStatus(id: string, status: string) {
    try {
      setUpdatingBookingId(id);
      setStatusMessage('');
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        setBookings((prev) => prev.map(b => (b.id === id ? { ...b, status } : b)));
        setStatusType('success');
        setStatusMessage(`Status pesanan ${id} berhasil diubah menjadi ${status}.`);
      } else {
        setStatusType('error');
        setStatusMessage(json.error || 'Gagal mengupdate status pesanan.');
      }
    } catch (err) {
      console.error(err);
      setStatusType('error');
      setStatusMessage('Terjadi kesalahan saat menghubungi server. Silakan coba lagi.');
    } finally {
      setUpdatingBookingId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Manajemen Pesanan</h1>
          <p className="text-brand-neutral text-sm mt-0.5">Pantau dan kelola seluruh transaksi pelanggan.</p>
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

        {statusMessage ? (
          <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${statusType === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
            {statusMessage}
          </div>
        ) : null}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Order ID & Waktu</th>
                <th className="px-5 py-4">Pelanggan</th>
                <th className="px-5 py-4">Layanan</th>
                <th className="px-5 py-4">Total Harga</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Aksi</th>
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
                        <div className="font-bold text-slate-800">{b.id}</div>
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
                        <div className="flex items-center justify-center gap-2">
                          {b.status === 'pending_payment' && (
                            <button
                              onClick={() => updateBookingStatus(b.id, 'paid')}
                              disabled={updatingBookingId === b.id}
                              className={`px-3 py-1 text-xs rounded-md ${updatingBookingId === b.id ? 'bg-emerald-200 text-white/70 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                            >
                              {updatingBookingId === b.id ? 'Updating...' : 'Mark Paid'}
                            </button>
                          )}
                          {b.status !== 'cancelled' && (
                            <button
                              onClick={() => updateBookingStatus(b.id, 'cancelled')}
                              disabled={updatingBookingId === b.id}
                              className={`px-3 py-1 text-xs rounded-md ${updatingBookingId === b.id ? 'bg-red-200 text-red-400 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                            >
                              {updatingBookingId === b.id ? 'Processing...' : 'Cancel'}
                            </button>
                          )}
                          <a href={`/admin/bookings/${b.id}`} className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded-md">View</a>
                        </div>
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