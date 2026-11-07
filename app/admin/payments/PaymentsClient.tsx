'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Search, CheckCircle, Clock, XCircle, AlertCircle, CreditCard,
  ExternalLink, RefreshCw, type LucideIcon,
} from 'lucide-react';
import Pagination from '@/components/admin/Pagination';

const PAGE_SIZE = 10;

interface PaymentBooking {
  id: string;
  status?: string;
  user?: { name?: string | null } | null;
}

interface AdminPayment {
  id: string;
  orderId: string;
  bookingId: string;
  amount: number;
  paymentType?: string | null;
  status: string;
  createdAt: string | Date;
  booking?: PaymentBooking | null;
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'pending', label: 'Pending' },
  { key: 'deny', label: 'Deny' },
  { key: 'expire', label: 'Expire' },
  { key: 'cancel', label: 'Cancel' },
];

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  settlement: { label: 'Settlement', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  capture:    { label: 'Capture',    cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  pending:    { label: 'Pending',    cls: 'bg-amber-100 text-amber-700', icon: Clock },
  deny:       { label: 'Deny',       cls: 'bg-red-100 text-red-600', icon: XCircle },
  expire:     { label: 'Expire',     cls: 'bg-slate-200 text-slate-600', icon: AlertCircle },
  cancel:     { label: 'Cancel',     cls: 'bg-slate-200 text-slate-600', icon: XCircle },
};

export default function PaymentsClient({ initialPayments }: { initialPayments: AdminPayment[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [payments, setPayments] = useState(initialPayments);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncMessageType, setSyncMessageType] = useState<'success' | 'warning' | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const filtered = payments.filter((p) => {
    const query = searchQuery.toLowerCase();
    const matchSearch =
      p.orderId.toLowerCase().includes(query) ||
      p.bookingId.toLowerCase().includes(query) ||
      (p.booking?.user?.name || '').toLowerCase().includes(query);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function handleSync(p: AdminPayment) {
    setSyncingId(p.id);
    setSyncMessage(null);
    setSyncMessageType(null);
    setSyncError(null);
    try {
      const res = await fetch('/api/admin/payments/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: p.orderId }),
      });
      const data = await res.json() as {
        error?: string;
        payment?: AdminPayment;
        lateSettlement?: boolean;
        warnings?: string[];
      };
      if (!res.ok) {
        throw new Error(data.error || 'Status pembayaran gagal diperiksa.');
      }
      const syncedPayment = data.payment;
      if (syncedPayment) setPayments((prev) => prev.map((x) => (x.id === p.id ? syncedPayment : x)));
      if (data.lateSettlement) {
        setSyncMessage('Dana diterima setelah batas pembayaran. Pesanan tidak diaktifkan dan perlu ditindaklanjuti sebagai refund.');
        setSyncMessageType('warning');
      } else if (data.warnings?.length) {
        setSyncMessage(data.warnings.join(' '));
        setSyncMessageType('warning');
      } else {
        setSyncMessage('Status pembayaran berhasil diperiksa dan diselaraskan dengan pesanan.');
        setSyncMessageType('success');
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Status pembayaran gagal diperiksa.');
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Log Pembayaran (Midtrans)</h1>
          <p className="text-brand-neutral text-sm mt-0.5">Periksa transaksi ke Midtrans dan selaraskan status pesanan dengan alur pembayaran yang berlaku.</p>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {syncMessage && (
          <p
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${
              syncMessageType === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {syncMessage}
          </p>
        )}
        {syncError && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {syncError}
          </p>
        )}
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const count = tab.key === 'all'
              ? payments.length
              : payments.filter((p) => p.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === tab.key
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Order ID, Booking ID, atau nama..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">{filtered.length} data</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Waktu Transaksi</th>
                <th className="px-5 py-4">Order ID (Midtrans)</th>
                <th className="px-5 py-4">Nama</th>
                <th className="px-5 py-4">Nominal</th>
                <th className="px-5 py-4">Metode Bayar</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500">Tidak ada data pembayaran.</td></tr>
              ) : (
                visible.map((p) => {
                  const badge = STATUS_BADGE[p.status] || { label: p.status, cls: 'bg-slate-100 text-slate-600', icon: Clock };
                  const isSyncing = syncingId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800">{format(new Date(p.createdAt), 'dd MMM yyyy', { locale: localeId })}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{format(new Date(p.createdAt), 'HH:mm:ss')}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-700">{p.orderId}</div>
                        <div className="text-[11px] text-orange-600 font-semibold mt-0.5">Booking: {p.bookingId}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{p.booking?.user?.name || '-'}</td>
                      <td className="px-5 py-4 font-bold text-slate-800">{formatRupiah(p.amount)}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold capitalize">
                          <CreditCard className="w-3.5 h-3.5" /> {p.paymentType?.replace('_', ' ') || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${badge.cls}`}>
                          <badge.icon className="w-3.5 h-3.5" /> {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/admin/bookings/${p.bookingId}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                            title="Lihat Booking"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleSync(p)}
                            disabled={isSyncing}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-40"
                            title="Periksa status di Midtrans"
                            aria-label={`Periksa status pembayaran ${p.orderId} di Midtrans`}
                          >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span className="hidden xl:inline">{isSyncing ? 'Memeriksa' : 'Periksa status'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          itemLabel="pembayaran"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
