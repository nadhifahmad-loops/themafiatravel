'use client';
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';

const STORAGE_KEY = 'mt_welcome_pending';

export default function LoginWelcomeToast() {
  const { data: session, status } = useSession();
  const { language } = useLanguage();
  const { toast } = useToast();
  const t = i18n.navbar[language];

  const pending = useRef(false);
  const shown = useRef(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) {
        sessionStorage.removeItem(STORAGE_KEY);
        pending.current = true;
      }
    } catch (error) {
      console.error('Unable to read the login welcome flag from session storage.', error);
    }
  }, []);

  useEffect(() => {
    if (!pending.current || status !== 'authenticated' || shown.current) return;
    shown.current = true;
    const displayName = session?.user?.name || session?.user?.email || '';
    toast(`${t.loginSuccess} · ${t.loggedAs} ${displayName}`, { variant: 'success' });
  }, [status, session?.user?.name, session?.user?.email, t.loginSuccess, t.loggedAs, toast]);

  return null;
}
