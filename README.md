# The Mafia Travel — Full Stack Travel Platform

Platform perjalanan premium dengan integrasi Orbisway API (hotel, pesawat, kereta, asuransi), Midtrans Payment Gateway, NextAuth authentication, dan PostgreSQL + Prisma.

## Tech Stack

- **Frontend & Backend**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS + Custom CSS Variables
- **Auth**: NextAuth.js (JWT, credentials + Google OAuth) dengan 2FA (TOTP + backup code)
- **Payment**: Midtrans Snap + webhook notification
- **API**: Orbisway (Hotel, Pesawat, Kereta, Asuransi)
- **Database**: PostgreSQL + Prisma ORM
- **Notifikasi**: Fonnte (WhatsApp), Redis rate-limit opsional (fallback in-memory)

## Struktur Project

```
mafia-travel/
├── app/
│   ├── (public)/          # Login, Register, Find Booking, Reset Password
│   ├── (dashboard)/       # Search, Checkout, Bookings, Refunds, Wallet (member)
│   ├── admin/             # Dashboard admin: bookings, finance, refund-queue, users, audit-logs
│   ├── api/               # API Routes (auth, hotel, flight, train, insurance, booking, payment, cron, admin)
│   ├── robots.ts          # robots.txt (metadata route)
│   └── sitemap.ts         # sitemap.xml (metadata route)
├── components/            # UI components (layout, admin, flight, hotel, train, insurance, auth)
├── lib/
│   ├── orbis.ts           # Orbisway API Client
│   ├── auth.ts            # NextAuth config
│   ├── midtrans.ts        # Midtrans helper
│   ├── snap-pay.ts        # Midtrans Snap loader (client)
│   ├── store.ts           # Prisma queries booking/refund (transaksional)
│   ├── validate.ts        # Zod schema validasi payload
│   ├── rate-limit.ts      # Rate limiter (Redis/in-memory)
│   ├── two-factor.ts      # TOTP + backup code 2FA
│   ├── notify.ts          # Notifikasi WhatsApp (Fonnte)
│   ├── price-check.ts     # Verifikasi ulang harga booking
│   ├── hotel-price.ts     # Verify harga hotel (provision/get_details)
│   └── booking-access.ts  # Cek kepemilikan booking (owner/admin/guest)
├── middleware.ts          # Auth guard + nonce CSP per-request
└── prisma/schema.prisma   # Skema PostgreSQL + seed (prisma/seed.ts)
```

## Setup & Jalankan

### 1. Install Dependencies

```bash
npm install
```

### 2. Konfigurasi Environment Variables

Salin `.env.example` ke `.env.local` dan isi:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=random-string-panjang

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mafia_travel

# Admin awal (wajib untuk seed)
ADMIN_EMAIL=admin@mafia.travel
ADMIN_PASSWORD=password-kuat-admin

# Orbisway API
ORBIS_API_URL=https://apiinternal.orbisway.com
ORBIS_USER=user_kamu
ORBIS_PASSWORD=password_kamu
ORBIS_API_KEY=api-key-kamu

# Midtrans
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Notifikasi WhatsApp (Fonnte) — opsional
FONNTE_API_TOKEN=token_fonnte_kamu
```

### 3. Inisialisasi Database & Seed

```bash
npx prisma migrate deploy
npx prisma generate
npm run seed
```

### 4. Jalankan Development Server

```bash
npm run dev
```

Buka http://localhost:3000

## Scripts

| Command | Fungsi |
|---------|--------|
| `npm run dev` | Development server |
| `npm run build` | Build produksi (`next build`) |
| `npm run start` | Jalankan build produksi |
| `npm run lint` | ESLint |
| `npm test` | Unit test (node --test + tsx) |
| `npm run seed` | Seed admin awal |
| `npx prisma studio` | Prisma Studio |

## Halaman

| URL | Deskripsi |
|-----|-----------|
| `/` | Landing page + cari penerbangan |
| `/login` `/register` | Login (2FA) & daftar akun |
| `/find-booking` | Cari booking tamu (kode booking) |
| `/flight/search`, `/hotel/search`, `/train/search`, `/insurance/search` | Pencarian masing-masing modul |
| `/hotel/[hotelId]` | Detail hotel & pilih kamar |
| `/flight/checkout`, `/hotel/checkout`, `/train/checkout`, `/insurance/checkout` | Form tamu + pembayaran |
| `/bookings` | Riwayat pesanan member |
| `/bookings/[id]/cancel` | Pembatalan & refund |
| `/insurance/bookings` | Booking asuransi member |
| `/refunds` | Status refund |
| `/wallet` | Dompet member |
| `/admin/*` | Admin: bookings, finance, refund-queue, users, payments, audit-logs |

## API Routes (utama)

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/auth/register` | POST | Daftar user baru |
| `/api/hotel/search` | POST | Cari hotel |
| `/api/hotel/book` | POST | Booking hotel (verifikasi harga) + Midtrans |
| `/api/flight/search` | POST | Cari penerbangan |
| `/api/flight/book` | POST | Booking pesawat (revalidasi harga) |
| `/api/train/search` | POST | Cari kereta |
| `/api/train/book` | POST | Booking kereta (revalidasi harga) |
| `/api/insurance/search` | POST | Cari produk asuransi |
| `/api/insurance/book` | POST | Booking asuransi (re-quote harga) |
| `/api/payment/notification` | POST | Webhook Midtrans |
| `/api/booking/find` | POST | Cari booking berdasarkan kode (tamu) |
| `/api/cron/...` | POST | Job terjadwal (cron) |

Semua payload API tervalidasi Zod (`lib/validate.ts`); harga booking diverifikasi ulang terhadap provider sebelum pembayaran (fail-closed).

## Keamanan

- **CSP nonce-based** per-request (middleware → meta tag di `app/layout.tsx`), tanpa `unsafe-inline`/`unsafe-eval` untuk script.
- Role guard admin di middleware (JWT) + verifikasi ulang di layout/route.
- Rate limiting pada endpoint auth, login, search, booking, dan hapus akun.
- Password re-authentication untuk aksi sensitif (hapus akun).
- Akses pembatalan booking hanya untuk pemilik/admin/tamu dengan email terdaftar.

## Deploy

### Docker (standalone)

```bash
docker build -t mafia-travel .
docker run -p 3000:3000 --env-file .env.local mafia-travel
```

### Vercel

```bash
vercel --prod
```

Jangan lupa set semua environment variables di dashboard provider (pastikan `DATABASE_URL` terisi dan sudah dijalankan `prisma migrate deploy`).
