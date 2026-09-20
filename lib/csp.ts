export const CSP_NONCE_PATTERN = /'nonce-([^']+)'/;

export function generateNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://app.sandbox.midtrans.com https://app.midtrans.com`,
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
}