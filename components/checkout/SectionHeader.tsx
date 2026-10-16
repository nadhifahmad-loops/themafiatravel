import type { ReactNode } from 'react';

interface Props {
  /** Nama ikon Font Awesome (tanpa prefix `fa-solid`), mis. `fa-user`. */
  icon?: string;
  /** Nomor langkah pada badge — opsional (untuk kartu bernomor). */
  number?: number;
  title: ReactNode;
  description?: ReactNode;
}

/**
 * Judul kartu form checkout yang seragam di keempat halaman:
 * badge bulat + judul `text-sm font-bold text-slate-800` + deskripsi opsional
 * `text-xs text-slate-400`. Sebelumnya tiap halaman menulis gaya ini sendiri
 * sehingga jarak dan ukurannya berbeda-beda.
 */
export default function SectionHeader({ icon, number, title, description }: Props) {
  return (
    <div className={description ? 'mb-1' : 'mb-4'}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 shrink-0 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">
          {number !== undefined ? number : <i className={`fa-solid ${icon || 'fa-user'} text-[9px]`} />}
        </span>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      {description && <p className="text-xs text-slate-400 mt-1 mb-4">{description}</p>}
    </div>
  );
}
