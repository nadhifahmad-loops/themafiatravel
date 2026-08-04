import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
    }

    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json(
        { success: false, error: 'Nomor telepon dan kode OTP wajib diisi' },
        { status: 400 }
      );
    }

    // Cari OTP terbaru yang belum verified
    const otp = await prisma.otpVerification.findFirst({
      where: {
        userId: user.id,
        phone,
        purpose: 'phone_change',
        verified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return NextResponse.json(
        { success: false, error: 'Kode OTP tidak ditemukan. Silakan minta kode baru.' },
        { status: 400 }
      );
    }

    // Cek expired
    if (new Date() > otp.expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.' },
        { status: 400 }
      );
    }

    // Cek max attempts
    if (otp.attempts >= otp.maxAttempts) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan. Silakan minta kode baru.' },
        { status: 429 }
      );
    }

    // Increment attempts
    await prisma.otpVerification.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    // Cek kode
    if (otp.code !== code) {
      const remaining = otp.maxAttempts - (otp.attempts + 1);
      return NextResponse.json(
        { success: false, error: `Kode OTP salah. Sisa percobaan: ${remaining}` },
        { status: 400 }
      );
    }

    // OTP valid — update nomor telepon user
    await prisma.user.update({
      where: { id: user.id },
      data: { phone },
    });

    // Mark OTP sebagai verified
    await prisma.otpVerification.update({
      where: { id: otp.id },
      data: { verified: true },
    });

    // Cleanup: hapus semua OTP lama untuk user ini
    await prisma.otpVerification.deleteMany({
      where: {
        userId: user.id,
        purpose: 'phone_change',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Nomor telepon berhasil diverifikasi dan diperbarui',
      phone,
    });
  } catch (error) {
    console.error('[Phone Verify Confirm Error]', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
