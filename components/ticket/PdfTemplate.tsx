'use client';

// components/ticket/PdfTemplate.tsx
// Template PDF e-ticket/voucher bersama — dipakai halaman detail pesanan
// (user login) DAN halaman detail pesanan guest (find-booking), sehingga
// tampilan dokumen identik di keduanya. Dirender di hidden div lalu
// di-capture html2pdf.js menjadi file PDF di sisi client.

import QRCode from 'react-qr-code';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { getVendorLogo } from '@/lib/vendor-logo';

/* ── Helper (salinan lokal murni — dipakai template) ───────────────────────── */
function fmtIDR(n: number) { if (!n || isNaN(n)) return 'Rp 0'; return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function fmtDate(d: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
function fmtDateShortPdf(d: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
function fmtTime(d: string) { if (!d) return '--:--'; return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
function fmtDuration(dep: string, arr: string) {
  if (!dep || !arr) return '-';
  const diff = new Date(arr).getTime() - new Date(dep).getTime();
  if (diff <= 0) return '-';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}
function nightCount(ci: string, co: string) {
  if (!ci || !co) return 1;
  const diff = new Date(co).getTime() - new Date(ci).getTime();
  if (diff <= 0) return 1;
  return Math.max(1, Math.round(diff / 86400000));
}

export const DC = { primary: '#EA580C', primaryDark: '#C2410C', dark: '#111827', primaryLight: '#FFF7ED', primaryBorder: '#FED7AA', light: '#F9FAFB', border: '#E5E7EB', muted: '#6B7280', text: '#111827', white: '#FFFFFF', greenBg: '#ECFDF5', green: '#059669', greenBorder: '#A7F3D0', blueBg: '#EFF6FF', blue: '#2563EB', blueBorder: '#BFDBFE' };

export function genVerificationHash(id: string): string {
  let hash = 0;
  const str = `TMT-VERIFY-${id}-2024`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  return `TMT-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export function PdfTemplate({ booking, bType, passengers, enrichedPassengers, savedBaggage, isTransport, isFlight, isTrain, isHotel, isInsurance, startDate, endDate, originCode, destCode, originName, destName, itemName, itemCode, subclass, baggageAllowance, segmentCount, bookingDataRaw, refundable }: any) {
  const { language } = useLanguage();
  const t = i18n.bookingDetail[language];
  const bookingId = booking.orderNumber || booking.id;
  const verHash = genVerificationHash(booking.id);
  const printTime = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

  const watermarkBg = `repeating-linear-gradient(-45deg, transparent, transparent 40px, rgba(234,88,12,0.02) 40px, rgba(234,88,12,0.02) 42px)`;
  const securityPattern = `radial-gradient(circle at 20% 80%, rgba(234,88,12,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(234,88,12,0.02) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(234,88,12,0.01) 0%, transparent 70%)`;

  const wrapper = (children: React.ReactNode) => (
    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
      <div id="ticket-print" style={{ width: '210mm', minHeight: '297mm', background: `#F8FAFC`, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontSize: '13px', color: DC.text, padding: '0', position: 'relative', overflow: 'hidden' }}>
        {/* Security watermark background */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: watermarkBg, pointerEvents: 'none', zIndex: 0 }}></div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: securityPattern, pointerEvents: 'none', zIndex: 0 }}></div>
        {/* Microprint line - top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `repeating-linear-gradient(90deg, ${DC.primary} 0px, ${DC.primary} 2px, transparent 2px, transparent 6px)`, zIndex: 1 }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );

  if (isFlight) {
    const firstSeg = bookingDataRaw?.provider_bookings?.[0]?.segments?.[0] || {};
    const lastSeg = bookingDataRaw?.provider_bookings?.[0]?.segments?.slice(-1)?.[0] || {};
    const terminal_dep = firstSeg.origin_terminal || firstSeg.terminal || '';
    const terminal_arr = lastSeg.destination_terminal || lastSeg.terminal || '';

    return wrapper(
      <>
        {/* ── HEADER ── */}
        <div style={{ background: `linear-gradient(135deg, ${DC.primary} 0%, ${DC.primaryDark} 100%)`, padding: '28px 36px 38px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }}></div>
          <div style={{ position: 'absolute', bottom: '-60px', left: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}></div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px' }}>E-Ticket Flight</div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: DC.white, marginTop: '4px', letterSpacing: '-0.5px' }}>Boarding Pass</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <img src="/images/logo.png" alt="The Mafia Travel" crossOrigin="anonymous" style={{ height: '36px', width: '36px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', fontWeight: 600 }}>THE MAFIA TRAVEL</div>
            </div>
          </div>

          {/* Order number badge */}
          <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 14px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>ORDER</span>
            <span style={{ fontSize: '13px', color: DC.white, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{bookingId}</span>
          </div>
        </div>

        {/* ── MAIN CARD ── */}
        <div style={{ margin: '-24px 24px 0', background: DC.white, borderRadius: '16px', border: `1px solid ${DC.border}`, overflow: 'hidden', position: 'relative', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          {/* Airline + Status bar — perfectly centered */}
          <div style={{ padding: '14px 24px', borderBottom: `1px dashed ${DC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {(() => {
                const logo = getVendorLogo(booking.bookingType, booking.provider || '', booking.airlineName || '');
                return logo ? (
                  <img src={logo} alt={itemName} crossOrigin="anonymous" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : null;
              })()}
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: DC.dark, lineHeight: 1.2 }}>{itemName}</div>
                {subclass && <div style={{ fontSize: '11px', color: DC.muted, marginTop: '2px' }}>{subclass}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {booking.pnr && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.bookingCode}</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace', color: DC.primary, letterSpacing: '2px', marginTop: '2px' }}>{booking.pnr}</div>
                </div>
              )}
              <div style={{ background: DC.greenBg, border: `1.5px solid ${DC.greenBorder}`, borderRadius: '8px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                <span style={{ fontSize: '11px', fontWeight: 800, color: DC.green, textTransform: 'uppercase', lineHeight: 1 }}>{booking.status === 'issued' ? t.statusMap.issued : t.statusMap.paid}</span>
              </div>
            </div>
          </div>

          {/* Flight Route */}
          <div style={{ padding: '28px 32px', borderBottom: `1px dashed ${DC.border}` }}>
            <div style={{ fontSize: '11px', color: DC.muted, fontWeight: 700, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{fmtDate(startDate)}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Departure */}
              <div style={{ textAlign: 'center', minWidth: '110px' }}>
                <div style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1, color: DC.dark, letterSpacing: '-1px' }}>{fmtTime(startDate)}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: DC.primary, marginTop: '10px' }}>{originCode}</div>
                <div style={{ fontSize: '11px', color: DC.muted, marginTop: '4px', maxWidth: '120px' }}>{originName}</div>
                {terminal_dep && <div style={{ fontSize: '9px', color: DC.muted, marginTop: '2px', fontWeight: 600 }}>{terminal_dep}</div>}
              </div>

              {/* Flight path */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px' }}>
                <div style={{ fontSize: '11px', color: DC.muted, fontWeight: 700, marginBottom: '10px' }}>{fmtDuration(startDate, endDate)}</div>
                <div style={{ width: '100%', position: 'relative', height: '24px' }}>
                  {/* Dashed line */}
                  <div style={{ position: 'absolute', top: '11px', left: '12px', right: '12px', height: '2px', background: `repeating-linear-gradient(90deg, ${DC.border} 0px, ${DC.border} 6px, transparent 6px, transparent 10px)` }}></div>
                  {/* Plane icon */}
                  <svg width="22" height="22" viewBox="0 0 24 24" fill={DC.primary} style={{ position: 'absolute', left: '50%', top: '0', transform: 'translateX(-50%) rotate(0deg)' }}>
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                  </svg>
                  {/* Dots */}
                  <div style={{ position: 'absolute', left: '4px', top: '8px', width: '10px', height: '10px', borderRadius: '50%', background: DC.primary }}></div>
                  <div style={{ position: 'absolute', right: '4px', top: '8px', width: '10px', height: '10px', borderRadius: '50%', border: `2.5px solid ${DC.primary}`, background: DC.white }}></div>
                </div>
                <div style={{ fontSize: '10px', color: DC.muted, marginTop: '8px', fontWeight: 600 }}>{segmentCount <= 1 ? t.direct : `${segmentCount - 1} Transit`}</div>
              </div>

              {/* Arrival */}
              <div style={{ textAlign: 'center', minWidth: '110px' }}>
                <div style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1, color: DC.dark, letterSpacing: '-1px' }}>{fmtTime(endDate)}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: DC.primary, marginTop: '10px' }}>{destCode}</div>
                <div style={{ fontSize: '11px', color: DC.muted, marginTop: '4px', maxWidth: '120px' }}>{destName}</div>
                {terminal_arr && <div style={{ fontSize: '9px', color: DC.muted, marginTop: '2px', fontWeight: 600 }}>{terminal_arr}</div>}
              </div>
            </div>
          </div>

          {/* Info Strip */}
          <div style={{ padding: '14px 24px', borderBottom: passengers.length > 0 ? `1px dashed ${DC.border}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFBFC' }}>
            <div style={{ display: 'flex', gap: '28px' }}>
              {passengers[0]?.ticket_number && (
                <div>
                  <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.eTicketNo}</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', marginTop: '3px', color: DC.dark }}>{passengers[0].ticket_number}</div>
                </div>
              )}
              {baggageAllowance && (
                <div>
                  <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.baggage}</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', color: DC.dark }}>{baggageAllowance}</div>
                </div>
              )}
              {subclass && (
                <div>
                  <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.classType}</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', color: DC.dark }}>{subclass}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: refundable ? DC.greenBg : '#FEF2F2', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${refundable ? DC.greenBorder : '#FECACA'}` }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: refundable ? DC.green : '#DC2626' }}>{refundable ? t.refundable : t.nonRefundable}</span>
            </div>
          </div>

          {/* Important Notices */}
          <div style={{ padding: '14px 24px', display: 'flex', gap: '12px', borderBottom: `1px dashed ${DC.border}` }}>
            {[
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DC.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="7" cy="15" r="1.5" fill={DC.primary}/></svg>, title: 'Identitas', desc: 'Tunjukkan dokumen ini dan identitas resmi saat keberangkatan.' },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DC.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><path d="M12 2v1"/><path d="M12 21v1"/></svg>, title: 'Waktu', desc: 'Check-in ditutup 45-90 menit sebelum jadwal.' },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DC.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>, title: 'Zona Waktu', desc: 'Waktu yang tertera adalah waktu setempat tujuan.' },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '10px', background: DC.primaryLight, borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: DC.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: DC.dark, lineHeight: 1.3 }}>{item.title}</div>
                  <div style={{ fontSize: '9px', color: DC.muted, marginTop: '3px', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Passenger Table */}
          {enrichedPassengers.length > 0 && (
            <div style={{ padding: '16px 24px', borderBottom: `1px dashed ${DC.border}` }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: DC.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>{isHotel ? t.guestData : t.passengerData}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '32px' }}>{t.no}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}` }}>{t.name}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '60px' }}>{t.type}</th>
                    {enrichedPassengers.some((p: any) => p.ticket_number || booking.pnr) && (
                      <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}` }}>{t.ticketPnr}</th>
                    )}
                    {enrichedPassengers.some((p: any) => p.seat) && (
                      <th style={{ padding: '8px 6px', textAlign: 'center', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '50px' }}>{t.flight.seat}</th>
                    )}
                    {(baggageAllowance || savedBaggage) && (
                      <th style={{ padding: '8px 6px', textAlign: 'center', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '60px' }}>{t.baggage}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {enrichedPassengers.map((p: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, color: DC.primary, borderBottom: `1px solid ${DC.border}` }}>{i + 1}</td>
                      <td style={{ padding: '10px 6px', fontWeight: 700, textTransform: 'uppercase', color: DC.dark, borderBottom: `1px solid ${DC.border}`, fontSize: '11px' }}>{[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}</td>
                      <td style={{ padding: '10px 6px', color: DC.muted, fontWeight: 600, borderBottom: `1px solid ${DC.border}` }}>{p.pax_type === 'ADT' ? t.adult : p.pax_type === 'CHD' ? t.child : t.infant}</td>
                      {enrichedPassengers.some((pp: any) => pp.ticket_number || booking.pnr) && (
                        <td style={{ padding: '10px 6px', color: DC.dark, fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', borderBottom: `1px solid ${DC.border}` }}>{p.ticket_number || booking.pnr || '-'}</td>
                      )}
                      {enrichedPassengers.some((pp: any) => pp.seat) && (
                        <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', fontSize: '11px', color: DC.dark, borderBottom: `1px solid ${DC.border}` }}>{p.seat || '-'}</td>
                      )}
                      {(baggageAllowance || savedBaggage) && (
                        <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: '11px', color: DC.dark, borderBottom: `1px solid ${DC.border}` }}>
                          {savedBaggage?.kg ? `${savedBaggage.kg} KG` : baggageAllowance || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: DC.dark }}>{t.help24h}</div>
              <div style={{ fontSize: '11px', color: DC.muted, marginTop: '6px', lineHeight: 2 }}>
                <div>📞 0804-1500-308</div>
                <div>✉️ support@themafiatravel.com</div>
              </div>
              <div style={{ fontSize: '9px', color: DC.muted, marginTop: '8px', fontStyle: 'italic' }}>Tunjukkan e-ticket ini melalui smartphone Anda. Tidak perlu mencetak.</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <QRCode value={`https://themafiatravel.com/verify/${booking.id}`} size={72} style={{ padding: '4px', background: 'white', border: `1px solid ${DC.border}`, borderRadius: '10px' }} />
              <div style={{ fontSize: '8px', color: DC.muted, marginTop: '4px', fontWeight: 600 }}>{t.scanVerify}</div>
            </div>
          </div>
        </div>

        {/* ── SECURITY FOOTER STRIP ── */}
        <div style={{ margin: '16px 24px 24px', padding: '14px 20px', background: DC.dark, borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Verification Code</div>
            <div style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'monospace', color: DC.white, letterSpacing: '2px', marginTop: '3px' }}>{verHash}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Diterbitkan</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '3px' }}>{printTime} WIB</div>
          </div>
        </div>

        {/* Microprint line */}
        <div style={{ fontSize: '4px', color: 'rgba(234,88,12,0.15)', textAlign: 'center', letterSpacing: '0.5px', padding: '0 24px', wordBreak: 'break-all', lineHeight: 1.5 }}>
          {'THE MAFIA TRAVEL • DOKUMEN RESMI • '.repeat(20)}
        </div>
      </>
    );
  }

  if (isTrain) {
    return wrapper(
      <>
        {/* ── HEADER ── */}
        <div style={{ background: `linear-gradient(135deg, #059669 0%, #047857 100%)`, padding: '28px 36px 38px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }}></div>
          <div style={{ position: 'absolute', bottom: '-60px', left: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px' }}>E-Ticket Train</div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: DC.white, marginTop: '4px', letterSpacing: '-0.5px' }}>Boarding Pass</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <img src="/images/logo.png" alt="The Mafia Travel" crossOrigin="anonymous" style={{ height: '36px', width: '36px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', fontWeight: 600 }}>THE MAFIA TRAVEL</div>
            </div>
          </div>
          <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 14px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>ORDER</span>
            <span style={{ fontSize: '13px', color: DC.white, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{bookingId}</span>
          </div>
        </div>

        {/* ── MAIN CARD ── */}
        <div style={{ margin: '-24px 24px 0', background: DC.white, borderRadius: '16px', border: `1px solid ${DC.border}`, overflow: 'hidden', position: 'relative', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          {/* Train info bar */}
          <div style={{ padding: '16px 24px', borderBottom: `1px dashed ${DC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><circle cx="8" cy="19" r="2"/><circle cx="16" cy="19" r="2"/><path d="M6 17l-2 4"/><path d="M18 17l2 4"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: DC.dark, lineHeight: 1.2 }}>{itemName}</div>
                <div style={{ fontSize: '11px', color: DC.muted, marginTop: '2px' }}>{subclass || 'Ekonomi'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {booking.pnr && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.bookingCode}</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace', color: '#059669', letterSpacing: '2px', marginTop: '2px' }}>{booking.pnr}</div>
                </div>
              )}
              <div style={{ background: DC.greenBg, border: `1.5px solid ${DC.greenBorder}`, borderRadius: '8px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                <span style={{ fontSize: '11px', fontWeight: 800, color: DC.green, textTransform: 'uppercase', lineHeight: 1 }}>{booking.status === 'issued' ? t.statusMap.issued : t.statusMap.paid}</span>
              </div>
            </div>
          </div>

          {/* Route */}
          <div style={{ padding: '28px 32px', borderBottom: `1px dashed ${DC.border}` }}>
            <div style={{ fontSize: '11px', color: DC.muted, fontWeight: 700, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{fmtDate(startDate)}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center', minWidth: '110px' }}>
                <div style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1, color: DC.dark, letterSpacing: '-1px' }}>{fmtTime(startDate)}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669', marginTop: '10px' }}>{originCode}</div>
                <div style={{ fontSize: '11px', color: DC.muted, marginTop: '4px' }}>{originName}</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px' }}>
                <div style={{ width: '100%', position: 'relative', height: '24px' }}>
                  <div style={{ position: 'absolute', top: '11px', left: '12px', right: '12px', height: '2px', background: `repeating-linear-gradient(90deg, ${DC.border} 0px, ${DC.border} 6px, transparent 6px, transparent 10px)` }}></div>
                  <div style={{ position: 'absolute', left: '4px', top: '8px', width: '10px', height: '10px', borderRadius: '50%', background: '#059669' }}></div>
                  <div style={{ position: 'absolute', right: '4px', top: '8px', width: '10px', height: '10px', borderRadius: '50%', border: '2.5px solid #059669', background: DC.white }}></div>
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: '110px' }}>
                <div style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1, color: DC.dark, letterSpacing: '-1px' }}>{fmtTime(endDate)}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669', marginTop: '10px' }}>{destCode}</div>
                <div style={{ fontSize: '11px', color: DC.muted, marginTop: '4px' }}>{destName}</div>
              </div>
            </div>
          </div>

          {/* Info strip */}
          <div style={{ padding: '14px 24px', display: 'flex', gap: '28px', background: '#FAFBFC', borderBottom: `1px dashed ${DC.border}` }}>
            <div>
              <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.date}</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', color: DC.dark }}>{fmtDateShortPdf(startDate)}</div>
            </div>
            <div>
              <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.classType}</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', color: DC.dark }}>{subclass || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Kebijakan</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', color: refundable ? DC.green : '#DC2626' }}>{refundable ? t.refundable : t.nonRefundable}</div>
            </div>
          </div>

          {/* Passenger table */}
          {enrichedPassengers.length > 0 && (
            <div style={{ padding: '16px 24px', borderBottom: `1px dashed ${DC.border}` }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: DC.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>{t.passengerData}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '32px' }}>{t.no}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}` }}>{t.name}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '60px' }}>{t.type}</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}` }}>{t.ticketPnr}</th>
                    {subclass && (
                      <th style={{ padding: '8px 6px', textAlign: 'center', color: DC.muted, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${DC.border}`, width: '60px' }}>{t.classType}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {enrichedPassengers.map((p: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, color: '#059669', borderBottom: `1px solid ${DC.border}` }}>{i + 1}</td>
                      <td style={{ padding: '10px 6px', fontWeight: 700, textTransform: 'uppercase', color: DC.dark, borderBottom: `1px solid ${DC.border}`, fontSize: '11px' }}>{[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}</td>
                      <td style={{ padding: '10px 6px', color: DC.muted, fontWeight: 600, borderBottom: `1px solid ${DC.border}` }}>{p.pax_type === 'ADT' ? t.adult : p.pax_type === 'CHD' ? t.child : t.infant}</td>
                      <td style={{ padding: '10px 6px', color: DC.dark, fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', borderBottom: `1px solid ${DC.border}` }}>{p.ticket_number || booking.pnr || '-'}</td>
                      {subclass && (
                        <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: '11px', color: DC.dark, borderBottom: `1px solid ${DC.border}` }}>{subclass}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: DC.dark }}>{t.help24h}</div>
              <div style={{ fontSize: '11px', color: DC.muted, marginTop: '6px', lineHeight: 1.8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>0804-1500-308</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <span>support@themafiatravel.com</span>
                </div>
              </div>
              <div style={{ fontSize: '9px', color: DC.muted, marginTop: '8px', fontStyle: 'italic' }}>Tunjukkan e-ticket ini melalui smartphone Anda. Tidak perlu mencetak.</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <QRCode value={`https://themafiatravel.com/verify/${booking.id}`} size={72} style={{ padding: '4px', background: 'white', border: `1px solid ${DC.border}`, borderRadius: '10px' }} />
              <div style={{ fontSize: '8px', color: DC.muted, marginTop: '4px', fontWeight: 600 }}>{t.scanVerify}</div>
            </div>
          </div>
        </div>

        {/* Security footer */}
        <div style={{ margin: '16px 24px 24px', padding: '14px 20px', background: DC.dark, borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Verification Code</div>
            <div style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'monospace', color: DC.white, letterSpacing: '2px', marginTop: '3px' }}>{verHash}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Diterbitkan</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '3px' }}>{printTime} WIB</div>
          </div>
        </div>
        <div style={{ fontSize: '4px', color: 'rgba(234,88,12,0.15)', textAlign: 'center', letterSpacing: '0.5px', padding: '0 24px', wordBreak: 'break-all', lineHeight: 1.5 }}>
          {'THE MAFIA TRAVEL • DOKUMEN RESMI • '.repeat(20)}
        </div>
      </>
    );
  }

  if (isHotel) {
    const nights = nightCount(booking.checkinDate, booking.checkoutDate);
    return wrapper(
      <>
        {/* ── HEADER ── */}
        <div style={{ background: `linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)`, padding: '28px 36px 38px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }}></div>
          <div style={{ position: 'absolute', bottom: '-60px', left: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px' }}>Voucher Hotel</div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: DC.white, marginTop: '4px', letterSpacing: '-0.5px' }}>Booking Confirmation</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <img src="/images/logo.png" alt="The Mafia Travel" crossOrigin="anonymous" style={{ height: '36px', width: '36px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', fontWeight: 600 }}>THE MAFIA TRAVEL</div>
            </div>
          </div>
          <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 14px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>ORDER</span>
            <span style={{ fontSize: '13px', color: DC.white, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{bookingId}</span>
          </div>
        </div>

        {/* ── MAIN CARD ── */}
        <div style={{ margin: '-24px 24px 0', background: DC.white, borderRadius: '16px', border: `1px solid ${DC.border}`, overflow: 'hidden', position: 'relative', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          {/* Hotel info bar */}
          <div style={{ padding: '16px 24px', borderBottom: `1px dashed ${DC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/><path d="M9 21V13h6v8"/><path d="M3 9h18"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: DC.dark, lineHeight: 1.2 }}>{itemName}</div>
                <div style={{ fontSize: '11px', color: DC.muted, marginTop: '2px' }}>{subclass || 'Standard Room'}</div>
              </div>
            </div>
            <div style={{ background: DC.greenBg, border: `1.5px solid ${DC.greenBorder}`, borderRadius: '8px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              <span style={{ fontSize: '11px', fontWeight: 800, color: DC.green, textTransform: 'uppercase', lineHeight: 1 }}>{t.statusMap.paid}</span>
            </div>
          </div>

          {/* Check-in / Check-out */}
          <div style={{ padding: '28px 32px', borderBottom: `1px dashed ${DC.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center', minWidth: '130px' }}>
                <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.hotel.checkin}</div>
                <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '10px', color: DC.dark }}>{fmtDateShortPdf(booking.checkinDate)}</div>
                <div style={{ fontSize: '10px', color: DC.muted, marginTop: '4px', fontWeight: 600 }}>Mulai pukul 14:00</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px' }}>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#7C3AED' }}>{nights}</div>
                <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 700 }}>{t.hotel.night}</div>
                <div style={{ width: '100%', position: 'relative', height: '24px', marginTop: '4px' }}>
                  <div style={{ position: 'absolute', top: '11px', left: '12px', right: '12px', height: '2px', background: `repeating-linear-gradient(90deg, ${DC.border} 0px, ${DC.border} 6px, transparent 6px, transparent 10px)` }}></div>
                  <div style={{ position: 'absolute', left: '4px', top: '8px', width: '10px', height: '10px', borderRadius: '50%', background: '#7C3AED' }}></div>
                  <div style={{ position: 'absolute', right: '4px', top: '8px', width: '10px', height: '10px', borderRadius: '50%', border: '2.5px solid #7C3AED', background: DC.white }}></div>
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: '130px' }}>
                <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.hotel.checkout}</div>
                <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '10px', color: DC.dark }}>{fmtDateShortPdf(booking.checkoutDate)}</div>
                <div style={{ fontSize: '10px', color: DC.muted, marginTop: '4px', fontWeight: 600 }}>Sebelum pukul 12:00</div>
              </div>
            </div>
          </div>

          {/* Info strip */}
          <div style={{ padding: '14px 24px', borderBottom: `1px dashed ${DC.border}`, display: 'flex', gap: '28px', background: '#FAFBFC' }}>
            <div>
              <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.hotel.guest}</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', color: DC.dark }}>{passengers.length || 1} {t.people}</div>
            </div>
            <div>
              <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.totalAmount}</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', color: DC.dark }}>{fmtIDR(booking.totalAmount)}</div>
            </div>
            <div>
              <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.orderNo}</div>
              <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', marginTop: '3px', color: DC.dark }}>{booking.id}</div>
            </div>
          </div>

          {/* Notice */}
          <div style={{ padding: '14px 24px', background: '#F5F3FF', borderBottom: `1px dashed ${DC.border}` }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#5B21B6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/><path d="M9 21V13h6v8"/><path d="M3 9h18"/></svg>
              Mohon simpan dokumen ini sebagai bukti voucher hotel Anda. Tunjukkan saat check-in.
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: DC.dark }}>{t.help24h}</div>
              <div style={{ fontSize: '11px', color: DC.muted, marginTop: '6px', lineHeight: 1.8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>0804-1500-308</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <span>support@themafiatravel.com</span>
                </div>
              </div>
              <div style={{ fontSize: '9px', color: DC.muted, marginTop: '8px', fontStyle: 'italic' }}>Tunjukkan voucher ini melalui smartphone Anda. Tidak perlu mencetak.</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <QRCode value={`https://themafiatravel.com/verify/${booking.id}`} size={72} style={{ padding: '4px', background: 'white', border: `1px solid ${DC.border}`, borderRadius: '10px' }} />
              <div style={{ fontSize: '8px', color: DC.muted, marginTop: '4px', fontWeight: 600 }}>{t.scanVerify}</div>
            </div>
          </div>
        </div>

        {/* Security footer */}
        <div style={{ margin: '16px 24px 24px', padding: '14px 20px', background: DC.dark, borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Verification Code</div>
            <div style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'monospace', color: DC.white, letterSpacing: '2px', marginTop: '3px' }}>{verHash}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Diterbitkan</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '3px' }}>{printTime} WIB</div>
          </div>
        </div>
        <div style={{ fontSize: '4px', color: 'rgba(234,88,12,0.15)', textAlign: 'center', letterSpacing: '0.5px', padding: '0 24px', wordBreak: 'break-all', lineHeight: 1.5 }}>
          {'THE MAFIA TRAVEL • DOKUMEN RESMI • '.repeat(20)}
        </div>
      </>
    );
  }

  // Insurance
  return wrapper(
    <>
      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)`, padding: '28px 36px 38px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }}></div>
        <div style={{ position: 'absolute', bottom: '-60px', left: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px' }}>{t.policyInsurance}</div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: DC.white, marginTop: '4px', letterSpacing: '-0.5px' }}>Insurance Policy</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <img src="/images/logo.png" alt="The Mafia Travel" crossOrigin="anonymous" style={{ height: '36px', width: '36px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', fontWeight: 600 }}>THE MAFIA TRAVEL</div>
          </div>
        </div>
        <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 14px' }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>POLIS</span>
          <span style={{ fontSize: '13px', color: DC.white, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{bookingId}</span>
        </div>
      </div>

      {/* ── MAIN CARD ── */}
      <div style={{ margin: '-24px 24px 0', background: DC.white, borderRadius: '16px', border: `1px solid ${DC.border}`, overflow: 'hidden', position: 'relative', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        {/* Insurance info bar */}
        <div style={{ padding: '16px 24px', borderBottom: `1px dashed ${DC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: DC.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: DC.dark, lineHeight: 1.2 }}>{itemName}</div>
              <div style={{ fontSize: '11px', color: DC.muted, marginTop: '2px' }}>{bookingDataRaw?.coverage || 'Full Trip Protection'}</div>
            </div>
          </div>
          <div style={{ background: DC.greenBg, border: `1.5px solid ${DC.greenBorder}`, borderRadius: '8px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DC.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            <span style={{ fontSize: '11px', fontWeight: 800, color: DC.green, textTransform: 'uppercase', lineHeight: 1 }}>Active</span>
          </div>
        </div>

        {/* Coverage period */}
        <div style={{ padding: '28px 32px', borderBottom: `1px dashed ${DC.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'center', minWidth: '140px' }}>
              <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Tanggal Mulai</div>
              <div style={{ fontSize: '22px', fontWeight: 900, marginTop: '10px', color: DC.dark }}>{fmtDateShortPdf(booking.checkinDate || startDate)}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px' }}>
              <div style={{ width: '100%', position: 'relative', height: '24px' }}>
                <div style={{ position: 'absolute', top: '11px', left: '12px', right: '12px', height: '2px', background: `repeating-linear-gradient(90deg, ${DC.border} 0px, ${DC.border} 6px, transparent 6px, transparent 10px)` }}></div>
                <div style={{ position: 'absolute', left: '4px', top: '8px', width: '10px', height: '10px', borderRadius: '50%', background: '#2563EB' }}></div>
                <div style={{ position: 'absolute', right: '4px', top: '8px', width: '10px', height: '10px', borderRadius: '50%', border: '2.5px solid #2563EB', background: DC.white }}></div>
              </div>
            </div>
            <div style={{ textAlign: 'center', minWidth: '140px' }}>
              <div style={{ fontSize: '10px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Tanggal Berakhir</div>
              <div style={{ fontSize: '22px', fontWeight: 900, marginTop: '10px', color: DC.dark }}>{fmtDateShortPdf(booking.checkoutDate || endDate)}</div>
            </div>
          </div>
        </div>

        {/* Info strip */}
        <div style={{ padding: '14px 24px', borderBottom: `1px dashed ${DC.border}`, display: 'flex', gap: '28px', background: '#FAFBFC' }}>
          <div>
            <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{t.insurance.insured}</div>
            <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', color: DC.dark }}>{passengers.length || 1} {t.people}</div>
          </div>
          <div>
            <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Total Premi</div>
            <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', color: DC.dark }}>{fmtIDR(booking.totalAmount)}</div>
          </div>
          <div>
            <div style={{ fontSize: '8px', color: DC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>No. Polis</div>
            <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', marginTop: '3px', color: DC.dark }}>{booking.id}</div>
          </div>
        </div>

        {/* Notice */}
        <div style={{ padding: '14px 24px', background: DC.blueBg, borderBottom: `1px dashed ${DC.border}` }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            Simpan dokumen ini sebagai bukti polis asuransi Anda. Untuk klaim, hubungi layanan bantuan 24 jam kami.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: DC.dark }}>{t.help24h}</div>
            <div style={{ fontSize: '11px', color: DC.muted, marginTop: '6px', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>0804-1500-308</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DC.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <span>support@themafiatravel.com</span>
              </div>
            </div>
            <div style={{ fontSize: '9px', color: DC.muted, marginTop: '8px', fontStyle: 'italic' }}>Tunjukkan dokumen ini melalui smartphone Anda. Tidak perlu mencetak.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <QRCode value={`https://themafiatravel.com/verify/${booking.id}`} size={72} style={{ padding: '4px', background: 'white', border: `1px solid ${DC.border}`, borderRadius: '10px' }} />
            <div style={{ fontSize: '8px', color: DC.muted, marginTop: '4px', fontWeight: 600 }}>Scan untuk verifikasi</div>
          </div>
        </div>
      </div>

      {/* Security footer */}
      <div style={{ margin: '16px 24px 24px', padding: '14px 20px', background: DC.dark, borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Verification Code</div>
          <div style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'monospace', color: DC.white, letterSpacing: '2px', marginTop: '3px' }}>{verHash}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Diterbitkan</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '3px' }}>{printTime} WIB</div>
        </div>
      </div>
      <div style={{ fontSize: '4px', color: 'rgba(234,88,12,0.15)', textAlign: 'center', letterSpacing: '0.5px', padding: '0 24px', wordBreak: 'break-all', lineHeight: 1.5 }}>
        {'THE MAFIA TRAVEL • DOKUMEN RESMI • '.repeat(20)}
      </div>
    </>
  );
}
