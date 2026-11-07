# The Mafia Travel — Platform Pemesanan Perjalanan

Platform pemesanan **pesawat, kereta, hotel, dan asuransi perjalanan** yang terhubung ke supplier **Orbisway**, pembayaran **Midtrans Snap**, autentikasi **NextAuth** (kredensial + Google, 2FA TOTP), dan database **PostgreSQL + Prisma**.

> Dokumen ini adalah panduan utama untuk **tim IT yang men-deploy**. Status audit & daftar risiko ada di [PRODUCTION-HANDOFF.md](./PRODUCTION-HANDOFF.md).

## Daftar isi

1. [Tech stack & struktur](#tech-stack--struktur)
2. [Menjalankan di lokal](#menjalankan-di-lokal)
3. [Panduan integrasi & deploy produksi](#panduan-integrasi--deploy-produksi)
4. [Variabel environment](#variabel-environment)
5. [Troubleshooting](#troubleshooting)
6. [Operasional & pemeliharaan](#operasional--pemeliharaan)
7. [Scripts, halaman, API](#scripts-halaman-api)

---

## Tech stack & struktur

- **Next.js 16** (App Router, output `standalone`) + TypeScript, Tailwind CSS
- **Auth**: NextAuth (JWT), Google OAuth, 2FA TOTP + backup code
- **Pembayaran**: Midtrans Snap + webhook
- **Supplier**: Orbisway (hotel, pesawat, kereta, asuransi)
- **Database**: PostgreSQL (diuji pada 16) + Prisma 6
- **Opsional tapi disarankan di produksi**: Redis (rate limit bersama), Cloudinary (upload gambar), Resend (email), Fonnte (WhatsApp)

```
app/            halaman (public, dashboard member, admin) + app/api/* (route handler)
components/     komponen UI
lib/            orbis.ts (client supplier), auth.ts, midtrans.ts, rate-limit.ts,
                upload-storage.ts, store.ts (query transaksional), validate.ts, dll.
prisma/         schema.prisma, migrations/, seed.ts
proxy.ts        guard halaman (auth) + CSP nonce per-request  (Next.js 16: menggantikan middleware.ts)
scripts/        check-env.ts (pemeriksa konfigurasi), skrip bantu lain
```

> **Penting:** `proxy.ts` **tidak** berlaku untuk `/api/*`. Setiap route API melakukan autentikasi/otorisasinya sendiri. Jangan menambah route API tanpa guard.

---

## Menjalankan di lokal

Prasyarat: **Node.js ≥ 20.9**, PostgreSQL 14+ (atau `docker compose up -d db`).

```bash
npm ci
cp .env.example .env.local        # isi nilai (lihat bagian Variabel environment)
npm run check:env                 # validasi konfigurasi
npm run db:migrate                # prisma migrate deploy (membangun semua tabel)
npm run db:seed                   # opsional: admin awal dari ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev                       # http://localhost:3000
```

Pengujian: `npm run typecheck && npm run lint && npm test && npm run build`.
CI (`.github/workflows/ci.yml`) menjalankan semuanya, ditambah **uji migrasi dari database kosong** dan **pengecekan drift schema ↔ migrasi**.

---

## Panduan integrasi & deploy produksi

Ikuti urutan ini. Setiap langkah punya cara verifikasi.

### Langkah 0 — Pilih target deploy

| | **Vercel** | **VPS + Docker Compose** |
|---|---|---|
| Cocok untuk | tim kecil, cepat | butuh **IP keluar tetap** |
| Cron | `vercel.json` (otomatis) | crontab server (lihat Langkah 7) |
| IP whitelist Orbisway | **sulit** (IP keluar Vercel dinamis kecuali add-on IP statis berbayar) | **mudah** (IP server tetap) |

Orbisway membatasi akses API per **IP whitelist**. Karena itu **VPS dengan IP tetap adalah pilihan yang paling aman untuk produksi**; Vercel hanya jika paket Anda menyediakan IP keluar statis dan IP tersebut sudah didaftarkan ke Orbisway.

### Langkah 1 — Siapkan layanan pihak ketiga

- **PostgreSQL** (Neon / managed / container). Siapkan dua URL: `DATABASE_URL` (boleh pooled) dan `DIRECT_URL` (koneksi langsung, dipakai migrasi). Password dengan karakter khusus harus di-URL-encode.
- **Orbisway**: kredensial akun **produksi** + daftarkan IP keluar server.
- **Midtrans**: akun **production** (Server Key `Mid-server-…`, Client Key `Mid-client-…`).
- **Google OAuth**: buat OAuth client; *Authorized redirect URI* = `https://DOMAIN/api/auth/callback/google`.
- **Cloudinary**: cloud name + API key/secret (untuk upload banner & cover koleksi).
- **Resend**: verifikasi **domain pengirim** (jangan `resend.dev`); isi `EMAIL_FROM`.
- **Redis** (Upstash/Redis Cloud): URL harus berawalan `rediss://` (TLS) atau `redis://`.

### Langkah 2 — Isi environment & validasi

```bash
cp .env.example .env     # atau set di dashboard platform
NODE_ENV=production npm run check:env
```

`check:env` memeriksa antara lain: kunci Midtrans cocok dengan mode, `NEXTAUTH_URL` https & bukan localhost, `CRON_SECRET` terisi, format `REDIS_URL`, `CLOUDINARY_*` lengkap. Perbaiki semua **ERROR** sebelum lanjut. Nilai rahasia tidak pernah dicetak.

> ⚠️ Variabel `NEXT_PUBLIC_*` **dibundel saat build**. Mengubahnya setelah build tidak berpengaruh — ubah lalu **build ulang**. Ini terutama penting untuk `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true` dan `NEXT_PUBLIC_APP_URL`.
> Nama lama `MIDTRANS_IS_PRODUCTION` / `MIDTRANS_CLIENT_KEY` **tidak dibaca** aplikasi.

### Langkah 3 — Migrasi database

```bash
npm run db:migrate        # = prisma migrate deploy
```

- **Database kosong/baru**: cukup perintah di atas (membangun 24 tabel).
- **Database yang sudah ada** (mis. produksi Neon yang kolomnya kurang, `error=Callback` di login Google): perintah yang sama aman. Migrasi `20261107000000_sync_schema_drift` bersifat idempotent dan menambahkan tabel/kolom yang hilang (`User.twoFactor*`, `Coupon.isFeatured`, `AuditLog`, `PasswordReset`, dst.).
- **Database yang dibuat dengan `prisma db push`** (tidak punya tabel `_prisma_migrations`) akan ditolak dengan error `P3005`. Tandai migrasi lama sebagai sudah diterapkan, lalu deploy:

  ```bash
  for m in $(ls prisma/migrations | grep -E '^[0-9]' | grep -v sync_schema_drift); do
    npx prisma migrate resolve --applied "$m"
  done
  npm run db:migrate
  ```

- **Jangan pakai `prisma db push` di produksi.** Setiap perubahan `schema.prisma` wajib disertai migrasi (`npx prisma migrate dev --name <nama>` di lokal, commit folder migrasinya). CI akan gagal jika schema dan migrasi berbeda.

Verifikasi: `npx prisma migrate status` → *Database schema is up to date*.

### Langkah 4 — Build & jalankan

**A. Docker Compose (VPS)**

```bash
# .env berisi POSTGRES_PASSWORD, DATABASE_URL (host: db), dst.
docker compose up -d --build
docker compose logs -f migrate app
```

Service `migrate` menjalankan `prisma migrate deploy` otomatis sebelum `app` start. Aplikasi hanya listen di `127.0.0.1:3000`; ekspos ke publik lewat reverse proxy HTTPS (Langkah 8). Healthcheck container memakai `/api/health`.

**B. Vercel**

1. Import repo, framework Next.js.
2. Isi semua variabel (Production). `DATABASE_URL`/`DIRECT_URL` harus berformat `postgresql://…`; bila memakai integrasi Neon, **petakan** variabel `POSTGRES_*` bawaan integrasi ke `DATABASE_URL` (pooled) dan `DIRECT_URL` (unpooled).
3. Jalankan migrasi dari mesin Anda/CI terhadap database produksi (`npm run db:migrate`) — Vercel tidak menjalankannya otomatis.
4. Deploy. Setelah mengubah `NEXT_PUBLIC_*`, lakukan **Redeploy tanpa build cache**.
5. Pastikan domain produksi tidak diproteksi *Vercel Authentication/Require Log In* untuk publik.

### Langkah 5 — Admin pertama

Set sementara `ADMIN_EMAIL`, `ADMIN_PASSWORD` (kuat), `ADMIN_NAME`, lalu:

```bash
curl -X POST https://DOMAIN/api/admin/setup \
  -H 'Content-Type: application/json' \
  -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}'
```

(atau `npm run db:seed`). Endpoint hanya berhasil **sekali** (409 jika admin sudah ada). Setelah login admin berhasil, **hapus `ADMIN_PASSWORD` dari environment** dan aktifkan 2FA admin.

### Langkah 6 — Webhook Midtrans & pembayaran

Di dashboard Midtrans (**Settings → Configuration**):

- **Payment Notification URL**: `https://DOMAIN/api/payment/notification`
- Atur *Finish/Unfinish/Error redirect URL* ke halaman aplikasi sesuai domain Anda.
- Mode/kunci harus **production** dan konsisten dengan `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true` (lihat Langkah 2). Webhook memverifikasi `signature_key`; request tanpa signature valid ditolak.

Uji: buat 1 transaksi bernilai kecil, bayar, lalu pastikan status booking menjadi *paid* dan e-tiket/email terkirim.

### Langkah 7 — Cron (wajib)

Dua job harus berjalan: `/api/cron/expire-bookings` (mengedaluwarsakan booking belum dibayar) dan `/api/cron/reminders`. Keduanya menuntut `CRON_SECRET`; tanpa itu semua panggilan ditolak (401) dan **booking tak dibayar tidak akan pernah kedaluwarsa**.

- **Vercel**: `vercel.json` sudah berisi jadwal. Vercel memanggil dengan **GET** + header `Authorization: Bearer $CRON_SECRET` (otomatis bila `CRON_SECRET` diset). Cek di *Project → Cron Jobs → Logs* bahwa responsnya 200.
- **VPS**: tambahkan ke crontab:

  ```cron
  0 1 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://DOMAIN/api/cron/expire-bookings
  0 8 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://DOMAIN/api/cron/reminders
  ```
  (jam dalam UTC pada server; sesuaikan ke WIB bila perlu.)

### Langkah 8 — Reverse proxy & HTTPS (VPS)

Rate limit memakai IP klien dari `X-Forwarded-For`. Proxy **harus menimpa** header itu (bukan menambahkan) agar klien tidak bisa memalsukannya:

```nginx
server {
  listen 443 ssl http2;
  server_name DOMAIN;
  # ssl_certificate ... (Let's Encrypt / certbot)
  client_max_body_size 6m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;   # TIMPA, jangan $proxy_add_x_forwarded_for
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### Langkah 9 — Smoke test sebelum go-live

- [ ] `GET /api/health` → 200 (database terhubung; menandakan konfigurasi minimum)
- [ ] Daftar akun baru, login (email+password) dan **login Google**
- [ ] Reset password: email terkirim dari domain Anda
- [ ] Cari **pesawat / kereta / hotel / asuransi** → hasil tampil (memastikan IP sudah di-whitelist Orbisway)
- [ ] Booking + bayar nominal kecil → status *paid*, webhook masuk
- [ ] Booking tamu (tanpa login) dan *Find Booking*
- [ ] Admin: login, lihat booking/user, tambah promo, **upload banner** (memastikan Cloudinary)
- [ ] Cron: panggil manual `expire-bookings` dengan secret → 200
- [ ] Header keamanan/CSP aktif (cek DevTools → Network → dokumen)

---

## Variabel environment

Template lengkap: [`.env.example`](./.env.example). Ringkasan:

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | ✅ | PostgreSQL (pooled / langsung) |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` | ✅ | Origin publik `https://…`, samakan keduanya |
| `NEXTAUTH_SECRET` | ✅ | ≥ 32 karakter acak (`openssl rand -base64 48`) |
| `TICKET_VERIFY_SECRET` | disarankan | ≥ 32 byte; bila kosong memakai `NEXTAUTH_SECRET` |
| `ORBISWAY_BASE_URL/USER/PASSWORD/API_KEY` | ✅ | Kredensial supplier (IP harus di-whitelist) |
| `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | ✅ | Pasangan kunci sandbox **atau** production |
| `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION` | ✅ | `true` untuk live. **Build-time** |
| `CRON_SECRET` | ✅ | Otorisasi cron (≥ 32 karakter acak) |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | ✅ prod | Upload gambar; tanpa ini upload mengembalikan 503 |
| `REDIS_URL` | disarankan | `rediss://…`; bila kosong/bermasalah → rate limit in-memory |
| `RESEND_API_KEY`, `EMAIL_FROM` | ✅ prod | Email transaksional dari domain terverifikasi |
| `GOOGLE_CLIENT_ID/SECRET` | bila Google aktif | Isi berpasangan |
| `FONNTE_API_TOKEN`, `NEXT_PUBLIC_WHATSAPP_SUPPORT` | opsional | WhatsApp |
| `ADMIN_EMAIL/PASSWORD/NAME` | sementara | Hanya untuk bootstrap admin, lalu hapus password |
| `REFUND_AUTO_MAX` | opsional | Batas refund otomatis (Rp) |
| `ALLOWED_DEV_ORIGINS` | dev saja | Host tunnel ngrok dll. |

**Jangan pernah** commit `.env*` (sudah di-gitignore) atau menaruh kredensial di dokumen/issue.

---

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| Login Google: `error=Callback` | Kolom/tabel belum ada di DB produksi | `npm run db:migrate` (migrasi sinkronisasi) |
| `P3005 database schema is not empty` | DB dibuat via `db push` | Langkah 3: `migrate resolve --applied` |
| 404 di seluruh situs padahal build sukses | Guard salah tempat / cache build lama | `proxy.ts` harus di **root** project; redeploy **tanpa build cache** |
| Pembayaran masih sandbox di produksi | `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION` salah saat build | Set `true`, **build ulang**; `npm run check:env` |
| Cron tidak jalan / booking tak kedaluwarsa | `CRON_SECRET` kosong atau salah | Isi secret; cek log cron (harus 200) |
| Semua pencarian error / timeout dari Orbisway | IP keluar belum di-whitelist | Daftarkan IP server ke Orbisway |
| Hotel `4014` stale `price_code` | Harga kadaluarsa | Ulangi alur dari pencarian (sudah ada retry) |
| Hotel `4021` / `500` / `9952` | Gangguan vendor/cache Orbis | Retry otomatis untuk aksi baca; bila berulang hubungi Orbisway |
| Upload banner/cover → 503 | `CLOUDINARY_*` belum diisi | Isi tiga variabel Cloudinary |
| Login/booking terasa lambat saat Redis down | Timeout Redis (±0,5 dtk) lalu fallback memory | Perbaiki `REDIS_URL`; cek log `[RateLimit]` |
| Container `unhealthy` | `/api/health` 503: DB/konfigurasi | Lihat `docker compose logs app`, jalankan `check:env` |

---

## Operasional & pemeliharaan

- **Backup**: aktifkan backup otomatis + uji restore database. Booking & pembayaran adalah data keuangan.
- **Rotasi rahasia** bila pernah terekspos (lihat PRODUCTION-HANDOFF.md). Mengganti `NEXTAUTH_SECRET` mengeluarkan semua sesi; mengganti `TICKET_VERIFY_SECRET` membatalkan QR tiket lama.
- **Pemantauan**: pantau 5xx, kegagalan webhook Midtrans, kegagalan cron, dan kuota/error Orbisway.
- **Dependency**: jalankan `npm audit --omit=dev` berkala. Diketahui: `prisma` 6→7 (major) dan `xlsx` (hanya dipakai menulis ekspor, bukan membaca file pengguna) ditunda.
- **Perubahan schema**: selalu lewat migrasi (lihat Langkah 3).

---

## Scripts, halaman, API

| Command | Fungsi |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Build / jalankan produksi |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (0 error; warning = backlog teknis) |
| `npm test` | Unit test (`node --test` + tsx) |
| `npm run check:env` | Validasi konfigurasi environment |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | Seed admin awal |

Halaman utama: `/` (landing), `/login`, `/register`, `/find-booking`, `/flight|hotel|train|insurance/search` & `/checkout`, `/bookings`, `/refunds`, `/wallet`, `/admin/*`.

API utama: `/api/{flight,hotel,train,insurance}/{search,book}`, `/api/payment/notification` (webhook Midtrans), `/api/booking/find`, `/api/cron/*`, `/api/admin/*`, `/api/health`.
