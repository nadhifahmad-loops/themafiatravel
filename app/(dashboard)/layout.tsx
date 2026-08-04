'use client';
import { useSession } from 'next-auth/react';
import UnifiedNavbar from '@/components/layout/UnifiedNavbar';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { language } = useLanguage();
  const t = i18n.common[language];

  if (status === 'loading') return (
    <div className="flex flex-col items-center justify-center h-screen bg-white gap-4">
      <div style={{ width: 44, height: 44, border: '3px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p className="text-gray-400 text-sm">{t.loading}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // Tidak ada redirect — user tanpa login tetap bisa akses halaman search & checkout
  return (
    <div className="min-h-screen bg-gray-50">
      <UnifiedNavbar user={session?.user || null} />
      <main>{children}</main>
    </div>
  );
}