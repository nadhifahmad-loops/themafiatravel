import type { Metadata } from 'next';
import PartnerContent from './PartnerContent';

export const metadata: Metadata = {
  title: 'Partner',
  description: 'Jadilah mitra The Mafia Travel dan kembangkan bisnis Anda bersama kami.',
  alternates: { canonical: '/partner' },
};

export default function PartnerPage() {
  return <PartnerContent />;
}
