// app/api/user/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    // Rate limit percobaan hapus akun (anti brute-force password).
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(`account-delete:${ip}:${session.user.email}`, 'auth');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 300) } }
      );
    }

    // Re-authentication: konfirmasi password sebelum akun dihapus.
    // Akun tanpa password (mis. login Google) tidak bisa diverifikasi lewat
    // password — proses tetap dijalankan karena sesi aktif sudah divalidasi.
    let passwordBody: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.password === 'string' && body.password) {
        passwordBody = body.password;
      }
    } catch {
      // body kosong/opsional — password akan ditolak bila akun memilikinya
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, password: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 401 });
    }

    if (dbUser.password) {
      if (!passwordBody) {
        return NextResponse.json(
          { error: 'Konfirmasi password wajib diisi untuk menghapus akun.' },
          { status: 400 }
        );
      }
      const valid = await bcrypt.compare(passwordBody, dbUser.password);
      if (!valid) {
        return NextResponse.json({ error: 'Password salah. Akun tidak dihapus.' }, { status: 403 });
      }
    }

    // Hapus user dari database. Booking milik user ini TIDAK ikut terhapus —
    // relasi Booking.userId di-set SetNull (lihat migration
    // 20260805100000_booking_user_setnull_on_delete) supaya riwayat transaksi
    // tetap ada untuk audit/pajak, hanya kepemilikannya yang dilepas.
    // Relasi lain (Payment via booking, TwoFactor, dll) tetap cascade seperti biasa.
    await prisma.user.delete({
      where: { id: dbUser.id },
    });

    return NextResponse.json({ success: true, message: 'Akun berhasil dihapus.' });
  } catch (error: any) {
    console.error('[Delete Account Error]', error.message);
    return NextResponse.json(
      { error: 'Gagal menghapus akun. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}