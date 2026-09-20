'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plane, Hotel, Train, Shield, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

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
  pnr?: string | null;
  flightNumber?: string | null;
  provider?: string | null;
  routeLabel?: string | null;
  hotelName?: string | null;
  bookingData?: any;
  passengerData?: unknown;
  createdAt: string | Date;
  updatedAt: string | Date;
  user?: { name?: string | null; email?: string | null; phone?: string | null } | null;
}

const STATUS_OPTIONS = [
  { value: 'pending_payment', label: 'Menunggu Pembayaran', color: 'bg-amber-100 text-amber-700', icon: Clock },
  { value: 'paid',            label: 'Dibayar',             color: 'bg-blue-100 text-blue-700',   icon: CheckCircle },
  { value: 'issued',          label: 'Issued',              color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  { value: 'cancelled',       label: 'Dibatalkan',          color: 'bg-red-100 text-red-600',      icon: XCircle },
  { value: 'refund_requested', label: 'Refund Diminta',     color: 'bg-orange-100 text-orange-700', icon: RefreshCw },
  { value: 'refund',          label: 'Refund Diproses',     color: 'bg-purple-100 text-purple-700', icon: RefreshCw },
];

const TYPE_ICONS: Record<string, typeof Plane> = { flight: Plane, hotel: Hotel, train: Train, insurance: Shield };

function formatCurrency(n: number, currency: string = 'IDR') {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminBookingDetailClient({ booking }: { booking: Booking }) {
  const router = useRouter();
  const [status, setStatus] = useState(booking.status);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const currentStatus = STATUS_OPTIONS.find(s => s.value === status) || { label: status, color: 'bg-slate-100 text-slate-700', icon: Clock };
  const TypeIcon = TYPE_ICONS[booking.bookingType] || Plane;
  const bookingInfo = typeof booking.bookingData === 'object' && booking.bookingData ? booking.bookingData : {};
  const passengers: Passenger[] = Array.isArray(booking.passengerData) ? booking.passengerData : [];

  async function handleStatusChange(newStatus: string) {
    if (newStatus === status || updating) return;
    setUpdating(true);
    setMessage('');
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus(newStatus);
        setMessageType('success');
        setMessage(`Status berhasil diubah menjadi "${STATUS_OPTIONS.find(s => s.value === newStatus)?.label || newStatus}".`);
      } else {
        setMessageType('error');
        setMessage(json.message || 'Gagal mengupdate status.');
      }
    } catch {
      setMessageType('error');
      setMessage('Gagal menghubungi server.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleProcessRefund() {
    if (updating) return;
    setUpdating(true);
    setMessage('');
    try {
      const res = await fetch(`/api/bookings/${booking.id}/refund-execute`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setStatus('cancelled');
        setMessageType('success');
        setMessage('Refund berhasil diproses. Booking kini berstatus Dibatalkan.');
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
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
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mt-2 ${currentStatus.color}`}>
                    <currentStatus.icon className="w-3.5 h-3.5" />{currentStatus.label}
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
            <h3 className="font-bold text-brand-ink">Ubah Status</h3>
            <div className="space-y-2">
              {STATUS_OPTIONS.map(opt => {
                const isActive = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    disabled={isActive || updating}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? `${opt.color} cursor-default`
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    } ${updating && !isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <opt.icon className="w-4 h-4" />
                    {opt.label}
                    {isActive && <span className="ml-auto text-xs font-bold uppercase">Aktif</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h3 className="font-bold text-brand-ink">Aksi Cepat</h3>
            {status === 'refund_requested' && (
              <button
                onClick={handleProcessRefund}
                disabled={updating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-all disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" /> {updating ? 'Memproses...' : 'Proses Refund (Eksekusi Midtrans)'}
              </button>
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
