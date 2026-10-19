import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = ['flight', 'hotel', 'train'];

async function getAuthedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

// GET /api/user/favorites — daftar favorit milik user login.
export async function GET() {
  try {
    const user = await getAuthedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, favorites });
  } catch (error) {
    console.error('[Favorites GET Error]', error);
    return NextResponse.json({ error: 'Gagal mengambil data favorit' }, { status: 500 });
  }
}

// POST /api/user/favorites — simpan favorit (idempoten via upsert dedupeKey).
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });

    const { entityType, dedupeKey, title, subtitle, price, image, searchParams } = body;

    if (!ALLOWED_TYPES.includes(entityType)) {
      return NextResponse.json({ error: 'Tipe favorit tidak valid' }, { status: 400 });
    }
    if (!dedupeKey || typeof dedupeKey !== 'string' || !title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
    }
    if (dedupeKey.length > 200 || title.length > 300) {
      return NextResponse.json({ error: 'Data terlalu panjang' }, { status: 400 });
    }

    const favorite = await prisma.favorite.upsert({
      where: {
        userId_entityType_dedupeKey: {
          userId: user.id,
          entityType,
          dedupeKey,
        },
      },
      update: {
        title,
        subtitle: typeof subtitle === 'string' ? subtitle : null,
        price: typeof price === 'number' && isFinite(price) ? Math.round(price) : null,
        image: typeof image === 'string' ? image : null,
        searchParams: searchParams && typeof searchParams === 'object' ? searchParams : {},
      },
      create: {
        userId: user.id,
        entityType,
        dedupeKey,
        title,
        subtitle: typeof subtitle === 'string' ? subtitle : null,
        price: typeof price === 'number' && isFinite(price) ? Math.round(price) : null,
        image: typeof image === 'string' ? image : null,
        searchParams: searchParams && typeof searchParams === 'object' ? searchParams : {},
      },
    });

    return NextResponse.json({ success: true, favorite });
  } catch (error) {
    console.error('[Favorites POST Error]', error);
    return NextResponse.json({ error: 'Gagal menyimpan favorit' }, { status: 500 });
  }
}
