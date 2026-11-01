'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  formatDocumentTitle,
  getPageMetadata,
  localizePageTitle,
} from '@/lib/page-metadata';

export function usePageTitle(title?: string | null) {
  const pathname = usePathname() || '/';
  const { language } = useLanguage();

  useEffect(() => {
    const metadata = getPageMetadata(pathname, language);
    const pageTitle = title
      ? localizePageTitle(title, language)
      : metadata.title;
    const fullTitle = formatDocumentTitle(pageTitle);
    if (title) {
      document.documentElement.dataset.pageTitle = title;
      document.documentElement.dataset.pageTitlePath = pathname;
    } else if (document.documentElement.dataset.pageTitlePath === pathname) {
      delete document.documentElement.dataset.pageTitle;
      delete document.documentElement.dataset.pageTitlePath;
    }
    document.title = fullTitle;

    const openGraphTitle = document.head.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (openGraphTitle) openGraphTitle.content = fullTitle;

    const twitterTitle = document.head.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.content = fullTitle;
  }, [language, pathname, title]);
}
