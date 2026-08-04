import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

const routes = [
  '',
  '/login',
  '/register',
  '/find-booking',
  '/forgot-password',
  '/flight/search',
  '/hotel/search',
  '/train/search',
  '/insurance/search',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.7,
  }));
}