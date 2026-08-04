import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { apiError, apiSuccess } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/security';
import crypto from 'crypto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`forgot:${ip}`, 'auth');
  if (!rateLimit.allowed) {
    return apiError('Terlalu banyak percobaan. Silakan coba lagi nanti.', 429, { retryAfter: rateLimit.retryAfter });
  }

  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : '';

    if (!EMAIL_REGEX.test(email)) {
      return apiError('Email tidak valid');
    }

    // Anti-enumeration: selalu kembalikan pesan sukses generik,
    // baik email terdaftar maupun tidak.
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true },
    });

    // Hanya akun dengan password (bukan Google-only) yang bisa di-reset.
    if (user?.password) {
      // Cooldown: maksimal 1 email reset per menit per user.
      const recent = await prisma.passwordReset.findFirst({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 60 * 1000) },
        },
      });
      if (!recent) {
        // Bersihkan token lama yang belum dipakai.
        await prisma.passwordReset.deleteMany({
          where: { userId: user.id, used: false },
        });

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

        await prisma.passwordReset.create({
          data: { userId: user.id, token, expiresAt },
        });

        await sendPasswordResetEmail({
          to: user.email,
          token,
          userName: user.name || 'User',
        });
      }
    }

    return apiSuccess({ message: 'Jika email terdaftar, link reset password telah dikirim. Periksa inbox atau folder spam kamu.' });
  } catch (e: any) {
    console.error('[Forgot Password]', e.message);
    return apiError('Gagal memproses permintaan reset password', 500);
  }
}
