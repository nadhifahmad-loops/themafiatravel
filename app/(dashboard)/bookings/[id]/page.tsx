'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import html2pdf from 'html2pdf.js';
import QRCode from 'react-qr-code';

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────

const formatCurrency = (amount: number, currency: string = 'IDR'): string =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

const formatPrintDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

const formatPrintDateShort = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const formatTime = (dateString: string): string => {
  if (!dateString) return '--:--';
  const date = new Date(dateString);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const getDuration = (dep: string, arr: string): string => {
  if (!dep || !arr) return '-';
  const diff = new Date(arr).getTime() - new Date(dep).getTime();
  if (diff <= 0) return '-';
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${h}j ${m}m`;
};

// ─────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    paid:            { label: 'Terkonfirmasi',       bg: '#ecfdf5', color: '#065f46', dot: '#10b981' },
    issued:          { label: 'Tiket Diterbitkan',   bg: '#ecfdf5', color: '#065f46', dot: '#10b981' },
    pending_payment: { label: 'Menunggu Pembayaran', bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
    payment_failed:  { label: 'Pembayaran Gagal',    bg: '#fef2f2', color: '#991b1b', dot: '#ef4444' },
    cancelled:       { label: 'Dibatalkan',          bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
  };
  const s = map[status] ?? { label: status, bg: '#f8fafc', color: '#475569', dot: '#94a3b8' };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '999px', background: s.bg, color: s.color, fontSize: '12px', fontWeight: 700, letterSpacing: '0.03em' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {s.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// INFO CHIP
// ─────────────────────────────────────────────────────────────

const InfoChip = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', borderRadius: '12px', padding: '12px 16px' }}>
    <span style={{ fontSize: '20px' }}>{icon}</span>
    <div>
      <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '14px', color: '#0f172a', fontWeight: 700, marginTop: '2px' }}>{value || '-'}</p>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/bookings/${id}`)
      .then((r) => r.json())
      .then((r) => { if (r.success) setBooking(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // ── PDF DOWNLOAD ───────────────────────────────────────────

  const handleDownloadPDF = async () => {
    const element = document.getElementById('ticket-print');
    if (!element) return;
    setDownloading(true);
    try {
      await html2pdf()
        .set({
          margin: 0,
          filename: `Dokumen_${booking.orderNumber || booking.id}.pdf`,
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { scale: 3, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(element)
        .save();
    } finally {
      setDownloading(false);
    }
  };

  // ── LOADING & NOT FOUND ────────────────────────────────────

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>Menyiapkan Data...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );

  if (!booking)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '48px', marginBottom: '8px' }}>🕵️‍♂️</p>
          <p style={{ color: '#64748b', fontWeight: 600 }}>Pesanan tidak ditemukan, Boss.</p>
          <Link href="/bookings" style={{ display: 'inline-block', marginTop: '16px', color: '#ea580c', fontWeight: 700, textDecoration: 'none' }}>
            ← Kembali ke Daftar Pesanan
          </Link>
        </div>
      </div>
    );

  // ── DYNAMIC DATA EXTRACTION ────────────────────────────────
  const bookingInfo = typeof booking.bookingData === 'object' && booking.bookingData ? booking.bookingData : {};
  const bType = booking.bookingType || (bookingInfo.train_name ? 'train' : bookingInfo.hotelName ? 'hotel' : bookingInfo.planName ? 'insurance' : 'flight');
  
  const passengers = Array.isArray(booking.passengerData) 
    ? booking.passengerData.filter((p: any) => p.first_name) 
    : [];

  // Variabel Dinamis
  const isFlight = bType === 'flight';
  const isTrain = bType === 'train';
  const isHotel = bType === 'hotel';
  const isInsurance = bType === 'insurance';
  const isTransport = isFlight || isTrain;

  const docTitle = isFlight ? 'E-Ticket Penerbangan' : isTrain ? 'E-Ticket Kereta Api' : isHotel ? 'Voucher Hotel' : 'Polis Asuransi';
  
  const startDate = bookingInfo.departureDate || bookingInfo.checkinDate || bookingInfo.startDate || booking.departureDate;
  const endDate = bookingInfo.arrival_date || bookingInfo.checkoutDate || bookingInfo.endDate || booking.returnDate || startDate;
  
  const originCode = bookingInfo.origin || booking.origin || '';
  const destCode = bookingInfo.destination || booking.destination || '';
  const originName = bookingInfo.origin_display_name || (isHotel ? bookingInfo.hotelCity : originCode);
  const destName = bookingInfo.destination_display_name || destCode;
  
  const itemName = isTrain ? (bookingInfo.train_name || 'Kereta API') : isHotel ? (bookingInfo.hotelName || 'Hotel') : isInsurance ? (bookingInfo.planName || 'Asuransi Perjalanan') : (booking.airlineName || 'Maskapai');
  const itemCode = isTrain ? bookingInfo.train_number : isFlight ? booking.flightNumber : '';
  const subclass = bookingInfo.subclass || bookingInfo.class || bookingInfo.roomType || '-';
  const refundable = bookingInfo.refundable === true || bookingInfo.is_refundable === true;
  
  // Custom Icon/Logo
  const logoUrl = isFlight ? `/images/airlines/${booking.provider?.toLowerCase()}.png` : '';
  const defaultIcon = isTrain ? 'fa-train' : isHotel ? 'fa-hotel' : isInsurance ? 'fa-shield-halved' : 'fa-plane';

  // ── RETURN ─────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .booking-card { transition: box-shadow 0.3s; }
        .download-btn { transition: all 0.2s; }
        .download-btn:hover { background: #c2410c !important; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(234, 88, 12, 0.35) !important; }
        .download-btn:active { transform: translateY(0); }
      `}} />

      {/* ── SCREEN VIEW (TAMPILAN WEB/HP) ──────────────────────────────────────── */}
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

        {/* NAVBAR */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
            <Link href="/bookings" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#ea580c'} onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}>
              <i className="fa-solid fa-arrow-left"></i> Kembali
            </Link>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rincian {bType}</p>
            <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end' }}>
               <img src="/images/logo.svg" alt="logo" style={{ height: '24px' }} onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
          </div>
        </nav>

        {/* CONTENT */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 20px 80px' }}>

          {/* ── CARD UTAMA ── */}
          <div className="booking-card" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>

            {/* GRADIENT HEADER */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '32px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(234, 88, 12, 0.15)', filter: 'blur(30px)' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', position: 'relative' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Booking ID</p>
                  <h1 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 900, color: 'white', letterSpacing: '-0.5px' }}>{booking.orderNumber || booking.id}</h1>
                  {(isTransport) && (
                    <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#cbd5e1' }}>PNR: <span style={{ fontWeight: 800, color: '#ea580c', letterSpacing: '1px' }}>{booking.pnr || '-'}</span></p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total Tagihan</p>
                  <h2 style={{ margin: '4px 0 10px', fontSize: '26px', fontWeight: 900, color: 'white' }}>{formatCurrency(booking.totalAmount, booking.currency)}</h2>
                  <StatusBadge status={booking.status} />
                </div>
              </div>
            </div>

            {/* VENDOR BAR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 32px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
              {isFlight && logoUrl ? (
                <img src={logoUrl} alt={itemName} style={{ height: '36px', width: 'auto', objectFit: 'contain' }} onError={(e) => e.currentTarget.style.display = 'none'} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fa-solid ${defaultIcon} text-orange-600 text-lg`}></i>
                </div>
              )}
              
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '16px', color: '#0f172a', textTransform: 'uppercase' }}>{itemName}</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                  {itemCode && `${itemCode} • `}{subclass}
                </p>
              </div>
              
              {isTransport && (
                <div style={{ marginLeft: 'auto' }}>
                  <span style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, background: refundable ? '#ecfdf5' : '#fef2f2', color: refundable ? '#065f46' : '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {refundable ? '✓ Refundable' : '✗ Non-Refundable'}
                  </span>
                </div>
              )}
            </div>

            {/* ROUTE / DATE SECTION */}
            <div style={{ padding: '32px' }}>
              
              <p style={{ margin: '0 0 28px', fontSize: '14px', color: '#475569', fontWeight: 700 }}>
                📅 {isHotel || isInsurance ? 'Periode Booking' : formatPrintDate(startDate)}
              </p>

              {isTransport ? (
                // ── TAMPILAN PESAWAT / KERETA ──
                <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                  <div style={{ flex: '0 0 auto', minWidth: '130px' }}>
                    <p style={{ margin: 0, fontSize: '42px', fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px', lineHeight: 1 }}>{formatTime(startDate)}</p>
                    <p style={{ margin: '8px 0 2px', fontSize: '22px', fontWeight: 900, color: '#ea580c' }}>{originCode}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b', maxWidth: '120px', fontWeight: 500 }}>{originName}</p>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>{getDuration(startDate, endDate)}</p>
                    <div style={{ width: '100%', position: 'relative', height: '2px', background: '#cbd5e1' }}>
                      <div style={{ position: 'absolute', left: '-4px', top: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: '#ea580c' }} />
                      <div style={{ position: 'absolute', top: '-4px', left: '50%', transform: 'translateX(-50%)', color: '#ea580c', fontSize: '16px', marginTop: '-6px' }}>
                        <i className={`fa-solid ${defaultIcon}`}></i>
                      </div>
                      <div style={{ position: 'absolute', right: '-4px', top: '-4px', width: '10px', height: '10px', borderRadius: '50%', border: '2.5px solid #ea580c', background: 'white' }} />
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Langsung</p>
                  </div>

                  <div style={{ flex: '0 0 auto', minWidth: '130px', textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '42px', fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px', lineHeight: 1 }}>{formatTime(endDate)}</p>
                    <p style={{ margin: '8px 0 2px', fontSize: '22px', fontWeight: 900, color: '#ea580c' }}>{destCode}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b', maxWidth: '130px', marginLeft: 'auto', fontWeight: 500 }}>{destName}</p>
                  </div>
                </div>
              ) : (
                // ── TAMPILAN HOTEL / ASURANSI ──
                <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                  <div style={{ flex: '0 0 auto', minWidth: '130px' }}>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.2 }}>{formatPrintDateShort(startDate)}</p>
                    <p style={{ margin: '4px 0 2px', fontSize: '14px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>{isHotel ? 'Check-in' : 'Mulai'}</p>
                    {isHotel && <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{formatTime(startDate) !== '--:--' ? formatTime(startDate) : '14:00'}</p>}
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px' }}>
                    <div style={{ width: '100%', position: 'relative', height: '2px', background: '#cbd5e1' }}>
                      <div style={{ position: 'absolute', left: '-4px', top: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: '#ea580c' }} />
                      <div style={{ position: 'absolute', top: '-4px', left: '50%', transform: 'translateX(-50%)', color: '#ea580c', fontSize: '16px', marginTop: '-6px' }}>
                         <i className={`fa-solid ${defaultIcon}`}></i>
                      </div>
                      <div style={{ position: 'absolute', right: '-4px', top: '-4px', width: '10px', height: '10px', borderRadius: '50%', border: '2.5px solid #ea580c', background: 'white' }} />
                    </div>
                  </div>

                  <div style={{ flex: '0 0 auto', minWidth: '130px', textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.2 }}>{formatPrintDateShort(endDate)}</p>
                    <p style={{ margin: '4px 0 2px', fontSize: '14px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>{isHotel ? 'Check-out' : 'Berakhir'}</p>
                    {isHotel && <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{formatTime(endDate) !== '--:--' ? formatTime(endDate) : '12:00'}</p>}
                  </div>
                </div>
              )}

              {/* INFO CHIPS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '36px' }}>
                {isFlight && <InfoChip icon="🎒" label="Bagasi" value={bookingInfo?.baggage_allowance || bookingInfo?.baggage_per_pax || '20 kg'} />}
                {isTrain && <InfoChip icon="💺" label="Kelas" value={subclass} />}
                {isHotel && <InfoChip icon="🛏️" label="Tipe Kamar" value={subclass} />}
                {isInsurance && <InfoChip icon="🛡️" label="Perlindungan" value={bookingInfo?.coverage || 'Full Trip'} />}
                
                <InfoChip icon="👥" label={isHotel ? 'Tamu' : 'Penumpang'} value={`${passengers.length || bookingInfo?.guests || 1} Orang`} />
                <InfoChip icon="🎫" label="No. Pesanan" value={booking.id} />
              </div>

              {/* PASSENGERS/GUESTS LIST */}
              {passengers.length > 0 && (
                <div style={{ marginTop: '32px' }}>
                  <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Data {isHotel ? 'Tamu' : 'Penumpang'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {passengers.map((p: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#ea580c', border: '1px solid #ffedd5' }}>
                            {i + 1}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                              {[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}
                            </p>
                            {p.pax_type && (
                              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                                {p.pax_type === 'ADT' ? 'Dewasa' : p.pax_type === 'CHD' ? 'Anak' : 'Bayi'} 
                                {isFlight && ` • Bagasi ${p.baggage || bookingInfo?.baggage_allowance || '20 kg'}`}
                              </p>
                            )}
                          </div>
                        </div>
                        {isTransport && (
                          <div style={{ textAlign: 'right' }}>
                             <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-Ticket No</p>
                             <p style={{ margin: 0, fontSize: '14px', color: '#0f172a', fontWeight: 800, fontFamily: 'monospace' }}>{p.ticket_number || booking.pnr || '-'}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACTION BUTTON */}
              <div style={{ marginTop: '40px', display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="download-btn"
                  style={{
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    background: downloading ? '#fdba74' : '#ea580c',
                    color: 'white', border: 'none', borderRadius: '16px',
                    padding: '18px 24px', fontSize: '15px', fontWeight: 800,
                    cursor: downloading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)',
                  }}
                >
                  {downloading ? (
                    <>
                      <span style={{ display: 'inline-block', width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Menyiapkan Dokumen...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-file-pdf"></i> Unduh Dokumen (PDF)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ── TEMPLATE E-TIKET PDF (DISEMBUNYIKAN DARI LAYAR) ───────────────── */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
        
        {/* Kontainer Utama yang akan ditangkap oleh html2pdf */}
        <div
          id="ticket-print"
          style={{ width: '210mm', minHeight: '297mm', background: '#fff', padding: '0', margin: '0', fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: '13px', color: '#0f172a' }}
        >
          {/* ── HEADER TIKET ── */}
          <div style={{ background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-40px', top: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(234, 88, 12, 0.2)', filter: 'blur(20px)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', position: 'relative' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{docTitle}</div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Dokumen Resmi The Mafia Travel</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff', letterSpacing: '1px' }}>THE MAFIA TRAVEL</span>
                <img src="/images/logo.svg" alt="logo" style={{ height: '32px' }} onError={(e) => e.currentTarget.style.display = 'none'} />
              </div>
            </div>
          </div>

          {/* ── ISI TIKET ── */}
          <div style={{ padding: '32px' }}>

            {/* VENDOR + ORDER INFO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '24px', borderBottom: '2px solid #f1f5f9', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                {isFlight && logoUrl ? (
                   <img src={logoUrl} alt="vendor" style={{ width: '80px', height: 'auto', objectFit: 'contain' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                ) : (
                   <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                     <i className={`fa-solid ${defaultIcon} text-slate-400 text-2xl`}></i>
                   </div>
                )}
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>{itemName}</div>
                  {itemCode && <div style={{ fontSize: '14px', color: '#475569', marginTop: '2px', fontWeight: 600 }}>{itemCode}</div>}
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Kelas / Tipe: {subclass}</div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Booking ID</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', marginTop: '2px' }}>{booking.orderNumber || booking.id}</div>
                
                {isTransport && (
                  <>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '12px' }}>Kode Booking (PNR)</div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#ea580c', letterSpacing: '4px', fontFamily: 'monospace', marginTop: '2px' }}>{booking.pnr || '-'}</div>
                  </>
                )}
              </div>
            </div>

            {/* TANGGAL */}
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#ea580c' }}>📅</span> {isHotel||isInsurance ? 'Periode' : 'Tanggal'}: {formatPrintDate(startDate)}
            </div>

            {/* ROUTE BOARD PDF */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '24px 32px', marginBottom: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              
              {isTransport ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '38px', fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px', lineHeight: 1 }}>{formatTime(startDate)}</div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#ea580c', marginTop: '8px' }}>{originCode}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>{originName}</div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 32px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 800, marginBottom: '8px' }}>{getDuration(startDate, endDate)}</div>
                    <div style={{ width: '100%', height: '2px', background: '#cbd5e1', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '0', top: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: '#ea580c' }} />
                      <div style={{ position: 'absolute', top: '-9px', left: '50%', transform: 'translateX(-50%)', fontSize: '18px', color: '#ea580c' }}><i className={`fa-solid ${defaultIcon}`}></i></div>
                      <div style={{ position: 'absolute', right: '0', top: '-4px', width: '10px', height: '10px', borderRadius: '50%', border: '2.5px solid #ea580c', background: '#fff' }} />
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '38px', fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px', lineHeight: 1 }}>{formatTime(endDate)}</div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#ea580c', marginTop: '8px' }}>{destCode}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>{destName}</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1 }}>{formatPrintDateShort(startDate)}</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#ea580c', marginTop: '8px', textTransform: 'uppercase' }}>{isHotel ? 'Check-in' : 'Mulai'}</div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 32px' }}>
                    <div style={{ width: '100%', height: '2px', background: '#cbd5e1', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '0', top: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: '#ea580c' }} />
                      <div style={{ position: 'absolute', top: '-9px', left: '50%', transform: 'translateX(-50%)', fontSize: '18px', color: '#ea580c' }}><i className={`fa-solid ${defaultIcon}`}></i></div>
                      <div style={{ position: 'absolute', right: '0', top: '-4px', width: '10px', height: '10px', borderRadius: '50%', border: '2.5px solid #ea580c', background: '#fff' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1 }}>{formatPrintDateShort(endDate)}</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#ea580c', marginTop: '8px', textTransform: 'uppercase' }}>{isHotel ? 'Check-out' : 'Berakhir'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* INFO STRIP PDF */}
            <div style={{ display: 'flex', gap: '0', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', marginBottom: '24px', overflow: 'hidden' }}>
              {[
                { icon: '📋', text: isTransport ? 'Tunjukkan dokumen ini dan identitas resmi saat keberangkatan.' : 'Tunjukkan dokumen ini kepada resepsionis/petugas.' },
                { icon: isTransport ? '⏰' : '📞', text: isTransport ? 'Check-in ditutup 45-90 menit sebelum jadwal.' : 'Hubungi kami jika butuh bantuan lebih lanjut.' },
                { icon: '🕐', text: 'Waktu yang tertera adalah waktu lokal setempat.' },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, padding: '12px 16px', borderRight: i < 2 ? '1px solid #fed7aa' : 'none', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: '11px', color: '#c2410c', fontWeight: 600, lineHeight: 1.4 }}>{item.text}</span>
                </div>
              ))}
            </div>

            {/* TABEL PENUMPANG PDF */}
            {passengers.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #0f172a' }}>Daftar {isHotel ? 'Tamu' : 'Penumpang'}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '12px', textAlign: 'center', color: '#475569', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', width: '40px' }}>No</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Nama</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Tipe</th>
                      {isTransport && <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Tiket / PNR</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {passengers.map((p: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ padding: '14px 12px', textAlign: 'center', fontWeight: 800, color: '#ea580c', borderBottom: '1px solid #f1f5f9' }}>{idx + 1}</td>
                        <td style={{ padding: '14px 12px', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>
                          {[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}
                        </td>
                        <td style={{ padding: '14px 12px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                          {p.pax_type === 'ADT' ? 'Dewasa' : p.pax_type === 'CHD' ? 'Anak' : p.pax_type === 'INF' ? 'Bayi' : '-'}
                        </td>
                        {isTransport && (
                           <td style={{ padding: '14px 12px', color: '#0f172a', fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}>{p.ticket_number || booking.pnr || '-'}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* FOOTER PDF */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '24px', borderTop: '2px dashed #e2e8f0' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Layanan Bantuan 24 Jam</div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>0804-1500-308</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', fontWeight: 500 }}>Diterbitkan pada: {formatPrintDateShort(new Date().toISOString())}</div>
              </div>

              <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end' }}>
                <div style={{ textAlign: 'center' }}>
                  <QRCode
                    value={`https://themafiatravel.com/verify/${booking.id}`}
                    size={80}
                    style={{ display: 'block', padding: '4px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>SCAN VERIFIKASI</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}