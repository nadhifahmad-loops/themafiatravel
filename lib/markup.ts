import { prisma } from './prisma';

export interface MarkupSettings {
  flight: number;
  hotel: number;
  train: number;
  insurance: number;
}

const DEFAULT: MarkupSettings = { flight: 50000, hotel: 10, train: 15000, insurance: 5 };

export async function getMarkup(): Promise<MarkupSettings> {
  try {
    const row = await prisma.markupSetting.findUnique({ where: { key: 'default' } });
    if (!row) return DEFAULT;
    return { flight: row.flight, hotel: row.hotel, train: row.train, insurance: row.insurance };
  } catch {
    return DEFAULT;
  }
}

/** Apply flat markup per pax (flight, train) */
export function applyFlatMarkup(amount: number, markupRp: number, paxCount: number): number {
  return amount + markupRp * paxCount;
}

/** Apply percentage markup (hotel, insurance) */
export function applyPercentMarkup(amount: number, markupPct: number): number {
  return amount * (1 + markupPct / 100);
}
