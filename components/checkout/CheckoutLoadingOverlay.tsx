'use client';
import { useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

interface Props {
  /** true saat request booking sedang berjalan. */
  open: boolean;
  /** Judul di tengah layar. Opsional — default mengikuti i18n. */
  title?: string;
  /** Sub-teks penjelasan. Opsional — default mengikuti i18n. */
  message?: string;
}

/**
 * Overlay loading yang MENIMPA seluruh halaman checkout selama booking diproses.
 *
 * Kenapa memakai overlay, bukan sekadar `disabled` pada tombol:
 *   • Root-nya `fixed inset-0` menutupi seluruh viewport, sehingga setiap klik
 *     mendarat di overlay ini dan tertelan — konten belakang (bagasi, kursi,
 *     kupon, navigasi, tombol ← Back) tidak bisa diakses sama sekali.
 *   • Tidak ada tombol tutup / dismiss — user tidak bisa membatalkan proses.
 *   • Scroll body dikunci dan fokus keyboard di-trap, jadi Tab pun tidak bisa
 *     menembus ke form di belakangnya.
 *
 * Lapisan proteksi terhadap double-klik di checkout:
 *   1. Overlay ini       — memblokir interaksi UI
 *   2. `isSubmittingRef` — guard sinkron yang menang klik ganda dalam 1 tick
 *   3. Idempotency key   — di server, walau lolos UI tetap hanya 1 eksekusi
 */
export default function CheckoutLoadingOverlay({ open, title, message }: Props) {
  const { language } = useLanguage();
  const t = i18n.checkoutOverlay[language];
  const containerRef = useRef<HTMLDivElement>(null);

  // Kunci scroll halaman selama overlay terbuka.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // Pindahkan fokus ke overlay supaya Tab tidak langsung lolos ke konten belakang.
  useEffect(() => {
    if (!open) return;
    containerRef.current?.focus();
  }, [open]);

  // Trapping keyboard: overlay tidak berisi elemen fokusable apa pun, jadi
  // Tab/Shift+Tab cukup di-cancel agar fokus tetap di sini.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={title ?? t.title}
      className="fixed inset-0 z-[12000] flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-sm animate-fade-in outline-none"
    >
      <div className="bg-white rounded-2xl shadow-[0_30px_80px_-20px_rgba(15,23,42,0.5)] px-8 py-9 w-full max-w-[360px] text-center space-y-3 animate-pop-in">
        <div className="w-9 h-9 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto" />
        <p className="font-bold text-slate-800 text-sm">{title ?? t.title}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{message ?? t.message}</p>
      </div>
    </div>
  );
}
