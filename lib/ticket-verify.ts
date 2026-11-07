import { createHmac, timingSafeEqual } from 'node:crypto';

export function genVerificationHash(id: string): string {
  const secret = process.env.TICKET_VERIFY_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('Ticket verification requires a secret with at least 32 bytes.');
  }

  const signature = createHmac('sha256', secret).update(`TMT-VERIFY-${id}`).digest('hex').slice(0, 32);
  return `TMT-${signature.toUpperCase()}`;
}

export function isValidVerificationHash(id: string, candidate: string): boolean {
  if (!/^TMT-[A-F0-9]{32}$/i.test(candidate)) return false;

  const expected = Buffer.from(genVerificationHash(id), 'ascii');
  const received = Buffer.from(candidate.toUpperCase(), 'ascii');
  return timingSafeEqual(expected, received);
}

export function verifyUrl(id: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://themafiatravel.com').replace(/\/+$/, '');
  return `${base}/verify/${encodeURIComponent(id)}?h=${genVerificationHash(id)}`;
}

export function verifyPath(id: string): string {
  return `/verify/${encodeURIComponent(id)}?h=${genVerificationHash(id)}`;
}
