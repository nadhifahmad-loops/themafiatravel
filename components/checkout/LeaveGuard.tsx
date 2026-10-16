'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TriangleAlert, ArrowLeft, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

interface Props {
  active: boolean;
  title?: string;
  description?: string;
  stayLabel?: string;
  leaveLabel?: string;
  /** Tujuan cadangan bila tombol back ditekan tanpa halaman sebelumnya. */
  fallbackHref?: string;
  /**
   * z-index dialog konfirmasi. Naikkan (mis. `z-[13000]`) saat overlay loading
   * checkout aktif — overlay memakai `z-[12000]`, sehingga tanpa penyesuaian
   * ini dialog "Yakin keluar?" akan muncul di BELAKANG overlay dan tak terlihat.
   */
  zIndex?: string;
}

// Menjaga pengguna tetap di halaman checkout sampai pemesanan selesai diproses.
// Menangani: keluar lewat link/klik, tombol back/forward browser, refresh, dan tutup tab.
// Navigasi programatik (router.push) tidak diblokir — hanya tindakan pengguna langsung.
export default function LeaveGuard({
  active,
  title,
  description,
  stayLabel,
  leaveLabel,
  fallbackHref = '/',
  zIndex = 'z-[1400]',
}: Props) {
  const router = useRouter();
  const { language } = useLanguage();
  const t = i18n.leaveGuard[language];

  const resolvedTitle = title ?? t.title;
  const resolvedDescription = description ?? t.description;
  const resolvedStay = stayLabel ?? t.stayLabel;
  const resolvedLeave = leaveLabel ?? t.leaveLabel;

  const [showDialog, setShowDialog] = useState(false);
  const bypassRef = useRef(false);
  const leavingRef = useRef(false);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const guardDepthRef = useRef(0);
  const pendingRef = useRef<{ type: 'anchor'; url: string } | { type: 'back' } | null>(null);

  const stay = useCallback(() => {
    pendingRef.current = null;
    setShowDialog(false);
  }, []);

  const leave = useCallback(() => {
    if (leavingRef.current) return;
    const pending = pendingRef.current;
    if (!pending) {
      setShowDialog(false);
      return;
    }

    leavingRef.current = true;
    bypassRef.current = true;
    setShowDialog(false);

    if (pending.type === 'anchor' && pending.url) {
      pendingRef.current = null;
      window.location.assign(pending.url);
      return;
    }

    // pending.type === 'back'
    pendingRef.current = null;
    const currentHref = window.location.href;
    // Guard menyisipkan entri history (bisa >1 saat StrictMode dev). Mundur sebanyak
    // kedalaman guard + 1 agar langsung meninggalkan halaman pada klik pertama.
    const steps = Math.max(1, guardDepthRef.current) + 1;
    window.history.go(-steps);

    // Cadangan: bila tidak ada halaman sebelumnya (checkout dibuka langsung),
    // go(-2) tidak berpindah — arahkan ke rute aman.
    window.setTimeout(() => {
      if (window.location.href === currentHref) {
        router.push(fallbackHref);
      }
    }, 450);
  }, [router, fallbackHref]);

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
    // Pertahankan state internal Next App Router saat menyisipkan entri guard.
    const pushGuard = (countDepth = false) => {
      window.history.pushState(
        { ...(window.history.state || {}), __leaveGuard: true },
        '',
        window.location.href,
      );
      if (countDepth) guardDepthRef.current += 1;
    };
    const onPopState = () => {
      if (bypassRef.current) return;
      pushGuard();
      pendingRef.current = { type: 'back' };
      setShowDialog(true);
    };
    pushGuard(true);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [active]);

  // ESC = tetap di halaman.
  useEffect(() => {
    if (!showDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDialog, stay]);

  // Kunci scroll body + fokus ke aksi aman saat dialog terbuka.
  useEffect(() => {
    if (!showDialog) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    stayButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showDialog]);

  return (
    <>
      {showDialog && (
        <div
          role="presentation"
          className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in`}
          onClick={stay}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-guard-title"
            aria-describedby="leave-guard-desc"
            className="relative w-full max-w-[380px] rounded-3xl bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.5)] ring-1 ring-slate-900/5 overflow-hidden animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={stay}
              aria-label={language === 'EN' ? 'Close' : 'Tutup'}
              className="absolute top-4 right-4 w-9 h-9 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="px-6 pt-7 pb-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 ring-4 ring-amber-100 flex items-center justify-center mb-4">
                <TriangleAlert className="w-6 h-6 text-white" />
              </div>
              <h2 id="leave-guard-title" className="text-base font-bold text-slate-900 leading-snug pr-6">
                {resolvedTitle}
              </h2>
              <p id="leave-guard-desc" className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                {resolvedDescription}
              </p>
            </div>

            <div className="px-6 pt-4 pb-6 flex flex-col-reverse sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={leave}
                className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 text-sm font-bold transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <ArrowLeft className="w-4 h-4" />
                {resolvedLeave}
              </button>
              <button
                ref={stayButtonRef}
                type="button"
                onClick={stay}
                className="flex-1 px-4 py-3 rounded-xl bg-brand-orange hover:bg-orange-600 text-white text-sm font-bold transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2"
              >
                {resolvedStay}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
