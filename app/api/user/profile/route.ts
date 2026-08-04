import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { accounts: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const provider = user.accounts.some(acc => acc.provider === 'google') ? 'google' : 'credentials';

    return NextResponse.json({
      success: true,
      user: {
        name: user.name ?? '',
        email: user.email,
        phone: user.phone ?? '',
        provider,
        image: user.image ?? null,
        createdAt: user.createdAt?.toISOString?.() || null,
      },
    });
  } catch (error: unknown) {
    console.error('[User Profile Error]', error);
    return NextResponse.json({ error: 'Gagal mengambil data profil' }, { status: 500 });
  }
}
