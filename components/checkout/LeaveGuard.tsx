'use client';
import { useEffect, useRef, useState } from 'react';
import { TriangleAlert, ArrowLeft } from 'lucide-react';

interface Props {
  active: boolean;
  title?: string;
  description?: string;
  stayLabel?: string;
  leaveLabel?: string;
}

// Menjaga pengguna tetap di halaman checkout sampai pemesanan selesai diproses.
// Menangani: keluar lewat link/klik, tombol back/forward browser, refresh, dan tutup tab.
// Navigation programatik (router.push) tidak diblokir — hanya tindakan pengguna langsung.
export default function LeaveGuard({
  active,
  title = 'Tinggalkan halaman checkout?',
  description = 'Pemesanan Anda belum selesai diproses. Data yang sudah diisi dapat hilang jika Anda keluar sekarang.',
  stayLabel = 'Tetap di Sini',
  leaveLabel = 'Ya, Tinggalkan',
}: Props) {
  const [showDialog, setShowDialog] = useState(false);
  const bypassRef = useRef(false);
  const pendingRef = useRef<{ type: 'anchor'; url: string } | { type: 'back' } | null>(null);

  // Browser-native dialog untuk refresh / tutup tab (beforeunload).
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypassRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);

  // Intersep klik pada link/anchor yang menuju ke halaman lain.
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (bypassRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const raw = anchor.getAttribute('href') || '';
      if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) return;
      let url: URL;
      try {
        url = new URL(raw, window.location.href);
      } catch {
        return;
      }
      // Navigasi ke halaman yang sama → biarkan.
      if (url.origin === window.location.origin && url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      pendingRef.current = { type: 'anchor', url: url.href };
      setShowDialog(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active]);

  // Intersep tombol back/forward browser (popstate).
  useEffect(() => {
    if (!active) return;
    const onPopState = () => {
      if (bypassRef.current) return;
      pendingRef.current = { type: 'back' };
      window.history.pushState(null, '', window.location.href);
      setShowDialog(true);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [active]);

  // Tutup dialog dengan tombol Escape = tetap di halaman.
  useEffect(() => {
    if (!showDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pendingRef.current = null;
        setShowDialog(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDialog]);

  const handleLeave = () => {
    bypassRef.current = true;
    setShowDialog(false);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending?.type === 'anchor' && pending.url) {
      window.location.assign(pending.url);
    } else if (pending?.type === 'back') {
      window.history.back();
    }
  };

  return (
    <>
      {showDialog && (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            pendingRef.current = null;
            setShowDialog(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-[0_25px_70px_-15px_rgba(15,23,42,0.4)] animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <TriangleAlert className="w-6 h-6 text-amber-500" />
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">{title}</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{description}</p>
            </div>
            <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  pendingRef.current = null;
                  setShowDialog(false);
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors"
              >
                {stayLabel}
              </button>
              <button
                type="button"
                onClick={handleLeave}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {leaveLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
