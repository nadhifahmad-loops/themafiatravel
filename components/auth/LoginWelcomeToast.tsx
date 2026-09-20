'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Check, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

const STORAGE_KEY = 'mt_welcome_pending';

export default function LoginWelcomeToast() {
  const { data: session, status } = useSession();
  const { language } = useLanguage();
  const t = i18n.navbar[language];

  const [pending, setPending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) {
        sessionStorage.removeItem(STORAGE_KEY);
        setPending(true);
      }
    } catch {}
  }, []);

  const visible = pending && !dismissed && status === 'authenticated';

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setDismissed(true), 5000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const name = session?.user?.name || '';
  const email = session?.user?.email || '';
  const displayName = name || email || '';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <div className="fixed bottom-5 right-5 z-[9999] w-[calc(100vw-2.5rem)] max-w-[380px]">
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/70 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.3)] animate-slide-in-right">
        <div className="flex items-center gap-3.5 p-4">
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-base font-black">
              {initial}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-white">
              <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-600">{t.loginSuccess}</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">
              {t.loggedAs}{' '}
              <span className="font-semibold text-slate-600">{displayName}</span>
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Tutup notifikasi"
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-[3px] w-full bg-orange-100">
          <div className="h-full bg-orange-500 animate-toast-progress" />
        </div>
      </div>
    </div>
  );
}
