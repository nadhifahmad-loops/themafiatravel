// lib/ticket-pdf.tsx
/* eslint-disable jsx-a11y/alt-text -- elemen Image di sini milik @react-pdf/renderer, bukan <img> DOM */
// Satu sumber dokumen PDF resmi The Mafia Travel.
// Dipakai oleh:
//   - endpoint unduh tiket (app/api/bookings/[id]/pdf)
//   - lampiran email konfirmasi pembayaran (lib/email-ticket-pdf)
//
// Prinsip desain: dokumen resmi, bukan poster. Satu aksen orange, teks vector,
// tanpa gradient/watermark/emoji. Semua data yang tidak tersedia tidak dicetak.

import React from 'react';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';
import { genVerificationHash, verifyUrl } from './ticket-verify';
import { normalizeBookingSegments, type NormalizedSegment } from './booking-segments';

const ORANGE = '#F27717';
const INK = '#111827';
const BODY = '#374151';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const SOFT = '#F9FAFB';
const SOFT_ORANGE = '#FFF6EE';

export type TicketType = 'flight' | 'hotel' | 'train' | 'insurance';

export type TicketSegment = {
  origin?: string | null;
  destination?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  originTerminal?: string | null;
  destinationTerminal?: string | null;
  departureDate?: string | null;
  arrivalDate?: string | null;
  carrierName?: string | null;
  flightNumber?: string | null;
  baggage?: string | null;
};

export type TicketPassenger = {
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  type?: string | null;
  seat?: string | null;
  ticketNumber?: string | null;
  baggage?: string | null;
};

export type TicketPdfData = {
  id: string;
  orderNumber: string;
  type: TicketType;
  status: string;
  createdAt?: string | null;
  paidAt?: string | null;
  paymentType?: string | null;
  totalAmount: number;
  currency: string;
  discountAmount: number;
  couponCode?: string | null;
  pnr?: string | null;
  provider?: string | null;
  airlineName?: string | null;
  flightNumber?: string | null;
  origin?: string | null;
  destination?: string | null;
  routeLabel?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  originTerminal?: string | null;
  destinationTerminal?: string | null;
  departureDate?: string | null;
  arrivalDate?: string | null;
  cabinClass?: string | null;
  baggage?: string | null;
  refundable: boolean;
  segments: TicketSegment[];
  hotelName?: string | null;
  checkinDate?: string | null;
  checkoutDate?: string | null;
  nights?: number | null;
  roomType?: string | null;
  roomCount?: number | null;
  adultCount?: number | null;
  childCount?: number | null;
  mealType?: string | null;
  coverage?: string | null;
  passengers: TicketPassenger[];
};

type RawBooking = {
  id: string;
  orderNumber?: string | null;
  bookingType?: string | null;
  status?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  discountAmount?: number | null;
  couponCode?: string | null;
  paymentType?: string | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string | null;
  pnr?: string | null;
  provider?: string | null;
  airlineName?: string | null;
  flightNumber?: string | null;
  origin?: string | null;
  destination?: string | null;
  routeLabel?: string | null;
  departureDate?: Date | string | null;
  hotelName?: string | null;
  checkinDate?: Date | string | null;
  checkoutDate?: Date | string | null;
  roomCount?: number | null;
  adultCount?: number | null;
  childCount?: number | null;
  nights?: number | null;
  mealType?: string | null;
  roomDescription?: string | null;
  passengerData?: unknown;
  bookingData?: unknown;
};

type RawProviderBooking = {
  journeys?: Array<{
    seats?: Array<{
      passenger_sequence?: number | string;
      seat?: string | null;
      seat_code?: string | null;
    }>;
  }>;
};

type RawBookingData = {
  provider_bookings?: RawProviderBooking[];
  selectedBaggage?: { kg?: number | string } | null;
  baggage_allowance?: string | null;
  refundable?: boolean;
  is_refundable?: boolean;
  fare_refundable?: boolean;
  arrival_date_from_search?: string | null;
  checkin_date?: string | null;
  checkout_date?: string | null;
  roomType?: string | null;
  room_description?: string | null;
  subclass?: string | null;
  cabin_class?: string | null;
  hotel_name?: string | null;
  hotelName?: string | null;
  mealType?: string | null;
  meal_type?: string | null;
  coverage?: string | null;
};

type RawPassenger = {
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  pax_type?: string | null;
  seat?: string | null;
  ticket_number?: string | null;
  baggage?: string | null;
  baggage_allowance?: string | null;
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function iso(v?: Date | string | null): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function fmtIDR(n?: number | null) {
  if (!n || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function fmtDate(v?: string | null) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateLong(v?: string | null) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateTime(v?: string | null) {
  if (!v) return '-';
  return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtTime(v?: string | null) {
  if (!v) return '--:--';
  return new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(dep?: string | null, arr?: string | null) {
  if (!dep || !arr) return '-';
  const diff = new Date(arr).getTime() - new Date(dep).getTime();
  if (diff <= 0) return '-';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function nightCount(ci?: string | null, co?: string | null) {
  if (!ci || !co) return 1;
  const diff = new Date(co).getTime() - new Date(ci).getTime();
  if (diff <= 0) return 1;
  return Math.max(1, Math.round(diff / 86400000));
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending_payment: 'MENUNGGU PEMBAYARAN',
    paid: 'TERKONFIRMASI',
    issued: 'TIKET DITERBITKAN',
    payment_failed: 'PEMBAYARAN GAGAL',
    cancelled: 'DIBATALKAN',
    expired: 'KEDALUWARSA',
    refund_requested: 'REFUND DIPROSES',
    refund: 'BERHASIL DIREFUND',
  };
  return map[status] || status.toUpperCase();
}

function normalizeType(v?: string | null): TicketType {
  if (v === 'hotel' || v === 'train' || v === 'insurance') return v;
  return 'flight';
}

function buildNotes(type: TicketType): string[] {
  if (type === 'hotel') {
    return [
      'Check-in mulai pukul 14:00 dan check-out sebelum pukul 12:00 waktu setempat.',
      'Tunjukkan voucher ini beserta identitas resmi saat check-in.',
      'Jumlah tamu dan tipe kamar mengikuti rincian pada dokumen ini.',
      'Pembatalan dan perubahan mengikuti kebijakan hotel yang berlaku.',
    ];
  }
  if (type === 'insurance') {
    return [
      'Polis berlaku sesuai periode perlindungan yang tertera.',
      'Simpan dokumen ini sebagai bukti perlindungan yang sah.',
      'Pengajuan klaim harus disertai dokumen pendukung yang lengkap.',
      'Hubungi layanan bantuan 24 jam kami untuk proses klaim.',
    ];
  }
  if (type === 'train') {
    return [
      'Tiba di stasiun minimal 30 menit sebelum jadwal keberangkatan.',
      'Tunjukkan e-tiket ini beserta identitas resmi saat boarding.',
      'Kursi dapat diubah melalui halaman detail pesanan bila tersedia.',
      'Pembatalan dan perubahan mengikuti ketentuan operator kereta.',
    ];
  }
  return [
    'Check-in ditutup 45-90 menit sebelum jadwal keberangkatan.',
    'Tunjukkan e-tiket ini beserta identitas resmi (KTP/paspor) saat check-in.',
    'Bagasi mengikuti ketentuan maskapai yang tertera pada tiket.',
    'Perubahan jadwal dan pembatalan mengikuti aturan tiket maskapai.',
  ];
}

/* ── Normalisasi data booking → dokumen ────────────────────────────────────── */

export function buildTicketPdfData(raw: RawBooking): TicketPdfData {
  const type = normalizeType(raw.bookingType);
  const bd = (raw.bookingData && typeof raw.bookingData === 'object' ? raw.bookingData : {}) as RawBookingData;
  const providerBookings: RawProviderBooking[] = Array.isArray(bd.provider_bookings) ? bd.provider_bookings : [];

  // Struktur vendor berbeda: segmen bisa berada di `provider_bookings[].segments`
  // atau `provider_bookings[].journeys[].segments[].legs[]` (atau hanya di
  // journey fields). Normalisasi menyatukannya agar dokumen selalu menampilkan
  // rute, nama kota, dan waktu yang konsisten.
  const normalizedSegments: NormalizedSegment[] = normalizeBookingSegments(bd.provider_bookings);

  const segments: TicketSegment[] = normalizedSegments.map((s) => ({
    origin: s.origin || null,
    destination: s.destination || null,
    originName: s.originName || null,
    destinationName: s.destinationName || null,
    originTerminal: s.originTerminal || null,
    destinationTerminal: s.destinationTerminal || null,
    departureDate: s.departureDate || null,
    arrivalDate: s.arrivalDate || null,
    carrierName: s.carrierName || null,
    flightNumber: s.flightNumber || null,
    baggage: s.baggage || null,
  }));

  const first = segments[0];
  const last = segments[segments.length - 1];

  // Kursi per penumpang: dari segmen (flight) atau journeys (train).
  // Urutan `passenger_sequence` di vendor bisa 0-based maupun 1-based.
  const seatByPax: Record<number, string> = {};
  for (const seg of normalizedSegments) {
    for (const sp of seg.passengers || []) {
      const rawNum = Number(sp?.passenger_number ?? sp?.number);
      if (!Number.isFinite(rawNum)) continue;
      const seat = sp?.seat || sp?.seat_code || sp?.seat_assignment || '';
      if (seat) seatByPax[rawNum] = seat;
    }
  }
  for (const pb of providerBookings) {
    for (const journey of Array.isArray(pb?.journeys) ? pb.journeys : []) {
      for (const s of Array.isArray(journey?.seats) ? journey.seats : []) {
        const num = Number(s?.passenger_sequence);
        const seat = s?.seat || s?.seat_code || '';
        if (Number.isFinite(num) && seat) seatByPax[num] = seat;
      }
    }
  }

  const rawPassengers: RawPassenger[] = Array.isArray(raw.passengerData) ? raw.passengerData : [];
  const passengers: TicketPassenger[] = rawPassengers
    .filter((p) => p && (p.first_name || p.last_name || p.name))
    .map((p, i) => {
      const fallbackName = typeof p.name === 'string' ? p.name.trim().split(/\s+/) : [];
      return {
        title: p.title || null,
        firstName: p.first_name || fallbackName[0] || null,
        lastName: p.last_name || fallbackName.slice(1).join(' ') || null,
        type: p.pax_type || 'ADT',
        seat: p.seat || seatByPax[i] || seatByPax[i + 1] || null,
        ticketNumber: p.ticket_number || null,
        baggage: p.baggage || p.baggage_allowance || null,
      };
    });

  const selectedBaggage = bd.selectedBaggage;
  const baggage =
    (selectedBaggage && typeof selectedBaggage === 'object' && selectedBaggage.kg ? `${selectedBaggage.kg} KG` : null) ||
    first?.baggage ||
    bd.baggage_allowance ||
    null;

  const refundable =
    bd.refundable === true || bd.is_refundable === true || bd.fare_refundable === true;

  const departureDate = iso(raw.departureDate) || first?.departureDate || null;
  const arrivalDate = last?.arrivalDate || iso(bd.arrival_date_from_search) || null;
  const checkinDate = iso(raw.checkinDate) || iso(bd.checkin_date) || null;
  const checkoutDate = iso(raw.checkoutDate) || iso(bd.checkout_date) || null;

  const roomType = raw.roomDescription || bd.roomType || bd.room_description || bd.subclass || null;

  return {
    id: raw.id,
    orderNumber: raw.orderNumber || raw.id,
    type,
    status: raw.status || 'paid',
    createdAt: iso(raw.createdAt),
    paidAt: iso(raw.paidAt),
    paymentType: raw.paymentType || null,
    totalAmount: raw.totalAmount || 0,
    currency: raw.currency || 'IDR',
    discountAmount: raw.discountAmount || 0,
    couponCode: raw.couponCode || null,
    pnr: raw.pnr || null,
    provider: raw.provider || null,
    airlineName: raw.airlineName || null,
    flightNumber: raw.flightNumber || first?.flightNumber || null,
    origin: raw.origin || first?.origin || null,
    destination: raw.destination || last?.destination || null,
    routeLabel: raw.routeLabel || null,
    originName: first?.originName || null,
    destinationName: last?.destinationName || null,
    originTerminal: first?.originTerminal || null,
    destinationTerminal: last?.destinationTerminal || null,
    departureDate,
    arrivalDate,
    cabinClass: bd.cabin_class || bd.subclass || roomType || null,
    baggage,
    refundable,
    segments,
    hotelName: raw.hotelName || bd.hotel_name || bd.hotelName || null,
    checkinDate,
    checkoutDate,
    nights: raw.nights || (checkinDate && checkoutDate ? nightCount(checkinDate, checkoutDate) : null),
    roomType,
    roomCount: raw.roomCount || null,
    adultCount: raw.adultCount || null,
    childCount: raw.childCount || null,
    mealType: raw.mealType || bd.mealType || bd.meal_type || null,
    coverage: bd.coverage || null,
    passengers,
  };
}

/* ── Logo & QR ─────────────────────────────────────────────────────────────── */

let cachedLogo: string | null | undefined;

/**
 * Logo di `public/images/logo.png` ternyata berisi JPEG (magic `ffd8ff`),
 * bukan PNG. react-pdf memercayai MIME pada data URI, lalu gagal parse dengan
 * pesan "Incomplete or corrupt PNG file" sehingga logo tidak tampil sama sekali.
 * Deteksi format dari byte aslinya agar data URI selalu benar.
 */
function sniffImageMime(bytes: Buffer): string {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'image/webp';
  }
  return 'image/png';
}

function logoDataUri(): string | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const file = path.join(process.cwd(), 'public', 'images', 'logo.png');
    const bytes = fs.readFileSync(file);
    const mime = sniffImageMime(bytes);
    cachedLogo = `data:${mime};base64,${bytes.toString('base64')}`;
    if (mime !== 'image/png') {
      console.warn(`[TicketPDF] Logo berformat ${mime}, bukan PNG. Label disesuaikan otomatis.`);
    }
  } catch (err) {
    console.warn('[TicketPDF] Gagal membaca logo:', err);
    cachedLogo = null;
  }
  return cachedLogo;
}

/* ── Styles ────────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingHorizontal: 36,
    paddingBottom: 52,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: INK,
    backgroundColor: '#FFFFFF',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 26, height: 26, objectFit: 'contain', marginRight: 8 },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 0.8, color: INK },
  brandSub: { fontSize: 7, color: MUTED, marginTop: 2, letterSpacing: 0.6 },
  docType: { fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 2, color: ORANGE, textAlign: 'right' },
  orderNo: { fontFamily: 'Courier-Bold', fontSize: 10, color: INK, marginTop: 3, textAlign: 'right' },
  rule: { height: 2, backgroundColor: ORANGE, marginTop: 12, marginBottom: 18 },

  sectionLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7, letterSpacing: 1.4, color: MUTED, textTransform: 'uppercase' },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 20, color: INK, marginTop: 4, letterSpacing: -0.3 },
  subtitle: { fontSize: 8.5, color: MUTED, marginTop: 4 },

  routeBox: { marginTop: 16, padding: 16, borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  routeDate: { fontSize: 8, color: MUTED, marginBottom: 10 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeSide: { width: 128 },
  routeSideRight: { width: 128, alignItems: 'flex-end' },
  time: { fontFamily: 'Helvetica-Bold', fontSize: 22, color: INK, letterSpacing: -0.5 },
  code: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: ORANGE, marginTop: 4 },
  city: { fontSize: 7.5, color: BODY, marginTop: 2 },
  terminal: { fontSize: 7, color: MUTED, marginTop: 1 },
  routeMiddle: { flex: 1, alignItems: 'center', paddingHorizontal: 10, paddingTop: 4 },
  duration: { fontSize: 7.5, color: MUTED, marginBottom: 6 },
  track: { width: '100%', height: 1, backgroundColor: LINE, marginTop: 4, marginBottom: 4 },
  trackDots: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -3 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE },
  dotHollow: { width: 5, height: 5, borderRadius: 3, borderWidth: 1.5, borderColor: ORANGE, backgroundColor: '#FFFFFF' },
  transit: { fontSize: 7, color: MUTED, marginTop: 6 },

  grid: { flexDirection: 'row', marginTop: 14, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 12 },
  field: { flex: 1, paddingRight: 8 },
  fieldLabel: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, letterSpacing: 1, color: MUTED, textTransform: 'uppercase' },
  fieldValue: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: INK, marginTop: 3 },
  fieldValueMono: { fontFamily: 'Courier-Bold', fontSize: 9.5, color: INK, marginTop: 3 },

  block: { marginTop: 16 },
  blockTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7, letterSpacing: 1.2, color: MUTED, textTransform: 'uppercase', marginBottom: 6 },

  table: { borderWidth: 1, borderColor: LINE, borderRadius: 3 },
  tableHead: { flexDirection: 'row', backgroundColor: SOFT, borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5, paddingHorizontal: 6 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, letterSpacing: 0.8, color: MUTED, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: LINE },
  trLast: { borderBottomWidth: 0 },
  td: { fontSize: 8, color: BODY },
  tdStrong: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: INK },
  tdMono: { fontFamily: 'Courier', fontSize: 8, color: BODY },

  payment: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 12, backgroundColor: SOFT_ORANGE, borderRadius: 3, borderWidth: 1, borderColor: '#FFE2C7' },
  paymentLabel: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, letterSpacing: 1, color: MUTED, textTransform: 'uppercase' },
  total: { fontFamily: 'Helvetica-Bold', fontSize: 16, color: ORANGE, marginTop: 3 },
  paymentMeta: { fontSize: 7.5, color: BODY, textAlign: 'right', lineHeight: 1.6 },

  notes: { marginTop: 16 },
  note: { fontSize: 7.2, color: MUTED, lineHeight: 1.6, marginBottom: 2 },

  footer: { marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: LINE, flexDirection: 'row', alignItems: 'center' },
  qr: { width: 56, height: 56 },
  verifyLabel: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, letterSpacing: 1, color: MUTED, textTransform: 'uppercase' },
  verifyCode: { fontFamily: 'Courier-Bold', fontSize: 10, color: INK, marginTop: 2 },
  footerText: { fontSize: 7, color: MUTED, marginTop: 2 },
  pageFooter: { position: 'absolute', bottom: 22, left: 36, right: 36, fontSize: 6.5, color: MUTED, textAlign: 'center', borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 5 },
});

/* ── Komponen kecil ────────────────────────────────────────────────────────── */

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={mono ? s.fieldValueMono : s.fieldValue}>{value || '-'}</Text>
    </View>
  );
}

function paxTypeLabel(type?: string | null) {
  if (type === 'CHD') return 'Anak';
  if (type === 'INF') return 'Bayi';
  return 'Dewasa';
}

/* ── Dokumen ───────────────────────────────────────────────────────────────── */

function TicketDocument({ data, qr }: { data: TicketPdfData; qr: string }) {
  const isHotel = data.type === 'hotel';
  const isInsurance = data.type === 'insurance';
  const isTransport = data.type === 'flight' || data.type === 'train';
  const logo = logoDataUri();

  const docType = isHotel ? 'VOUCHER HOTEL' : isInsurance ? 'POLIS ASURANSI' : 'E-TICKET';
  const title = isHotel ? 'Booking Confirmation' : isInsurance ? 'Insurance Policy' : 'Boarding Pass';
  const startDate = isTransport ? data.departureDate : isHotel || isInsurance ? data.checkinDate : null;
  const endDate = isTransport ? data.arrivalDate : isHotel || isInsurance ? data.checkoutDate : null;
  const itemName =
    (isHotel ? data.hotelName : isInsurance ? data.coverage || 'Asuransi Perjalanan' : data.airlineName) ||
    data.routeLabel ||
    '-';

  const hasTicketCol = data.passengers.some((p) => p.ticketNumber) || !!data.pnr;
  const hasSeatCol = data.passengers.some((p) => p.seat);
  const hasBaggageCol = data.passengers.some((p) => p.baggage) || !!data.baggage;
  const notes = buildNotes(data.type);

  return (
    <Document title={`${docType} ${data.orderNumber}`} author="The Mafia Travel" subject={docType} creator="The Mafia Travel">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.brandRow}>
            {logo ? <Image src={logo} style={s.logo} /> : null}
            <View>
              <Text style={s.brand}>THE MAFIA TRAVEL</Text>
              <Text style={s.brandSub}>Travel &amp; Ticketing</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docType}>{docType}</Text>
            <Text style={s.orderNo}>{data.orderNumber}</Text>
          </View>
        </View>
        <View style={s.rule} />

        {/* Title */}
        <Text style={s.sectionLabel}>{docType}</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>
          {itemName}
          {data.pnr ? `  ·  PNR ${data.pnr}` : ''}
          {data.status ? `  ·  ${statusLabel(data.status)}` : ''}
        </Text>

        {/* Route / periode */}
        <View style={s.routeBox}>
          {isTransport ? (
            <>
              <Text style={s.routeDate}>{fmtDateLong(startDate)}</Text>
              <View style={s.routeRow}>
                <View style={s.routeSide}>
                  <Text style={s.time}>{fmtTime(data.departureDate)}</Text>
                  <Text style={s.code}>{data.origin || '-'}</Text>
                  <Text style={s.city}>{data.originName || '-'}</Text>
                  {data.originTerminal ? <Text style={s.terminal}>{data.originTerminal}</Text> : null}
                </View>
                <View style={s.routeMiddle}>
                  <Text style={s.duration}>{fmtDuration(data.departureDate, data.arrivalDate)}</Text>
                  <View style={s.track} />
                  <View style={s.trackDots}>
                    <View style={s.dot} />
                    <View style={s.dotHollow} />
                  </View>
                  <Text style={s.transit}>
                    {data.segments.length > 1 ? `${data.segments.length - 1} Transit` : 'Langsung'}
                  </Text>
                </View>
                <View style={s.routeSideRight}>
                  <Text style={s.time}>{fmtTime(data.arrivalDate)}</Text>
                  <Text style={s.code}>{data.destination || '-'}</Text>
                  <Text style={s.city}>{data.destinationName || '-'}</Text>
                  {data.destinationTerminal ? <Text style={s.terminal}>{data.destinationTerminal}</Text> : null}
                </View>
              </View>
            </>
          ) : (
            <View style={s.routeRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>{isHotel ? 'Check-in' : 'Mulai'}</Text>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 14, color: INK, marginTop: 4 }}>
                  {fmtDate(startDate)}
                </Text>
                {isHotel ? <Text style={s.city}>Mulai pukul 14:00</Text> : null}
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={s.sectionLabel}>{isHotel ? 'Check-out' : 'Berakhir'}</Text>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 14, color: INK, marginTop: 4 }}>
                  {fmtDate(endDate)}
                </Text>
                {isHotel ? <Text style={s.city}>Sebelum pukul 12:00</Text> : null}
              </View>
            </View>
          )}
        </View>

        {/* Detail grid */}
        <View style={s.grid}>
          {isTransport ? (
            <>
              <Field label="Maskapai / Operator" value={data.airlineName || data.provider} />
              <Field label="Nomor" value={data.flightNumber} mono />
              <Field label="Kelas" value={data.cabinClass} />
              <Field label="Bagasi" value={data.baggage} />
            </>
          ) : isHotel ? (
            <>
              <Field label="Hotel" value={data.hotelName} />
              <Field label="Tipe Kamar" value={data.roomType} />
              <Field label="Malam" value={data.nights ? `${data.nights} malam` : null} />
              <Field label="Tamu / Kamar" value={`${(data.adultCount || 0) + (data.childCount || 0) || data.passengers.length || 1} orang${data.roomCount ? ` · ${data.roomCount} kamar` : ''}`} />
            </>
          ) : (
            <>
              <Field label="Produk" value={data.coverage || 'Asuransi Perjalanan'} />
              <Field label="Tertanggung" value={`${data.passengers.length || 1} orang`} />
              <Field label="Mulai" value={fmtDate(data.checkinDate)} />
              <Field label="Berakhir" value={fmtDate(data.checkoutDate)} />
            </>
          )}
        </View>

        <View style={s.grid}>
          <Field label="Kode Booking (PNR)" value={data.pnr} mono />
          <Field label="Tipe" value={isHotel ? 'Hotel' : isInsurance ? 'Asuransi' : data.type === 'train' ? 'Kereta Api' : 'Pesawat'} />
          <Field label="Refund" value={data.refundable ? 'Refundable' : 'Non-refundable'} />
          <Field label="Dipesan" value={fmtDate(data.createdAt)} />
        </View>

        {/* Segmen multi-transit */}
        {isTransport && data.segments.length > 1 ? (
          <View style={s.block}>
            <Text style={s.blockTitle}>Rincian Segmen</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.th, { flex: 2 }]}>Rute</Text>
                <Text style={[s.th, { flex: 1.4 }]}>Berangkat</Text>
                <Text style={[s.th, { flex: 1.4 }]}>Tiba</Text>
                <Text style={[s.th, { flex: 1.2 }]}>Penerbangan</Text>
              </View>
              {data.segments.map((seg, i) => (
                <View key={i} style={[s.tr, i === data.segments.length - 1 ? s.trLast : {}]}>
                  <Text style={[s.tdStrong, { flex: 2 }]}>
                    {seg.origin || '-'} → {seg.destination || '-'}
                  </Text>
                  <Text style={[s.td, { flex: 1.4 }]}>{fmtDateTime(seg.departureDate)}</Text>
                  <Text style={[s.td, { flex: 1.4 }]}>{fmtDateTime(seg.arrivalDate)}</Text>
                  <Text style={[s.tdMono, { flex: 1.2 }]}>{seg.flightNumber || '-'}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Penumpang */}
        {data.passengers.length > 0 ? (
          <View style={s.block}>
            <Text style={s.blockTitle}>{isHotel ? 'Data Tamu' : isInsurance ? 'Tertanggung' : 'Data Penumpang'}</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.th, { width: 16 }]}>#</Text>
                <Text style={[s.th, { flex: 3 }]}>Nama</Text>
                <Text style={[s.th, { width: 42 }]}>Tipe</Text>
                {hasTicketCol ? <Text style={[s.th, { flex: 2 }]}>Tiket / PNR</Text> : null}
                {hasSeatCol ? <Text style={[s.th, { width: 38 }]}>Kursi</Text> : null}
                {hasBaggageCol ? <Text style={[s.th, { width: 52 }]}>Bagasi</Text> : null}
              </View>
              {data.passengers.map((p, i) => (
                <View key={i} style={[s.tr, i === data.passengers.length - 1 ? s.trLast : {}]}>
                  <Text style={[s.td, { width: 16 }]}>{i + 1}</Text>
                  <Text style={[s.tdStrong, { flex: 3 }]}>
                    {[p.title, p.firstName, p.lastName].filter(Boolean).join(' ').toUpperCase()}
                  </Text>
                  <Text style={[s.td, { width: 42 }]}>{paxTypeLabel(p.type)}</Text>
                  {hasTicketCol ? (
                    <Text style={[s.tdMono, { flex: 2 }]}>{p.ticketNumber || data.pnr || '-'}</Text>
                  ) : null}
                  {hasSeatCol ? <Text style={[s.tdStrong, { width: 38 }]}>{p.seat || '-'}</Text> : null}
                  {hasBaggageCol ? (
                    <Text style={[s.td, { width: 52 }]}>{p.baggage || data.baggage || '-'}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Pembayaran */}
        <View style={s.payment}>
          <View>
            <Text style={s.paymentLabel}>Total Pembayaran</Text>
            <Text style={s.total}>{fmtIDR(data.totalAmount)}</Text>
            {data.discountAmount > 0 ? (
              <Text style={[s.footerText, { marginTop: 2 }]}>
                Diskon {fmtIDR(data.discountAmount)}
                {data.couponCode ? ` · ${data.couponCode}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.paymentMeta}>Metode: {data.paymentType ? data.paymentType.replace(/_/g, ' ') : '-'}</Text>
            <Text style={s.paymentMeta}>Dibayar: {data.paidAt ? fmtDateTime(data.paidAt) : '-'}</Text>
            <Text style={s.paymentMeta}>Dipesan: {fmtDateTime(data.createdAt)}</Text>
          </View>
        </View>

        {/* Syarat */}
        <View style={s.notes}>
          <Text style={s.blockTitle}>Syarat &amp; Ketentuan</Text>
          {notes.map((note, i) => (
            <Text key={i} style={s.note}>
              {i + 1}. {note}
            </Text>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer} wrap={false}>
          <Image src={qr} style={s.qr} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.verifyLabel}>Kode Verifikasi</Text>
            <Text style={s.verifyCode}>{genVerificationHash(data.id)}</Text>
            <Text style={[s.footerText, { marginTop: 4 }]}>
              Pindai QR untuk memverifikasi keaslian dokumen ini.
            </Text>
            <Text style={s.footerText}>Dokumen sah tanpa tanda tangan basah.</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.verifyLabel}>Diterbitkan</Text>
            <Text style={[s.footerText, { marginTop: 3 }]}>
              {new Date().toLocaleString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Jakarta',
              })}{' '}
              WIB
            </Text>
            <Text style={[s.footerText, { marginTop: 4 }]}>support@themafiatravel.com</Text>
            <Text style={s.footerText}>0804-1500-308</Text>
          </View>
        </View>

        <Text fixed style={s.pageFooter}>
          THE MAFIA TRAVEL · Dokumen resmi · themafiatravel.com
        </Text>
      </Page>
    </Document>
  );
}

/* ── Render ────────────────────────────────────────────────────────────────── */

/**
 * `pdf().toBuffer()` di @react-pdf/renderer v4 mengembalikan ReadableStream,
 * bukan Buffer. Kumpulkan dulu stream-nya agar aman dikirim sebagai body PDF
 * dan sebagai lampiran email (nodemailer butuh Buffer).
 */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array | string));
  }
  return Buffer.concat(chunks);
}

export async function renderTicketPdf(data: TicketPdfData): Promise<Buffer> {
  const qr = await QRCode.toDataURL(verifyUrl(data.id), {
    margin: 0,
    width: 240,
    errorCorrectionLevel: 'medium',
    color: { dark: '#111827', light: '#FFFFFF' },
  });
  const stream = await pdf(<TicketDocument data={data} qr={qr} />).toBuffer();
  return streamToBuffer(stream);
}

/* ── Builder lampiran email (kompatibel dengan pemanggil lama) ─────────────── */

type EmailAttachment = { filename: string; content: Buffer };

export function ticketFilename(type: string, orderNumber: string): string {
  const prefix =
    type === 'hotel' ? 'VOUCHER' : type === 'insurance' ? 'POLIS' : type === 'train' ? 'E-TICKET-KERETA' : 'E-TICKET';
  const safe = (orderNumber || 'TMT').replace(/[^a-zA-Z0-9-_]/g, '-');
  return `${prefix}_${safe}.pdf`;
}

export async function buildBookingTicketAttachment(bookingRecord: unknown): Promise<EmailAttachment[] | null> {
  try {
    const data = buildTicketPdfData(bookingRecord as RawBooking);
    const buffer = await renderTicketPdf(data);
    return [{ filename: ticketFilename(data.type, data.orderNumber), content: buffer }];
  } catch (err) {
    console.warn('[TicketPDF] Gagal membangun lampiran tiket:', err);
    return null;
  }
}

export async function generateBookingTicketPdf(bookingRecord: unknown): Promise<Buffer | null> {
  try {
    return await renderTicketPdf(buildTicketPdfData(bookingRecord as RawBooking));
  } catch (err) {
    console.warn('[TicketPDF] Gagal membuat PDF tiket:', err);
    return null;
  }
}
