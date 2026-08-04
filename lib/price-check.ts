export type PriceCheckKind = 'ok' | 'changed' | 'unverifiable' | 'invalid';

export interface PriceCheckResult {
  ok: boolean;
  kind: PriceCheckKind;
  originalPrice: number;
  newPrice?: number;
  message?: string;
}

export interface PriceCheckInput {
  submitted: number;
  refreshed?: number | null;
  tolerance?: number;
  lowerBoundOnly?: boolean;
}

const fmtIDR = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

function changedMessage(original: number, next: number): string {
  return `Harga telah berubah dari ${fmtIDR(original)} menjadi ${fmtIDR(next)}. Silakan cari ulang.`;
}

export function checkSubmittedPrice(input: PriceCheckInput): PriceCheckResult {
  const tolerance = input.tolerance ?? 0.05;
  const submitted = Number(input.submitted);

  if (!Number.isFinite(submitted) || submitted <= 0) {
    return { ok: false, kind: 'invalid', originalPrice: submitted, message: 'total_amount tidak valid.' };
  }

  const refreshed = Number(input.refreshed);
  if (!Number.isFinite(refreshed) || refreshed <= 0) {
    return {
      ok: false,
      kind: 'unverifiable',
      originalPrice: submitted,
      newPrice: refreshed,
      message: 'Harga tidak dapat diverifikasi saat ini.',
    };
  }

  if (input.lowerBoundOnly) {
    const minExpected = refreshed * (1 - tolerance);
    if (submitted < minExpected) {
      return {
        ok: false,
        kind: 'changed',
        originalPrice: submitted,
        newPrice: refreshed,
        message: changedMessage(submitted, refreshed),
      };
    }
    return { ok: true, kind: 'ok', originalPrice: submitted, newPrice: refreshed };
  }

  const maxAllowed = Math.abs(submitted * tolerance);
  if (Math.abs(refreshed - submitted) > maxAllowed) {
    return {
      ok: false,
      kind: 'changed',
      originalPrice: submitted,
      newPrice: refreshed,
      message: changedMessage(submitted, refreshed),
    };
  }
  return { ok: true, kind: 'ok', originalPrice: submitted, newPrice: refreshed };
}