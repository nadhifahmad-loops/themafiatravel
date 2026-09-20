'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Download, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight,
  Wallet, ExternalLink, CalendarDays,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

interface FinanceSummary {
  currentRevenue: number;
  previousRevenue: number;
  estimatedProfit: number;
  totalTransactions: number;
}

interface FinanceTransaction {
  id: string;
  createdAt: string | Date;
  totalAmount: number;
  bookingType: string;
  customerName: string;
  label: string;
}

interface FinanceChartPoint {
  name: string;
  revenue: number;
  profit?: number;
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return format(d, 'MMMM yyyy', { locale: localeId });
}

const BOOKING_TYPE_LABEL: Record<string, string> = {
  hotel: 'Hotel',
  flight: 'Penerbangan',
  train: 'Kereta Api',
  insurance: 'Asuransi',
};

function exportExcel(transactions: FinanceTransaction[], currentMonth: string, summary: FinanceSummary) {
  if (!transactions.length) {
    alert('Tidak ada transaksi untuk bulan ini.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Laporan Transaksi ──
  const titleRow = [['LAPORAN KEUANGAN - THE MAFIA TRAVEL']];
  const metaRow = [['Periode:', currentMonth], ['Dicetak:', format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeId })]];
  const emptyRow = [['']];
  const headerRow = [['No.', 'ID Transaksi', 'Tanggal', 'Waktu', 'Customer', 'Tipe Booking', 'Lokasi/Nama', 'Nominal (IDR)']];

  const dataRows = transactions.map((t, i) => [
    i + 1,
    t.id,
    format(new Date(t.createdAt), 'dd MMM yyyy'),
    format(new Date(t.createdAt), 'HH:mm'),
    t.customerName,
    BOOKING_TYPE_LABEL[t.bookingType] || t.bookingType,
    t.label,
    Math.round(t.totalAmount),
  ]);

  const summaryRows = [
    [''],
    ['RINGKASAN', '', '', '', '', '', '', ''],
    ['', 'Total Transaksi:', summary.totalTransactions, '', '', '', '', ''],
    ['', 'Total Pendapatan:', '', '', '', '', '', summary.currentRevenue],
    ['', 'Estimasi Laba (8%):', '', '', '', '', '', summary.estimatedProfit],
  ];

  const wsData = [...titleRow, ...metaRow, ...emptyRow, ...headerRow, ...dataRows, ...summaryRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 28 },  // ID Transaksi
    { wch: 14 },  // Tanggal
    { wch: 8 },   // Waktu
    { wch: 22 },  // Customer
    { wch: 16 },  // Tipe Booking
    { wch: 26 },  // Lokasi/Nama
    { wch: 18 },  // Nominal
  ];

  // Merge title
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Transaksi');

  // ── Sheet 2: Ringkasan ──
  const summaryData = [
    ['RINGKASAN KEUANGAN'],
    [''],
    ['Periode', currentMonth],
    [''],
    ['Metrik', 'Nilai'],
    ['Pendapatan Kotor', summary.currentRevenue],
    ['Estimasi Laba Kotor (8%)', summary.estimatedProfit],
    ['Total Transaksi', summary.totalTransactions],
    [''],
    ['Catatan:'],
    ['Estimasi laba dihitung dengan margin 8% dari pendapatan kotor.'],
    ['Data hanya mencakup transaksi dengan status paid/issued.'],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
  ws2['!cols'] = [
    { wch: 28 },
    { wch: 22 },
  ];
  ws2['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws2, 'Ringkasan');

  // ── Download ──
  const fileName = `laporan-keuangan-${currentMonth.replace(/\s+/g, '-').toLowerCase()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export default function FinanceClient({
  summary,
  recentTransactions,
  chartData,
  currentYear,
  currentMonth,
  selectedMonth,
  availableMonths,
}: {
  summary: FinanceSummary;
  recentTransactions: FinanceTransaction[];
  chartData: FinanceChartPoint[];
  currentYear: number;
  currentMonth: string;
  selectedMonth: string;
  availableMonths: string[];
}) {
  const router = useRouter();

  const revenueGrowth = summary.previousRevenue === 0
    ? 100
    : ((summary.currentRevenue - summary.previousRevenue) / summary.previousRevenue) * 100;

  function handleMonthChange(value: string) {
    router.push(`/admin/finance?month=${value}`);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Laporan Keuangan</h1>
          <p className="text-brand-neutral text-sm mt-0.5">Rangkuman pendapatan, laba kotor, dan arus kas.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl hover:bg-slate-50 transition-colors shadow-sm appearance-none cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
          </div>
          <button
          onClick={() => exportExcel(recentTransactions, currentMonth, summary)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold">Pendapatan Kotor</p>
              <p className="text-slate-400 text-[11px] mt-0.5">{currentMonth}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-4">{formatRupiah(summary.currentRevenue)}</p>
          <div className="flex items-center gap-1 mt-2">
            {revenueGrowth >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
            <span className={`text-xs font-semibold ${revenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {revenueGrowth > 0 ? '+' : ''}{revenueGrowth.toFixed(1)}% dari bulan lalu
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold">Estimasi Laba Kotor</p>
              <p className="text-slate-400 text-[11px] mt-0.5">Margin ~8%</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-4">{formatRupiah(summary.estimatedProfit)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold">Total Transaksi</p>
              <p className="text-slate-400 text-[11px] mt-0.5">Berhasil (Paid/Issued)</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-4">{summary.totalTransactions} <span className="text-sm font-medium text-slate-500">trx</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-brand-ink mb-6">Grafik Pendapatan ({currentYear})</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val: string | number) => `Rp${Number(val) / 1000000}M`} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(val: any) => formatRupiah(Number(val) || 0)} />
              <Bar dataKey="revenue" name="Pendapatan" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar dataKey="profit" name="Laba" fill="#f97316" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Ledger */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-brand-ink">Arus Kas Masuk Terkini</h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[350px]">
            {recentTransactions.length === 0 ? (
              <div className="p-5 text-center text-sm text-slate-500">Tidak ada transaksi di bulan ini.</div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {recentTransactions.map((trx) => (
                  <li key={trx.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/admin/bookings/${trx.id}`}
                            className="text-xs font-bold text-slate-800 hover:text-orange-600 transition-colors truncate"
                          >
                            {trx.customerName}
                          </Link>
                          <ExternalLink className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{trx.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{format(new Date(trx.createdAt), 'dd MMM, HH:mm', { locale: localeId })}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-emerald-600">+{formatRupiah(trx.totalAmount)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{trx.bookingType}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
