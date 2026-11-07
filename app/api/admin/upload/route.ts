import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveUploadedImage, StorageNotConfiguredError } from '@/lib/upload-storage';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const admin = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Tidak ada file yang dikirim.' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipe file harus JPG, PNG, atau WebP.' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Ukuran file maksimal 5MB.' }, { status: 400 });
  }

  try {
    const url = await saveUploadedImage(file, 'banners');
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[Admin Upload Error]', error);
    return NextResponse.json({ error: 'Gagal mengunggah gambar.' }, { status: 500 });
  }
}
