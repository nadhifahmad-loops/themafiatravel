'use client';
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function ErrorContent() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/bookings'), 2500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-5">
      <div className="text-5xl">❌</div>
      <div className="text-center space-y-1">
        <p className="text-gray-700 font-semibold text-base">Pembayaran tidak berhasil</p>
        <p className="text-gray-400 text-sm">Pesanan Anda tetap tersimpan. Mengarahkan ke halaman pesanan...</p>
      </div>
    </div>
  );
}

export default function PaymentError() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Memuat...</div>}>
      <ErrorContent />
    </Suspense>
  );
}