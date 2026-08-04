import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { randomInt, createHash } from 'node:crypto';

export interface TwoFactorSetupData {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export function generateTwoFactorSecret() {
  return generateSecret();
}

export async function generateTwoFactorSetupData(email: string, issuer = 'The Mafia Travel'): Promise<TwoFactorSetupData> {
  const secret = generateTwoFactorSecret();
  const otpauthUrl = generateURI({ issuer, label: email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return {
    secret,
    otpauthUrl,
    qrCodeDataUrl,
    backupCodes: generateBackupCodes(),
  };
}

export function generateBackupCodes(count = 8) {
  const codes: string[] = [];
  const seen = new Set<string>();
  while (seen.size < count) {
    const num = randomInt(10_000_000, 100_000_000);
    const code = `${num}`;
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }
  return codes;
}

export function verifyTwoFactorCode(secret: string, code: string) {
  if (!secret || !code) return false;
  try {
    return verifySync({ token: code.replace(/\s+/g, ''), secret }).valid;
  } catch {
    return false;
  }
}

// Backup codes disimpan at-rest sebagai SHA-256, bukan plaintext. Kode mentah
// hanya pernah dikirim ke client SATU KALI saat generate (setup/enable).
export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

// Verifikasi mendukung dua format: hash SHA-256 (format baru) dan plaintext
// legacy (data lama yang belum di-migrasi).
export function verifyTwoFactorBackupCode(backupCodes: string[] | null | undefined, code: string) {
  if (!backupCodes || !code) return false;
  const normalized = String(code).replace(/\s+/g, '');
  if (!normalized) return false;
  const hash = hashBackupCode(normalized);
  return backupCodes.some((entry) => entry === normalized || entry === hash);
}

// Hapus kode yang terpakai (baik entry hash maupun plaintext legacy).
export function consumeBackupCode(backupCodes: string[] | null | undefined, code: string): string[] {
  const normalized = String(code).replace(/\s+/g, '');
  const hash = hashBackupCode(normalized);
  return (backupCodes ?? []).filter((entry) => entry !== normalized && entry !== hash);
}
