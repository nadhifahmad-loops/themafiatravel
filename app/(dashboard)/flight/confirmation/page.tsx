'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

function ConfirmationContent() {
  const { language } = useLanguage();
  const t = i18n.flightConfirmation[language];
  const sp = useSearchParams();
  const orderId = sp.get('order') || '';
  const status = sp.get('status') || 'pending';
  const isSuccess = status === 'success';
  const isPending = status === 'pending';

  const config = {
    icon: isSuccess ? '✓' : isPending ? '✈️' : '✕',
    title: isSuccess ? t.title : isPending ? 'Menunggu Pembayaran' : 'Pembayaran Gagal',
    desc: isSuccess
      ? t.subtitle
      : isPending
      ? 'Selesaikan pembayaran sebelum batas waktu agar kursi dan tarif tetap aman.'
      : 'Terjadi masalah pada pembayaran. Silakan coba lagi atau hubungi tim support.',
    iconBg: isSuccess ? 'bg-emerald-100' : isPending ? 'bg-orange-100' : 'bg-red-100',
    iconColor: isSuccess ? 'text-emerald-600' : isPending ? 'text-orange-600' : 'text-red-600',
    iconBorder: isSuccess ? 'border-emerald-200' : isPending ? 'border-orange-200' : 'border-red-200',
  };

  const nextSteps = isSuccess
    ? [
        'Kami akan mengirim e-ticket ke alamat email pemesan.',
        'Pastikan nama penumpang sesuai dokumen perjalanan.',
      ]
    : isPending
    ? [
        'Selesaikan pembayaran melalui laman Midtrans yang terbuka.',
        'Konfirmasi pemesanan akan muncul otomatis setelah pembayaran selesai.',
      ]
    : [
        'Coba ulang pembayaran atau pilih penerbangan lain.',
        'Hubungi tim support jika masalah berlanjut.',
      ];

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className={`px-6 py-8 text-center ${isSuccess ? 'bg-emerald-50' : isPending ? 'bg-orange-50' : 'bg-red-50'}`}>
          <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 text-3xl ${config.iconBg} ${config.iconBorder}`}>
            <span className={config.iconColor}>{config.icon}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">{config.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{config.desc}</p>
        </div>

        <div className="p-6 md:p-7 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{t.orderNumber}</span>
              <span className="font-black text-slate-800">{orderId || '—'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <i className="fa-solid fa-list-check text-orange-500" />
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Apa selanjutnya?</p>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              {nextSteps.map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <i className="fa-solid fa-circle-check mt-0.5 text-orange-500" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/bookings" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition-all hover:bg-orange-700">
              <i className="fa-solid fa-list-check" /> {t.viewBooking}
            </Link>
            <Link href="/flight/search" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3.5 text-sm font-bold text-orange-600 transition-colors hover:bg-orange-100">
              <i className="fa-solid fa-magnifying-glass" /> Cari Penerbangan Lainnya
            </Link>
            <Link href="/dashboard" className="mt-1 text-center text-xs text-slate-400 transition-colors hover:text-slate-600">
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-orange-200 border-t-orange-600" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
