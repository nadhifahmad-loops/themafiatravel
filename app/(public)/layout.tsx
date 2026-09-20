import PublicLayoutWrapper from '@/components/layout/PublicLayoutWrapper';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicLayoutWrapper>{children}</PublicLayoutWrapper>;
}
