import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/account/', '/bookings/', '/refunds/', '/payments/', '/insurance/bookings/', '/wallet/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}