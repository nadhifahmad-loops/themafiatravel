import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Cek login dulu sebelum rate limit, agar IP tanpa akses tidak ikut dihitung.
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Akses ditolak!' }, { status: 401 });
    }

    // Rate limit percobaan ganti password per IP (cegah brute force current password).
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(`change-password:${ip}`, 'auth');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Password saat ini dan password baru harus diisi.' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password baru minimal 8 karakter.' }, { status: 400 });
    }

    // Password baru tidak boleh sama dengan password lama
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'Password baru harus berbeda dari password saat ini.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    // Jika user daftar pakai Google, dia tidak punya password di database
    if (!user.password) {
      return NextResponse.json({
        error: 'Akun ini terdaftar menggunakan Google. Tidak ada password yang bisa diubah.'
      }, { status: 400 });
    }

    // Verifikasi apakah password saat ini (lama) cocok
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Password saat ini salah!' }, { status: 401 });
    }

    // Enkripsi password baru sebelum disimpan
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        password: hashedNewPassword,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diperbarui.',
    });

  } catch (error: unknown) {
    console.error('[Change Password Error]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Gagal mengubah password. Ada gangguan di server.' },
      { status: 500 }
    );
  }
}
