import type { Metadata } from 'next';
import AboutContent from './AboutContent';

export const metadata: Metadata = {
  title: 'Tentang Kami',
  description: 'Kenali lebih dekat The Mafia Travel — platform perjalanan modern untuk booking pesawat, hotel, kereta, dan asuransi.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return <AboutContent />;
}
