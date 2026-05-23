# 🏝️ The Mafia Travel — Full Stack Travel Platform

Platform perjalanan premium dengan integrasi Orbisway API, Midtrans Payment Gateway, dan NextAuth authentication.

## 🛠️ Tech Stack
- **Frontend & Backend**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS + Custom CSS Variables
- **Auth**: NextAuth.js (JWT)
- **Payment**: Midtrans Snap
- **API**: Orbisway (Hotel, Pesawat, Kereta, Asuransi)
- **Database**: In-memory store (siap upgrade ke PostgreSQL + Prisma)

## 📁 Struktur Project
```
mafia-travel/
├── app/
│   ├── (public)/          # Login, Register
│   ├── (dashboard)/       # Dashboard, Hotel, Bookings (protected)
│   ├── api/               # API Routes
│   │   ├── auth/          # NextAuth + Register
│   │   ├── hotel/         # Search, Detail, Book, Cancel
│   │   ├── flight/        # Search Pesawat
│   │   └── payment/       # Midtrans Notification
│   └── payment/finish/    # Redirect setelah bayar
├── components/
│   ├── hotel/             # HotelCard, HotelSearchForm
│   └── layout/            # Navbar
├── lib/
│   ├── orbis.ts           # Orbisway API Client
│   ├── auth.ts            # NextAuth config
│   ├── midtrans.ts        # Midtrans helper
│   └── store.ts           # In-memory store
└── prisma/schema.prisma   # DB schema (untuk upgrade ke PostgreSQL)
```

## 🚀 Setup & Jalankan

### 1. Install Dependencies
```bash
npm install
```

### 2. Konfigurasi Environment Variables
Buat file `.env.local` dan isi:
```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=isi-dengan-random-string-panjang

# Orbisway API (sudah diisi API key kamu)
ORBIS_API_URL=https://apiinternal.orbisway.com
ORBIS_USER=user_kamu
ORBIS_PASSWORD=password_kamu
ORBIS_API_KEY=f420217e-bd23-48e9-a383-709673e5dd32

# Midtrans (ambil dari dashboard.midtrans.com)
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Jalankan Development Server
```bash
npm run dev
```
Buka http://localhost:3000

## 🌐 Halaman
| URL | Deskripsi |
|-----|-----------|
| `/` | Landing page (sebelum login) |
| `/login` | Halaman login |
| `/register` | Halaman daftar akun |
| `/dashboard` | Dashboard (setelah login) |
| `/hotel/search` | Pencarian hotel |
| `/hotel/[id]` | Detail & pilih kamar hotel |
| `/hotel/checkout` | Form data tamu + pembayaran |
| `/hotel/confirmation` | Konfirmasi setelah bayar |
| `/bookings` | Riwayat pesanan |

## 🔌 API Routes
| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/auth/register` | POST | Daftar user baru |
| `/api/hotel/search` | POST | Cari hotel |
| `/api/hotel/detail` | POST | Detail hotel & room |
| `/api/hotel/provision` | POST | Cek harga terbaru |
| `/api/hotel/book` | POST | Buat booking + Midtrans |
| `/api/hotel/booking` | GET/POST | List / cek status booking |
| `/api/hotel/cancel` | POST | Cancel & cek refund |
| `/api/payment/notification` | POST | Webhook Midtrans |
| `/api/flight/search` | POST | Cari penerbangan |

## 💾 Upgrade ke Database PostgreSQL
```bash
# Install PostgreSQL (Supabase atau lokal)
# Isi DATABASE_URL di .env.local
# Lalu jalankan:
npx prisma migrate dev
npx prisma generate
```
Lalu ganti `bookingStore` di `lib/store.ts` dengan Prisma queries.

## 💳 Setup Midtrans
1. Daftar di https://dashboard.midtrans.com
2. Aktifkan Sandbox mode untuk testing
3. Ambil Server Key & Client Key dari Settings → Access Keys
4. Isi di `.env.local`
5. Set Notification URL: `https://domain-kamu.com/api/payment/notification`

## 🚢 Deploy ke Vercel
```bash
npm install -g vercel
vercel --prod
```
Jangan lupa set semua environment variables di Vercel dashboard!
