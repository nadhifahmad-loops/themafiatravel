'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog Syarat & Ketentuan untuk halaman checkout & pembatalan.
 *
 * Isinya diambil dari `i18n.termsPage` — sumber yang sama dengan halaman
 * `/terms` — sehingga tidak ada konten duplikat dan otomatis mengikuti bahasa
 * aktif (ID/EN).
 *
 * Sengaja berupa modal DI TEMPAT, bukan link ke `/terms`: LeaveGuard pada
 * halaman checkout mengintersep semua klik anchor yang menuju halaman lain,
 * sehingga link biasa akan memicu dialog "Yakin keluar?" justru saat user
 * ingin membaca ketentuan. Karena tidak ada navigasi sama sekali, data form
 * juga dijamin utuh.
 *
 * Layout: bottom-sheet di layar kecil, dialog tengah di desktop.
 * z-[3000] — di atas bar brand (1000) & modal kursi (2000), di bawah toast
 * (9999), dialog LeaveGuard (1400) dan overlay loading checkout (12000).
 */
export default function TermsModal({ open, onClose }: Props) {
  const { language } = useLanguage();
  const t = i18n.termsPage[language];
  const tc = i18n.checkoutSteps[language];

  // ESC = tutup dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Kunci scroll body selama dialog terbuka.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        className="relative w-full sm:max-w-[640px] max-h-[88vh] sm:max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.5)] ring-1 ring-slate-900/5 animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar — hanya tampil sebagai petunjuk seret di bottom-sheet */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-start gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0 flex-1">
            <h2
              id="terms-modal-title"
              className="text-base sm:text-lg font-extrabold text-brand-ink leading-snug"
            >
              {t.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{t.updated}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tc.close}
            className="shrink-0 w-9 h-9 -mt-1 -mr-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body scrollable — konten sama dengan halaman /terms */}
        <div className="overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-5">
          {t.sections.map((section, i) => (
            <div key={i}>
              <h3 className="text-sm font-black text-brand-ink mb-1.5">{section.heading}</h3>
              <div className="text-[13px] text-slate-600 leading-relaxed">
                {'list' in section && section.list ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {section.list.map((item: string, j: number) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{section.content}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Aksi penutup di bawah agar mudah dijangkau jempol di layar kecil */}
        <div className="px-5 sm:px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl bg-brand-orange hover:bg-orange-600 text-white text-sm font-bold transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2"
          >
            {tc.close}
          </button>
        </div>
      </div>
    </div>
  );
}
