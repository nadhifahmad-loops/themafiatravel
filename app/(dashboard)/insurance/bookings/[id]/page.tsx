'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function InsuranceBookingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        // Kita panggil API get_booking asuransi yang sudah dibuat di orbis.ts
        const res = await fetch(`/api/insurance/booking/${id}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengambil detail pesanan');
        setBooking(data.data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDetail();
  }, [id]);

  if (loading) return <div style={{ color: '#C9A84C', textAlign: 'center', padding: '100px' }}>⏳ Memuat Detail Polis...</div>;
  if (error) return <div style={{ color: '#e74c3c', textAlign: 'center', padding: '100px' }}>⚠️ {error}</div>;

  return (
    <div style={{ padding: '32px', maxWidth: 800, margin: '0 auto', fontFamily: 'DM Sans, sans-serif', color: '#F8F6F0' }}>
      <button onClick={() => router.back()} style={{ background: 'transparent', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', marginBottom: '24px' }}>← Kembali</button>
      
      <div style={{ background: '#1A1A1A', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 20, padding: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '50px', marginBottom: '10px' }}>🛡️</div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', color: '#C9A84C', margin: '0 0 8px 0' }}>E-Polis Asuransi</h1>
          <p style={{ color: '#666', fontSize: '14px' }}>ID Pesanan: {id}</p>
          <span style={{ display: 'inline-block', marginTop: '15px', padding: '6px 16px', background: 'rgba(39,174,96,0.1)', color: '#27AE60', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid rgba(39,174,96,0.2)' }}>
             TERKONFIRMASI
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>Nama Produk</p>
            <p style={{ fontSize: '16px', fontWeight: 'bold' }}>{booking?.product_name || 'BCA Travel Insurance'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>Premi Dibayar</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#C9A84C' }}>IDR {booking?.totalAmount?.toLocaleString('id-ID')}</p>
          </div>
        </div>

        <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
           <h3 style={{ fontSize: '14px', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>Informasi Tertanggung</h3>
           {booking?.passengerData?.map((pax: any, i: number) => (
             <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
                <span style={{ color: '#AAA' }}>{pax.title} {pax.first_name} {pax.last_name}</span>
                <span style={{ color: '#666' }}>{pax.identity?.identity_number}</span>
             </div>
           ))}
        </div>

        <button onClick={() => window.print()} style={{ width: '100%', marginTop: '30px', padding: '14px', background: 'linear-gradient(135deg,#C9A84C,#A07830)', color: '#0A0A0A', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
          🖨️ Cetak E-Polis
        </button>
      </div>
    </div>
  );
}