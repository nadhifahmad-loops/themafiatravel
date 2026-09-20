import type { Metadata } from 'next';
import type { Career } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Karier',
  description: 'Bergabunglah dengan tim The Mafia Travel dan bangun karier di industri travel tech.',
};

const TYPE_LABEL: Record<string, string> = {
  'full-time': 'Full Time',
  'part-time': 'Part Time',
  'freelance': 'Freelance',
  'internship': 'Internship',
};

export default async function CareerPage() {
  let careers: Career[] = [];
  try {
    careers = await prisma.career.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  } catch {}

  return (
    <>
      <header className="max-w-[1280px] mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
          Karier
        </h1>
        <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium max-w-2xl">
          Bergabunglah dengan tim kami dan bantu membangun masa depan perjalanan di Indonesia.
        </p>
      </header>

      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        {careers.length === 0 ? (
          <div className="text-center py-12 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-briefcase text-2xl text-slate-400" />
            </div>
            <h2 className="text-xl font-black text-brand-ink mb-2">Lowongan Segera Tersedia</h2>
            <p className="text-slate-500 max-w-md mx-auto">
              Saat ini belum ada posisi yang dibuka. Ikuti perkembangan kami untuk informasi lowongan terbaru.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {careers.map((c) => (
              <div key={c.id} className="bg-white border border-slate-100 shadow-card rounded-2xl p-6 hover:border-orange-200 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                        {TYPE_LABEL[c.type] || c.type}
                      </span>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {c.department}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-brand-ink mb-1">{c.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{c.location}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{c.description}</p>
                    {c.requirements && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Persyaratan:</p>
                        <ul className="text-sm text-slate-600 space-y-0.5">
                          {c.requirements.split('\n').filter(Boolean).slice(0, 3).map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-orange-400 mt-1">•</span>
                              <span>{r.trim()}</span>
                            </li>
                          ))}
                          {c.requirements.split('\n').filter(Boolean).length > 3 && (
                            <li className="text-xs text-slate-400">+{c.requirements.split('\n').filter(Boolean).length - 3} persyaratan lainnya</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}