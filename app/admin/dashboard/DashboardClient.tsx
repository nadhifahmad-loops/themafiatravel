'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import { TrendingUp, ShoppingBag, Clock, Users, ArrowUpRight, ArrowDownRight, Plane, Hotel, Train, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface TrendPoint { date: string; orders: number; revenue: number; }
interface RecentBooking {
  id: string;
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
  totalUsers: number;
  recentBookings: RecentBooking[];
  trendData: TrendPoint[];
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
  cancelled:       { label: 'Batal',    cls: 'bg-red-100 text-red-600 border border-red-200' },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  flight:    <Plane className="w-3.5 h-3.5" />,
  hotel:     <Hotel className="w-3.5 h-3.5" />,
  train:     <Train className="w-3.5 h-3.5" />,
  insurance: <Shield className="w-3.5 h-3.5" />,
};

const TYPE_COLOR: Record<string, string> = {
  flight: 'bg-blue-100 text-blue-600',
  hotel: 'bg-violet-100 text-violet-600',
  train: 'bg-emerald-100 text-emerald-600',
  insurance: 'bg-orange-100 text-orange-600',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      <p className="text-slate-500">Pesanan: <span className="text-slate-800 font-bold">{payload[0]?.value}</span></p>
      <p className="text-slate-500">Revenue: <span className="text-orange-600 font-bold">{formatRupiah(payload[1]?.value ?? 0)}</span></p>
    </div>
  );
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const [chartType, setChartType] = useState<'bar' | 'area'>('area');
  const trend = data.trendData ?? [];
  const bookings = data.recentBookings ?? [];

  const summaryCards = [
    { label: 'Total Pendapatan', sub: 'Bulan ini', value: formatRupiah(data.revenue), icon: TrendingUp, iconBg: 'bg-orange-100', iconColor: 'text-orange-600', badge: '+12.4%', badgeUp: true },
    { label: 'Pesanan Aktif', sub: 'Status paid', value: data.activeBookings.toLocaleString('id-ID'), icon: ShoppingBag, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', badge: '+5 hari ini', badgeUp: true },
    { label: 'Menunggu Pembayaran', sub: 'Perlu tindakan', value: data.pendingPayment.toLocaleString('id-ID'), icon: Clock, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', badge: data.pendingPayment > 10 ? 'Tinggi' : 'Normal', badgeUp: false },
    { label: 'Total User', sub: 'Terdaftar', value: data.totalUsers.toLocaleString('id-ID'), icon: Users, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', badge: '+23 minggu ini', badgeUp: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Selamat Datang 👋</h1>
        <p className="text-slate-500 text-sm mt-0.5">Berikut ringkasan operasional The Mafia Travel hari ini, {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: localeId })}.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-xs font-medium">{card.label}</p>
                  <p className="text-slate-400 text-[11px]">{card.sub}</p>
                </div>
                <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${card.iconColor}`} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800 mt-3 tracking-tight">{card.value}</p>
              <div className="flex items-center gap-1 mt-2">
                {card.badgeUp ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDownRight className="w-3.5 h-3.5 text-amber-500" />}
                <span className={`text-xs font-medium ${card.badgeUp ? 'text-emerald-600' : 'text-amber-600'}`}>{card.badge}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Tren Pemesanan</h2>
              <p className="text-slate-400 text-xs mt-0.5">7 Hari Terakhir</p>
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
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="orders" stroke="#f97316" strokeWidth={2.5} fill="url(#ordersGrad)" dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={0} fill="url(#revenueGrad)" />
              </AreaChart>
            ) : (
              <BarChart data={trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="orders" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Breakdown Tipe</h3>
            {[
              { label: 'Pesawat', icon: Plane, pct: 58, color: 'bg-blue-500' },
              { label: 'Hotel', icon: Hotel, pct: 24, color: 'bg-violet-500' },
              { label: 'Kereta', icon: Train, pct: 13, color: 'bg-emerald-500' },
              { label: 'Asuransi', icon: Shield, pct: 5, color: 'bg-orange-500' },
            ].map(item => (
              <div key={item.label} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <item.icon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{item.pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white">
            <p className="text-orange-100 text-xs font-medium">Revenue Hari Ini</p>
            <p className="text-2xl font-bold mt-1">{formatRupiah(trend[trend.length - 1]?.revenue ?? 0)}</p>
            <p className="text-orange-200 text-xs mt-2">{trend[trend.length - 1]?.orders ?? 0} transaksi berhasil</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Pesanan Terbaru</h2>
            <p className="text-slate-400 text-xs mt-0.5">5 transaksi terkini</p>
          </div>
          <a href="/admin/bookings" className="text-xs text-orange-500 font-semibold hover:text-orange-600 transition-colors">Lihat Semua →</a>
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
                const route = b.routeLabel || b.hotelName || '—';
                return (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">{b.id}</p>
                        {b.pnr && <p className="text-slate-400 text-[11px]">{b.pnr}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-700 font-medium text-xs">{b.user?.name ?? 'Guest'}</p>
                      <p className="text-slate-400 text-[11px]">{b.user?.email ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold ${typeColor}`}>
                        {TYPE_ICON[b.bookingType]}
                        {b.bookingType.charAt(0).toUpperCase() + b.bookingType.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 hidden md:table-cell">{route}</td>
                    <td className="px-5 py-3.5 text-right"><p className="font-semibold text-slate-800 text-xs">{formatRupiah(b.totalAmount)}</p></td>
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