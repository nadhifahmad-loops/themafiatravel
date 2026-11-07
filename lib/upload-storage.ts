import crypto from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Penyimpanan gambar upload (banner admin, cover koleksi member).
 *
 * Produksi: file disimpan di Cloudinary (set CLOUDINARY_CLOUD_NAME,
 * CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Disk lokal TIDAK bisa dipakai di
 * produksi: Vercel read-only, container Docker ephemeral, dan Next.js tidak
 * melayani file baru di `public/` yang muncul setelah build.
 *
 * Development: tanpa konfigurasi Cloudinary, file ditulis ke `public/uploads`.
 */

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Penyimpanan upload belum dikonfigurasi (CLOUDINARY_* belum diisi).');
    this.name = 'StorageNotConfiguredError';
  }
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

/** Signature upload Cloudinary: SHA-1 dari parameter terurut + API secret. */
export function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

/** Simpan gambar dan kembalikan URL yang bisa disimpan di database. */
export async function saveUploadedImage(file: File, folder: 'banners' | 'collections'): Promise<string> {
  const cfg = cloudinaryConfig();

  if (cfg) {
    const timestamp = Math.floor(Date.now() / 1000);
    const cloudFolder = `mafia-travel/${folder}`;
    const signature = signCloudinaryParams({ folder: cloudFolder, timestamp }, cfg.apiSecret);

    const body = new FormData();
    body.append('file', file);
    body.append('api_key', cfg.apiKey);
    body.append('timestamp', String(timestamp));
    body.append('folder', cloudFolder);
    body.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
      method: 'POST',
      body,
    });
    const data = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !data.secure_url) {
      throw new Error(`Upload Cloudinary gagal (${res.status}): ${data.error?.message ?? 'tanpa detail'}`);
    }
    return data.secure_url;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new StorageNotConfiguredError();
  }

  // Development saja: tulis ke public/uploads.
  const ext = MIME_EXT[file.type] ?? 'jpg';
  const filename = `${folder === 'banners' ? 'banner' : 'cover'}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${folder}/${filename}`;
}
