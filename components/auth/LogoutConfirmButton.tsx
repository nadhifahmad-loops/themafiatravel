'use client';
import { useState } from 'react';
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

  const handleConfirm = async () => {
    setLoading(true);
    await signOut({ callbackUrl });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (!loading) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-[0_25px_70px_-15px_rgba(15,23,42,0.4)] animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-5">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">{title}</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{description}</p>
            </div>
            <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
