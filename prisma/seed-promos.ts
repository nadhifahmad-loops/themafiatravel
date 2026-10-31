import { PrismaClient } from '@prisma/client';

/**
 * Seed kartu promo homepage.
 * Idempoten: hanya mengisi bila tabel masih kosong (tidak menimpa editan admin).
 *
 * Jalankan: npx tsx prisma/seed-promos.ts
 *
 * Catatan perbaikan vs data hardcoded lama (app/page.tsx):
 *  - tanggal statis "18 Okt 2026" (sudah lewat) → validUntil 30 Nov 2026
 *  - harga string ID/EN beda format ("Rp 684.400" / "Rp 684,400") → integer
 *  - kartu "Resort Lombok" yang mengarah ke Bali (dest ID8731 + q 'Bali')
 *    → diganti "Hotel Yogyakarta" (ID8735) karena belum ada kode destinasi Lombok
 *    yang valid di daftar provider (destination_id wajib untuk pencarian hotel)
 */

const prisma = new PrismaClient();

// Satu jendela kampanye. Admin bisa mengubah per kartu lewat /admin/promos.
const VALID_UNTIL = new Date('2026-11-30T23:59:59.000Z');

const PROMOS = [
  // ── PESAWAT ────────────────────────────────────────────────────────────────
  {
    service: 'flight', titleId: 'Jakarta – Yogyakarta', titleEn: null,
    badgeId: 'Sekali Jalan', badgeEn: 'One Way',
    image: '/images/domestik/yogyakarta.png', priceFrom: 684400,
    origin: 'CGK', destination: 'JOG', airline: 'Batik Air',
    airlineImg: '/images/airlines/batik.png', sortOrder: 1,
  },
  {
    service: 'flight', titleId: 'Jakarta – Surabaya', titleEn: null,
    badgeId: 'Sekali Jalan', badgeEn: 'One Way',
    image: '/images/domestik/surabaya.png', priceFrom: 876800,
    origin: 'CGK', destination: 'SUB', airline: 'Garuda Indonesia',
    airlineImg: '/images/airlines/garuda.png', sortOrder: 2,
  },
  {
    service: 'flight', titleId: 'Jakarta – Bali / Denpasar', titleEn: null,
    badgeId: 'Sekali Jalan', badgeEn: 'One Way',
    image: '/images/domestik/bali.png', priceFrom: 1240900,
    origin: 'CGK', destination: 'DPS', airline: 'Super Air Jet',
    airlineImg: '/images/airlines/superairjet.png', sortOrder: 3,
  },
  {
    service: 'flight', titleId: 'Jakarta – Medan', titleEn: null,
    badgeId: 'Sekali Jalan', badgeEn: 'One Way',
    image: '/images/domestik/medan.png', priceFrom: 1294400,
    origin: 'CGK', destination: 'KNO', airline: 'Citilink',
    airlineImg: '/images/airlines/citilink.png', sortOrder: 4,
  },
  {
    service: 'flight', titleId: 'Jakarta – Lombok', titleEn: null,
    badgeId: 'Sekali Jalan', badgeEn: 'One Way',
    image: '/images/domestik/lombok.png', priceFrom: 850000,
    origin: 'CGK', destination: 'LOP', airline: 'AirAsia',
    airlineImg: '/images/airlines/airasia.png', sortOrder: 5,
  },

  // ── HOTEL ──────────────────────────────────────────────────────────────────
  {
    service: 'hotel', titleId: 'Hotel Bali Mewah', titleEn: 'Luxury Bali Hotel',
    badgeId: 'Bintang 5', badgeEn: '5 Stars',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80',
    priceFrom: 750000,
    destinationId: 'ID8731', q: 'Bali', city: 'Bali', sortOrder: 1,
  },
  {
    service: 'hotel', titleId: 'Hotel Yogyakarta', titleEn: 'Yogyakarta Hotel',
    badgeId: 'Nilai Terbaik', badgeEn: 'Best Value',
    image: '/images/domestik/yogyakarta.png', priceFrom: 450000,
    destinationId: 'ID8735', q: 'Yogyakarta', city: 'Yogyakarta', sortOrder: 2,
  },
  {
    service: 'hotel', titleId: 'Hotel Jakarta Pusat', titleEn: 'Central Jakarta Hotel',
    badgeId: 'Flash Sale', badgeEn: 'Flash Sale',
    image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500&q=80',
    priceFrom: 380000,
    destinationId: 'ID339', q: 'Jakarta', city: 'Jakarta', sortOrder: 3,
  },
  {
    service: 'hotel', titleId: 'Villa Ubud', titleEn: 'Ubud Villa',
    badgeId: 'Pilihan Editor', badgeEn: "Editor's Pick",
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&q=80',
    priceFrom: 1200000,
    // Ubud ada di Bali → destinasi provider tetap Bali, kata kunci 'Bali'
    destinationId: 'ID8731', q: 'Bali', city: 'Ubud', sortOrder: 4,
  },

  // ── KERETA ─────────────────────────────────────────────────────────────────
  {
    service: 'train', titleId: 'Jakarta – Surabaya', titleEn: null,
    badgeId: 'Eksekutif', badgeEn: 'Executive',
    image: '/images/domestik/surabaya.png', priceFrom: 180000,
    origin: 'GMR', destination: 'SGU', sortOrder: 1,
  },
  {
    service: 'train', titleId: 'Bandung – Yogyakarta', titleEn: null,
    badgeId: 'Populer', badgeEn: 'Popular',
    image: '/images/domestik/yogyakarta.png', priceFrom: 120000,
    origin: 'BD', destination: 'YK', sortOrder: 2,
  },
  {
    service: 'train', titleId: 'Jakarta – Bandung', titleEn: null,
    badgeId: 'Harian', badgeEn: 'Daily',
    image: '/images/domestik/bandung.png', priceFrom: 75000,
    origin: 'GMR', destination: 'BD', sortOrder: 3,
  },
];

async function main() {
  const existing = await prisma.promoRoute.count();

  if (existing > 0) {
    console.log(`Tabel PromoRoute sudah berisi ${existing} kartu — seed dilewati (tidak menimpa data admin).`);
    return;
  }

  await prisma.promoRoute.createMany({
    data: PROMOS.map((p) => ({ ...p, validUntil: VALID_UNTIL })),
  });

  console.log(`${PROMOS.length} kartu promo berhasil diisi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
