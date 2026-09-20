import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const posts = await prisma.blogPost.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const admin = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true },
  });
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { title, slug, excerpt, content, coverImage, author, category, isPublished, sortOrder } = body;

  if (!title || !content) {
    return NextResponse.json({ error: 'Judul dan konten wajib diisi.' }, { status: 400 });
  }

  const finalSlug = slug?.trim() || slugify(title);

  // Cek duplikasi slug
  const existingSlug = await prisma.blogPost.findUnique({ where: { slug: finalSlug } });
  if (existingSlug) {
    return NextResponse.json({ error: 'Slug sudah digunakan. Gunakan slug yang berbeda.' }, { status: 400 });
  }

  const post = await prisma.blogPost.create({
    data: {
      title,
      slug: finalSlug,
      excerpt: excerpt || '',
      content,
      coverImage: coverImage || null,
      author: author || 'Admin',
      category: category || 'Travel Tips',
      isPublished: isPublished === true,
      publishedAt: isPublished === true ? new Date() : null,
      sortOrder: sortOrder || 0,
    },
  });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'blog.create',
    entityType: 'blog_post',
    entityId: post.id,
    after: post,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true, post });
}
