import LanguageToggle from '@/components/layout/LanguageToggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LanguageToggle className="fixed right-4 top-4 z-[1100] sm:right-6 sm:top-6" />
      {children}
    </>
  );
}