'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import Image from 'next/image';
import { i18n } from '@/lib/i18n';
import TermsModal from '@/components/checkout/TermsModal';
import { CARRIER_CODE_TO_AIRLINE, PROVIDER_ID_TO_LABEL } from '@/lib/providers';
import { hasFlightDeparted } from '@/lib/orbis-post-booking';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

type RefundData = {
  order_number: string;
  issued_name: string;
  provider: string;
  refund_amount: number | null;
  estimate_source?: 'vendor' | 'manual';
  cancellation_policy: string[];
  refund_fee?: {
    pnr: string;
    received_amount: number;
    charge_rate: number;
    charge_type: string;
    currency_code: string;
    status: string;
    refund_code: string;
  }[];
};

type RefundCaptcha = { pnr: string; image: string };

type CancelResult = {
  pnr?: string;
  refund_code?: string;
  received_amount: number | null;
  refund_mode?: 'auto' | 'manual' | 'void';
  status: string;
  warning?: string;
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
  const [refundCaptcha, setRefundCaptcha] = useState<RefundCaptcha[]>([]);
  const [captchaValues, setCaptchaValues] = useState<Record<string, string>>({});

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
    if (booking.bookingType === 'flight' && hasFlightDeparted(booking)) {
      setRefundError('Waktu keberangkatan sudah lewat. Refund mandiri tidak tersedia; hubungi customer service untuk memeriksa apakah aturan maskapai menyediakan pengecualian.');
      return;
    }
    setLoadingRefund(true);
    setRefundError('');
    setRefundCaptcha([]);
    setCaptchaValues({});

    const sType = booking.bookingType;
    try {
      if (sType === 'flight') {
        const loginResponse = await fetch('/api/flight/refund/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: id }),
        });
        const loginJson = await loginResponse.json();
        if (!loginResponse.ok || !loginJson.success) {
          const loginError = loginJson.error || 'Gagal memuat verifikasi refund maskapai.';
          if (loginResponse.status < 500) {
            throw new Error(loginError);
          }
          throw new Error(
            'Maskapai gagal menyiapkan captcha refund. Estimasi refund belum dapat diperiksa karena verifikasi captcha diwajibkan oleh vendor. Coba lagi nanti atau hubungi customer service dengan nomor pesanan ini.'
          );
        }

        const rawChallenges = loginJson.data?.pre_refund_login;
        const challengeList = Array.isArray(rawChallenges)
          ? rawChallenges
          : rawChallenges && typeof rawChallenges === 'object'
            ? [rawChallenges]
            : [];
        const challenges = challengeList.flatMap((item: unknown) => {
          if (!item || typeof item !== 'object') return [];
          const value = item as Record<string, unknown>;
          if (typeof value.pnr !== 'string' || typeof value.img !== 'string' || !value.img) return [];
          return [{ pnr: value.pnr, image: value.img }];
        });

        if (challenges.length) {
          setRefundCaptcha(challenges);
          setRefundData(null);
          return;
        }

        throw new Error(
          'Maskapai tidak mengirim captcha refund. Estimasi tidak dapat diproses tanpa verifikasi tersebut. Coba lagi nanti atau hubungi customer service.'
        );
      }

      if (sType === 'train' || sType === 'insurance') {
        setRefundData({
          order_number: booking.orderNumber,
          issued_name: booking.pnr || booking.orderNumber,
          provider: booking.provider || sType,
          refund_amount: null,
          estimate_source: 'manual',
          cancellation_policy: sType === 'train'
            ? ['Dokumentasi API KAI mendukung pembatalan booking, tetapi tidak mencantumkan nominal atau kebijakan nilai refund. Nominal akan diverifikasi admin setelah pembatalan vendor.']
            : ['Dokumentasi API asuransi mendukung pembatalan polis, tetapi tidak mencantumkan nominal refund atau masa free-look. Nominal akan diverifikasi admin setelah pembatalan vendor.'],
          refund_fee: [],
        });
        return;
      }

      let res: Response;
      if (sType === 'hotel') {
        res = await fetch('/api/hotel/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_number: booking.orderNumber,
            check_only: true,
          }),
        });
      } else {
        throw new Error('Jenis booking tidak mendukung pemeriksaan refund mandiri.');
      }

      const data = await res!.json();

      if (!res!.ok || !data.success) {
        throw new Error(data.error || 'Gagal memuat estimasi refund');
      }

      const quote = data.data && typeof data.data === 'object'
        ? data.data as Record<string, unknown>
        : {};
      const quoteAmount = typeof data.refundAmount === 'number' && Number.isFinite(data.refundAmount)
        ? data.refundAmount
        : null;
      if (quoteAmount === null) {
        throw new Error('Vendor tidak mengembalikan nominal refund yang valid.');
      }
      const policies = Array.isArray(quote.cancellation_policy)
        ? quote.cancellation_policy.filter((item): item is string => typeof item === 'string')
        : typeof quote.cancellation_policy === 'string'
          ? [quote.cancellation_policy]
          : ['Nominal refund berdasarkan check_refund_amount dan dapat berubah sesuai hasil pembatalan vendor.'];
      const rawFees = Array.isArray(quote.refund_fee)
        ? quote.refund_fee
        : quote.refund_fee && typeof quote.refund_fee === 'object'
          ? [quote.refund_fee]
          : [];
      const resolvedIssuedName = typeof data.identifiers?.issued_name === 'string'
        ? data.identifiers.issued_name
        : booking.pnr || booking.orderNumber;

      setRefundData({
        order_number: booking.orderNumber,
        issued_name: resolvedIssuedName,
        provider: booking.provider || 'hotel',
        refund_amount: quoteAmount,
        estimate_source: 'vendor',
        cancellation_policy: policies,
        refund_fee: rawFees.map((value) => {
          const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
          return {
            pnr: typeof row.pnr === 'string' ? row.pnr : booking.pnr || booking.orderNumber,
            received_amount: typeof row.received_amount === 'number' ? row.received_amount : quoteAmount,
            charge_rate: typeof row.charge_rate === 'number'
              ? row.charge_rate
              : Math.max(0, Number(booking.totalAmount || 0) - quoteAmount),
            charge_type: typeof row.charge_type === 'string' ? row.charge_type : 'amount',
            currency_code: typeof row.currency_code === 'string' ? row.currency_code : 'IDR',
            status: typeof row.status === 'string' ? row.status : booking.status,
            refund_code: typeof row.refund_code === 'string' ? row.refund_code : '',
          };
        }),
      });
    } catch (e: unknown) {
      setRefundError(e instanceof Error ? e.message : 'Gagal memuat data refund');
    } finally {
      setLoadingRefund(false);
    }
  };

  const loadFlightRefundQuote = async (captcha: Record<string, string>) => {
    if (!Object.keys(captcha).length || Object.values(captcha).some((value) => !value.trim())) {
      throw new Error('Captcha refund wajib diisi sebelum meminta estimasi dari maskapai.');
    }

    const response = await fetch('/api/flight/refund/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: id, ...(Object.keys(captcha).length ? { captcha } : {}) }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Gagal mengambil estimasi refund dari maskapai.');
    }

    const vendorAmount = typeof result.refundableAmount === 'number' && Number.isFinite(result.refundableAmount)
      ? result.refundableAmount
      : null;
    const amount = vendorAmount;
    const fee = amount === null ? 0 : Math.max(0, Number(booking.totalAmount || 0) - amount);
    setRefundData({
      order_number: booking.orderNumber,
      issued_name: booking.pnr || booking.orderNumber,
      provider: booking.provider || 'flight',
      refund_amount: amount,
      estimate_source: vendorAmount === null ? 'manual' : 'vendor',
      cancellation_policy: vendorAmount === null
        ? ['Maskapai tidak mengembalikan nominal refund yang dapat dibaca. Pembatalan tetap akan meminta review admin; nominal diverifikasi dari respons vendor sebelum dana diproses.']
        : ['Estimasi nominal berasal dari get_refund_booking maskapai dan dapat berubah sesuai hasil cancel vendor.'],
      refund_fee: amount === null ? [] : [{
        pnr: booking.pnr || booking.orderNumber,
        received_amount: amount,
        charge_rate: fee,
        charge_type: 'amount',
        currency_code: 'IDR',
        status: booking.status,
        refund_code: '',
      }],
    });
    setRefundCaptcha([]);
    setCaptchaValues({});
  };

  const submitRefundCaptcha = async () => {
    if (!refundCaptcha.length || refundCaptcha.some(({ pnr }) => !captchaValues[pnr]?.trim())) return;
    setLoadingRefund(true);
    setRefundError('');
    try {
      await loadFlightRefundQuote(
        Object.fromEntries(refundCaptcha.map(({ pnr }) => [pnr, captchaValues[pnr].trim()]))
      );
    } catch (error: unknown) {
      setRefundError(error instanceof Error ? error.message : 'Gagal memverifikasi captcha refund.');
    } finally {
      setLoadingRefund(false);
    }
  };

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
            expected_refund_amount: refundData?.refund_amount,
            reason: reasonText,
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
          }),
        });
      } else if (sType === 'train') {
        res = await fetch('/api/train/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: id,
            reason: reasonText,
          }),
        });
      } else {
        res = await fetch('/api/insurance/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: id,
            reason: reasonText,
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
      const refundAmt = typeof data.refund_amount === 'number'
        ? data.refund_amount
        : typeof raw.received_amount === 'number'
          ? raw.received_amount
          : null;

      setCancelResult({
        pnr:             raw.pnr || booking.pnr || booking.orderNumber,
        refund_code:     typeof raw.refund_code === 'string' ? raw.refund_code : undefined,
        received_amount: refundAmt,
        refund_mode: data.refund_mode,
        status:          raw.status || 'CANCELLED',
        warning:         typeof data.warning === 'string' ? data.warning : undefined,
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
  const flightDeparted = booking.bookingType === 'flight' && hasFlightDeparted(booking);
  const nonCancellable = !['paid', 'issued'].includes(booking.status) || flightDeparted;
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
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '20px', color: '#0f172a', margin: '0 0 8px' }}>
            {flightDeparted ? 'Waktu Keberangkatan Sudah Lewat' : 'Pesanan Tidak Dapat Dibatalkan'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px', lineHeight: 1.6 }}>
            {flightDeparted
              ? 'Refund mandiri tidak tersedia setelah waktu keberangkatan. Hubungi customer service untuk memeriksa apakah aturan maskapai menyediakan pengecualian.'
              : <>Pesanan dengan status <span style={{ fontWeight: 700, color: '#ea580c' }}>{booking.status}</span> tidak memenuhi syarat untuk pembatalan/refund.</>}
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

  const refundAmount = refundData?.refund_amount ?? null;
  // charge_rate vendor bisa berupa persentase atau nominal per PNR, bukan
  // selalu total biaya dalam rupiah. Selisih total dibayar - refund adalah
  // angka yang konsisten untuk ditampilkan ke pengguna.
  const cancellationFee = refundAmount === null
    ? null
    : Math.max(0, Number(booking.totalAmount || 0) - refundAmount);

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
                  <i className="fa-solid fa-plug" style={{ color: '#cbd5e1', fontSize: '12px' }}></i> {sType === 'hotel' ? sType : (resolveAirlineName(booking.provider || '') || sType)}
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

            {!loadingRefund && !refundData && refundCaptcha.length === 0 && !refundError && (
              <button
                type="button"
                onClick={callCheckRefund}
                className="w-full rounded-2xl border border-orange-200 bg-white px-5 py-4 text-sm font-bold text-orange-700 shadow-sm transition hover:bg-orange-50"
              >
                <i className="fa-solid fa-magnifying-glass-dollar mr-2"></i>
                Cek estimasi refund dari vendor
              </button>
            )}

            {refundCaptcha.length > 0 && !refundData && (
              <div className="card-hover" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
                <p style={{ fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Verifikasi maskapai</p>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 18px' }}>Masukkan captcha untuk mengambil estimasi refund resmi dari vendor.</p>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {refundCaptcha.map(({ pnr, image }) => (
                    <label key={pnr} style={{ display: 'grid', gap: '8px', maxWidth: '360px' }}>
                      <span style={{ fontSize: '12px', color: '#475569', fontWeight: 700 }}>PNR {pnr}</span>
                      <Image
                        src={image.startsWith('data:') ? image : `data:image/png;base64,${image}`}
                        alt={`Captcha refund untuk PNR ${pnr}`}
                        width={190}
                        height={72}
                        unoptimized
                        className="rounded-lg border border-slate-200 bg-white object-contain"
                      />
                      <input
                        value={captchaValues[pnr] || ''}
                        onChange={(event) => setCaptchaValues((previous) => ({ ...previous, [pnr]: event.target.value }))}
                        autoComplete="off"
                        aria-label={`Captcha PNR ${pnr}`}
                        placeholder="Ketik captcha"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={submitRefundCaptcha}
                  disabled={loadingRefund || refundCaptcha.some(({ pnr }) => !captchaValues[pnr]?.trim())}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingRefund ? 'Memverifikasi...' : 'Cek estimasi refund'}
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </button>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '999px', background: refundData.estimate_source === 'manual' ? '#fff7ed' : '#ecfdf5', color: refundData.estimate_source === 'manual' ? '#c2410c' : '#065f46', fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: refundData.estimate_source === 'manual' ? '#f97316' : '#10b981', display: 'inline-block' }}></span>
                      {refundData.estimate_source === 'manual' ? 'Menunggu verifikasi nominal' : 'Live dari API vendor'}
                    </span>
                  </div>
                  <div style={{ padding: '24px 28px' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Total Dibayar</span>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{fmtRp(booking.totalAmount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', background: '#ecfdf5' }}>
                        <span style={{ fontWeight: 900, fontSize: '15px', color: '#0f172a' }}>
                          {refundData.refund_amount === null ? 'Nominal refund' : 'Estimasi Refund'}
                        </span>
                        <span style={{ fontSize: refundData.refund_amount === null ? '14px' : '26px', fontWeight: 900, color: refundData.refund_amount === null ? '#c2410c' : '#059669' }}>
                          {refundData.refund_amount === null ? 'Menunggu verifikasi' : fmtRp(refundData.refund_amount)}
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '14px 0 0', lineHeight: 1.5 }}>
                      Nomor pesanan: <strong style={{ color: '#475569' }}>{booking.orderNumber}</strong>. Nominal final mengikuti respons vendor dan verifikasi admin.
                    </p>
                  </div>
                </div>

                {/* Product-specific note */}
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
                    ...(cancellationFee !== null
                      ? [{ lbl: 'Biaya Pembatalan', val: `\u2212 ${fmtRp(cancellationFee)}`, color: '#ef4444' }]
                      : []),
                  ].map((row) => (
                    <div key={row.lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{row.lbl}</span>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: row.color || '#0f172a', textAlign: 'right', maxWidth: '55%' }}>{row.val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: '#ecfdf5', borderTop: '2px dashed #a7f3d0' }}>
                    <span style={{ fontWeight: 900, fontSize: '15px', color: '#0f172a' }}>Nominal Refund</span>
                    <span style={{ fontSize: refundAmount === null ? '14px' : '26px', fontWeight: 900, color: refundAmount === null ? '#c2410c' : '#059669' }}>
                      {refundAmount === null ? 'Menunggu verifikasi' : fmtRp(refundAmount)}
                    </span>
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
                <p style={{ margin: 0 }}>Setelah kamu klik <strong>&quot;Batalkan Pesanan Sekarang&quot;</strong>, sistem akan meminta pembatalan ke vendor. Tindakan ini tidak dapat dibatalkan; nominal refund mengikuti hasil vendor dan verifikasi admin.</p>
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
                  {cancelResult.refund_mode === 'auto'
                    ? 'Refund telah dikirim untuk diproses otomatis.'
                    : 'Pembatalan vendor berhasil. Permintaan refund menunggu verifikasi nominal dan review admin sebelum dana dikembalikan.'}
                </p>

                {/* Refund code */}
                {cancelResult.refund_code ? (
                  <div style={{ display: 'inline-block', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '14px 28px', marginBottom: '24px' }}>
                    <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Kode Refund</p>
                    <p style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 900, color: '#0f172a', letterSpacing: '2px', margin: 0 }}>{cancelResult.refund_code}</p>
                  </div>
                ) : null}

                {/* Refund amount */}
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '20px', padding: '24px 40px', display: 'inline-block' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
                    {cancelResult.received_amount === null ? 'Nominal refund' : cancelResult.refund_mode === 'auto' ? 'Refund diproses' : 'Nominal dari vendor'}
                  </p>
                  <p style={{ fontSize: cancelResult.received_amount === null ? '16px' : '36px', fontWeight: 900, color: cancelResult.received_amount === null ? '#c2410c' : '#059669', margin: '0 0 4px' }}>
                    {cancelResult.received_amount === null ? 'Menunggu verifikasi admin' : fmtRp(cancelResult.received_amount)}
                  </p>
                  <p style={{ fontSize: '13px', color: '#10b981', margin: 0 }}>
                    {cancelResult.refund_mode === 'auto' ? 'Dikirim ke metode pembayaran asal' : 'Belum dikirim; menunggu review admin'}
                  </p>
                </div>
              </div>
            </div>

            {cancelResult.warning && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '20px', padding: '20px 24px', display: 'flex', gap: '14px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ color: '#d97706', fontSize: '16px' }}></i>
                </div>
                <div>
                  <p style={{ fontWeight: 700, color: '#92400e', fontSize: '14px', margin: '0 0 4px' }}>Perlu tindak lanjut</p>
                  <p style={{ color: '#a16207', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>{cancelResult.warning}</p>
                </div>
              </div>
            )}

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
                    { dot: '#10b981', bg: '#ecfdf5', date: `Hari ini, ${todayStr}`, title: 'Pembatalan vendor dikonfirmasi', desc: `Pesanan ${booking.orderNumber} berhasil dibatalkan.`, done: true },
                    {
                      dot: cancelResult.refund_mode === 'auto' ? '#10b981' : '#ea580c',
                      bg: cancelResult.refund_mode === 'auto' ? '#ecfdf5' : '#fff7ed',
                      date: cancelResult.refund_mode === 'auto' ? 'Selesai' : 'Menunggu admin',
                      title: cancelResult.refund_mode === 'auto' ? 'Refund dikirim otomatis' : 'Verifikasi nominal dan review refund',
                      desc: cancelResult.received_amount === null
                        ? 'Nominal akan diverifikasi dari data vendor sebelum refund diproses.'
                        : cancelResult.refund_mode === 'auto'
                          ? `${fmtRp(cancelResult.received_amount)} dikirim ke metode pembayaran asal.`
                          : `Nominal vendor ${fmtRp(cancelResult.received_amount)} menunggu persetujuan admin.`,
                      active: cancelResult.refund_mode !== 'auto',
                      done: cancelResult.refund_mode === 'auto',
                    },
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

                {/* Refund status information */}
                <div style={{ marginTop: '24px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '18px 20px', display: 'flex', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="fa-solid fa-envelope" style={{ color: '#3b82f6', fontSize: '14px' }}></i>
                  </div>
                  <div style={{ fontSize: '12px', color: '#1e40af', lineHeight: 1.6 }}>
                    <p style={{ fontWeight: 700, margin: '0 0 2px' }}>Status permintaan refund</p>
                    <p style={{ margin: 0 }}>
                      {cancelResult.refund_mode === 'auto'
                        ? 'Refund otomatis telah dikirim ke metode pembayaran asal.'
                        : 'Tim admin akan memverifikasi nominal vendor sebelum memproses pengembalian dana.'}
                      {cancelResult.refund_code ? <> Simpan kode refund <strong>{cancelResult.refund_code}</strong> untuk referensi.</> : null}
                    </p>
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
