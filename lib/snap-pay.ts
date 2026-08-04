// lib/snap-pay.ts
// Helper client-side untuk membuka pembayaran Snap Midtrans sebagai POPUP
// di dalam aplikasi (bukan redirect ke halaman payment list Midtrans).
// Snapshot script dimuat dinamis dengan deduplikasi, dengan fallback redirect
// ke VT-Web jika popup gagal dimuat.

export interface SnapPopupOptions {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
  [key: string]: unknown;
}

export interface SnapInstance {
  pay: (token: string, options?: SnapPopupOptions) => void;
  embed: (token: string, options?: SnapPopupOptions) => void;
}

interface SnapWindow extends Window {
  snap?: SnapInstance;
}

let snapScriptPromise: Promise<SnapInstance> | null = null;

function isProduction(): boolean {
  return process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
}

function snapBase(): string {
  return isProduction() ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
}

// URL fallback jika popup Snap tidak bisa dimuat (VT-Web full page).
export function getSnapRedirectUrl(token: string): string {
  return `${snapBase()}/snap/v2/vtweb/${token}`;
}

// Memuat & meng-cache script Snap.js, mengembalikan window.snap.
export function loadSnap(): Promise<SnapInstance> {
  if (snapScriptPromise) return snapScriptPromise;
  if (typeof window === 'undefined') {
    snapScriptPromise = Promise.reject(new Error('Snap hanya berjalan di browser'));
    return snapScriptPromise;
  }
  const snapWindow = window as SnapWindow;
  if (snapWindow.snap) {
    snapScriptPromise = Promise.resolve(snapWindow.snap);
    return snapScriptPromise;
  }

  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
  if (!clientKey) {
    snapScriptPromise = Promise.reject(new Error('NEXT_PUBLIC_MIDTRANS_CLIENT_KEY belum diset'));
    return snapScriptPromise;
  }

  snapScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${snapBase()}/snap/snap.js`;
    script.setAttribute('data-client-key', clientKey);
    script.async = true;
    script.onload = () => {
      const snap = (window as SnapWindow).snap;
      if (snap) {
        resolve(snap);
      } else {
        snapScriptPromise = null; // izinkan retry
        reject(new Error('Snap gagal dimuat: window.snap tidak tersedia'));
      }
    };
    script.onerror = () => {
      snapScriptPromise = null; // izinkan retry
      reject(new Error('Snap gagal dimuat: script tidak dapat diakses'));
    };
    document.head.appendChild(script);
  });

  return snapScriptPromise;
}
