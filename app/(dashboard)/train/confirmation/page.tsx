'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ConfirmationContent() {
  const sp = useSearchParams();
  const orderId    = sp.get('order') || '';
  const kaiOrder   = sp.get('kai') || '';
  const pnr        = sp.get('pnr') || '';
  const status     = sp.get('status') || 'pending';
  const isSuccess  = status === 'success';
  const isPending  = status === 'pending';

  const statusConfig = {
    success: {
      icon: '✓', color: '#27AE60', bg: 'rgba(39,174,96,0.12)',
      title: 'Pembayaran Berhasil!',
      desc: 'E-tiket KAI akan segera dikirim ke email kamu.',
    },
    pending: {
      icon: '🚆', color: '#C9A84C', bg: 'rgba(201,168,76,0.12)',
      title: 'Menunggu Pembayaran',
      desc: 'Selesaikan pembayaranmu sebelum batas waktu. Tiket dikunci sementara.',
    },
    failed: {
      icon: '✗', color: '#e74c3c', bg: 'rgba(231,76,60,0.12)',
      title: 'Pembayaran Gagal',
      desc: 'Kursi tidak jadi dikunci. Silakan coba lagi.',
    },
  };

  const cfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap'); @keyframes pop{0%{transform:scale(0.7);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>
        {/* Status Icon */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%', margin: '0 auto 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isSuccess ? 44 : 40,
          background: cfg.bg, border: `2px solid ${cfg.color}`,
          animation: 'pop 0.5s cubic-bezier(.34,1.56,.64,1) both',
        }}>
          {cfg.icon}
        </div>

        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, marginBottom: 10, color: '#F8F6F0', animation: 'fadeUp 0.4s ease 0.1s both' }}>
          {cfg.title}
        </h1>
        <p style={{ color: '#888', fontSize: 15, lineHeight: 1.7, marginBottom: 28, animation: 'fadeUp 0.4s ease 0.15s both' }}>
          {cfg.desc}
        </p>

        {/* Booking details card */}
        <div style={{ background: '#161616', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 16, padding: '22px 24px', marginBottom: 28, textAlign: 'left', animation: 'fadeUp 0.4s ease 0.2s both' }}>
          <div style={{ fontSize: 11, color: '#666', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 16 }}>
            Informasi Pesanan
          </div>

          {orderId && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>NOMOR PESANAN (INTERNAL)</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F8F6F0', fontFamily: 'monospace' }}>{orderId}</div>
            </div>
          )}

          {kaiOrder && (
            <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(201,168,76,0.06)', borderRadius: 10, border: '1px solid rgba(201,168,76,0.12)' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>NOMOR ORDER KAI</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#C9A84C', fontFamily: 'monospace' }}>{kaiOrder}</div>
            </div>
          )}

          {pnr && (
            <div style={{ padding: '12px 14px', background: 'rgba(39,174,96,0.05)', borderRadius: 10, border: '1px solid rgba(39,174,96,0.15)' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>KODE BOOKING (PNR)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#27AE60', fontFamily: 'monospace', letterSpacing: '0.15em' }}>{pnr}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Tunjukkan kode ini di loket / mesin cetak KAI</div>
            </div>
          )}

          {isPending && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.15)', borderRadius: 10, fontSize: 12, color: '#e74c3c', lineHeight: 1.6 }}>
              ⏰ Kursi dikunci sementara. Segera selesaikan pembayaran agar tiket tidak dibatalkan otomatis.
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp 0.4s ease 0.3s both' }}>
          <Link href="/bookings" style={{ padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg,#C9A84C,#A07830)', color: '#0A0A0A', fontWeight: 800, fontSize: 15, textDecoration: 'none', display: 'block', fontFamily: 'inherit', letterSpacing: '0.02em' }}>
            📋 Lihat Pesanan Saya
          </Link>
          <Link href="/train/search" style={{ padding: '14px', borderRadius: 12, border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', fontWeight: 600, fontSize: 14, textDecoration: 'none', display: 'block', fontFamily: 'inherit' }}>
            🚆 Cari Tiket Lagi
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TrainConfirmationPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
        <div style={{ width: 28, height: 28, border: '2px solid rgba(201,168,76,0.3)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
