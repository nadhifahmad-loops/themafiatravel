import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateTwoFactorSetupData, hashBackupCode, verifyTwoFactorBackupCode, verifyTwoFactorCode } from '@/lib/two-factor';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
  }

  // Rate limit per user + IP — cegah brute force kode TOTP (enable/disable) dan spam setup.
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`twofa:${user.id}:${ip}`, 'auth');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Permintaan tidak valid' }, { status: 400 });
  }

  const requestBody = body as { action?: unknown; code?: unknown };
  const action = requestBody.action ?? 'setup';
  const code = typeof requestBody.code === 'string' ? requestBody.code.trim() : '';

  if (action === 'setup') {
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: '2FA sudah aktif. Nonaktifkan 2FA sebelum menyiapkan ulang.' },
        { status: 409 }
      );
    }

    const setup = await generateTwoFactorSetupData(user.email, 'The Mafia Travel');
    const updated = await prisma.user.updateMany({
      where: { id: user.id, twoFactorEnabled: false },
      data: {
        twoFactorSecret: setup.secret,
        twoFactorBackupCodes: setup.backupCodes.map(hashBackupCode),
      },
    });

    if (!updated.count) {
      return NextResponse.json(
        { success: false, error: '2FA baru saja diaktifkan. Muat ulang halaman sebelum melanjutkan.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, data: setup });
  }

  if (action === 'enable') {
    if (user.twoFactorEnabled) {
      return NextResponse.json({ success: false, error: '2FA sudah aktif' }, { status: 409 });
    }
    if (!user.twoFactorSecret) {
      return NextResponse.json({ success: false, error: 'Setup 2FA belum dimulai' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(code) || !verifyTwoFactorCode(user.twoFactorSecret, code)) {
      return NextResponse.json({ success: false, error: 'Kode 2FA tidak valid' }, { status: 400 });
    }

    const enabled = await prisma.user.updateMany({
      where: { id: user.id, twoFactorEnabled: false, twoFactorSecret: user.twoFactorSecret },
      data: { twoFactorEnabled: true },
    });

    if (!enabled.count) {
      return NextResponse.json(
        { success: false, error: 'Setup 2FA berubah. Muat ulang halaman dan coba lagi.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, message: '2FA berhasil diaktifkan' });
  }

  if (action === 'disable') {
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ success: false, error: '2FA tidak sedang aktif' }, { status: 400 });
    }

    const backupCodes = Array.isArray(user.twoFactorBackupCodes)
      ? user.twoFactorBackupCodes.filter((value): value is string => typeof value === 'string')
      : [];
    const validBackupCode = verifyTwoFactorBackupCode(backupCodes, code);
    if (!verifyTwoFactorCode(user.twoFactorSecret, code) && !validBackupCode) {
      return NextResponse.json(
        { success: false, error: 'Kode authenticator atau backup code tidak valid' },
        { status: 400 }
      );
    }

    const disabled = await prisma.user.updateMany({
      where: { id: user.id, twoFactorEnabled: true, twoFactorSecret: user.twoFactorSecret },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: Prisma.DbNull,
      },
    });

    if (!disabled.count) {
      return NextResponse.json(
        { success: false, error: 'Status 2FA berubah. Muat ulang halaman sebelum mencoba lagi.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, message: '2FA berhasil dinonaktifkan' });
  }

  return NextResponse.json({ success: false, error: 'Aksi tidak valid' }, { status: 400 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      enabled: user.twoFactorEnabled,
      configured: Boolean(user.twoFactorSecret),
      // Jangan pernah kirim backupCodes ke client — kode hanya ditampilkan
      // sekali saat generate/enable. Di sini cukup count untuk UI.
      backupCodesCount: Array.isArray(user.twoFactorBackupCodes) ? user.twoFactorBackupCodes.length : 0,
    },
  });
}
