'use client';

import { useEffect } from 'react';

const APP_NAME = 'The Mafia Travel';

export function usePageTitle(title?: string | null) {
  useEffect(() => {
    if (title) {
      document.title = `${title} | ${APP_NAME}`;
    } else {
      document.title = `${APP_NAME} — Pesan Tiket & Hotel Terbaik`;
    }
  }, [title]);
}
