'use client';

import type { MouseEvent } from 'react';

interface Props {
  /** Kalimat sebelum label S&K, mis. "Dengan menekan tombol, Anda menyetujui". */
  prefix: string;
  /** Label yang bisa diklik, mis. "Syarat & Ketentuan". */
  termsLabel: string;
  /** Kalimat sesudah label, mis. "kami.". */
  suffix: string;
  /** Membuka dialog — state-nya dipegang halaman (lihat TermsModal). */
  onOpen: () => void;
  className?: string;
}

/**
 * Teks persetujuan "…Anda menyetujui [Syarat & Ketentuan] kami." dengan bagian
 * label yang bisa diklik. Sebelumnya teks ini hanya hiasan sehingga user tidak
 * bisa mengetahui isinya.
 *
 * Menghasilkan `<span>` (bukan `<p>`) agar aman dipakai baik sebagai elemen
 * berdiri sendiri maupun sebagai isi `note` pada MobileCheckoutBar yang sudah
 * membungkusnya dengan `<p>`.
 */
export default function TermsAgreementText({ prefix, termsLabel, suffix, onOpen, className = '' }: Props) {
  return (
    <span className={`text-[10px] text-slate-400 ${className}`}>
      {prefix}{' '}
      <button
        type="button"
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          // Cegah agar klik tidak ikut mengaktifkan elemen <label> di sekitarnya
          // (dipakai pada halaman pembatalan yang membungkus teks dengan label).
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }}
        className="font-semibold text-slate-500 hover:text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-600 transition-colors"
      >
        {termsLabel}
      </button>{' '}
      {suffix}
    </span>
  );
}
