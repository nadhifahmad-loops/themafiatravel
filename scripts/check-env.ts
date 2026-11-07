/**
 * Pemeriksa konfigurasi environment sebelum deploy.
 *
 *   npm run check:env              -> periksa env saat ini (+ .env.local / .env jika ada)
 *   NODE_ENV=production npm run check:env   -> aturan produksi (lebih ketat)
 *
 * Tidak pernah mencetak nilai rahasia. Exit code 1 jika ada ERROR.
 */
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (existsSync(f)) {
    try {
      (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(f);
    } catch {
      /* abaikan file yang tidak bisa dibaca */
    }
  }
}

const env = process.env;
const isProd = env.NODE_ENV === 'production';
type Level = 'ERROR' | 'WARN' | 'OK';
const results: { level: Level; msg: string }[] = [];
const add = (level: Level, msg: string) => results.push({ level, msg });

const has = (k: string) => Boolean(env[k] && env[k]!.trim() !== '');
const need = (k: string, why: string) =>
  has(k) ? add('OK', `${k} terisi`) : add('ERROR', `${k} kosong — ${why}`);

// ── Wajib selalu ──────────────────────────────────────────────────────────
need('DATABASE_URL', 'koneksi PostgreSQL aplikasi');
need('DIRECT_URL', 'koneksi langsung untuk `prisma migrate deploy`');
need('NEXTAUTH_URL', 'origin publik aplikasi');
need('NEXT_PUBLIC_APP_URL', 'dipakai callback pembayaran, link reset password, verifikasi tiket');
need('NEXTAUTH_SECRET', 'penandatangan sesi JWT');

for (const k of ['DATABASE_URL', 'DIRECT_URL']) {
  if (has(k) && !/^postgres(ql)?:\/\//.test(env[k]!)) {
    add('ERROR', `${k} harus diawali postgresql:// (cek karakter khusus di password perlu di-URL-encode)`);
  }
}
if (has('NEXTAUTH_SECRET') && env.NEXTAUTH_SECRET!.length < 32) {
  add('ERROR', 'NEXTAUTH_SECRET terlalu pendek (minimal 32 karakter acak)');
}

// ── Origin ────────────────────────────────────────────────────────────────
for (const k of ['NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL']) {
  const v = env[k];
  if (!v) continue;
  try {
    const u = new URL(v);
    if (isProd && u.protocol !== 'https:') add('ERROR', `${k} harus https:// di produksi`);
    if (isProd && /localhost|127\.0\.0\.1|ngrok/.test(u.hostname)) add('ERROR', `${k} masih mengarah ke host lokal/tunnel`);
    if (v.endsWith('/')) add('WARN', `${k} sebaiknya tanpa garis miring di akhir`);
  } catch {
    add('ERROR', `${k} bukan URL yang valid`);
  }
}
if (has('NEXTAUTH_URL') && has('NEXT_PUBLIC_APP_URL') && env.NEXTAUTH_URL!.replace(/\/$/, '') !== env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, '')) {
  add('WARN', 'NEXTAUTH_URL dan NEXT_PUBLIC_APP_URL berbeda — samakan agar login & callback konsisten');
}

// ── Orbisway ──────────────────────────────────────────────────────────────
for (const k of ['ORBISWAY_BASE_URL', 'ORBISWAY_USER', 'ORBISWAY_PASSWORD', 'ORBISWAY_API_KEY']) {
  need(k, 'kredensial supplier Orbisway');
}

// ── Midtrans: mode harus sinkron dengan kunci ─────────────────────────────
need('MIDTRANS_SERVER_KEY', 'kunci server Midtrans');
need('NEXT_PUBLIC_MIDTRANS_CLIENT_KEY', 'kunci client Snap');
const live = env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
if (!has('NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION')) {
  add('WARN', 'NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION tidak diset — dianggap sandbox (false). Nilai ini dibundel saat BUILD.');
}
for (const legacy of ['MIDTRANS_IS_PRODUCTION', 'MIDTRANS_CLIENT_KEY']) {
  if (has(legacy)) add('WARN', `${legacy} adalah nama lama dan TIDAK dibaca aplikasi; gunakan NEXT_PUBLIC_${legacy}`);
}
const sk = env.MIDTRANS_SERVER_KEY ?? '';
const ck = env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? '';
if (sk && ck) {
  const skSandbox = sk.startsWith('SB-');
  const ckSandbox = ck.startsWith('SB-');
  if (skSandbox !== ckSandbox) add('ERROR', 'MIDTRANS server key dan client key berasal dari mode berbeda (sandbox vs production)');
  if (live && skSandbox) add('ERROR', 'Mode production aktif tetapi kunci Midtrans adalah SANDBOX (SB-)');
  if (!live && !skSandbox) add('ERROR', 'Mode sandbox aktif tetapi kunci Midtrans adalah PRODUCTION — set NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true lalu BUILD ULANG');
}
if (isProd && !live) add('WARN', 'NODE_ENV=production tetapi Midtrans masih sandbox — pembayaran tidak nyata');

// ── Rahasia lain ──────────────────────────────────────────────────────────
if (has('TICKET_VERIFY_SECRET') && Buffer.byteLength(env.TICKET_VERIFY_SECRET!) < 32) {
  add('ERROR', 'TICKET_VERIFY_SECRET kurang dari 32 byte');
} else if (!has('TICKET_VERIFY_SECRET')) {
  add(isProd ? 'WARN' : 'OK', 'TICKET_VERIFY_SECRET kosong — memakai NEXTAUTH_SECRET (ganti NEXTAUTH_SECRET akan membatalkan verifikasi tiket lama)');
}
if (!has('CRON_SECRET')) {
  add(isProd ? 'ERROR' : 'WARN', 'CRON_SECRET kosong — /api/cron/* menolak semua request, booking tak dibayar TIDAK akan kedaluwarsa & reminder tidak terkirim');
} else if (env.CRON_SECRET!.length < 24) {
  add('WARN', 'CRON_SECRET pendek; gunakan string acak ≥ 32 karakter');
}

// ── Redis (rate limit bersama) ────────────────────────────────────────────
if (!has('REDIS_URL')) {
  add(isProd ? 'WARN' : 'OK', 'REDIS_URL kosong — rate limit hanya per-instance (in-memory)');
} else {
  try {
    const u = new URL(env.REDIS_URL!);
    if (!['redis:', 'rediss:'].includes(u.protocol)) add('ERROR', 'REDIS_URL harus diawali redis:// atau rediss:// (Upstash/Redis Cloud memakai rediss://)');
    else if (!u.hostname) add('ERROR', 'REDIS_URL tidak punya host');
    else add('OK', 'REDIS_URL format valid');
  } catch {
    add('ERROR', 'REDIS_URL bukan URL valid (cek tanda kutip/spasi/karakter khusus pada password)');
  }
}

// ── Email, OAuth, upload ──────────────────────────────────────────────────
if (has('RESEND_API_KEY')) {
  if (!has('EMAIL_FROM')) add(isProd ? 'ERROR' : 'WARN', 'RESEND_API_KEY terisi tetapi EMAIL_FROM kosong (produksi wajib domain pengirim terverifikasi)');
  else if (/resend\.dev/.test(env.EMAIL_FROM!)) add('ERROR', 'EMAIL_FROM memakai resend.dev (hanya untuk uji coba)');
} else {
  add('WARN', 'RESEND_API_KEY kosong — email (reset password, e-tiket) tidak terkirim');
}
if (has('GOOGLE_CLIENT_ID') !== has('GOOGLE_CLIENT_SECRET')) add('ERROR', 'GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET harus diisi berpasangan');
if (!has('GOOGLE_CLIENT_ID')) add('WARN', 'Google OAuth belum dikonfigurasi');
const cloud = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].filter(has).length;
if (cloud !== 0 && cloud !== 3) add('ERROR', 'CLOUDINARY_* harus diisi lengkap (CLOUD_NAME, API_KEY, API_SECRET)');
if (cloud === 0) add(isProd ? 'ERROR' : 'WARN', 'CLOUDINARY_* kosong — upload banner/cover koleksi tidak berfungsi di produksi');
if (isProd && has('ADMIN_PASSWORD')) add('WARN', 'ADMIN_EMAIL/ADMIN_PASSWORD masih ada — hapus setelah admin pertama dibuat');

// ── Output ────────────────────────────────────────────────────────────────
const order: Level[] = ['ERROR', 'WARN', 'OK'];
for (const lvl of order) {
  for (const r of results.filter((x) => x.level === lvl)) {
    if (lvl === 'OK') continue;
    console.log(`${lvl === 'ERROR' ? '✖ ERROR' : '⚠ WARN '}  ${r.msg}`);
  }
}
const errors = results.filter((r) => r.level === 'ERROR').length;
const warns = results.filter((r) => r.level === 'WARN').length;
console.log(`\nMode: ${isProd ? 'production' : 'non-production'} | ${errors} error, ${warns} peringatan`);
process.exit(errors > 0 ? 1 : 0);
