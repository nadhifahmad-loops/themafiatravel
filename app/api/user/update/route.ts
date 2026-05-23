import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Keamanan tingkat Mafia: Hanya user yang login yang bisa ubah datanya sendiri
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Akses ditolak! Kamu siapa, Bos?' }, { status: 401 });
    }

    const { name, phone } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Nama jangan dikosongkan, Bos.' }, { status: 400 });
    }

    // Update data di database
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        name,
        phone: phone || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      user: {
        name: updatedUser.name,
        phone: updatedUser.phone,
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