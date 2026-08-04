import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`reset:${ip}`, 'auth');
  if (!rateLimit.allowed) {
    return apiError('Terlalu banyak percobaan. Silakan coba lagi nanti.', 429, { retryAfter: rateLimit.retryAfter });
  }

  try {
    const body = await req.json();
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!token) {
      return apiError('Token reset tidak valid');
    }

    if (password.length < 8 || password.length > 128) {
      return apiError('Password minimal 8 karakter');
    }

    const record = await prisma.passwordReset.findUnique({ where: { token } });

    if (!record || record.used) {
      return apiError('Link reset tidak valid atau sudah digunakan', 400);
    }

    if (new Date() > record.expiresAt) {
      return apiError('Link reset sudah kedaluwarsa. Silakan minta link baru.', 400);
    }

    const hashed = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      }),
      prisma.passwordReset.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);

    return apiSuccess({ message: 'Password berhasil diubah. Silakan masuk dengan password baru.' });
  } catch (e: any) {
    console.error('[Reset Password]', e.message);
    return apiError('Gagal mereset password', 500);
  }
}
