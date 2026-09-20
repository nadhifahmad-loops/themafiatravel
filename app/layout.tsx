import type { Metadata, Viewport } from 'next';
import { headers, cookies } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import { buildCsp } from '@/lib/csp';
import { getToken } from 'next-auth/jwt';

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'The Mafia Travel — Perjalanan Terbaik',
    template: '%s | The Mafia Travel',
  },
  description: 'Pesan hotel, tiket pesawat, kereta, dan asuransi perjalanan terpercaya.',
  keywords: [
    'hotel murah',
    'tiket pesawat',
    'tiket kereta',
    'asuransi perjalanan',
    'The Mafia Travel',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    siteName: 'The Mafia Travel',
    title: 'The Mafia Travel — Perjalanan Terbaik',
    description: 'Pesan hotel, tiket pesawat, kereta, dan asuransi perjalanan terpercaya.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Mafia Travel — Perjalanan Terbaik',
    description: 'Pesan hotel, tiket pesawat, kereta, dan asuransi perjalanan terpercaya.',
  },
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  themeColor: '#338CB2',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce');
  const csp = buildCsp(nonce ?? '');

  const cookieStore = await cookies();
  const reqLike = { headers: Object.fromEntries(headersList.entries()), cookies: Object.fromEntries(cookieStore.getAll().map(c => [c.name, c.value])) } as any;
  const token = await getToken({ req: reqLike, secret: process.env.NEXTAUTH_SECRET, secureCookie: process.env.NODE_ENV === 'production' });
  const session = token ? { user: { id: token.sub || '', name: token.name || '', email: token.email || '', image: token.picture || null } } : null;

  return (
    <html lang="id">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={csp} />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers session={session}>{children}</Providers>
        <div id="datepicker-root"></div>
      </body>
    </html>
  );
}