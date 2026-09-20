'use client';
import { SessionProvider } from 'next-auth/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LocationProvider } from '@/contexts/LocationContext';
import LoginWelcomeToast from '@/components/auth/LoginWelcomeToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Providers({ children, session }: { children: React.ReactNode; session?: any }) {
  return (
    <SessionProvider session={session}>
      <LanguageProvider>
        <LocationProvider>
          {children}
          <LoginWelcomeToast />
        </LocationProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
