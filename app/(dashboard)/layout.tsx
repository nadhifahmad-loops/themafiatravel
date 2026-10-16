'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import UnifiedNavbar from '@/components/layout/UnifiedNavbar';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { language } = useLanguage();
  const pathname = usePathname();
  const t = i18n.common[language];

  // Toggle bahasa (ID/EN) di navbar desktop hanya tampil di halaman hasil
  // pencarian — berlaku untuk tamu maupun user login (flag `!user` sudah
  // dilepas agar user login juga bisa ganti bahasa dari navbar). Sidebar
  // mobile tidak digest dan selalu menampilkannya, jadi cukup tentukan
  // apakah halaman sekarang termasuk /search.
  const isSearchPage = pathname?.includes('/search') ?? false;

  // FIX: Next.js 16 can cause useSession fetch to hang/fail for guests.
  // Show children after a short timeout even if status is still 'loading'.
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    if (status === 'loading') {
      const timer = setTimeout(() => setForceShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === 'loading' && !forceShow) return (
      <div className="flex flex-col items-center justify-center h-screen bg-brand-bgLight gap-4">
      <div style={{ width: 44, height: 44, border: '3px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p className="text-gray-400 text-sm">{t.loading}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-bgLight">
      <UnifiedNavbar user={session?.user || null} showLanguageToggle={isSearchPage} />
      {/* UnifiedNavbar sengaja tidak dirender di /checkout (lihat UnifiedNavbar),
          tapi halaman checkout punya header sticky milik sendiri (CheckoutNavbar)
          yang ikut alur dokumen. Padding 36px yang selama ini tetap ditanam
          menyisakan ruang kosong nyangkut di atas — jadi dibatalkan di sana. */}
      <main className={pathname?.includes('/checkout') ? '' : 'pt-[36px]'}>{children}</main>
    </div>
  );
}