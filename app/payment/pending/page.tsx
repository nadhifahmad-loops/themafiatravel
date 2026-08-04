'use client';
import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function PendingContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const orderId = sp.get('order_id') || '';

  useEffect(() => {
    const t = setTimeout(() => {
      if (orderId) router.replace(`/bookings/${orderId}`);
      else router.replace('/bookings');
    }, 2000);
    return () => clearTimeout(t);
  }, [orderId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-5">
      <div
        style={{
          width: 52,
          height: 52,
          border: '3px solid #eab308',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <div className="text-center space-y-1">
        <p className="text-slate-700 font-semibold text-base">Pembayaran sedang menunggu konfirmasi</p>
        <p className="text-slate-400 text-sm">Mengarahkan ke rincian pesanan...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function PaymentPending() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-slate-400 text-sm">Memuat...</p></div>}>
      <PendingContent />
    </Suspense>
  );
}
