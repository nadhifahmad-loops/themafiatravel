# Production handoff — The Mafia Travel

Status audit per **7 November 2026**. Panduan langkah deploy ada di [README.md](./README.md).

## Hasil verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `npm ci` (lock file sinkron) | Lolos (sebelumnya gagal: `bootstrap` tak terpakai) |
| `tsc --noEmit` | Lolos |
| Unit test | Lolos (termasuk test rate limiter & signature upload) |
| `next build` | Lolos |
| ESLint | 0 error; ±440 warning = backlog teknis (lihat bawah) |
| Migrasi dari database kosong (PostgreSQL 16) | 24 tabel, **tanpa selisih** dengan `schema.prisma`; aman dijalankan 2×; hapus user ber-booking berhasil |
| `npm audit --omit=dev` | 4 temuan, 0 critical (sebelumnya 15, 3 critical) |
| Build Docker, uji integrasi Orbisway/Midtrans live, uji Cloudinary | **Belum dijalankan** (lingkungan audit tidak punya Docker/akses supplier) — CI dan smoke test README yang membuktikannya |

## Temuan dan perbaikan dalam audit ini

| Prioritas | Temuan | Status |
|---|---|---|
| Kritis | Migrasi tidak lengkap: 11 tabel + banyak kolom hanya ada di `schema.prisma` (penyebab `error=Callback` login Google di produksi). `migrate deploy` di DB baru menghasilkan aplikasi rusak | **Diperbaiki**: migrasi `20261107000000_sync_schema_drift` (idempotent) + CI memeriksa drift |
| Tinggi | Cron Vercel memanggil **GET**, route hanya mengekspor POST → selalu 405; booking tak dibayar tak pernah kedaluwarsa | **Diperbaiki** (GET ditambahkan; otorisasi tetap `CRON_SECRET`) |
| Tinggi | Rate limiter fail-closed: Redis error menolak semua login/search/booking | **Diperbaiki** (fallback in-memory + timeout cepat) |
| Tinggi | Upload gambar ke `public/uploads` tidak berfungsi di Vercel/Docker | **Diperbaiki** (Cloudinary; 503 jelas bila belum dikonfigurasi). **Belum diuji ke akun Cloudinary** |
| Tinggi | `next@16.2.4` rentan (termasuk XSS pada CSP nonce) | **Diperbaiki** (16.4.5 + patch dependency lain) |
| Sedang | `Booking.userId` masih NOT NULL → hapus akun ber-booking gagal | **Diperbaiki** di migrasi |
| Sedang | 6 route flight anonim memanggil supplier tanpa rate limit | **Diperbaiki** (per IP) |
| Sedang | Dockerfile: `npm ci` tanpa schema Prisma (postinstall) & tanpa `openssl` Alpine; tanpa langkah migrasi/healthcheck | **Diperbaiki** (belum dijalankan di sini; CI membangunnya) |
| Rendah | Perbandingan kredensial `admin/setup` tidak constant-time; domain ngrok pribadi di `next.config.ts`; paket `@neon/*` & file sampah | **Diperbaiki** |
| Info | README menyebut `middleware.ts` (yang benar `proxy.ts`); dokumen lama menyatakan CI sudah ada padahal tidak ada | **Diperbaiki** (README ditulis ulang, CI ditambahkan) |

## Risiko yang masih terbuka

1. **Rotasi kredensial (kritis, tindakan manusia).** Dokumen audit sebelumnya mencatat `env.md` lama pernah memuat kredensial asli di riwayat Git. Zip yang diaudit tidak punya `.git`, jadi tidak bisa diverifikasi. Jika benar: rotasi database, Orbisway, Midtrans, Resend, Fonnte, Redis, Google OAuth secret, `NEXTAUTH_SECRET`, dan password admin; bersihkan riwayat atau buat repo baru sebelum dibagikan. Folder `.env` lokal juga berisi kredensial asli — jangan ikut di-push/dikirim.
2. **Sesi supplier global.** `lib/orbis.ts` memakai satu signature login Orbisway untuk semua pelanggan. Bila alur penerbangan Orbis menyimpan state per signature (sell → kontak → kursi → book), pelanggan bersamaan dapat saling mengganggu. **Konfirmasi ke Orbisway** apakah state terikat signature dan apakah concurrent booking aman; uji dengan 2 transaksi paralel di staging.
3. **IP whitelist Orbisway.** Lihat README Langkah 0; Vercel tanpa IP statis tidak cocok.
4. **Backlog lint (bukan bug runtime):** `no-explicit-any` (±330, respons Orbis belum bertipe) dan aturan React Compiler (`set-state-in-effect`, `refs`, `purity`) dijadikan *warning*. Kurangi bertahap dengan menambah tipe dan menguji UI.
5. **Dependency:** `prisma` 6→7 (major, perlu pengujian terpisah); `xlsx` tanpa versi perbaikan di npm — hanya dipakai menulis ekspor.
6. **Redis** disarankan di produksi; tanpa itu rate limit per-instance.
7. **`/api/health` dangkal**: memeriksa database dan keberadaan konfigurasi, bukan ketersediaan Orbisway/Midtrans.
8. **Webhook Midtrans** memverifikasi signature, tetapi tidak membandingkan `gross_amount` dengan total booking (nilainya berasal dari transaksi yang dibuat server sendiri). Pertimbangkan pengecekan tambahan bila ada diskon/markup yang dihitung di luar Snap.

## Checklist go-live

- [ ] Kredensial dirotasi dan tidak ada rahasia di repo/riwayat
- [ ] `NODE_ENV=production npm run check:env` → 0 error
- [ ] `prisma migrate status` → up to date
- [ ] Midtrans mode **production** (kunci + `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true` saat build) dan Notification URL terpasang
- [ ] IP server terdaftar di Orbisway; pencarian keempat modul berhasil
- [ ] `CRON_SECRET` terisi; kedua cron mengembalikan 200
- [ ] `EMAIL_FROM` domain terverifikasi; `CLOUDINARY_*` terisi
- [ ] Admin dibuat, `ADMIN_PASSWORD` dihapus dari environment
- [ ] Smoke test README (Langkah 9) lulus, termasuk 1 pembayaran nyata nominal kecil
- [ ] Backup database aktif dan restore pernah diuji
