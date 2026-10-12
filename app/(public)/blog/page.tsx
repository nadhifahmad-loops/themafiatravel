import type { Metadata } from 'next';
import type { BlogPost } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import BlogContent from './BlogContent';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Artikel tips perjalanan, promo terbaru, dan berita dari The Mafia Travel.',
  alternates: { canonical: '/blog' },
};

export default async function BlogPage() {
  let posts: BlogPost[] = [];
  try {
    posts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    });
  } catch {}

  return <BlogContent posts={posts} />;
}
