'use client';

import type { BlogPost } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

export default function BlogContent({ posts }: { posts: BlogPost[] }) {
  const { language } = useLanguage();
  const t = i18n.blogPage[language];
  const locale = language === 'ID' ? 'id-ID' : 'en-US';

  usePageTitle(t.title);

  return (
    <>
      <header className="max-w-[1280px] mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
          {t.title}
        </h1>
        <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium max-w-2xl">
          {t.subtitle}
        </p>
      </header>

      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-pen-nib text-2xl text-slate-400" />
            </div>
            <h2 className="text-xl font-black text-brand-ink mb-2">{t.emptyTitle}</h2>
            <p className="text-slate-500 max-w-md mx-auto">
              {t.emptyText}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="group block bg-white border border-slate-100 shadow-card rounded-2xl overflow-hidden hover:border-orange-200 transition-all">
                {p.coverImage ? (
                  <div className="relative w-full h-48 bg-slate-100">
                    <Image src={p.coverImage} alt={p.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-orange-50 to-slate-100 flex items-center justify-center">
                    <i className="fa-solid fa-pen-nib text-4xl text-orange-200" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                      {p.category}
                    </span>
                    {p.publishedAt && (
                      <span className="text-xs text-slate-400">
                        {new Date(p.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-brand-ink mb-1 group-hover:text-orange-600 transition-colors line-clamp-2">{p.title}</h2>
                  {p.excerpt && <p className="text-sm text-slate-500 line-clamp-2">{p.excerpt}</p>}
                  <p className="text-xs text-slate-400 mt-2">{t.byLabel} {p.author}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
