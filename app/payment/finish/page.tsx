'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function FinishContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('Memproses pembayaran...');

  const orderId = sp.get('order_id') || '';
  const statusCode = sp.get('status_code') || '';
  const transactionStatus = sp.get('transaction_status') || '';

  useEffect(() => {
    if (!orderId) {
      window.location.replace('/bookings');
      return;
    }

    const isSuccess = statusCode === '200' || transactionStatus === 'settlement' || transactionStatus === 'capture';
    const isPending = statusCode === '201' || transactionStatus === 'pending';
    const isFailed = statusCode === '202' || transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire';

    if (isSuccess) {
      setMessage('Pembayaran berhasil! Mengarahkan ke rincian pesanan...');
    } else if (isPending) {
      setMessage('Pembayaran sedang diproses. Mengarahkan ke rincian pesanan...');
    } else if (isFailed) {
      setMessage('Pembayaran tidak berhasil. Mengarahkan ke rincian pesanan...');
    }

    const timer = setTimeout(() => {
      router.replace(`/bookings/${orderId}`);
    }, 1800);

    return () => clearTimeout(timer);
  }, [orderId, statusCode, transactionStatus, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-5">
      <div
        style={{
          width: 52,
          height: 52,
          border: '3px solid #1e293b',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <div className="text-center space-y-1">
        <p className="text-slate-700 font-semibold text-base">{message}</p>
        <p className="text-slate-400 text-sm">Harap tunggu sebentar...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function PaymentFinish() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
          <div
            style={{
              width: 48,
              height: 48,
              border: '3px solid #1e293b',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p className="text-slate-400 text-sm font-medium">Memproses...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      }
    >
      <FinishContent />
    </Suspense>
  );
}
