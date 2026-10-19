// lib/email-ticket-pdf.ts
// Generator PDF tiket/voucher di sisi server memakai @react-pdf/renderer.
// Hasilnya dilampirkan sebagai attachment pada email konfirmasi pembayaran
// (Resend attachments) sehingga pelanggan langsung menerima dokumen resmi
// tanpa perlu login. Pembuatan PDF bersifat non-fatal: jika gagal, email
// tetap terkirim tanpa lampiran.

import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const ORANGE = '#EA580C';
const DARK = '#111827';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const GREEN = '#059669';
const LIGHT = '#F9FAFB';

type PdfBooking = {
  id: string;
  orderNumber?: string | null;
  bookingType?: string | null;
  status?: string | null;
  pnr?: string | null;
  provider?: string | null;
  airlineName?: string | null;
  hotelName?: string | null;
  routeLabel?: string | null;
  origin?: string | null;
  destination?: string | null;
  departureDate?: string | Date | null;
  arrivalDate?: string | Date | null;
  checkinDate?: string | Date | null;
  checkoutDate?: string | Date | null;
  totalAmount?: number | null;
  cabinClass?: string | null;
  passengers?: Array<{
    title?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    pax_type?: string | null;
  }> | null;
};

// Hash verifikasi identik dengan sisi client (components/ticket/PdfTemplate).
function genVerificationHash(id: string): string {
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

function fmtIDR(n?: number | null) {
  if (!n || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function fmtDate(d?: string | Date | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateTime(d?: string | Date | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  page: { padding: 0, fontFamily: 'Helvetica', color: DARK, fontSize: 10 },
  header: { backgroundColor: ORANGE, padding: '22 28 26', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 700, marginTop: 4 },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' },
  brand: { color: 'rgba(255,255,255,0.85)', fontSize: 9, fontWeight: 700, letterSpacing: 1 },
  badgeRow: { backgroundColor: ORANGE, paddingHorizontal: 28, paddingBottom: 20 },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 6, padding: '6 12', flexDirection: 'row' },
  badgeLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 8, marginRight: 6 },
  badgeValue: { color: '#FFFFFF', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 },
  card: { margin: '0 28', marginTop: 18, borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { color: MUTED, fontSize: 7, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 },
  value: { color: DARK, fontSize: 11, fontWeight: 700, marginTop: 3 },
  valueBig: { color: DARK, fontSize: 15, fontWeight: 700, marginTop: 3 },
  orange: { color: ORANGE },
  green: { color: GREEN },
  sectionTitle: { color: MUTED, fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginTop: 14, marginBottom: 8 },
  paxRow: { flexDirection: 'row', paddingVertical: 7, borderTopWidth: 1, borderTopColor: BORDER },
  paxName: { flex: 3, color: DARK, fontSize: 10, fontWeight: 700 },
  paxType: { flex: 1, color: MUTED, fontSize: 9 },
  statusLine: { margin: '16 28 0', backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 8, padding: '10 14' },
  footer: { margin: '16 28 24', backgroundColor: DARK, borderRadius: 10, padding: '12 16', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 7, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 },
  footerValue: { color: '#FFFFFF', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, marginTop: 3 },
  note: { margin: '0 28 22', color: MUTED, fontSize: 8, fontStyle: 'italic', lineHeight: 1.5 },
});

function TicketDoc({ booking }: { booking: PdfBooking }) {
  const bType = booking.bookingType || 'flight';
  const isHotel = bType === 'hotel';
  const isInsurance = bType === 'insurance';
  const isFlight = bType === 'flight';
  const label = booking.orderNumber && booking.orderNumber !== booking.id ? booking.orderNumber : booking.id;

  const title = isHotel ? 'Voucher Hotel' : isInsurance ? 'Insurance Policy' : 'E-Ticket';
  const subtitle = isHotel ? 'Booking Confirmation' : isInsurance ? 'Insurance Policy' : 'Boarding Pass';

  const primary =
    isHotel ? '#7C3AED' : isInsurance ? '#2563EB' : isFlight ? ORANGE : GREEN;

  const passengers = Array.isArray(booking.passengers) ? booking.passengers : [];
  const startDate = booking.departureDate || booking.checkinDate || null;
  const endDate = booking.arrivalDate || booking.checkoutDate || null;

  const statusText =
    booking.status === 'issued' ? 'ISSUED' : booking.status === 'paid' ? 'PAID' : (booking.status || '').toUpperCase();

  const itemTitle = booking.hotelName || booking.routeLabel || booking.airlineName || booking.bookingType || 'Pesanan';

  return (
    <Document title={`Tiket ${label}`} author="The Mafia Travel">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: primary }]}>
          <View>
            <Text style={styles.headerSub}>{title}</Text>
            <Text style={styles.headerTitle}>{subtitle}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.brand}>THE MAFIA TRAVEL</Text>
          </View>
        </View>
        <View style={[styles.badgeRow, { backgroundColor: primary }]}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>ORDER</Text>
            <Text style={styles.badgeValue}>{label}</Text>
          </View>
        </View>

        {/* Info utama */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{isHotel ? 'Hotel' : isInsurance ? 'Produk' : 'Maskapai / Kereta'}</Text>
              <Text style={styles.valueBig}>{itemTitle}</Text>
              {booking.cabinClass ? <Text style={[styles.value, { color: MUTED, fontSize: 9 }]}>{booking.cabinClass}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {booking.pnr ? (
                <View style={{ marginBottom: 6 }}>
                  <Text style={styles.label}>Kode Booking</Text>
                  <Text style={[styles.valueBig, { color: primary, letterSpacing: 1 }]}>{booking.pnr}</Text>
                </View>
              ) : null}
              <View style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 6, padding: '5 12' }}>
                <Text style={[styles.value, { color: GREEN, fontSize: 9, marginTop: 0 }]}>{statusText}</Text>
              </View>
            </View>
          </View>

          {/* Periode / rute */}
          <View style={[styles.row, { marginTop: 8, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{isHotel ? 'Check-in' : 'Tanggal Berangkat'}</Text>
              <Text style={styles.value}>{fmtDate(startDate)}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.label}>{isHotel ? 'Malam' : 'Rute'}</Text>
              <Text style={styles.value}>
                {isHotel
                  ? (startDate && endDate
                      ? `${Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))}`
                      : '1')
                  : `${booking.origin || '-'} → ${booking.destination || '-'}`}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.label}>{isHotel ? 'Check-out' : 'Tiba / Selesai'}</Text>
              <Text style={styles.value}>{isHotel ? fmtDate(endDate) : (endDate ? fmtDateTime(endDate) : '-')}</Text>
            </View>
          </View>

          {/* Penumpang */}
          {passengers.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>{isHotel ? 'Tamu' : 'Penumpang'}</Text>
              {passengers.map((p, i) => (
                <View key={i} style={styles.paxRow}>
                  <Text style={styles.paxName}>{[p.title, p.first_name, p.last_name].filter(Boolean).join(' ')}</Text>
                  <Text style={styles.paxType}>{p.pax_type === 'CHD' ? 'Anak' : p.pax_type === 'INF' ? 'Bayi' : 'Dewasa'}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Total */}
          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.label}>Total</Text>
              <Text style={[styles.valueBig, { color: ORANGE }]}>{fmtIDR(booking.totalAmount)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.label}>Kode Pesanan</Text>
              <Text style={[styles.value, { fontFamily: 'Courier' }]}>{booking.id}</Text>
            </View>
          </View>
        </View>

        {/* Status line */}
        <View style={styles.statusLine}>
          <Text style={{ color: '#065F46', fontSize: 9, lineHeight: 1.5 }}>
            {isHotel
              ? 'Mohon simpan dokumen ini sebagai bukti voucher hotel Anda. Tunjukkan saat check-in.'
              : isInsurance
                ? 'Simpan dokumen ini sebagai bukti polis asuransi Anda. Untuk klaim, hubungi layanan bantuan 24 jam kami.'
                : 'Pembayaran telah diterima. Tunjukkan e-ticket ini (via smartphone, tanpa perlu mencetak) beserta identitas resmi saat keberangkatan.'}
          </Text>
        </View>

        {/* Footer verifikasi */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>Verification Code</Text>
            <Text style={styles.footerValue}>{genVerificationHash(booking.id)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.footerLabel}>Diterbitkan</Text>
            <Text style={[styles.footerValue, { fontSize: 9, letterSpacing: 0 }]}>{fmtDateTime(new Date())} WIB</Text>
          </View>
        </View>

        <Text style={styles.note}>
          Dokumen ini diterbitkan secara elektronik oleh The Mafia Travel. Dukungan 24 jam: 0804-1500-308 / support@themafiatravel.com
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Menghasilkan buffer PDF tiket/voucher untuk email konfirmasi pembayaran.
 * Mengembalikan null jika generasi gagal (agar email tetap terkirim tanpa lampiran).
 */
export async function generateBookingTicketPdf(booking: PdfBooking): Promise<Buffer | null> {
  try {
    const doc = TicketDoc({ booking });
    // Di Node runtime toBuffer() mengembalikan Buffer; type-definition
    // @react-pdf/renderer kadang menandainya ReadableStream — cast aman di sini.
    const buffer = (await pdf(doc).toBuffer()) as unknown as Buffer;
    return buffer;
  } catch (err) {
    console.warn('[EmailPDF] Gagal membuat PDF tiket:', err);
    return null;
  }
}

type EmailAttachment = { filename: string; content: Buffer };

/**
 * Bangun lampiran email (array {filename, content}) dari record booking Prisma.
 * Mengembalikan null bila PDF gagal dibuat sehingga email tetap terkirim tanpa lampiran.
 */
export async function buildBookingTicketAttachment(bookingRecord: any): Promise<EmailAttachment[] | null> {
  try {
    const bd = (bookingRecord?.bookingData ?? {}) as any;
    const rawPassengers = Array.isArray(bookingRecord?.passengerData) ? bookingRecord.passengerData : [];

    const pdfBooking: PdfBooking = {
      id: bookingRecord.id,
      orderNumber: bookingRecord.orderNumber,
      bookingType: bookingRecord.bookingType,
      status: bookingRecord.status,
      pnr: bookingRecord.pnr,
      provider: bookingRecord.provider,
      airlineName: bookingRecord.airlineName,
      hotelName: bd.hotel_name || bd.hotelName || null,
      routeLabel: bookingRecord.routeLabel,
      origin: bookingRecord.origin,
      destination: bookingRecord.destination,
      departureDate: bookingRecord.departureDate,
      arrivalDate: bd.arrival_date_from_search || null,
      checkinDate: bd.checkin_date || bd.checkinDate || null,
      checkoutDate: bd.checkout_date || bd.checkoutDate || null,
      totalAmount: bookingRecord.totalAmount,
      cabinClass: bd.cabin_class || bd.subclass || bd.roomType || '',
      passengers: rawPassengers.map((p: any) => ({
        title: p.title,
        first_name: p.first_name,
        last_name: p.last_name,
        pax_type: p.pax_type,
      })),
    };

    const buf = await generateBookingTicketPdf(pdfBooking);
    if (!buf) return null;
    const fname = `TMT_${bookingRecord.orderNumber || bookingRecord.id}.pdf`;
    return [{ filename: fname, content: buf }];
  } catch (err) {
    console.warn('[EmailPDF] Gagal membangun lampiran tiket:', err);
    return null;
  }
}
