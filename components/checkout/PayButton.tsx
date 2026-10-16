import type { ReactNode } from 'react';

/** Gaya tombol bayar standar checkout — dipakai PayButton & MobileCheckoutBar. */
export const payBtnCls =
  'w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed ' +
  'text-white font-bold text-sm rounded-xl px-5 py-3.5 shadow-card transition-all active:scale-[0.98] ' +
  'flex items-center justify-center gap-2';

interface Props {
  loading?: boolean;
  /** Teks saat loading (mis. "Memproses..."). */
  loadingLabel?: string;
  children?: ReactNode;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

/**
 * Tombol pembayaran tunggal untuk keempat halaman checkout.
 * Sebelumnya tiap halaman menulis spinner + `disabled` + label sendiri sehingga
 * tinggi, radius, dan perilaku disabled-nya berbeda-beda.
 * Warna tetap `bg-slate-900` sesuai sistem warna yang sudah dipakai.
 */
export default function PayButton({
  loading,
  loadingLabel,
  children,
  type = 'button',
  disabled,
  onClick,
  className = '',
}: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${payBtnCls} ${className}`}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
