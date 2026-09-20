import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const posts = await prisma.blogPost.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      author: true,
      category: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ posts });
}
