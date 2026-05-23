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
  const labels: Record<string, { icon: string; title: string; desc: string }> = {
    flight: { icon: '✈️', title: 'Tiket Pesawat', desc: 'E-Tiket akan dikirim ke email kamu.' },
    train: { icon: '🚆', title: 'Tiket Kereta', desc: 'E-Tiket KAI akan dikirim ke email kamu.' },
    insurance: { icon: '🛡️', title: 'Asuransi Perjalanan', desc: 'Polis asuransi akan dikirim ke email kamu.' },
  };
  const l = labels['flight'];
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 90, height: 90, borderRadius: '50%', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, background: isSuccess ? 'rgba(39,174,96,0.12)' : isPending ? 'rgba(201,168,76,0.12)' : 'rgba(192,57,43,0.12)', border: `2px solid ${isSuccess ? '#27AE60' : isPending ? '#C9A84C' : '#e74c3c'}` }}>
          {isSuccess ? '✓' : isPending ? l.icon : '✗'}
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, marginBottom: 12, color: '#F8F6F0' }}>
          {isSuccess ? 'Pembayaran Berhasil!' : isPending ? 'Menunggu Pembayaran' : 'Pembayaran Gagal'}
        </h1>
        <p style={{ color: '#666', fontSize: 15, lineHeight: 1.75, marginBottom: 16 }}>
          {isSuccess ? `${l.title} kamu telah dikonfirmasi. ${l.desc}` : isPending ? 'Pembayaranmu sedang diproses.' : 'Silakan coba lagi.'}
        </p>
        {orderId && (
          <div style={{ background: '#1A1A1A', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 12, padding: '16px 22px', margin: '20px 0', textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 4, letterSpacing: '0.07em' }}>NOMOR PESANAN</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#C9A84C', fontFamily: 'monospace' }}>{orderId}</div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
          <Link href="/bookings" style={{ padding: '14px', borderRadius: 10, background: 'linear-gradient(135deg,#C9A84C,#A07830)', color: '#0A0A0A', fontWeight: 700, fontSize: 15, textDecoration: 'none', display: 'block', fontFamily: 'DM Sans, sans-serif' }}>📋 Lihat Pesanan Saya</Link>
          <Link href="/dashboard" style={{ padding: '14px', borderRadius: 10, border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C', fontWeight: 600, fontSize: 15, textDecoration: 'none', display: 'block', fontFamily: 'DM Sans, sans-serif' }}>🏠 Kembali ke Beranda</Link>
        </div>
      </div>
    </div>
  );
}
export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div style={{ width: 32, height: 32, border: '2px solid #C9A84C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
