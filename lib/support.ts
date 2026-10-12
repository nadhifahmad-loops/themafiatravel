// ─── Support contact helpers ─────────────────────────────────────────────────

/** Nomor WhatsApp support (format internasional tanpa "+"). */
export const SUPPORT_WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT || '6281234567890';

/** Email support utama. */
export const SUPPORT_EMAIL = 'support@themafiatravel.com';

/** Email khusus privasi. */
export const PRIVACY_EMAIL = 'privacy@themafiatravel.com';

/**
 * Bangun URL WhatsApp (wa.me) menuju tim support.
 * @param message Pesan awal yang otomatis terisi di chat.
 */
export function getSupportWhatsAppUrl(message?: string): string {
  const base = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
