'use client';

import { useSession } from 'next-auth/react';
import UnifiedNavbar from '@/components/layout/UnifiedNavbar';
import Footer from '@/components/layout/Footer';

export default function PublicLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex flex-col bg-brand-bgLight">
      <UnifiedNavbar user={session?.user || null} />
      <main className="flex-1 pt-[64px] md:pt-[116px]">
        {children}
      </main>
      <Footer />
    </div>
  );
}
