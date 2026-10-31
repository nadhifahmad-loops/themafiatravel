'use client';
import { SessionProvider } from 'next-auth/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { ToastProvider } from '@/contexts/ToastContext';
import LoginWelcomeToast from '@/components/auth/LoginWelcomeToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Providers({ children, session, lang }: { children: React.ReactNode; session?: any; lang?: 'ID' | 'EN' }) {
  return (
    <SessionProvider session={session}>
      <LanguageProvider initialLang={lang}>
        <LocationProvider>
          <ToastProvider>
            {children}
            <LoginWelcomeToast />
          </ToastProvider>
        </LocationProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
