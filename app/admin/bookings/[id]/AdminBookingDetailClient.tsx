'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plane, Hotel, Train, Shield, Clock, RefreshCw, Banknote } from 'lucide-react';

interface Passenger {
  first_name?: string;
  last_name?: string;
  title?: string;
  pax_type?: string;
  ticket_number?: string;
  baggage?: string;
}

interface Booking {
  id: string;
  orderNumber?: string | null;
  bookingType: string;
  status: string;
  totalAmount: number;
  currency?: string;
  origin?: string | null;
  destination?: string | null;
  pnr?: string | null;
  flightNumber?: string | null;
  provider?: string | null;
  routeLabel?: string | null;
  hotelName?: string | null;
  bookingData?: unknown;
  passengerData?: unknown;
  /** 'settlement' | 'pending' | 'expire' | 'late_settlement' | ... */
  paymentStatus?: string | null;
  paymentId?: string | null;
  paymentType?: string | null;
  paidAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  user?: { name?: string | null; email?: string | null; phone?: string | null } | null;
}

type RescheduleHistoryEntry = {
  pnr?: string | null;
  originalDepartureDate?: string | null;
  departureDate?: string | null;
  origin?: string | null;
  destination?: string | null;
  flightNumber?: string | null;
  amount?: number | null;
  adminFee?: number | null;
  changedAt?: string | null;
};

const TYPE_ICONS: Record<string, typeof Plane> = { flight: Plane, hotel: Hotel, train: Train, insurance: Shield };

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function formatCurrency(n: number, currency: string = 'IDR') {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminBookingDetailClient({ booking }: { booking: Booking }) {
  const router = useRouter();
  const bookingInfo = objectValue(booking.bookingData) || {};
  const refundRequest = objectValue(bookingInfo.refundRequest) || {};
  const savedRefundAmount = typeof refundRequest.amount === 'number' && Number.isFinite(refundRequest.amount)
    ? refundRequest.amount
    : null;
  const [status, setStatus] = useState(booking.status);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [refundAmount, setRefundAmount] = useState(savedRefundAmount === null ? '' : String(savedRefundAmount));

  const statusLabels: Record<string, string> = {
    pending_payment: 'Menunggu pembayaran',
    paid: 'Sudah dibayar',
    issued: 'Tiket/voucher terbit',
    payment_failed: 'Pembayaran gagal',
    cancelled: 'Dibatalkan',
    expired: 'Kedaluwarsa',
    refund_requested: 'Menunggu review refund',
    refund: 'Refund sedang diproses',
  };
  const currentStatusLabel = statusLabels[status] || status;
  const TypeIcon = TYPE_ICONS[booking.bookingType] || Plane;
  const passengers: Passenger[] = Array.isArray(booking.passengerData) ? booking.passengerData : [];
  const rescheduleHistory: RescheduleHistoryEntry[] = Array.isArray(bookingInfo.rescheduleHistory)
    ? [...bookingInfo.rescheduleHistory].filter((entry): entry is RescheduleHistoryEntry => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))).reverse()
    : [];
  const refundEstimate = bookingInfo.flightRefundEstimate && typeof bookingInfo.flightRefundEstimate === 'object'
    ? bookingInfo.flightRefundEstimate as { amount?: number | null; capturedAt?: string; source?: string }
    : null;

  async function handleProcessRefund() {
    if (updating) return;
    if (status !== 'refund_requested') {
      setMessageType('error');
      setMessage('Refund hanya dapat diproses dari permintaan yang menunggu review.');
      return;
    }

    const amount = Number(refundAmount);
    if (!refundAmount.trim() || !Number.isFinite(amount) || amount < 0 || amount > booking.totalAmount) {
      setMessageType('error');
      setMessage('Masukkan nominal refund yang valid, mulai dari Rp0 sampai total pembayaran.');
      return;
    }

    if (!window.confirm(`Konfirmasi pengembalian dana sebesar ${formatCurrency(amount, booking.currency)} kepada pelanggan? Pastikan nominal sudah sesuai bukti vendor.`)) {
      return;
    }

    setUpdating(true);
    setMessage('');
    try {
      const res = await fetch(`/api/bookings/${booking.id}/refund-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus('cancelled');
        setMessageType('success');
        setMessage(json.data?.noRefund
          ? 'Permintaan ditutup dengan nominal Rp0. Tidak ada dana yang dikirim.'
          : 'Refund berhasil dikirim ke Midtrans dan pesanan ditandai dibatalkan.');
        router.refresh();
      } else {
        setMessageType('error');
        setMessage(json.message || 'Gagal memproses refund.');
      }
    } catch {
      setMessageType('error');
      setMessage('Gagal menghubungi server.');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/bookings" className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-orange-600 hover:border-orange-200 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-brand-ink">Detail Pesanan</h1>
          <p className="text-brand-neutral text-sm">{booking.orderNumber || booking.id}</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${messageType === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
          {message}
        </div>
      )}

      {/* Pembayaran telat — uang sudah masuk ke Midtrans tapi di luar window 1 jam,
          jadi booking sengaja TIDAK diterbitkan. Perlu tindakan kasir (refund manual). */}
      {booking.paymentStatus === 'late_settlement' && (
        <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-fuchsia-600" />
            <p className="font-bold text-fuchsia-900">Pembayaran telat — perlu tindakan kasir</p>
          </div>
          <p className="text-sm text-fuchsia-800">
            Dana untuk pesanan ini diterima Midtrans <strong>setelah batas pembayaran 1 jam</strong>, sehingga
            booking sengaja <strong>tidak diterbitkan</strong> dan statusnya tetap gagal. Uangnya sudah masuk —
            silakan direfund manual ke kanal pembayaran asal, atau hubungi pemilik pesanan bila ingin diproses ulang.
          </p>
          <ul className="text-xs text-fuchsia-800/90 space-y-0.5 pt-1">
            <li>ID Transaksi Midtrans: <span className="font-mono font-bold">{booking.paymentId || '-'}</span></li>
            <li>Metode bayar: <span className="font-bold">{booking.paymentType || '-'}</span></li>
            <li>Jumlah diterima: <span className="font-bold">{formatCurrency(booking.totalAmount, booking.currency)}</span></li>
          </ul>
        </div>
      )}

      {status === 'refund_requested' && (
        <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Banknote className="w-5 h-5 mt-0.5 text-orange-700" />
            <div>
              <h2 className="font-bold text-orange-950">Permintaan refund menunggu pemeriksaan</h2>
              <p className="mt-1 text-sm text-orange-900">
                Cocokkan nominal dengan hasil pembatalan vendor dan bukti pembayaran sebelum mengirim dana.
              </p>
              {typeof refundRequest.reason === 'string' && refundRequest.reason && (
                <p className="mt-2 text-sm text-orange-900"><strong>Alasan pelanggan:</strong> {refundRequest.reason}</p>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {booking.bookingType === 'flight' && (refundEstimate || rescheduleHistory.length > 0) ? (
            <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5">
              <div className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-sky-700" />
                <h3 className="font-bold text-sky-950">Riwayat Refund &amp; Reschedule Maskapai</h3>
              </div>
              {refundEstimate ? (
                <div className="mt-3 rounded-xl border border-white bg-white/80 p-3 text-sm">
                  <p className="font-semibold text-slate-700">Estimasi refund vendor</p>
                  <p className="mt-1 font-black text-slate-900">
                    {typeof refundEstimate.amount === 'number' ? formatCurrency(refundEstimate.amount, booking.currency) : 'Nominal tidak tersedia'}
                  </p>
                  {refundEstimate.capturedAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Diperiksa {formatDate(refundEstimate.capturedAt)} · {refundEstimate.source || 'get_refund_booking'}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {rescheduleHistory.length ? (
                <ol className="mt-3 space-y-2">
                  {rescheduleHistory.map((entry, index) => (
                    <li key={`${entry.pnr || 'pnr'}-${entry.changedAt || index}`} className="rounded-xl border border-white bg-white/80 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-slate-800">
                          {entry.origin || booking.origin || '-'} → {entry.destination || booking.destination || '-'}
                          {entry.flightNumber ? ` · ${entry.flightNumber}` : ''}
                        </p>
                        <span className="text-[11px] text-slate-500">{entry.changedAt ? formatDate(entry.changedAt) : '-'}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {entry.originalDepartureDate ? formatDate(entry.originalDepartureDate) : '-'}
                        {' → '}
                        {entry.departureDate ? formatDate(entry.departureDate) : '-'}
                        {entry.pnr ? ` · PNR ${entry.pnr}` : ''}
                      </p>
                      {typeof entry.amount === 'number' ? (
                        <p className="mt-1 text-xs font-semibold text-slate-700">
                          Biaya perubahan: {formatCurrency(entry.amount, booking.currency)}
                          {typeof entry.adminFee === 'number' ? ` · Admin: ${formatCurrency(entry.adminFee, booking.currency)}` : ''}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          ) : null}

          {/* Card Utama */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Gradient Header */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-orange-500/15 rounded-full blur-2xl" />
              <div className="relative flex justify-between items-start gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Booking ID</p>
                  <h2 className="text-2xl font-black text-white mt-1">{booking.orderNumber || booking.id}</h2>
                  {booking.pnr && <p className="text-sm text-slate-300 mt-1">PNR: <span className="font-bold text-orange-400">{booking.pnr}</span></p>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Total</p>
                  <p className="text-2xl font-black text-white mt-1">{formatCurrency(booking.totalAmount, booking.currency)}</p>
                  <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white mt-2">
                    {currentStatusLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Bar */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <TypeIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800 capitalize">{booking.bookingType}</p>
                <p className="text-xs text-slate-500">{booking.routeLabel || booking.hotelName || booking.flightNumber || '-'}</p>
              </div>
              {booking.provider && <span className="ml-auto text-xs font-bold text-slate-400 uppercase">{booking.provider}</span>}
            </div>

            {/* Detail List */}
            <div className="p-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Pelanggan</p>
                <p className="font-semibold text-slate-800 mt-1">{booking.user?.name || 'Guest'}</p>
                <p className="text-xs text-slate-500">{booking.user?.email || '-'}</p>
                {booking.user?.phone && <p className="text-xs text-slate-500">{booking.user.phone}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Tanggal Dibuat</p>
                <p className="font-semibold text-slate-800 mt-1">{formatDate(booking.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Terakhir Diupdate</p>
                <p className="font-semibold text-slate-800 mt-1">{formatDate(booking.updatedAt)}</p>
              </div>
              {booking.flightNumber && (
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Nomor Penerbangan</p>
                  <p className="font-semibold text-slate-800 mt-1">{booking.flightNumber}</p>
                </div>
              )}
            </div>
          </div>

          {/* Passengers */}
          {passengers.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-brand-ink">Data Penumpang / Tamu</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {passengers.map((p, i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-xs font-bold text-orange-600">{i + 1}</div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}</p>
                        <p className="text-xs text-slate-500">{p.pax_type === 'ADT' ? 'Dewasa' : p.pax_type === 'CHD' ? 'Anak' : p.pax_type === 'INF' ? 'Bayi' : p.pax_type || '-'}</p>
                      </div>
                    </div>
                    {p.ticket_number && <span className="text-xs font-mono font-bold text-slate-600">{p.ticket_number}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-brand-ink">Status pesanan</h3>
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <Clock className="w-4 h-4 text-slate-500" />
              {currentStatusLabel}
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Status mengikuti pembayaran dan konfirmasi layanan. Jangan mengubahnya manual agar catatan pembayaran, tiket, dan refund tetap sinkron.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h3 className="font-bold text-brand-ink">Aksi Cepat</h3>
            {status === 'refund_requested' && (
              <div className="space-y-2">
                <label htmlFor="refund-amount" className="block text-xs font-semibold text-slate-600">
                  Nominal refund yang sudah diverifikasi
                </label>
                <input
                  id="refund-amount"
                  type="number"
                  min="0"
                  max={booking.totalAmount}
                  step="1"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  readOnly={savedRefundAmount !== null}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 read-only:bg-slate-50"
                  aria-describedby="refund-amount-help"
                />
                <p id="refund-amount-help" className="text-xs leading-relaxed text-slate-500">
                  {savedRefundAmount !== null
                    ? 'Nominal dari permintaan vendor tersimpan. Periksa kembali bukti vendor sebelum memproses.'
                    : `Periksa nominal di bukti vendor. Nilai maksimal ${formatCurrency(booking.totalAmount, booking.currency)}.`}
                </p>
                <button
                  onClick={handleProcessRefund}
                  disabled={updating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition-all disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" /> {updating ? 'Mengirim refund...' : 'Verifikasi dan proses refund'}
                </button>
              </div>
            )}
            <Link
              href={`/bookings/${booking.id}`}
              target="_blank"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-50 text-orange-600 text-sm font-semibold hover:bg-orange-100 transition-all"
            >
              Lihat Halaman User →
            </Link>
            <button
              onClick={() => router.refresh()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-50 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-all border border-slate-200"
            >
              <RefreshCw className="w-4 h-4" /> Refresh Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
