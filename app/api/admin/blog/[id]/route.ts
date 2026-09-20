import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';
import { unlink } from 'fs/promises';
import path from 'path';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: 'Artikel tidak ditemukan.' }, { status: 404 });
  }

  return NextResponse.json({ post });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Artikel tidak ditemukan.' }, { status: 404 });
  }

  const body = await req.json();
  const { title, slug, excerpt, content, coverImage, author, category, isPublished, sortOrder } = body;

  if (!title || !content) {
    return NextResponse.json({ error: 'Judul dan konten wajib diisi.' }, { status: 400 });
  }

  const finalSlug = slug?.trim() || slugify(title);

  // Cek duplikasi slug (kecuali artikel itu sendiri)
  if (finalSlug !== existing.slug) {
    const duplicateSlug = await prisma.blogPost.findUnique({ where: { slug: finalSlug } });
    if (duplicateSlug) {
      return NextResponse.json({ error: 'Slug sudah digunakan. Gunakan slug yang berbeda.' }, { status: 400 });
    }
  }

  // Handle publishedAt
  let publishedAt = existing.publishedAt;
  if (isPublished === true && !existing.isPublished) {
    publishedAt = new Date(); // Pertama kali publish
  } else if (isPublished === false) {
    publishedAt = null; // Unpublish
  }

  const post = await prisma.blogPost.update({
    where: { id },
    data: {
      title,
      slug: finalSlug,
      excerpt: excerpt || '',
      content,
      coverImage: coverImage || null,
      author: author || 'Admin',
      category: category || 'Travel Tips',
      isPublished: isPublished === true,
      publishedAt,
      sortOrder: sortOrder ?? 0,
    },
  });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'blog.update',
    entityType: 'blog_post',
    entityId: post.id,
    before: existing,
    after: post,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true, post });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Artikel tidak ditemukan.' }, { status: 404 });
  }

  // Hapus file cover image dari disk
  if (existing.coverImage) {
    const filepath = path.join(process.cwd(), 'public', existing.coverImage);
    await unlink(filepath).catch(() => {});
  }

  await prisma.blogPost.delete({ where: { id } });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'blog.delete',
    entityType: 'blog_post',
    entityId: existing.id,
    before: existing,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true });
}
