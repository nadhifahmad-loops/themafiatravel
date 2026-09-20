import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug }, select: { title: true, excerpt: true } });
  if (!post) return { title: 'Artikel Tidak Ditemukan' };
  return { title: post.title, description: post.excerpt };
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.isPublished) notFound();

  return (
    <>
      <header className="max-w-[1280px] mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-2">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-brand-blue hover:text-brand-orange transition-colors mb-5">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Blog
        </Link>
        <div className="max-w-[760px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
              {post.category}
            </span>
            {post.publishedAt && (
              <span className="text-xs text-slate-400">
                {new Date(post.publishedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight mb-2">
            {post.title}
          </h1>
          <p className="text-sm text-slate-500 font-medium">oleh {post.author}</p>
        </div>
      </header>

      <article className="max-w-[760px] mx-auto px-4 md:px-8 py-8">
        {post.coverImage && (
          <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-8 bg-slate-100 shadow-card">
            <Image src={post.coverImage} alt={post.title} fill className="object-cover" priority />
          </div>
        )}
        <div className="prose prose-slate max-w-none">
          {post.content.split('\n').map((line: string, i: number) => {
            if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-black text-brand-ink mt-8 mb-4">{line.slice(2)}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-brand-ink mt-6 mb-3">{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-brand-ink mt-5 mb-2">{line.slice(4)}</h3>;
            if (line.startsWith('- ')) return <li key={i} className="text-slate-700 ml-4">{line.slice(2)}</li>;
            if (line.trim() === '') return <br key={i} />;
            return <p key={i} className="text-slate-600 leading-relaxed mb-3">{line}</p>;
          })}
        </div>
      </article>
    </>
  );
}