import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from './providers';

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
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce');
  const nonceSource = nonce ? `'nonce-${nonce}'` : '';

  const csp = [
    "default-src 'self'",
    `script-src 'self'${nonceSource ? ` ${nonceSource}` : ''} https://app.sandbox.midtrans.com https://app.midtrans.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    'frame-src https://app.sandbox.midtrans.com https://app.midtrans.com',
    "worker-src 'self' blob:",
    'upgrade-insecure-requests',
  ].join('; ');

  return (
    <html lang="id">
      <head>
        {nonce ? (
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: `window.__webpack_nonce__ = ${JSON.stringify(nonce)};` }}
          />
        ) : null}
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
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}