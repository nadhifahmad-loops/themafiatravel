import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// POST /api/user/collections/[id]/cover — upload cover kustom koleksi (member).
// Body: multipart/form-data dengan field "file". Hasilnya disimpan sebagai
// collection.coverImage; null di PATCH = kembali ke gradasi default.
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
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

    const formData = await req.formData().catch(() => null);
    const file = formData?.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang dikirim.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipe file harus JPG, PNG, atau WebP.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 5MB.' }, { status: 400 });
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const filename = `cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'collections');
    const filepath = path.join(uploadDir, filename);

    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const url = `/uploads/collections/${filename}`;
    const updated = await prisma.collection.update({
      where: { id },
      data: { coverImage: url },
    });

    return NextResponse.json({
      success: true,
      coverImage: updated.coverImage,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error('[Collection Cover Upload Error]', error);
    return NextResponse.json({ error: 'Gagal mengunggah cover' }, { status: 500 });
  }
}
