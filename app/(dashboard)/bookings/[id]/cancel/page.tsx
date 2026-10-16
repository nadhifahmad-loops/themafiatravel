'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import Image from 'next/image';
import { i18n } from '@/lib/i18n';
import TermsModal from '@/components/checkout/TermsModal';
import { CARRIER_CODE_TO_AIRLINE, PROVIDER_ID_TO_LABEL } from '@/lib/providers';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

type RefundData = {
  order_number: string;
  issued_name: string;
  provider: string;
  refund_amount: number;
  cancellation_policy: string[];
  refund_fee: {
    pnr: string;
    received_amount: number;
    charge_rate: number;
    charge_type: string;
    currency_code: string;
    status: string;
    refund_code: string;
  }[];
};

type CancelResult = {
  pnr?: string;
  refund_code: string;
  received_amount: number;
  status: string;
};

const REASONS = [
  { key: 'change-plan',   icon: '\u{1F4C8}', title: 'Perubahan rencana perjalanan',         desc: 'Jadwal atau tujuan berubah sehingga perjalanan tidak dapat dilanjutkan' },
  { key: 'health',        icon: '\u{1F3E5}', title: 'Kondisi kesehatan / darurat keluarga',  desc: 'Sakit atau kondisi darurat yang tidak memungkinkan bepergian' },
  { key: 'found-better',  icon: '\u{1F50D}', title: 'Menemukan opsi yang lebih baik',        desc: 'Tersedia harga atau akomodasi yang lebih sesuai kebutuhan' },
  { key: 'duplicate',     icon: '\u{1F504}', title: 'Pesanan duplikat / salah pesan',        desc: 'Tidak sengaja memesan dua kali atau terdapat kesalahan data' },
  { key: 'other',         icon: '\u{1F4AC}', title: 'Alasan lainnya',                        desc: 'Ceritakan alasanmu secara spesifik' },
];

const fmtRp = (n: number) =>
  'IDR ' + new Intl.NumberFormat('id-ID').format(Math.round(n || 0));

const fmtDate = (ds: string) => {
  if (!ds) return '-';
  return new Date(ds).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

// ─────────────────────────────────────────────────────────────
// STEP PROGRESS BAR
// ─────────────────────────────────────────────────────────────
const STEP_LABELS = ['Cek Kebijakan', 'Pilih Alasan', 'Konfirmasi', 'Selesai'];

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-5 py-3.5 mb-6 shadow-sm overflow-x-auto gap-0">
      {STEP_LABELS.map((label, i) => {
        const stepNum = (i + 1) as Step;
        const isDone    = current > stepNum;
        const isActive  = current === stepNum;
        return (
          <div key={i} className="flex items-center flex-shrink-0">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: isDone ? '#10b981' : isActive ? '#ea580c' : '#f1f5f9',
                  color: isDone || isActive ? 'white' : '#94a3b8',
                  boxShadow: isActive ? '0 0 0 4px rgba(234, 88, 12, 0.15)' : 'none',
                }}
              >
                {isDone ? '\u2713' : stepNum}
              </div>
              <span
                className="text-xs font-semibold hidden sm:block"
                style={{ color: isDone ? '#10b981' : isActive ? '#ea580c' : '#94a3b8' }}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className="w-8 h-0.5 mx-2 rounded-full flex-shrink-0"
                style={{ background: isDone ? '#34d399' : '#e2e8f0' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function resolveAirlineName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  const firstPart = parts[0] || '';
  const upperFirst = firstPart.toUpperCase();
  if (CARRIER_CODE_TO_AIRLINE[upperFirst]) return CARRIER_CODE_TO_AIRLINE[upperFirst];
  const upper = trimmed.toUpperCase();
  if (CARRIER_CODE_TO_AIRLINE[upper]) return CARRIER_CODE_TO_AIRLINE[upper];
  const lower = trimmed.toLowerCase();
  if (PROVIDER_ID_TO_LABEL[lower]) return PROVIDER_ID_TO_LABEL[lower];
  return trimmed;
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function CancelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { language } = useLanguage();
  const t = i18n.bookingDetail[language];
  const tc = i18n.common[language];

  const [step, setStep]                 = useState<Step>(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [booking, setBooking] = useState<any>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);

  // Step 1
  const [refundData, setRefundData]     = useState<RefundData | null>(null);
  const [loadingRefund, setLoadingRefund] = useState(false);
  const [refundError, setRefundError]   = useState('');

  // Step 2
  const [reason, setReason]             = useState('');
  const [otherNote, setOtherNote]       = useState('');

  // Step 3
  const [agreed, setAgreed]             = useState(false);
  // Dialog Syarat & Ketentuan — dibuka di tempat tanpa navigasi.
  const [termsOpen, setTermsOpen]       = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [processMsg, setProcessMsg]     = useState('Menghubungi vendor...');
  const [cancelError, setCancelError]   = useState('');
  const [alertType, setAlertType]       = useState<'success' | 'error' | ''>('');

  // Step 5 (success)
  const [cancelResult, setCancelResult] = useState<CancelResult | null>(null);

  // ── Load booking data ────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    fetch(`/api/bookings/${id}`)
      .then(r => r.json())
      .then(r => { if (r.success) setBooking(r.data); })
      .catch(console.error)
      .finally(() => setLoadingBooking(false));
  }, [id]);

  const callCheckRefund = async () => {
    if (!booking) return;
    setLoadingRefund(true);
    setRefundError('');

    const sType = booking.bookingType;
    try {
      let res: Response;
      if (sType === 'hotel') {
        res = await fetch('/api/hotel/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_number: booking.orderNumber,
            issued_name: booking.pnr || booking.orderNumber,
            provider: booking.provider || 'hotelbeds',
            check_only: true,
          }),
        });
      } else if (sType === 'flight') {
        res = await fetch(`/api/bookings/${id}/refund-estimate`, { method: 'POST' });
      } else if (sType === 'train') {
        res = await fetch(`/api/bookings/${id}/refund-estimate`, { method: 'POST' });
      } else {
        res = await fetch(`/api/bookings/${id}/refund-estimate`, { method: 'POST' });
      }

      const data = await res!.json();

      if (!res!.ok || !data.success) {
        throw new Error(data.error || 'Gagal memuat estimasi refund');
      }

      if (sType === 'hotel' && data.data?.refund_fee) {
        setRefundData(data.data);
      } else {
        const est = data.data;
        setRefundData({
          order_number:        booking.orderNumber,
          issued_name:         booking.pnr || booking.orderNumber,
          provider:            booking.provider || sType,
          refund_amount:       est.estimated_refund_amount,
          cancellation_policy: [`Biaya penalti: ${fmtRp(est.penalty_fee)}, Biaya admin: ${fmtRp(est.admin_fee)}`],
          refund_fee: [{
            pnr:             booking.pnr || booking.orderNumber,
            received_amount: est.estimated_refund_amount,
            charge_rate:     est.penalty_fee + est.admin_fee,
            charge_type:     'amount',
            currency_code:   'IDR',
            status:          booking.status,
            refund_code:     '',
          }],
        });
      }
    } catch (e: unknown) {
      setRefundError(e instanceof Error ? e.message : 'Gagal memuat data refund');
    } finally {
      setLoadingRefund(false);
    }
  };

  // ── Immediately call check_refund_amount when booking loaded ─
  useEffect(() => {
    if (!booking) return;
    callCheckRefund();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking]);

  // ── Cleanup interval on unmount ──
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  // ── processCancel: calls actual cancel API ───────────────
  const processCancel = async () => {
    if (!booking || !agreed) return;
    setProcessing(true);
    setCancelError('');

    const reasonText = reason === 'other' ? otherNote : REASONS.find(r => r.key === reason)?.title || reason || 'Dibatalkan oleh pengguna';

    const msgs = [
      'Menghubungi vendor...',
      `Memverifikasi data pesanan ${booking.orderNumber}...`,
      'Mengkonfirmasi pembatalan...',
      'Memproses refund & menghasilkan kode refund...',
      'Memperbarui status pesanan...',
    ];
    let msgIdx = 0;
    const iv = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, msgs.length - 1);
      setProcessMsg(msgs[msgIdx]);
    }, 900);
    ivRef.current = iv;

    try {
      const sType = booking.bookingType;
      let res: Response;

      if (sType === 'hotel') {
        res = await fetch('/api/hotel/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_number: booking.orderNumber,
            issued_name: booking.pnr || booking.orderNumber,
            provider: booking.provider || 'hotelbeds',
            refundAmount: refundData?.refund_amount,
          }),
        });
      } else if (sType === 'flight') {
        res = await fetch('/api/flight/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: id,
            cancel_type: 'refund',
            reason: reasonText,
            refundAmount: refundData?.refund_amount,
          }),
        });
      } else if (sType === 'train') {
        res = await fetch('/api/train/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: id,
            reason: reasonText,
            refundAmount: refundData?.refund_amount,
          }),
        });
      } else {
        res = await fetch('/api/insurance/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: id,
            reason: reasonText,
            refundAmount: refundData?.refund_amount,
          }),
        });
      }

      const data = await res!.json();
      clearInterval(iv);
      ivRef.current = null;

      if (!res!.ok || !data.success) {
        throw new Error(data.error || 'Gagal membatalkan pesanan');
      }

      const raw = data.data || {};
      const refundAmt = raw.received_amount || refundData?.refund_amount || 0;

      setCancelResult({
        pnr:             raw.pnr || booking.pnr || booking.orderNumber,
        refund_code:     raw.refund_code || `REF-${Date.now().toString(36).toUpperCase()}`,
        received_amount: refundAmt,
        status:          raw.status || 'CANCELLED',
      });

      setStep(4);
    } catch (e: unknown) {
      clearInterval(iv);
      ivRef.current = null;
      setCancelError(e instanceof Error ? e.message : 'Gagal membatalkan pesanan. Silakan coba lagi atau hubungi CS.');
      setAlertType('error');
      setStep(3);
    } finally {
      setProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // LOADING / NOT FOUND
  // ─────────────────────────────────────────────────────────
  if (loadingBooking) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
          <Link href="/bookings" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, color: '#64748b', textDecoration: 'none' }}>
                <i className="fa-solid fa-arrow-left"></i> {t.back}
          </Link>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.cancelBooking}</p>
          <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end' }}>
            <Image src="/images/logo.svg" alt="logo" width={24} height={24} className="h-6 w-auto" onError={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
          </div>
        </div>
      </nav>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>{t.loading}</p>
      </div>
    </div>
  );

  if (!booking) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
          <Link href="/bookings" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, color: '#64748b', textDecoration: 'none' }}>
                <i className="fa-solid fa-arrow-left"></i> {t.back}
          </Link>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.cancelBooking}</p>
          <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end' }}>
            <Image src="/images/logo.svg" alt="logo" width={24} height={24} className="h-6 w-auto" onError={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
          </div>
        </div>
      </nav>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '8px' }}>
        <p style={{ fontSize: '48px', margin: 0 }}>&#128196;</p>
        <p style={{ color: '#64748b', fontWeight: 600, margin: 0 }}>{t.notFound}</p>
        <Link href="/bookings" style={{ display: 'inline-block', marginTop: '12px', color: '#ea580c', fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>
          {t.backToList}
        </Link>
      </div>
    </div>
  );

  // Guard: jangan bisa akses halaman ini kalau status bukan cancellable
  const nonCancellable = !['paid', 'issued'].includes(booking.status);
  if (nonCancellable) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
          <Link href={`/bookings/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, color: '#64748b', textDecoration: 'none' }}>
                <i className="fa-solid fa-arrow-left"></i> {t.back}
          </Link>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.cancelBooking}</p>
          <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end' }}>
            <Image src="/images/logo.svg" alt="logo" width={24} height={24} className="h-6 w-auto" onError={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
          </div>
        </div>
      </nav>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ maxWidth: '420px', textAlign: 'center', padding: '40px', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>&#128683;</p>
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '20px', color: '#0f172a', margin: '0 0 8px' }}>Pesanan Tidak Dapat Dibatalkan</h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px', lineHeight: 1.6 }}>
            Pesanan dengan status <span style={{ fontWeight: 700, color: '#ea580c' }}>{booking.status}</span> tidak memenuhi syarat untuk pembatalan/refund.
          </p>
          <Link href={`/bookings/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px', background: '#ea580c', color: 'white', fontWeight: 700, borderRadius: '16px', textDecoration: 'none', fontSize: '14px', boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)' }}>
            <i className="fa-solid fa-arrow-left text-xs"></i> Kembali ke Detail
          </Link>
        </div>
      </div>
    </div>
  );

  const sType    = booking.bookingType || 'hotel';
  const isFlight = sType === 'flight';
  const isTrain  = sType === 'train';
  const isIns    = sType === 'insurance';

  const productName = isFlight
    ? `${booking.routeLabel || `${booking.origin} → ${booking.destination}`} · ${resolveAirlineName(booking.airlineName || '') || 'Maskapai'}`
    : isTrain
    ? booking.routeLabel || 'Kereta Api'
    : isIns
    ? booking.hotelName || 'Asuransi Perjalanan'
    : booking.hotelName || 'Hotel';

  const productIcon = isFlight ? 'fa-plane' : isTrain ? 'fa-train' : isIns ? 'fa-shield-halved' : 'fa-hotel';

  const cancellationFee = refundData
    ? (refundData.refund_fee?.[0]?.charge_rate || 0)
    : 0;
  const refundAmount    = refundData?.refund_amount || 0;

  const reasonLabel = REASONS.find(r => r.key === reason)?.title || reason;

  const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // ─────────────────────────────────────────────────────────
  // RENDER PROCESSING OVERLAY
  // ─────────────────────────────────────────────────────────
  if (processing) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8' }}>
                <i className="fa-solid fa-arrow-left"></i> {t.back}
          </span>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.cancelBooking}</p>
          <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end' }}>
            <Image src="/images/logo.svg" alt="logo" width={24} height={24} className="h-6 w-auto" onError={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
          </div>
        </div>
      </nav>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          {/* Spinner */}
          <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 28px' }}>
            <div style={{ position: 'absolute', inset: 0, border: '4px solid #f1f5f9', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', inset: 0, border: '4px solid #ea580c', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>&#9203;</div>
          </div>
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '22px', color: '#0f172a', margin: '0 0 8px' }}>Memproses Pembatalan...</h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px' }}>{processMsg}</p>
          {/* Bouncing dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '32px' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: '8px', height: '8px', background: '#fdba74', borderRadius: '50%', animation: 'bounce 1.4s infinite', animationDelay: `${i * 0.16}s` }} />
            ))}
          </div>
          {/* Security badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 20px', borderRadius: '12px' }}>
            <i className="fa-solid fa-lock" style={{ fontSize: '11px' }}></i> Koneksi aman &middot; API Orbisway &middot; cancel_booking
          </div>
        </div>
      </div>
      <style>{`
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
      `}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .cancel-fade { animation: fadeInUp 0.5s ease forwards; }
        .card-hover { transition: all 0.2s; }
        .card-hover:hover { box-shadow: 0 12px 40px -8px rgba(0,0,0,0.12); transform: translateY(-1px); }
      `}} />

      {/* ── STICKY NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
          <Link href={`/bookings/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }}>
                <i className="fa-solid fa-arrow-left"></i> {t.back}
          </Link>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.cancelBooking}</p>
          <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end' }}>
            <Image src="/images/logo.svg" alt="logo" width={24} height={24} className="h-6 w-auto" onError={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
          </div>
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Step bar — hide on step 4 (success) */}
        {step < 4 && <StepBar current={step} />}

        {/* ══════════════════════════════════════════════════════
            STEP 1 — CEK KEBIJAKAN
        ══════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="cancel-fade space-y-5">

            {/* ── BOOKING CARD (dark gradient header) ── */}
            <div className="card-hover" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
              {/* Dark gradient header */}
              <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '28px 32px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(234, 88, 12, 0.15)', filter: 'blur(30px)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(234, 88, 12, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fa-solid ${productIcon}`} style={{ color: '#ea580c', fontSize: '20px' }}></i>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>Pesanan</p>
                      <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 900, color: 'white' }}>{productName}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Total Dibayar</p>
                    <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 900, color: 'white' }}>{fmtRp(booking.totalAmount)}</p>
                  </div>
                </div>
              </div>
              {/* Meta bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '16px 32px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                  <i className="fa-solid fa-receipt" style={{ color: '#cbd5e1', fontSize: '12px' }}></i> {booking.orderNumber}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                  <i className="fa-solid fa-plug" style={{ color: '#cbd5e1', fontSize: '12px' }}></i> {resolveAirlineName(booking.provider || '') || sType}
                </span>
                {booking.checkinDate && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                    <i className="fa-solid fa-calendar" style={{ color: '#cbd5e1', fontSize: '12px' }}></i> {fmtDate(booking.checkinDate)}
                  </span>
                )}
                {booking.departureDate && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                    <i className="fa-solid fa-calendar-check" style={{ color: '#cbd5e1', fontSize: '12px' }}></i> {fmtDate(booking.departureDate)}
                  </span>
                )}
              </div>
            </div>

            {/* Loading refund data */}
            {loadingRefund && (
              <div className="card-hover" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '40px 32px', textAlign: 'center', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: '10px', height: '10px', background: '#fdba74', borderRadius: '50%', animation: 'bounce 1.4s infinite', animationDelay: `${i * 0.16}s` }} />
                  ))}
                </div>
                <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>Mengambil data kebijakan refund dari API...</p>
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>check_refund_amount &middot; {sType}</p>
              </div>
            )}

            {/* Error */}
            {refundError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '20px', padding: '20px 24px', display: 'flex', gap: '14px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444', fontSize: '16px' }}></i>
                </div>
                <div>
                  <p style={{ fontWeight: 700, color: '#991b1b', fontSize: '14px', margin: '0 0 4px' }}>Gagal memuat data refund</p>
                  <p style={{ color: '#b91c1c', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>{refundError}</p>
                  <button onClick={callCheckRefund} style={{ marginTop: '10px', fontSize: '13px', fontWeight: 700, color: '#991b1b', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <i className="fa-solid fa-rotate-right" style={{ marginRight: '4px', fontSize: '11px' }}></i> {tc.retry}
                  </button>
                </div>
              </div>
            )}

            {/* Refund result */}
            {refundData && !loadingRefund && (
              <>
                {/* Warning box */}
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '20px', padding: '20px 24px', display: 'flex', gap: '14px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <i className="fa-solid fa-circle-exclamation" style={{ color: '#d97706', fontSize: '16px' }}></i>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, color: '#92400e', fontSize: '14px', margin: '0 0 6px' }}>Baca Kebijakan Sebelum Melanjutkan</p>
                    {refundData.cancellation_policy.map((p, i) => (
                      <p key={i} style={{ color: '#a16207', fontSize: '13px', margin: '0 0 4px', lineHeight: 1.6 }}>{p}</p>
                    ))}
                  </div>
                </div>

                {/* Estimasi card */}
                <div className="card-hover" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa-solid fa-sack-dollar" style={{ color: '#10b981', fontSize: '16px' }}></i>
                      </div>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>Estimasi Refund</span>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '999px', background: '#ecfdf5', color: '#065f46', fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                      Live dari API
                    </span>
                  </div>
                  <div style={{ padding: '24px 28px' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Total Dibayar</span>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{fmtRp(booking.totalAmount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Biaya Pembatalan</span>
                        <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '14px' }}>&#8722; {fmtRp(cancellationFee)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', background: '#ecfdf5' }}>
                        <span style={{ fontWeight: 900, fontSize: '15px', color: '#0f172a' }}>Estimasi Refund</span>
                        <span style={{ fontSize: '26px', fontWeight: 900, color: '#059669' }}>{fmtRp(refundAmount)}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '14px 0 0', lineHeight: 1.5 }}>
                      * Kode refund akan dihasilkan setelah konfirmasi. Nomor pesanan: <strong style={{ color: '#475569' }}>{booking.orderNumber}</strong>
                    </p>
                  </div>
                </div>

                {/* Product-specific note */}
                {sType === 'train' && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '20px', padding: '20px 24px', display: 'flex', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fa-solid fa-train" style={{ color: '#3b82f6', fontSize: '16px' }}></i>
                    </div>
                    <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: 1.6 }}>
                      <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Kebijakan Pembatalan KAI</p>
                      <p style={{ margin: 0 }}>Biaya administrasi KAI: 10% dari harga tiket per penumpang. Refund dikirim ke metode pembayaran asal dalam 14 hari kerja.</p>
                    </div>
                  </div>
                )}
                {sType === 'flight' && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '20px', padding: '20px 24px', display: 'flex', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fa-solid fa-circle-exclamation" style={{ color: '#d97706', fontSize: '16px' }}></i>
                    </div>
                    <div style={{ fontSize: '13px', color: '#92400e', lineHeight: 1.6 }}>
                      <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Perhatian: Aturan Fare Maskapai</p>
                      <p style={{ margin: 0 }}>Biaya pembatalan ditentukan oleh fare rule maskapai. Tiket promo mungkin tidak dapat di-refund. Proses pengembalian dana biasanya membutuhkan 30&#8211;90 hari kerja.</p>
                    </div>
                  </div>
                )}
                {sType === 'insurance' && (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '20px', padding: '20px 24px', display: 'flex', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fa-solid fa-shield-halved" style={{ color: '#059669', fontSize: '16px' }}></i>
                    </div>
                    <div style={{ fontSize: '13px', color: '#065f46', lineHeight: 1.6 }}>
                      <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Informasi Pembatalan Asuransi</p>
                      <p style={{ margin: 0 }}>Jika masih dalam masa free-look period (14 hari sejak pembelian), refund penuh dapat diproses tanpa biaya.</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
              <Link href={`/bookings/${id}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 24px', border: '2px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '14px', borderRadius: '16px', textDecoration: 'none', transition: 'all 0.2s', background: 'white' }}>
                <i className="fa-solid fa-arrow-left text-xs"></i> {t.back}
              </Link>
              <button
                onClick={() => setStep(2)}
                disabled={!refundData || loadingRefund}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '16px 24px',
                  background: (!refundData || loadingRefund) ? '#fdba74' : '#ea580c',
                  color: 'white', border: 'none', borderRadius: '16px',
                  fontSize: '14px', fontWeight: 800,
                  cursor: (!refundData || loadingRefund) ? 'not-allowed' : 'pointer',
                  opacity: (!refundData || loadingRefund) ? 0.5 : 1,
                  boxShadow: (!refundData || loadingRefund) ? 'none' : '0 4px 14px rgba(234, 88, 12, 0.25)',
                  transition: 'all 0.2s',
                }}
              >
                {tc.next} <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 2 — PILIH ALASAN
        ══════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="cancel-fade space-y-5">
            <div className="card-hover" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 28px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-pen-to-square" style={{ color: '#3b82f6', fontSize: '16px' }}></i>
                </div>
                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>Alasan Pembatalan</span>
              </div>
              <div style={{ padding: '24px 28px' }}>
                <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Bantu kami memproses refund lebih cepat. Alasan ini hanya untuk data internal dan tidak mempengaruhi nominal refund.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {REASONS.map(r => (
                    <div
                      key={r.key}
                      onClick={() => setReason(r.key)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '14px',
                        padding: '18px 20px', borderRadius: '16px',
                        border: `2px solid ${reason === r.key ? '#ea580c' : '#e2e8f0'}`,
                        background: reason === r.key ? '#fff7ed' : 'white',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        border: `2px solid ${reason === r.key ? '#ea580c' : '#cbd5e1'}`,
                        background: reason === r.key ? '#ea580c' : 'white',
                        flexShrink: 0, marginTop: '1px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}>
                        {reason === r.key && <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }} />}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', margin: 0 }}>{r.title}</p>
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', lineHeight: 1.5 }}>{r.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {reason === 'other' && (
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Keterangan Tambahan</label>
                    <textarea
                      value={otherNote}
                      onChange={e => setOtherNote(e.target.value)}
                      placeholder="Ceritakan alasan pembatalanmu di sini..."
                      style={{
                        width: '100%', padding: '14px 16px',
                        border: '2px solid #e2e8f0', borderRadius: '14px',
                        fontSize: '14px', color: '#0f172a', lineHeight: 1.5,
                        outline: 'none', resize: 'none', fontFamily: 'inherit',
                        transition: 'border-color 0.2s',
                      }}
                      rows={3}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#ea580c'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 24px', border: '2px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '14px', borderRadius: '16px', background: 'white', cursor: 'pointer', transition: 'all 0.2s' }}>
                <i className="fa-solid fa-arrow-left text-xs"></i> {t.back}
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!reason}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '16px 24px',
                  background: !reason ? '#fdba74' : '#ea580c',
                  color: 'white', border: 'none', borderRadius: '16px',
                  fontSize: '14px', fontWeight: 800,
                  cursor: !reason ? 'not-allowed' : 'pointer',
                  opacity: !reason ? 0.5 : 1,
                  boxShadow: !reason ? 'none' : '0 4px 14px rgba(234, 88, 12, 0.25)',
                  transition: 'all 0.2s',
                }}
              >
                {tc.next} <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 3 — KONFIRMASI
        ══════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="cancel-fade space-y-5">
            {/* Summary card */}
            <div className="card-hover" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 28px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-clipboard-list" style={{ color: '#ef4444', fontSize: '16px' }}></i>
                </div>
                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>Ringkasan Pembatalan</span>
              </div>
              <div style={{ padding: '24px 28px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                  {[
                    { lbl: 'Nomor Pesanan',    val: booking.orderNumber },
                    { lbl: 'Produk',           val: productName },
                    { lbl: 'Alasan',           val: reasonLabel },
                    { lbl: 'Total Dibayar',    val: fmtRp(booking.totalAmount) },
                    { lbl: 'Biaya Pembatalan', val: `\u2212 ${fmtRp(cancellationFee)}`, color: '#ef4444' },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none' }}>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{row.lbl}</span>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: row.color || '#0f172a', textAlign: 'right', maxWidth: '55%' }}>{row.val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: '#ecfdf5', borderTop: '2px dashed #a7f3d0' }}>
                    <span style={{ fontWeight: 900, fontSize: '15px', color: '#0f172a' }}>Total Refund</span>
                    <span style={{ fontSize: '26px', fontWeight: 900, color: '#059669' }}>{fmtRp(refundAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Danger alert */}
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '20px', padding: '20px 24px', display: 'flex', gap: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444', fontSize: '16px' }}></i>
              </div>
              <div style={{ fontSize: '13px', color: '#991b1b', lineHeight: 1.6 }}>
                <p style={{ fontWeight: 700, margin: '0 0 6px' }}>Tindakan Ini Tidak Dapat Diurungkan</p>
                <p style={{ margin: 0 }}>Setelah kamu klik <strong>&quot;Batalkan Pesanan Sekarang&quot;</strong>, sistem akan memanggil API <code style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>cancel_booking</code> ke vendor dan tidak bisa dibatalkan. Pastikan kamu sudah membaca kebijakan refund.</p>
              </div>
            </div>

            {/* Agreement checkbox */}
            <div className="card-hover" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px 28px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#ea580c', flexShrink: 0, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: '#475569', lineHeight: 1.7 }}>
                  Saya memahami kebijakan pembatalan dan biaya yang berlaku. Saya menyetujui bahwa keputusan ini bersifat final dan tidak dapat diurungkan. Dengan ini saya menyetujui{' '}
                  {/* Teks ini berada di dalam <label> yang membungkus checkbox,
                      jadi preventDefault() wajib — tanpa itu klik S&K ikut
                      men-toggle checkbox persetujuan. */}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTermsOpen(true); }}
                    style={{ color: '#ea580c', fontWeight: 700, cursor: 'pointer', background: 'transparent', border: 0, padding: 0, font: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                  >
                    Syarat & Ketentuan
                  </button>{' '}
                  pembatalan Orbisway.
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 24px', border: '2px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '14px', borderRadius: '16px', background: 'white', cursor: 'pointer', transition: 'all 0.2s' }}>
                <i className="fa-solid fa-arrow-left text-xs"></i> {t.back}
              </button>
              <button
                onClick={processCancel}
                disabled={!agreed}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  padding: '16px 24px',
                  background: !agreed ? '#fca5a5' : '#dc2626',
                  color: 'white', border: 'none', borderRadius: '16px',
                  fontSize: '14px', fontWeight: 800,
                  cursor: !agreed ? 'not-allowed' : 'pointer',
                  opacity: !agreed ? 0.5 : 1,
                  boxShadow: !agreed ? 'none' : '0 4px 14px rgba(220, 38, 38, 0.3)',
                  transition: 'all 0.2s',
                }}
              >
                <i className="fa-solid fa-trash-can" style={{ fontSize: '13px' }}></i>
                {t.cancelBooking}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 4 — BERHASIL
        ══════════════════════════════════════════════════════ */}
        {step === 4 && cancelResult && (
          <div className="cancel-fade space-y-5">
            <StepBar current={4} />

            {/* Hero success card */}
            <div className="card-hover" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
              <div style={{ padding: '48px 32px', textAlign: 'center' }}>
                {/* Success icon */}
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
                  <i className="fa-solid fa-circle-check" style={{ color: '#10b981', fontSize: '40px' }}></i>
                </div>
                <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '24px', color: '#0f172a', margin: '0 0 8px' }}>Pembatalan Berhasil Diproses!</h2>
                <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '440px', margin: '0 auto 28px', lineHeight: 1.6 }}>
                  Permintaan refund kamu sedang diproses. Dana akan dikembalikan ke metode pembayaran asal sesuai estimasi vendor.
                </p>

                {/* Refund code */}
                <div style={{ display: 'inline-block', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '14px 28px', marginBottom: '24px' }}>
                  <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Kode Refund</p>
                  <p style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 900, color: '#0f172a', letterSpacing: '2px', margin: 0 }}>{cancelResult.refund_code}</p>
                </div>

                {/* Refund amount */}
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '20px', padding: '24px 40px', display: 'inline-block' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Total Refund Kamu</p>
                  <p style={{ fontSize: '36px', fontWeight: 900, color: '#059669', margin: '0 0 4px' }}>{fmtRp(cancelResult.received_amount)}</p>
                  <p style={{ fontSize: '13px', color: '#10b981', margin: 0 }}>
                    Dikirim ke metode pembayaran asal
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="card-hover" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 28px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-chart-line" style={{ color: '#10b981', fontSize: '16px' }}></i>
                </div>
                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>Status Proses Refund</span>
              </div>
              <div style={{ padding: '28px' }}>
                <div style={{ position: 'relative', paddingLeft: '32px' }}>
                  {/* Vertical line */}
                  <div style={{ position: 'absolute', left: '9px', top: '8px', bottom: '8px', width: '2px', background: '#e2e8f0', borderRadius: '1px' }} />

                  {[
                    { dot: '#10b981', bg: '#ecfdf5', date: `Hari ini, ${todayStr}`,        title: 'Pembatalan dikonfirmasi',              desc: `Pesanan ${booking.orderNumber} berhasil dibatalkan.`, done: true },
                    { dot: '#ea580c', bg: '#fff7ed', date: '1\u20132 hari kerja',              title: 'Verifikasi refund oleh tim Orbisway',   desc: 'Tim memverifikasi dan meneruskan ke vendor',          active: true },
                    { dot: '#cbd5e1', bg: '#f8fafc', date: '3\u20135 hari kerja',               title: 'Proses oleh vendor / bank',             desc: 'Refund diteruskan ke penyedia pembayaran',            done: false },
                    { dot: '#cbd5e1', bg: '#f8fafc', date: '7\u201314 hari kerja',               title: 'Dana masuk ke rekeningmu',     desc: `${fmtRp(cancelResult.received_amount)} diterima`,    done: false },
                  ].map((item, i) => (
                    <div key={i} style={{ position: 'relative', marginBottom: i < 3 ? '28px' : 0 }}>
                      {/* Dot */}
                      <div style={{
                        position: 'absolute', left: '-32px', top: '2px',
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: item.active ? '#ea580c' : item.done ? item.dot : '#f1f5f9',
                        border: `2px solid ${item.active ? '#ea580c' : item.done ? item.dot : '#e2e8f0'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: item.active ? '0 0 0 4px rgba(234, 88, 12, 0.12)' : 'none',
                      }}>
                        {item.done && <i className="fa-solid fa-check" style={{ color: 'white', fontSize: '9px' }}></i>}
                      </div>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>{item.date}</p>
                      <p style={{ fontWeight: 700, fontSize: '14px', color: item.active ? '#ea580c' : '#0f172a', margin: '0 0 2px' }}>{item.title}</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Email notification */}
                <div style={{ marginTop: '24px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '18px 20px', display: 'flex', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="fa-solid fa-envelope" style={{ color: '#3b82f6', fontSize: '14px' }}></i>
                  </div>
                  <div style={{ fontSize: '12px', color: '#1e40af', lineHeight: 1.6 }}>
                    <p style={{ fontWeight: 700, margin: '0 0 2px' }}>Notifikasi email aktif</p>
                    <p style={{ margin: 0 }}>Kamu akan mendapat email di setiap tahap proses. Simpan kode refund <strong>{cancelResult.refund_code}</strong> untuk referensi.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href={`/bookings/${id}`} style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 24px', border: '2px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '14px', borderRadius: '16px', textDecoration: 'none', background: 'white', transition: 'all 0.2s' }}>
                <i className="fa-solid fa-arrow-left text-xs"></i> {t.back} ke Detail
              </Link>
              <Link href="/bookings" style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 24px', background: '#ea580c', color: 'white', fontWeight: 700, fontSize: '14px', borderRadius: '16px', textDecoration: 'none', boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)', transition: 'all 0.2s' }}>
                <i className="fa-solid fa-list text-xs"></i> Lihat Semua Pesanan
              </Link>
            </div>

            {/* Help text */}
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '20px', padding: '18px 24px', display: 'flex', gap: '14px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-headset" style={{ color: '#ea580c', fontSize: '14px' }}></i>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.6 }}>
                Pertanyaan? Hubungi <strong style={{ color: '#ea580c' }}>CS Orbisway</strong> di 0800-1234-5678 atau chat di aplikasi. Sertakan kode refund saat menghubungi kami.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ── ALERT MODAL OVERLAY ── */}
      {(cancelError && alertType === 'error') && (
        <div
          onClick={() => { setCancelError(''); setAlertType(''); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '400px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.35)',
              animation: 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* Top accent bar */}
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />

            {/* Content */}
            <div style={{ padding: '36px 32px 28px', textAlign: 'center' }}>
              {/* Animated icon */}
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: '#fef2f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                animation: 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
              }}>
                <i className="fa-solid fa-circle-xmark" style={{ color: '#dc2626', fontSize: '36px' }}></i>
              </div>

              <h3 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '20px', color: '#0f172a', margin: '0 0 8px' }}>
                Pembatalan Gagal
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 4px', lineHeight: 1.6 }}>
                {cancelError}
              </p>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: '#f1f5f9', margin: '0 32px' }} />

            {/* Actions */}
            <div style={{ padding: '20px 32px 24px', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setCancelError(''); setAlertType(''); }}
                style={{
                  flex: 1, padding: '14px 0',
                  border: '2px solid #e2e8f0', borderRadius: '14px',
                  background: 'white', color: '#475569',
                  fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {tc.close}
              </button>
              <button
                onClick={() => { setCancelError(''); setAlertType(''); window.open('tel:080012345678', '_self'); }}
                style={{
                  flex: 1, padding: '14px 0',
                  border: 'none', borderRadius: '14px',
                  background: '#ea580c', color: 'white',
                  fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)',
                  transition: 'all 0.2s',
                }}
              >
                <i className="fa-solid fa-headset" style={{ marginRight: '6px', fontSize: '13px' }}></i>
                Hubungi CS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Syarat & Ketentuan — kontennya sama dengan halaman /terms */}
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes popIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}} />
    </div>
  );
}
