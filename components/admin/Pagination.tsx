'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, totalItems, pageSize, itemLabel = 'data', onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const pages: number[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
  }
  const withGaps: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) withGaps.push('ellipsis');
    withGaps.push(p);
    prev = p;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
      <p className="text-xs text-slate-400">
        Menampilkan <span className="font-semibold text-slate-600">{start}–{end}</span> dari <span className="font-semibold text-slate-600">{totalItems}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Sebelumnya"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {withGaps.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold transition-colors ${
                p === page ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Berikutnya"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
