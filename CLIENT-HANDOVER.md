# The Mafia Travel — Dokumen Serah Terima Projek

**Untuk:** Klien / Pemilik Projek
**Isi:** Narasi presentasi, panduan akses (termasuk halaman admin), tur fitur, checklist uji terima, dan persiapan go-live.

---

## 1. Narasi Pembuka

> Berikut paragraf yang bisa dibacakan saat serah terima (meeting maupun kiriman pesan):

"The Mafia Travel adalah platform pemesanan perjalanan online yang sudah jadi dan siap diuji: pelanggan bisa mencari dan memesan **tiket pesawat, kereta, hotel, dan asuransi perjalanan** dalam satu situs, membayar secara online lewat **Midtrans**, dan langsung mendapatkan e-tiket yang bisa diakses kapan saja di halaman pesanan saya. Semua data disimpan aman di database, dan pelanggan bisa masuk dengan email maupun akun Google.

Di sisi pengelola, tersedia **panel admin terpisah** khusus akun berstatus admin — bukan bagian dari login pelanggan. Lewat panel ini Anda bisa memantau ringkasan bisnis, memproses pesanan, mengelola antrian refund, melihat log pembayaran, laporan keuangan, mengelola pengguna, membuat promo dan kupon, mengelola konten blog dan lowongan karier, serta mengatur markup harga — semuanya lewat satu halaman login.

Yang kami serahkan hari ini adalah seluruh source code projek beserta dokumentasi teknisnya. Dokumen ini berisi panduan langkah demi langkah untuk mulai memakai sistem, dimulai dari cara masuk ke halaman admin."

---

## 2. Gambaran Platform

| Aspek | Keterangan |
|---|---|
| Produk | Pemesanan **pesawat, kereta, hotel, asuransi perjalanan** |
| Alur | Cari → pilih → checkout → bayar (Midtrans Snap) → e-tiket otomatis |
| Login pelanggan | Email + password, atau **Google**; opsional **2FA (TOTP)** dan verifikasi **OTP telepon via WhatsApp** |
| Bahasa | **Indonesia & Inggris** (bisa diganti pelanggan di pengaturan akun) |
| Tampilan | Responsive: desktop, tablet, dan ponsel |
| Teknologi | Next.js 16 (App Router), TypeScript, Tailwind CSS, PostgreSQL + Prisma |
| Pembayaran | Midtrans Snap (kanal mengikuti pengaturan akun Midtrans Anda: virtual account, QRIS, kartu, dll.) |
| Supplier | Orbisway (pesawat, kereta, hotel, asuransi) |

**Tiga area situs:**

1. **Situs publik** — halaman depan (`/`), pencarian, promo/diskon, blog, bantuan, karier, partner, tentang kami, syarat & ketentuan, privasi, serta **cari pesanan tanpa login** (`/find-booking`).
2. **Area pelanggan** — daftar/login, proses pemesanan sampai e-tiket, kelola pesanan (batal/refund/reschedule, ulasan), favorit & koleksi, **penumpang tersimpan** (otomatis terisi saat checkout), dan pengaturan akun (nama, tanggal lahir, nomor telepon, password, 2FA, bahasa).
3. **Area admin** — panel pengelola di `/admin` (login terpisah, lihat bagian 4).

---

## 3. Cara Masuk ke Halaman Admin

> ⚠️ **Penting:** Halaman admin menggunakan **login terpisah** dari pelanggan. Akun pelanggan biasa **tidak akan bisa** masuk ke `/admin` — sistem akan mengembalikannya ke halaman login admin dengan pesan *Unauthorized*.

### 3.1 Alamat halaman login admin

| Lingkungan | URL |
|---|---|
| Lokal (server dev) | `http://localhost:3000/admin/login` |
| Produksi | `https://DOMAIN-ANDA/admin/login` |

### 3.2 Kredensial

- **Email & password admin** dibuat saat inisialisasi dari variabel `ADMIN_EMAIL` dan `ADMIN_PASSWORD`, dan nilai yang berlaku ada di file `.env` proyek.
- Kirim kredensial ke klien **lewat channel aman** (password manager / pesan privat) — **jangan** cantumkan di dokumen, email biasa, atau chat kelompok.
- Jika akun admin belum ada sama sekali (database baru), tim teknis menjalankan sekali:
  - `npm run db:seed`, atau
  - `POST /api/admin/setup` (endpoint hanya berhasil satu kali; selanjutnya menolak dengan 409).

### 3.3 Langkah login

1. Buka **`/admin/login`** (lihat tabel 3.1).
2. Isi **email** dan **password** admin → klik tombol masuk.
3. **Jika 2FA aktif** untuk akun tersebut: masukkan **kode 6 digit** dari aplikasi authenticator (Google Authenticator / Microsoft Authenticator / 1Password) yang muncul di layar kedua.
4. Berhasil → otomatis diarahkan ke **Dashboard** (`/admin/dashboard`).

Catatan tambahan:
- Admin yang **sudah login** dan membuka lagi `/admin/login` akan langsung dilempar ke dashboard (tanpa perlu login ulang).
- Setelah **login pertama berhasil**, sebaiknya: **ganti password** ke yang kuat, **aktifkan 2FA** dari profil admin, lalu **hapus `ADMIN_PASSWORD`** dari environment (sesuai prosedur keamanan di `README.md`).

---

## 4. Tur Menu Admin

Setelah masuk, menu ada di sidebar kiri (bisa dilipat). Strukturnya:

| Kelompok | Menu | URL | Fungsi singkat |
|---|---|---|---|
| **Menu Utama** | Dashboard | `/admin/dashboard` | Ringkasan statistik & aktivitas terbaru |
| **Pesanan & Transaksi** | Manajemen Pesanan | `/admin/bookings` | Lihat & proses pesanan (detail per pesanan di `/admin/bookings/[id]`) |
| | Antrian Refund | `/admin/refund-queue` | Proses permintaan refund pelanggan |
| | Log Pembayaran | `/admin/payments` | Riwayat transaksi pembayaran |
| | Laporan Keuangan | `/admin/finance` | Rekap keuangan |
| **Pengguna** | Manajemen User | `/admin/users` | Lihat & kelola akun pelanggan |
| **Promosi & Konten** | Manajemen Promo | `/admin/promos` | Buat & atur promo/banner |
| | Manajemen Kupon | `/admin/coupons` | Buat & atur kode kupon |
| | Manajemen Karier | `/admin/careers` | Kelola lowongan & lamaran |
| | Manajemen Blog | `/admin/blog` | Tulis & terbitkan artikel |
| **Pengaturan** | Pengaturan Markup | `/admin/settings` | Atur markup/harga jual |
| | Audit Log | `/admin/audit-logs` | Jejak aktivitas penting di sistem |
| *(profil)* | Profil Admin | `/admin/profile` | Data diri, password, & 2FA akun admin |

**Urutan yang disarankan untuk demo ke klien:** Dashboard → Manajemen Pesanan → Antrian Refund → Log Pembayaran → Laporan Keuangan → Manajemen User → Promo & Kupon → Blog & Karier → Pengaturan Markup → Audit Log.

---

## 5. Panduan Singkat Area Pelanggan

Berguna saat mendemokan sisi pengguna:

1. **Daftar** di `/register` (atau langsung **masuk dengan Google** di `/login`).
2. **Cari** produk: `/flight/search`, `/train/search`, `/hotel/search`, atau `/insurance/search`.
3. **Checkout** → pilih penumpang (data dari **Penumpang Tersimpan** otomatis terisi) → pilih metode pembayaran → bayar lewat halaman Midtrans.
4. **E-tiket** muncul di **Pesanan Saya** (`/bookings`); detail, batal, refund/reschedule, dan ulasan juga di sana.
5. **Kelola akun** di `/account`: nama, tanggal lahir, nomor telepon (verifikasi OTP WhatsApp), password, 2FA, dan bahasa.
6. **Tanpa login**: pelanggan lama bisa cek pesanan lewat **`/find-booking`** (nomor pesanan + email/nomor HP pemesan).

---

## 6. Checklist Uji Terima (Acceptance)

Centang bersama klien saat serah terima:

**Situs & pencarian**
- [ ] Halaman depan terbuka, tampil rapi di desktop dan ponsel
- [ ] Pencarian **pesawat, kereta, hotel, asuransi** mengembalikan hasil (artinya koneksi supplier aktif)
- [ ] Ganti bahasa Indonesia ↔ Inggris berfungsi

**Pelanggan**
- [ ] Daftar akun baru, login email+password, dan login **Google**
- [ ] Lupa password → email reset terkirim
- [ ] Booking uji + pembayaran nominal kecil → status **lunas**, e-tiket muncul di Pesanan Saya
- [ ] Batalkan/refund satu booking uji → terlihat di Antrian Refund **di panel admin**
- [ ] Simpan penumpang & favorit berfungsi; pengaturan akun (nama/tanggal lahir/telepon/2FA) tersimpan

**Admin**
- [ ] Masuk lewat **`/admin/login`** dengan akun admin
- [ ] Akun pelanggan biasa **ditolak** membuka `/admin`
- [ ] Booking uji tampil di Manajemen Pesanan; refund masuk ke Antrian Refund
- [ ] Membuat promo/kupon baru → langsung terlihat di situs pelanggan
- [ ] Upload banner/cover gambar berhasil (Cloudinary aktif)
- [ ] Audit Log mencatat aktivitas penting

---

## 7. Persiapan Go-Live (untuk Klien)

Sebelum situs dipakai publik, pihak klien perlu menyiapkan:

1. **Domain + hosting.** Untuk produksi disarankan **VPS dengan IP keluar tetap**, karena supplier Orbisway membatasi akses API berdasarkan **whitelist IP** (di Vercel, IP keluar dinamis kecuali paket IP statis berbayar).
2. **Akun supplier Orbisway produksi** + pendaftaran IP server ke Orbisway.
3. **Akun Midtrans production** (Server Key & Client Key) + penyetelan **Payment Notification URL** = `https://DOMAIN/api/payment/notification`.
4. **Google OAuth client** (untuk login Google) dengan redirect URI `https://DOMAIN/api/auth/callback/google`.
5. **Cloudinary** (upload gambar), **Resend** (email dari domain terverifikasi), **Redis** (rate limit), dan **`CRON_SECRET`** untuk cron booking & pengingat.
6. **Backup database otomatis** + uji restore — data pesanan adalah data keuangan.
7. **Keamanan akun admin**: password kuat, 2FA aktif, `ADMIN_PASSWORD` dihapus dari environment.

> Panduan teknis lengkap (variabel environment, migrasi, Docker/Vercel, nginx, cron, troubleshooting) ada di **`README.md`**; daftar audit & risiko ada di **`PRODUCTION-HANDOFF.md`**. Kedua dokumen ditujukan untuk tim IT yang men-deploy.

---

## 8. Catatan Keamanan

- **Jangan pernah** commit file `.env` (sudah di-gitignore) atau menyebarkan kredensial di dokumen/issue/chat publik.
- Kredensial rahasia dikirim lewat **password manager** atau pesan privat, bukan email biasa/grup.
- Ganti `NEXTAUTH_SECRET` bila pernah terekspos (efek samping: semua sesi pelanggan keluar).
- Pantau menu **Audit Log** secara berkala untuk aktivitas mencurigakan.

---

## 9. Lampiran: Perintah & Dokumen Penting

**Perintah (dijalankan tim teknis):**

| Perintah | Fungsi |
|---|---|
| `npm ci` | Install dependensi |
| `npm run dev` | Server lokal → `http://localhost:3000` |
| `npm run build` / `npm start` | Build & jalankan versi produksi |
| `npm run check:env` | Validasi konfigurasi environment |
| `npm run db:migrate` | Jalankan semua migrasi database |
| `npm run db:seed` | Buat/refresh akun admin awal |
| `npm run typecheck && npm run lint && npm test` | Pemeriksaan mutu kode |

**Dokumen referensi:**

| Dokumen | Isi |
|---|---|
| `README.md` | Panduan utama: lokal, integrasi, deploy produksi, variabel environment, troubleshooting |
| `PRODUCTION-HANDOFF.md` | Status audit & daftar risiko |
| `CLIENT-HANDOVER.md` | Dokumen ini (narasi serah terima untuk klien) |

---

*Seri terakhir yang diselesaikan sebelum serah terima: penumpang tersimpan untuk checkout (pesawat/kereta), halaman akun yang dirapikan (edit profil lewat popup — nama, tanggal lahir, telepon OTP), dan perbaikan popup konfirmasi keluar yang kini selalu tampil di lapisan terdepan di semua halaman.*
