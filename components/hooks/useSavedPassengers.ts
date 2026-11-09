'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SavedPassengerRecord } from '@/lib/saved-passengers';

/**
 * Ambil daftar penumpang tersimpan hanya untuk user yang sudah login.
 * Data di-refresh saat tab kembali aktif supaya penumpang yang ditambahkan di
 * tab halaman akun langsung terlihat tanpa mengorbankan isian checkout.
 */
export function useSavedPassengers(enabled: boolean) {
  const [savedPassengers, setSavedPassengers] = useState<SavedPassengerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (background = false) => {
    if (!enabled) return;

    if (!background) {
      setSavedPassengers([]);
      setLoading(true);
      setError('');
    }

    try {
      const res = await fetch('/api/user/passengers', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat penumpang tersimpan.');
      if (!mountedRef.current) return;

      setSavedPassengers(Array.isArray(data?.passengers) ? data.passengers : []);
      setError('');
    } catch {
      if (!mountedRef.current) return;
      setError('load');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      if (document.visibilityState === 'visible') load(true);
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, load]);

  return {
    savedPassengers: enabled ? savedPassengers : [],
    loading: enabled ? loading : false,
    error: enabled ? error : '',
    refetch: () => load(true),
  };
}
