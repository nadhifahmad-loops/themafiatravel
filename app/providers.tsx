'use client';
import { SessionProvider } from 'next-auth/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthModalProvider } from '@/contexts/AuthModalContext';
import AuthModals from '@/components/auth/AuthModals';
import PageMetadataSync from '@/components/metadata/PageMetadataSync';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Providers({ children, session, lang }: { children: React.ReactNode; session?: any; lang?: 'ID' | 'EN' }) {
  return (
    <SessionProvider session={session}>
      <LanguageProvider initialLang={lang}>
        <PageMetadataSync />
        <LocationProvider>
          <ToastProvider>
            <AuthModalProvider>
              {children}
              <AuthModals />
            </AuthModalProvider>
          </ToastProvider>
        </LocationProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
