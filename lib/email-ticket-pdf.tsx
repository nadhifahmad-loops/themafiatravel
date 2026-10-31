// lib/email-ticket-pdf.tsx
// Kompatibilitas: pemanggil lama (email konfirmasi pembayaran) tetap memakai
// modul ini, tetapi seluruh logika dokumen kini berada di lib/ticket-pdf.tsx
// agar tiket hasil unduhan dan lampiran email selalu identik.

export {
  buildBookingTicketAttachment,
  generateBookingTicketPdf,
} from './ticket-pdf';
