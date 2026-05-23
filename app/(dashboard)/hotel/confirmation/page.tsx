'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ConfirmationContent() {
  const sp = useSearchParams();
  const orderId = sp.get('order') || '';
  const status = sp.get('status') || 'pending';
  const isSuccess = status === 'success';
  const isPending = status === 'pending';

  const config = {
    icon: isSuccess ? '✓' : isPending ? '⏳' : '✗',
    title: isSuccess ? 'Pembayaran Berhasil!' : isPending ? 'Menunggu Pembayaran' : 'Pembayaran Gagal',
    desc: isSuccess
      ? 'Pesanan hotelmu telah dikonfirmasi. Voucher akan dikirim ke emailmu dalam beberapa menit.'
      : isPending
      ? 'Pembayaranmu sedang diproses. Kami akan mengirim konfirmasi setelah pembayaran selesai.'
      : 'Terjadi masalah dengan pembayaran. Silakan coba lagi atau hubungi support.',
    iconBg: isSuccess ? 'bg-green-100' : isPending ? 'bg-orange-light' : 'bg-red-100',
    iconColor: isSuccess ? 'text-green-600' : isPending ? 'text-orange' : 'text-red-500',
    iconBorder: isSuccess ? 'border-green-200' : isPending ? 'border-orange/30' : 'border-red-200',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl border-2 ${config.iconBg} ${config.iconBorder}`}>
          <span className={config.iconColor}>{config.icon}</span>
        </div>

        {/* Title & Desc */}
        <h1 className="text-2xl font-black text-dark mb-3">{config.title}</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">{config.desc}</p>

        {/* Order ID */}
        {orderId && (
          <div className="bg-white border-2 border-gray-100 rounded-2xl p-5 mb-6 text-left">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Nomor Pesanan</p>
            <p className="font-black text-orange text-lg font-mono">{orderId}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="/bookings"
            className="w-full py-4 rounded-full font-bold text-white text-sm flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA6B0A)', boxShadow: '0 6px 20px rgba(249,115,22,0.3)' }}
          >
            📋 Lihat Pesanan Saya
          </Link>
          <Link
            href="/hotel/search"
            className="w-full py-4 rounded-full font-bold text-sm border-2 border-orange text-orange hover:bg-orange-light transition-colors flex items-center justify-center gap-2"
          >
            🔍 Cari Hotel Lainnya
          </Link>
          <Link href="/dashboard" className="text-gray-400 text-xs hover:text-gray-600 transition-colors mt-1">
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div style={{ width: 32, height: 32, border: '3px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
