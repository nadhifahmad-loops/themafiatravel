'use client';

import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import {
  BadgeCheck,
  ShieldX,
  Loader2,
  CalendarDays,
  MapPin,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';

type VerifyDocument = {
  orderNumber: string;
  bookingType: string;
  status: string;
  itemName?: string | null;
  origin?: string | null;
  destination?: string | null;
  routeLabel?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  passengerCount?: number;
  issuedAt?: string | null;
};

const COPY = {
  ID: {
    title: 'Verifikasi Dokumen',
    subtitle: 'Pindai QR pada dokumen untuk memastikan keasliannya.',
    checking: 'Memeriksa dokumen...',
    valid: 'Dokumen Sah',
    validSub: 'Dokumen ini diterbitkan oleh The Mafia Travel dan terdaftar di sistem kami.',
    invalid: 'Dokumen Tidak Valid',
    invalidSub: 'Kode verifikasi tidak cocok atau dokumen tidak terdaftar.',
    order: 'Nomor Pesanan',
    type: 'Layanan',
    service: 'Layanan',
    hotel: 'Hotel',
    route: 'Rute',
    status: 'Status',
    period: 'Tanggal',
    guests: 'Jumlah Tamu',
    issued: 'Diterbitkan',
    home: 'Kembali ke Beranda',
    help: 'Butuh bantuan? Hubungi tim support kami.',
    types: { flight: 'Pesawat', hotel: 'Hotel', train: 'Kereta Api', insurance: 'Asuransi' } as Record<string, string>,
    statuses: {
      pending_payment: 'Menunggu Pembayaran',
      paid: 'Terkonfirmasi',
      issued: 'Tiket Diterbitkan',
      payment_failed: 'Pembayaran Gagal',
      cancelled: 'Dibatalkan',
      expired: 'Kedaluwarsa',
      refund_requested: 'Refund Diproses',
      refund: 'Berhasil Direfund',
    } as Record<string, string>,
  },
  EN: {
    title: 'Document Verification',
    subtitle: 'Scan the QR on your document to confirm its authenticity.',
    checking: 'Checking document...',
    valid: 'Valid Document',
    validSub: 'This document was issued by The Mafia Travel and is registered in our system.',
    invalid: 'Invalid Document',
    invalidSub: 'The verification code does not match or the document is not registered.',
    order: 'Order Number',
    type: 'Service',
    service: 'Service',
    hotel: 'Hotel',
    route: 'Route',
    status: 'Status',
    period: 'Date',
    guests: 'Guests',
    issued: 'Issued',
    home: 'Back to Home',
    help: 'Need help? Contact our support team.',
    types: { flight: 'Flight', hotel: 'Hotel', train: 'Train', insurance: 'Insurance' } as Record<string, string>,
    statuses: {
      pending_payment: 'Pending Payment',
      paid: 'Confirmed',
      issued: 'Ticket Issued',
      payment_failed: 'Payment Failed',
      cancelled: 'Cancelled',
      expired: 'Expired',
      refund_requested: 'Refund in Progress',
      refund: 'Refunded',
    } as Record<string, string>,
  },
};

function fmtDate(v?: string | null) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs font-semibold text-brand-ink text-right">{value}</span>
    </div>
  );
}

function VerifyContent({ id }: { id: string }) {
  const { language } = useLanguage();
  const c = COPY[language];
  const searchParams = useSearchParams();
  const hash = searchParams.get('h') || '';

  const [state, setState] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [doc, setDoc] = useState<VerifyDocument | null>(null);
  const [message, setMessage] = useState('');

  usePageTitle(c.title);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(`/api/verify/${encodeURIComponent(id)}?h=${encodeURIComponent(hash)}`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.valid) {
          setDoc(json.document);
          setState('valid');
        } else {
          setMessage(json.message || c.invalidSub);
          setState('invalid');
        }
      } catch {
        if (!cancelled) {
          setMessage(c.invalidSub);
          setState('invalid');
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [id, hash, c.invalidSub]);

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-card mb-4">
          <ShieldCheck className="w-6 h-6 text-brand-blue" strokeWidth={2} />
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-brand-ink tracking-tight">{c.title}</h1>
        <p className="text-sm text-brand-neutral mt-1.5">{c.subtitle}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        {state === 'loading' && (
          <div className="p-10 flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 text-brand-orange animate-spin" strokeWidth={2.4} />
            <p className="text-sm text-slate-500">{c.checking}</p>
          </div>
        )}

        {state === 'valid' && doc && (
          <>
            <div className="px-5 sm:px-6 py-5 border-b border-slate-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <BadgeCheck className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-700">{c.valid}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{c.validSub}</p>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4">
              <Row label={c.order} value={doc.orderNumber} />
              <Row label={c.type} value={c.types[doc.bookingType] || doc.bookingType} />
              {doc.itemName && <Row label={doc.bookingType === 'hotel' ? c.hotel : c.service} value={doc.itemName} />}
              <Row label={c.status} value={c.statuses[doc.status] || doc.status} />
              {(doc.origin || doc.destination || doc.routeLabel) && (
                <Row
                  label={c.route}
                  value={
                    doc.routeLabel ||
                    `${doc.origin || ''}${doc.origin && doc.destination ? ' → ' : ''}${doc.destination || ''}`
                  }
                />
              )}
              {doc.startDate && (
                <Row
                  label={c.period}
                  value={doc.endDate ? `${fmtDate(doc.startDate)} — ${fmtDate(doc.endDate)}` : fmtDate(doc.startDate)}
                />
              )}
              {!!doc.passengerCount && <Row label={c.guests} value={`${doc.passengerCount}`} />}
              {doc.issuedAt && <Row label={c.issued} value={fmtDate(doc.issuedAt)} />}
            </div>

            <div className="px-5 sm:px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-[11px]">The Mafia Travel</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="text-[11px]">{fmtDate(new Date().toISOString())}</span>
              </div>
            </div>
          </>
        )}

        {state === 'invalid' && (
          <div className="p-8 sm:p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <ShieldX className="w-6 h-6 text-red-500" strokeWidth={2.2} />
            </div>
            <p className="text-base font-bold text-brand-ink">{c.invalid}</p>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{message || c.invalidSub}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-blue hover:text-brand-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {c.home}
        </Link>
        <p className="text-[11px] text-slate-400">{c.help}</p>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-slate-300">
        <Image src="/images/logo.png" alt="The Mafia Travel" width={18} height={18} className="object-contain" />
        <span className="text-[10px] font-semibold tracking-[0.18em] uppercase">The Mafia Travel</span>
      </div>
    </div>
  );
}

export default function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-brand-orange animate-spin" />
        </div>
      }
    >
      <VerifyContent id={id} />
    </Suspense>
  );
}
