import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateTwoFactorSetupData, verifyTwoFactorCode, hashBackupCode } from '@/lib/two-factor';
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

  const body = await request.json().catch(() => ({}));
  const action = body?.action ?? 'setup';
  const code = body?.code ?? '';

  if (action === 'setup') {
    const setup = await generateTwoFactorSetupData(user.email, 'The Mafia Travel');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: setup.secret,
        twoFactorEnabled: false,
        twoFactorBackupCodes: setup.backupCodes.map(hashBackupCode),
      },
    });

    return NextResponse.json({ success: true, data: setup });
  }

  if (action === 'enable') {
    if (!user.twoFactorSecret) {
      return NextResponse.json({ success: false, error: 'Setup 2FA belum dimulai' }, { status: 400 });
    }

    if (!verifyTwoFactorCode(user.twoFactorSecret, code)) {
      return NextResponse.json({ success: false, error: 'Kode 2FA tidak valid' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    return NextResponse.json({ success: true, message: '2FA berhasil diaktifkan' });
  }

  if (action === 'disable') {
    if (!verifyTwoFactorCode(user.twoFactorSecret ?? '', code)) {
      return NextResponse.json({ success: false, error: 'Kode 2FA tidak valid' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: Prisma.DbNull,
      },
    });

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
