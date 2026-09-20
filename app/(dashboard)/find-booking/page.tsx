'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import Footer from '@/components/layout/Footer';

interface BookingResult {
  id: string;
  orderNumber: string;
  bookingType: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  origin: string | null;
  destination: string | null;
  departureDate: string | null;
}

function FindBookingContent() {
  const { language } = useLanguage();
  const t = i18n.findBooking[language];
  const isEN = language === 'EN';

  const [orderNumber, setOrderNumber] = useState('');
  const [phone,       setPhone]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [result,      setResult]      = useState<BookingResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !phone.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/booking/find', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderNumber: orderNumber.trim(), phone: phone.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || t.notFound);
      } else {
        setResult(data.booking);
      }
    } catch {
      setError(t.connectionError);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const bookingTypeLabel = (type: string) => {
    const types: Record<string, string> = { FLIGHT: 'Pesawat', HOTEL: 'Hotel', TRAIN: 'Kereta', INSURANCE: 'Asuransi' };
    return types[type] || type;
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, { text: string; color: string }> = {
      PENDING:    { text: 'Menunggu',  color: 'bg-amber-100 text-amber-700' },
      CONFIRMED:  { text: 'Terkonfirmasi', color: 'bg-blue-100 text-blue-700' },
      PAID:       { text: 'Dibayar',   color: 'bg-emerald-100 text-emerald-700' },
      COMPLETED:  { text: 'Selesai',   color: 'bg-green-100 text-green-700' },
      CANCELLED:  { text: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
    };
    return labels[status] || { text: status, color: 'bg-slate-100 text-slate-700' };
  };

  const bookingIcon = (type: string) => {
    const icons: Record<string, string> = { FLIGHT: 'fa-plane', HOTEL: 'fa-hotel', TRAIN: 'fa-train', INSURANCE: 'fa-shield-halved' };
    return icons[type] || 'fa-ticket';
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col">

      {/* Orange Header */}
      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 pt-28 pb-16 px-4">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-2xl font-black text-white mb-1">
            {isEN ? 'Retrieve Your Booking' : 'Cek Pesanan Kamu'}
          </h1>
          <p className="text-orange-100 text-sm">
            {isEN ? 'Find your booking using email or phone number' : 'Temukan pesananmu menggunakan email atau nomor telepon'}
          </p>
        </div>
      </div>

      {/* Search Card */}
      <div className="max-w-xl mx-auto px-4 -mt-8 flex-1 w-full mb-16">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="p-5">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-start gap-2">
                <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSearch} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isEN ? 'Email or Phone Number' : 'Email atau Nomor Telepon'}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={isEN ? 'Enter your email or phone number' : 'Masukkan email atau nomor telepon'}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isEN ? 'Booking Code' : 'Kode Booking'}
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={e => setOrderNumber(e.target.value.toUpperCase())}
                  placeholder={isEN ? 'Enter your booking code' : 'Masukkan kode booking'}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-sm font-mono uppercase tracking-wider"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !orderNumber.trim() || !phone.trim()}
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.searching}</>
                  : <>{isEN ? 'Find Booking' : 'Cari Pesanan'}</>
                }
              </button>
            </form>
          </div>

          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
            <p className="text-slate-400 text-xs text-center">
              {isEN ? "Don't have a booking?" : 'Belum punya pesanan?'}{' '}
              <Link href="/" className="text-orange-500 hover:text-orange-600 font-bold transition-colors">
                {isEN ? 'Book Now' : 'Pesan Sekarang'}
              </Link>
            </p>
          </div>
        </div>

        {/* Hasil Pencarian */}
        {result && (
          <div className="mt-6 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <i className={`fa-solid ${bookingIcon(result.bookingType)} text-orange-500`}></i>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{isEN ? 'Booking Found' : 'Pesanan Ditemukan'}</p>
                  <p className="text-xs text-slate-500">{isEN ? 'Here are your booking details' : 'Berikut rincian pesananmu'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-lg font-black text-slate-900 tracking-wider">{result.orderNumber}</span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusLabel(result.status).color}`}>
                  {statusLabel(result.status).text}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-500 mb-1">{isEN ? 'Type' : 'Jenis'}</p>
                  <p className="font-bold text-slate-800">{bookingTypeLabel(result.bookingType)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-500 mb-1">{isEN ? 'Date' : 'Tanggal'}</p>
                  <p className="font-bold text-slate-800">{formatDate(result.createdAt)}</p>
                </div>
                {result.origin && result.destination && (
                  <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                    <p className="text-slate-500 mb-1">{isEN ? 'Route' : 'Rute'}</p>
                    <p className="font-bold text-slate-800">{result.origin} → {result.destination}</p>
                  </div>
                )}
                <div className="bg-orange-50 rounded-xl p-3 col-span-2">
                  <p className="text-orange-600 mb-1">{isEN ? 'Total Amount' : 'Total Harga'}</p>
                  <p className="font-black text-orange-600 text-lg">{formatCurrency(result.totalAmount)}</p>
                </div>
              </div>
            </div>

            <div className="p-4 flex gap-3">
              <Link
                href={`/find-booking/${result.id}?orderNumber=${encodeURIComponent(result.orderNumber)}&phone=${encodeURIComponent(phone)}`}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                <i className="fa-solid fa-eye text-xs"></i>
                {isEN ? 'View Details' : 'Lihat Detail'}
              </Link>
              <button
                onClick={() => { setResult(null); setOrderNumber(''); setPhone(''); }}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm"
              >
                {isEN ? 'New Search' : 'Cari Lagi'}
              </button>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default function FindBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    }>
      <FindBookingContent />
    </Suspense>
  );
}
