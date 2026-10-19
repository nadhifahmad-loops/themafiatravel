import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_NAME_LENGTH = 60;
const MAX_COLLECTIONS_PER_USER = 50;

async function getAuthedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

// GET /api/user/collections — daftar koleksi milik user login (dengan jumlah item).
export async function GET() {
  try {
    const user = await getAuthedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const collections = await prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { favorites: true } } },
    });

    return NextResponse.json({
      success: true,
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        coverImage: c.coverImage,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        itemCount: c._count.favorites,
      })),
    });
  } catch (error) {
    console.error('[Collections GET Error]', error);
    return NextResponse.json({ error: 'Gagal mengambil koleksi' }, { status: 500 });
  }
}

// POST /api/user/collections — buat koleksi baru.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Nama koleksi wajib diisi' }, { status: 400 });
    }
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: 'Nama koleksi terlalu panjang' }, { status: 400 });
    }

    const count = await prisma.collection.count({ where: { userId: user.id } });
    if (count >= MAX_COLLECTIONS_PER_USER) {
      return NextResponse.json({ error: 'Batas koleksi tercapai' }, { status: 400 });
    }

    const collection = await prisma.collection.create({
      data: { userId: user.id, name },
    });

    return NextResponse.json({
      success: true,
      collection: {
        id: collection.id,
        name: collection.name,
        coverImage: collection.coverImage,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        itemCount: 0,
      },
    });
  } catch (error) {
    console.error('[Collections POST Error]', error);
    return NextResponse.json({ error: 'Gagal membuat koleksi' }, { status: 500 });
  }
}
