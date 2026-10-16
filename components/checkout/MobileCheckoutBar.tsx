'use client';

import type { ReactNode } from 'react';

/**
 * BAR CTA mobile yang menempel di bawah layar selama user mengisi form.
 *
 * Di layar kecil ringkasan pesanan berada jauh di bawah form, sehingga tanpa
 * bar ini user harus scroll panjang hanya untuk menekan tombol bayar. Bar ini
 * hanya tampil < lg; di desktop CTA tetap berada di kartu ringkasan.
 *
 * z-[900] — di bawah bar brand (1000), modal (2000), dialog LeaveGuard (1400 /
 * 13000) dan overlay loading (12000), sehingga tidak pernah menutupi lapisan
 * yang harus tetap terlihat.
 */
interface Props {
  /** Label kecil di atas nominal, mis. "Total Pembayaran". */
  totalLabel: string;
  /** Nominal yang sudah diformat, mis. "Rp 1.234.567". */
  total: string;
  /** Teks tombol, mis. "Bayar". */
  ctaLabel: string;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  /**
   * Catatan di atas baris total — tampil penuh (tidak dipotong).
   * Bisa berupa teks biasa maupun node, mis. TermsAgreementText yang di dalamnya
   * ada tombol untuk membuka dialog Syarat & Ketentuan.
   */
  note?: ReactNode;
  /** `submit` bila bar diletakkan di dalam <form> (agar Enter tetap mengirim). */
  type?: 'button' | 'submit';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function MobileCheckoutBar({
  totalLabel,
  total,
  ctaLabel,
  loading,
  loadingLabel,
  disabled,
  note,
  type = 'button',
  onClick,
}: Props) {
  return (
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-[900] border-t border-slate-200 bg-white/95 backdrop-blur-xl px-4 pt-2.5 pb-3 shadow-[0_-10px_30px_-18px_rgba(15,23,42,0.45)]">
      {note && (
        <p className="text-[10px] text-slate-400 text-center leading-tight mb-2">{note}</p>
      )}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
            {totalLabel}
          </p>
          <p className="text-[15px] font-extrabold text-slate-900 leading-tight truncate mt-0.5">
            {total}
          </p>
        </div>
        <button
          type={type}
          onClick={onClick}
          disabled={disabled || loading}
          className="shrink-0 min-w-[132px] px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {loadingLabel}
            </>
          ) : (
            ctaLabel
          )}
        </button>
      </div>
    </div>
  );
}
