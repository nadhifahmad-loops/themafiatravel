'use client';
import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function PendingContent() {
  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/bookings'), 2000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-5">
      <div className="text-5xl">⏳</div>
      <div className="text-center space-y-1">
        <p className="text-gray-700 font-semibold text-base">Pembayaran sedang menunggu konfirmasi</p>
        <p className="text-gray-400 text-sm">Mengarahkan ke halaman pesanan...</p>
      </div>
    </div>
  );
}

export default function PaymentPending() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Memuat...</div>}>
      <PendingContent />
    </Suspense>
  );
}