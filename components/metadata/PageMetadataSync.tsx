'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDocumentTitle, getPageMetadata, localizePageTitle } from '@/lib/page-metadata';

function setMeta(selector: string, attribute: 'content' | 'href', value: string) {
  let element = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
  if (!element) {
    const isLink = selector.startsWith('link');
    element = isLink
      ? document.createElement('link')
      : document.createElement('meta');
    const property = selector.match(/property="([^"]+)"/)?.[1];
    const name = selector.match(/name="([^"]+)"/)?.[1];
    if (property) element.setAttribute('property', property);
    else if (name) element.setAttribute('name', name);
    else if (isLink) {
      element.setAttribute('rel', 'canonical');
    }
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
}

export default function PageMetadataSync() {
  const pathname = usePathname() || '/';
  const { language } = useLanguage();

  useEffect(() => {
    const metadata = getPageMetadata(pathname, language);
    const pageTitle = document.documentElement.dataset.pageTitlePath === pathname
      ? document.documentElement.dataset.pageTitle
      : undefined;
    const title = formatDocumentTitle(
      pageTitle ? localizePageTitle(pageTitle, language) : metadata.title,
    );
    document.title = title;
    document.documentElement.lang = language === 'ID' ? 'id' : 'en';
    setMeta('meta[name="description"]', 'content', metadata.description);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', metadata.description);
    setMeta('meta[property="og:locale"]', 'content', language === 'ID' ? 'id_ID' : 'en_US');
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', metadata.description);
    setMeta('link[rel="canonical"]', 'href', `${window.location.origin}${pathname}`);
  }, [language, pathname]);

  return null;
}
