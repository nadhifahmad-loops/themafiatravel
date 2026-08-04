import crypto from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Validasi secret untuk cron job.
 *
 * Vercel Cron Jobs mengirim secret lewat header:
 *   Authorization: Bearer <CRON_SECRET>
 * (bukan header custom). Untuk kompatibilitas dengan pemanggilan manual /
 * GitHub Actions, header `x-cron-secret` tetap diterima sebagai fallback.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const auth = req.headers.get('authorization') || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(auth);
  const provided = (bearer ? bearer[1] : req.headers.get('x-cron-secret')) || '';

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
