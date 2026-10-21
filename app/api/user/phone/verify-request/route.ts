import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppWithResult, generateOTP, formatOTPMessage } from '@/lib/whatsapp';

const OTP_EXPIRY_MINUTES = 5;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 menit antar request

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

    const { phone } = await req.json();
    // phone harus full international format: "6281234567890" / "14155551234" / dll
    if (!phone || phone.length < 7 || !/^\d+$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: 'Nomor telepon tidak valid. Gunakan format internasional tanpa tanda + (contoh: 6281234567890)' },
        { status: 400 }
      );
    }

    // Cek apakah ada OTP aktif yang baru dikirim (< 1 menit lalu)
    const recentOtp = await prisma.otpVerification.findFirst({
      where: {
        userId: user.id,
        purpose: 'phone_change',
        verified: false,
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOtp) {
      return NextResponse.json(
        { success: false, error: 'Tunggu sebentar sebelum minta kode baru' },
        { status: 429 }
      );
    }

    // Generate OTP
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Simpan ke database
    const otp = await prisma.otpVerification.create({
      data: {
        userId: user.id,
        phone,
        code,
        purpose: 'phone_change',
        expiresAt,
      },
    });

    // Kirim via WhatsApp — phone sudah full international format
    const sent = await sendWhatsAppWithResult(phone, formatOTPMessage(code, 'verifikasi perubahan nomor telepon'));

    if (!sent.success) {
      await prisma.otpVerification.delete({ where: { id: otp.id } });
      const disconnectedDevice = sent.reason.toLowerCase().includes('disconnected device');
      return NextResponse.json(
        {
          success: false,
          error: disconnectedDevice
            ? 'WhatsApp layanan sedang terputus. Admin perlu menghubungkan kembali perangkat pengirim di Fonnte sebelum OTP dapat dikirim.'
            : 'Gagal mengirim OTP via WhatsApp. Silakan coba lagi nanti atau hubungi admin.',
        },
        { status: 503 }
      );
    }

    // Mask nomor: tampilkan 4 digit pertama, sisanya *
    const masked = `+${phone.slice(0, 2)} ${phone.slice(2, 5)}${'*'.repeat(Math.max(0, phone.length - 5))}`;

    return NextResponse.json({
      success: true,
      message: `Kode OTP berhasil dikirim ke ${masked}`,
      phone: masked,
    });
  } catch (error) {
    console.error('[Phone Verify Request Error]', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
