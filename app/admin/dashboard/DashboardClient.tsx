'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { TrendingUp, ShoppingBag, Clock, Users, Plane, Hotel, Train, Shield, ArrowRightLeft, Banknote, type LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface TrendPoint { date: string; orders: number; revenue: number; paidOrders: number; }
interface ServiceCount { bookingType: string; count: number; }
interface RecentBooking {
  id: string;
  orderNumber?: string | null;
  bookingType: string;
  status: string;
  totalAmount: number;
  routeLabel?: string | null;
  hotelName?: string | null;
  pnr?: string | null;
  createdAt: Date | string;
  user?: { name?: string | null; email?: string | null } | null;
}
interface DashboardData {
  revenue: number;
  activeBookings: number;
  pendingPayment: number;
  refundsToReview: number;
  lateSettlements: number;
  totalUsers: number;
  recentBookings: RecentBooking[];
  trendData: TrendPoint[];
  serviceBreakdown: ServiceCount[];
}

// No local dummy data here — consume server-provided `data` only.

function formatRupiah(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}Jt`;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: 'Menunggu', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  paid:            { label: 'Dibayar',  cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
  issued:          { label: 'Issued',   cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  refund_requested:{ label: 'Menunggu review refund', cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
  refund:          { label: 'Refund diproses', cls: 'bg-purple-100 text-purple-700 border border-purple-200' },
  payment_failed:  { label: 'Pembayaran gagal', cls: 'bg-red-100 text-red-600 border border-red-200' },
  cancelled:       { label: 'Batal',    cls: 'bg-red-100 text-red-600 border border-red-200' },
  expired:         { label: 'Kedaluwarsa', cls: 'bg-red-100 text-red-600 border border-red-200' },
};

const SERVICES = [
  { key: 'flight', label: 'Pesawat', icon: Plane, color: 'bg-blue-500' },
  { key: 'hotel', label: 'Hotel', icon: Hotel, color: 'bg-violet-500' },
  { key: 'train', label: 'Kereta', icon: Train, color: 'bg-emerald-500' },
  { key: 'insurance', label: 'Asuransi', icon: Shield, color: 'bg-orange-500' },
];

const TYPE_ICON: Record<string, LucideIcon> = {
  flight: Plane,
  hotel: Hotel,
  train: Train,
  insurance: Shield,
};

const TYPE_COLOR: Record<string, string> = {
  flight: 'bg-blue-100 text-blue-600',
  hotel: 'bg-violet-100 text-violet-600',
  train: 'bg-emerald-100 text-emerald-600',
  insurance: 'bg-orange-100 text-orange-600',
};

function CustomTooltip({
  active,
  payload,
  label,
}: Pick<TooltipContentProps<number, string>, 'active' | 'payload' | 'label'>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      <p className="text-slate-500">Pesanan: <span className="text-slate-800 font-bold">{payload[0]?.value}</span></p>
    </div>
  );
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const [chartType, setChartType] = useState<'bar' | 'area'>('area');
  const trend = data.trendData ?? [];
  const bookings = data.recentBookings ?? [];

  const summaryCards = [
    { label: 'Pendapatan bulan ini', sub: 'Pesanan dibayar atau diterbitkan', value: formatRupiah(data.revenue), icon: TrendingUp, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
    { label: 'Pesanan aktif', sub: 'Sudah dibayar atau diterbitkan', value: data.activeBookings.toLocaleString('id-ID'), icon: ShoppingBag, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
    { label: 'Menunggu pembayaran', sub: 'Pelanggan belum menyelesaikan pembayaran', value: data.pendingPayment.toLocaleString('id-ID'), icon: Clock, iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
    { label: 'Akun pelanggan', sub: 'Jumlah akun terdaftar', value: data.totalUsers.toLocaleString('id-ID'), icon: Users, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  ];
  const serviceTotal = data.serviceBreakdown.reduce((sum, item) => sum + item.count, 0);
  const serviceCounts = new Map(data.serviceBreakdown.map((item) => [item.bookingType, item.count]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">Ringkasan operasional</h1>
        <p className="text-brand-neutral text-sm mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy', { locale: localeId })} · Angka diperbarui dari data pesanan dan pembayaran.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
          <div>
            <p className="text-brand-neutral text-xs font-medium">{card.label}</p>
            <p className="text-slate-400 text-[11px]">{card.sub}</p>
          </div>
                <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${card.iconColor}`} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold text-brand-ink mt-3 tracking-tight">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-brand-ink">Tren Pemesanan</h2>
              <p className="text-slate-400 text-xs mt-0.5">Jumlah pesanan dibuat dalam 7 hari terakhir</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setChartType('area')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${chartType === 'area' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Area</button>
              <button onClick={() => setChartType('bar')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${chartType === 'bar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Batang</button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            {chartType === 'area' ? (
              <AreaChart data={trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.15} /><stop offset="95%" stopColor="#f97316" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={(props) => <CustomTooltip {...props} />} />
                <Area type="monotone" dataKey="orders" stroke="#f97316" strokeWidth={2.5} fill="url(#ordersGrad)" dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </AreaChart>
            ) : (
              <BarChart data={trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={(props) => <CustomTooltip {...props} />} />
                <Bar dataKey="orders" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-brand-ink mb-4">Breakdown Tipe</h3>
            <p className="text-slate-400 text-xs mb-4">Proporsi semua pesanan yang tercatat</p>
            {SERVICES.map(item => {
              const count = serviceCounts.get(item.key) || 0;
              const pct = serviceTotal ? Math.round((count / serviceTotal) * 100) : 0;
              return (
              <div key={item.label} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <item.icon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{count} <span className="font-normal text-slate-400">({pct}%)</span></span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );})}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-brand-ink">Perlu ditindaklanjuti</h3>
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-500">Pendapatan hari ini · pembayaran berhasil</p>
              <p className="mt-1 text-lg font-bold text-brand-ink">{formatRupiah(trend[trend.length - 1]?.revenue ?? 0)}</p>
              <p className="text-xs text-slate-500">{trend[trend.length - 1]?.paidOrders ?? 0} pesanan dibayar/diterbitkan</p>
            </div>
            <Link href="/admin/refund-queue" className="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50 px-3 py-3 text-sm font-semibold text-orange-900 hover:bg-orange-100 transition-colors">
              <span className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" />Permintaan refund</span>
              <span>{data.refundsToReview}</span>
            </Link>
            <Link href="/admin/refund-queue" className="flex items-center justify-between gap-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-3 py-3 text-sm font-semibold text-fuchsia-900 hover:bg-fuchsia-100 transition-colors">
              <span className="flex items-center gap-2"><Banknote className="w-4 h-4" />Dana telat masuk</span>
              <span>{data.lateSettlements}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-brand-ink">Pesanan Terbaru</h2>
              <p className="text-slate-400 text-xs mt-0.5">5 transaksi terkini</p>
            </div>
          <Link href="/admin/bookings" className="text-xs text-orange-600 font-semibold hover:text-orange-700 transition-colors">Lihat semua pesanan →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Tipe</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Rute / Hotel</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {bookings.slice(0, 5).map((b) => {
                const badge = STATUS_BADGE[b.status] ?? { label: b.status, cls: 'bg-slate-100 text-slate-600' };
                const typeColor = TYPE_COLOR[b.bookingType] ?? 'bg-slate-100 text-slate-600';
                const TypeIcon = TYPE_ICON[b.bookingType] ?? ShoppingBag;
                const route = b.routeLabel || b.hotelName || '—';
                return (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-brand-ink text-xs hover:text-orange-700">{b.orderNumber || b.id}</Link>
                        {b.pnr && <p className="text-slate-400 text-[11px]">{b.pnr}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-700 font-medium text-xs">{b.user?.name ?? 'Guest'}</p>
                      <p className="text-slate-400 text-[11px]">{b.user?.email ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold ${typeColor}`}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {b.bookingType.charAt(0).toUpperCase() + b.bookingType.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 hidden md:table-cell">{route}</td>
                    <td className="px-5 py-3.5 text-right">                    <p className="font-semibold text-brand-ink text-xs">{formatRupiah(b.totalAmount)}</p></td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}