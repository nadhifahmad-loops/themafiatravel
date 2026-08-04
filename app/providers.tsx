'use client';
import { SessionProvider } from 'next-auth/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LocationProvider } from '@/contexts/LocationContext';
import LoginWelcomeToast from '@/components/auth/LoginWelcomeToast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <LocationProvider>
          {children}
          <LoginWelcomeToast />
        </LocationProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
