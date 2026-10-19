import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/user/favorites/[id] — pindahkan favorit ke koleksi
// (collectionId: null = "Tanpa koleksi").
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const favorite = await prisma.favorite.findUnique({ where: { id } });
    if (!favorite || favorite.userId !== user.id) {
      return NextResponse.json({ error: 'Favorit tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const collectionId = body?.collectionId ?? null;

    // collectionId non-null harus berupa koleksi MILIK user yang sama.
    if (collectionId !== null) {
      if (typeof collectionId !== 'string') {
        return NextResponse.json({ error: 'Koleksi tidak valid' }, { status: 400 });
      }
      const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
      if (!collection || collection.userId !== user.id) {
        return NextResponse.json({ error: 'Koleksi tidak ditemukan' }, { status: 404 });
      }
    }

    const updated = await prisma.favorite.update({
      where: { id },
      data: { collectionId },
      select: { id: true, collectionId: true },
    });

    return NextResponse.json({ success: true, favorite: updated });
  } catch (error) {
    console.error('[Favorites PATCH Error]', error);
    return NextResponse.json({ error: 'Gagal memperbarui koleksi favorit' }, { status: 500 });
  }
}

// DELETE /api/user/favorites/[id] — hapus favorit milik user login.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;

    // Cek kepemilikan dulu — jangan sampai user lain bisa menghapus.
    const favorite = await prisma.favorite.findUnique({ where: { id } });
    if (!favorite || favorite.userId !== user.id) {
      return NextResponse.json({ error: 'Favorit tidak ditemukan' }, { status: 404 });
    }

    await prisma.favorite.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Favorites DELETE Error]', error);
    return NextResponse.json({ error: 'Gagal menghapus favorit' }, { status: 500 });
  }
}
