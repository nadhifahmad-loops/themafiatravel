'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Search, Plane, Hotel, Train, Shield, Clock3, CheckCircle2, ArrowRightLeft, RefreshCw, AlertTriangle, Banknote, type LucideIcon } from 'lucide-react';
import Pagination from '@/components/admin/Pagination';

interface AdminRefundBooking {
  id: string;
  orderNumber?: string | null;
  bookingType: string;
  status: string;
  totalAmount: number;
  currency?: string;
  pnr?: string | null;
  routeLabel?: string | null;
  hotelName?: string | null;
  flightNumber?: string | null;
  provider?: string | null;
  cancelReason?: string | null;
  cancelType?: string | null;
  paymentStatus?: string | null;
  paymentId?: string | null;
  paymentType?: string | null;
  refundRequest?: { amount?: number | null; reason?: string; requestedAt?: string; mode?: string } | null;
  refundResult?: { amount?: number; refundedAt?: string; processedBy?: string } | null;
  flightRefundEstimate?: { amount?: number | null; capturedAt?: string } | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  user?: { name?: string | null; email?: string | null } | null;
}

const PAGE_SIZE = 10;

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  refund_requested: { label: 'Menunggu Review', cls: 'bg-orange-100 text-orange-700', icon: Clock3 },
  refund: { label: 'Refund Diproses', cls: 'bg-purple-100 text-purple-700', icon: RefreshCw },
  expired: { label: 'Kedaluwarsa', cls: 'bg-red-100 text-red-600', icon: AlertTriangle },
};

const TYPE_ICON: Record<string, LucideIcon> = { flight: Plane, hotel: Hotel, train: Train, insurance: Shield };

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function RefundAmountBadge({ amount }: { amount?: number | null }) {
  if (amount === null || amount === undefined) return null;
  return <div className="text-[11px] font-bold text-emerald-700 mt-0.5">Refund: {formatRupiah(amount)}</div>;
}

function ProcessedBadge({ processedBy }: { processedBy?: string | null }) {
  if (!processedBy) return null;
  const isAuto = processedBy === 'auto';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isAuto ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
      {isAuto ? 'Otomatis' : 'Review Admin'}
    </span>
  );
}

export default function RefundQueueClient({
  initialReview,
  initialLate,
  initialHistory,
}: {
  initialReview: AdminRefundBooking[];
  initialLate: AdminRefundBooking[];
  initialHistory: AdminRefundBooking[];
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<AdminRefundBooking[]>(initialReview || []);
  // Tanpa setter: aksi pada dana telat dilakukan manual di dashboard Midtrans,
  // jadi daftar ini hanya tampilan dan cukup dibaca sekali dari server.
  const [lateSettlements] = useState<AdminRefundBooking[]>(initialLate || []);
  const [history, setHistory] = useState<AdminRefundBooking[]>(initialHistory || []);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});

  const matches = useMemo(() => {
    const term = searchQuery.toLowerCase();
    return (booking: AdminRefundBooking) => {
      const haystack = [booking.id, booking.orderNumber, booking.pnr, booking.user?.name, booking.user?.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    };
  }, [searchQuery]);

  const filteredReview = useMemo(() => review.filter(matches), [review, matches]);
  const filteredLate = useMemo(() => lateSettlements.filter(matches), [lateSettlements, matches]);
  const filteredHistory = useMemo(() => history.filter(matches), [history, matches]);

  const totalPages = Math.max(1, Math.ceil(filteredReview.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filteredReview.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function processRefund(id: string) {
    const row = review.find((booking) => booking.id === id);
    const rawAmount = refundAmounts[id] ?? (
      typeof row?.refundRequest?.amount === 'number' ? String(row.refundRequest.amount) : ''
    );
    const amount = Number(rawAmount);
    if (!rawAmount.trim() || !Number.isFinite(amount) || amount < 0) {
      setStatusType('error');
      setStatusMessage('Masukkan nominal refund nol atau lebih yang sudah diverifikasi sebelum memproses dana.');
      return;
    }

    try {
      setProcessingId(id);
      setStatusMessage('');
      const res = await fetch(`/api/bookings/${id}/refund-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (json.success) {
        const processedAmount = json.data?.amount;
        setReview((prev) => prev.filter((booking) => booking.id !== id));
        if (row) {
          setHistory((prev) =>
            [
              {
                ...row,
                status: 'cancelled',
                refundResult: {
                  amount: processedAmount ?? amount,
                  refundedAt: new Date().toISOString(),
                  processedBy: 'admin',
                },
              },
              ...prev,
            ].slice(0, 20)
          );
        }
        setStatusType('success');
        setStatusMessage(json.data?.noRefund
          ? 'Nominal refund terverifikasi Rp0. Booking ditutup tanpa pengembalian dana.'
          : 'Refund berhasil diproses. Dana dikembalikan ke pelanggan.');
      } else {
        setStatusType('error');
        setStatusMessage(json.message || 'Gagal memproses refund.');
      }
    } catch (error) {
      console.error(error);
      setStatusType('error');
      setStatusMessage('Terjadi kesalahan saat menghubungi server.');
    } finally {
      setProcessingId(null);
    }
  }

  const searchInput = (
    <div className="relative w-full md:w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type="text"
        value={searchQuery}
        onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }}
        placeholder="Cari order, PNR, pelanggan..."
        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
      />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-brand-ink">Antrian Refund</h1>
        <p className="text-brand-neutral text-sm">
          Refund otomatis diproses langsung; refund manual masuk antrian review dan menunggu eksekusi admin.
        </p>
      </div>

      {statusMessage ? (
        <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${statusType === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
          {statusMessage}
        </div>
      ) : null}

      {/* ── ANTIAN REVIEW ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ArrowRightLeft className="w-4 h-4 text-orange-500" />
            <span className="font-bold">Antrian Review</span>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{review.length}</span>
          </div>
          {searchInput}
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Booking</th>
                <th className="px-5 py-4">Pelanggan</th>
                <th className="px-5 py-4">Layanan</th>
                <th className="px-5 py-4">Nilai</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">Saat ini tidak ada refund yang menunggu review.</td>
                </tr>
              ) : (
                visible.map((booking) => {
                  const badge = STATUS_BADGE[booking.status] || { label: booking.status, cls: 'bg-slate-100 text-slate-700', icon: Clock3 };
                  const TypeIcon = TYPE_ICON[booking.bookingType] || Plane;
                  const refundAmountInput = refundAmounts[booking.id] ?? (
                    typeof booking.refundRequest?.amount === 'number' ? String(booking.refundRequest.amount) : ''
                  );
                  const numericRefundAmount = Number(refundAmountInput);
                  const canProcessRefund = refundAmountInput.trim() !== ''
                    && Number.isFinite(numericRefundAmount)
                    && numericRefundAmount >= 0;
                  return (
                    <tr key={booking.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">{booking.orderNumber || booking.id}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{format(new Date(booking.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-700">{booking.user?.name || 'Guest'}</div>
                        <div className="text-[11px] text-slate-500">{booking.user?.email || '-'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600"><TypeIcon className="w-3.5 h-3.5" /></div>
                          <span className="font-medium text-slate-700 capitalize text-xs">{booking.bookingType}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600">{booking.routeLabel || booking.hotelName || booking.flightNumber || '-'}</div>
                        {booking.pnr && <div className="text-[10px] font-bold text-orange-600 mt-0.5">PNR: {booking.pnr}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">{formatRupiah(booking.totalAmount)}</div>
                        <RefundAmountBadge amount={booking.refundRequest?.amount} />
                        {booking.refundRequest?.amount == null ? (
                          <label className="mt-2 block text-left text-[10px] font-semibold text-slate-500">
                            Nominal terverifikasi admin
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={refundAmountInput}
                              onChange={(event) => setRefundAmounts((current) => ({
                                ...current,
                                [booking.id]: event.target.value,
                              }))}
                              placeholder="Masukkan nominal"
                              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                            />
                          </label>
                        ) : null}
                        {typeof booking.flightRefundEstimate?.amount === 'number' ? (
                          <div className="mt-1 text-[10px] text-sky-700">
                            Estimasi vendor: {formatRupiah(booking.flightRefundEstimate.amount)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${badge.cls}`}>
                          <badge.icon className="w-3.5 h-3.5" />{badge.label}
                        </span>
                        {booking.cancelReason && <div className="text-[10px] text-slate-400 mt-1">{(booking.cancelReason || '').slice(0, 60)}</div>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => processRefund(booking.id)}
                            disabled={processingId === booking.id || !canProcessRefund}
                            className={`px-3 py-1 text-xs rounded-md ${processingId === booking.id ? 'bg-purple-200 text-white/70 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-300'}`}
                          >
                            {processingId === booking.id ? 'Memproses...' : numericRefundAmount === 0 && canProcessRefund ? 'Tutup tanpa refund' : 'Proses Refund'}
                          </button>
                          <a href={`/admin/bookings/${booking.id}`} className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded-md">Detail</a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={currentPage} totalPages={totalPages} totalItems={filteredReview.length} pageSize={PAGE_SIZE} itemLabel="booking refund" onPageChange={setPage} />
      </div>

      {/* ── DANA TELAT (pembayaran lewat window 1 jam) ────────────────────── */}
      <div className="bg-white rounded-2xl border border-fuchsia-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <Banknote className="w-4 h-4 text-fuchsia-600 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold">Dana Telat</span>
              <span className="text-xs bg-fuchsia-100 text-fuchsia-700 px-2 py-0.5 rounded-full font-bold">{lateSettlements.length}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pembayaran yang diterima Midtrans <strong>setelah batas 1 jam</strong>. Booking tidak diterbitkan dan
              statusnya tetap gagal — dananya sudah masuk sehingga perlu ditindaklanjuti manual (refund via dashboard
              Midtrans, atau hubungi pelanggan bila ingin diproses ulang).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-fuchsia-100 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-fuchsia-50/60 text-slate-500 font-semibold border-b border-fuchsia-100">
              <tr>
                <th className="px-5 py-4">Booking</th>
                <th className="px-5 py-4">Pelanggan</th>
                <th className="px-5 py-4">Layanan</th>
                <th className="px-5 py-4">Dana Diterima</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fuchsia-50">
              {filteredLate.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">Tidak ada pembayaran telat. Bagus.</td>
                </tr>
              ) : (
                filteredLate.map((booking) => {
                  const TypeIcon = TYPE_ICON[booking.bookingType] || Plane;
                  return (
                    <tr key={booking.id} className="hover:bg-fuchsia-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">{booking.orderNumber || booking.id}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{format(new Date(booking.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-700">{booking.user?.name || 'Guest'}</div>
                        <div className="text-[11px] text-slate-500">{booking.user?.email || '-'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600"><TypeIcon className="w-3.5 h-3.5" /></div>
                          <span className="font-medium text-slate-700 capitalize text-xs">{booking.bookingType}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600">{booking.routeLabel || booking.hotelName || booking.flightNumber || '-'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">{formatRupiah(booking.totalAmount)}</div>
                        {booking.paymentType && <div className="text-[11px] text-slate-500 mt-0.5 capitalize">{booking.paymentType.replace(/_/g, ' ')}</div>}
                        {booking.paymentId && <div className="text-[10px] font-mono text-slate-400 mt-0.5">{booking.paymentId}</div>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-fuchsia-100 text-fuchsia-700">
                          <AlertTriangle className="w-3.5 h-3.5" />Telat
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">Refund manual via Midtrans</div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <a href={`/admin/bookings/${booking.id}`} className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded-md">Detail</a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── RIWAYAT REFUND ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="font-bold">Riwayat Refund</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{history.length} terbaru</span>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Booking</th>
                <th className="px-5 py-4">Pelanggan</th>
                <th className="px-5 py-4">Layanan</th>
                <th className="px-5 py-4">Refund</th>
                <th className="px-5 py-4 text-center">Cara Proses</th>
                <th className="px-5 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">Belum ada riwayat refund.</td>
                </tr>
              ) : (
                filteredHistory.map((booking) => {
                  const TypeIcon = TYPE_ICON[booking.bookingType] || Plane;
                  const refundedAt = booking.refundResult?.refundedAt;
                  return (
                    <tr key={booking.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">{booking.orderNumber || booking.id}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {refundedAt ? `Refund ${format(new Date(refundedAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}` : format(new Date(booking.updatedAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-700">{booking.user?.name || 'Guest'}</div>
                        <div className="text-[11px] text-slate-500">{booking.user?.email || '-'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600"><TypeIcon className="w-3.5 h-3.5" /></div>
                          <span className="font-medium text-slate-700 capitalize text-xs">{booking.bookingType}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600">{booking.routeLabel || booking.hotelName || booking.flightNumber || '-'}</div>
                      </td>
                      <td className="px-5 py-4 font-bold text-emerald-700">
                        {typeof booking.refundResult?.amount === 'number'
                          ? formatRupiah(booking.refundResult.amount)
                          : typeof booking.refundRequest?.amount === 'number'
                            ? formatRupiah(booking.refundRequest.amount)
                            : 'Belum tercatat'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <ProcessedBadge processedBy={booking.refundResult?.processedBy} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />Selesai
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
