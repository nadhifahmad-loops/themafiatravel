import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_NAME_LENGTH = 60;

// PATCH /api/user/collections/[id] — ganti nama dan/atau cover koleksi.
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
    const collection = await prisma.collection.findUnique({ where: { id } });
    if (!collection || collection.userId !== user.id) {
      return NextResponse.json({ error: 'Koleksi tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json().catch(() => null);

    const data: { name?: string; coverImage?: string | null } = {};

    if (body && typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: 'Nama koleksi wajib diisi' }, { status: 400 });
      }
      if (name.length > MAX_NAME_LENGTH) {
        return NextResponse.json({ error: 'Nama koleksi terlalu panjang' }, { status: 400 });
      }
      data.name = name;
    }

    // coverImage: string = cover baru (hasil upload), null = kembali ke default.
    if (body && 'coverImage' in body) {
      if (body.coverImage === null) {
        data.coverImage = null;
      } else if (typeof body.coverImage === 'string' && body.coverImage.startsWith('/uploads/')) {
        data.coverImage = body.coverImage;
      } else {
        return NextResponse.json({ error: 'Cover tidak valid' }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 });
    }

    const updated = await prisma.collection.update({ where: { id }, data });
    return NextResponse.json({
      success: true,
      collection: {
        id: updated.id,
        name: updated.name,
        coverImage: updated.coverImage,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Collections PATCH Error]', error);
    return NextResponse.json({ error: 'Gagal mengubah koleksi' }, { status: 500 });
  }
}

// DELETE /api/user/collections/[id] — hapus koleksi.
// Favorit di dalamnya TIDAK ikut terhapus (FK onDelete: SetNull → jadi "Tanpa koleksi").
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
    const collection = await prisma.collection.findUnique({ where: { id } });
    if (!collection || collection.userId !== user.id) {
      return NextResponse.json({ error: 'Koleksi tidak ditemukan' }, { status: 404 });
    }

    await prisma.collection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Collections DELETE Error]', error);
    return NextResponse.json({ error: 'Gagal menghapus koleksi' }, { status: 500 });
  }
}
