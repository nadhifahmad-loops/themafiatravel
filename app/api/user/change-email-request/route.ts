import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import { apiError, apiSuccess } from '@/lib/validate';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user.id;
    if (!userId) return apiError('Unauthorized', 401);

    const { newEmail } = await req.json();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return apiError('Email tidak valid');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return apiError('User tidak ditemukan', 404);

    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return apiError('Email baru sama dengan email saat ini');
    }

    const existingUser = await prisma.user.findUnique({ where: { email: newEmail.toLowerCase() } });
    if (existingUser) {
      return apiError('Email sudah digunakan oleh akun lain');
    }

    // Rate limit: max 1 request per minute
    const recentToken = await prisma.emailVerification.findFirst({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    });
    if (recentToken) {
      return apiError('Tunggu 1 menit sebelum request lagi');
    }

    // Clean old tokens for this user
    await prisma.emailVerification.deleteMany({
      where: { userId, verified: false },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.emailVerification.create({
      data: {
        userId,
        newEmail: newEmail.toLowerCase(),
        token,
        expiresAt,
      },
    });

    await sendVerificationEmail({
      to: newEmail.toLowerCase(),
      token,
      userName: user.name || 'User',
    });

    return apiSuccess({ message: `Email verifikasi telah dikirim ke ${newEmail}` });
  } catch (e: any) {
    console.error('[Change Email Request]', e.message);
    return apiError('Gagal mengirim email verifikasi', 500);
  }
}
