import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isValidBirthDate } from '@/lib/checkout-utils';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Keamanan tingkat Mafia: Hanya user yang login yang bisa ubah datanya sendiri
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Akses ditolak! Kamu siapa, Bos?' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Permintaan tidak valid, Bos.' }, { status: 400 });
    }

    const { name, birthDate } = body as { name?: unknown; birthDate?: unknown };
    const hasName = name !== undefined && name !== null;
    const hasBirthDate = birthDate !== undefined && birthDate !== null;

    if (!hasName && !hasBirthDate) {
      return NextResponse.json({ error: 'Tidak ada data yang diperbarui, Bos.' }, { status: 400 });
    }

    const data: { name?: string; birthDate?: Date | null } = {};

    if (hasName) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return NextResponse.json({ error: 'Nama minimal 2 karakter, Bos.' }, { status: 400 });
      }
      data.name = name.trim();
    }

    if (hasBirthDate) {
      if (typeof birthDate !== 'string') {
        return NextResponse.json({ error: 'Tanggal lahir tidak valid, Bos.' }, { status: 400 });
      }
      if (birthDate === '') {
        data.birthDate = null; // boleh dikosongkan
      } else if (!isValidBirthDate(birthDate)) {
        return NextResponse.json({ error: 'Tanggal lahir tidak valid atau masih di masa depan, Bos.' }, { status: 400 });
      } else {
        // 'YYYY-MM-DD' ditafsirkan sebagai tanggal lokal (bukan waktu UTC)
        const [y, m, d] = birthDate.split('-').map(Number);
        data.birthDate = new Date(Date.UTC(y, m - 1, d, 12));
      }
    }

    // Update data di database
    // Phone hanya bisa diubah melalui flow OTP (/api/user/phone/verify-confirm)
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data,
    });

    return NextResponse.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      user: {
        name: updatedUser.name,
        phone: updatedUser.phone,
        birthDate: updatedUser.birthDate ? updatedUser.birthDate.toISOString().slice(0, 10) : null,
      }
    });

  } catch (error: any) {
    console.error('[User Update Error]', error.message);
    return NextResponse.json(
      { error: 'Gagal memperbarui database. Ada sabotase sepertinya.' },
      { status: 500 }
    );
  }
}
