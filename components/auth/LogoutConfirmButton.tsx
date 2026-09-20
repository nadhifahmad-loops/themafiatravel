'use client';
import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

interface Props {
  className?: string;
  children: React.ReactNode;
  callbackUrl?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function LogoutConfirmButton({
  className,
  children,
  callbackUrl = '/',
  title = 'Yakin ingin keluar?',
  description = 'Anda akan keluar dari akun The Mafia Travel.',
  confirmLabel = 'Ya, Keluar',
  cancelLabel = 'Batal',
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleConfirm = () => {
    setLoading(true);
    signOut({ callbackUrl });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
          {/* Overlay — klik di luar card = tutup */}
          <div className="absolute inset-0" onClick={() => { if (!loading) setOpen(false); }} />

          {/* Card */}
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 pb-5">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <LogOut className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug">{title}</h2>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{description}</p>

            <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors disabled:opacity-60"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Logout...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    {confirmLabel}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
