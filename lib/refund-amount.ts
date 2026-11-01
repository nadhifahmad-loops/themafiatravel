function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function amount(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function extractAmount(value: unknown, depth: number): number | null {
  const root = asRecord(value);
  if (!root) return null;

  for (const key of ['refund_amount', 'received_amount']) {
    const direct = amount(root[key]);
    if (direct !== null) return direct;
  }

  const rawFees = root.refund_fee;
  const fees = Array.isArray(rawFees) ? rawFees : rawFees ? [rawFees] : [];
  const amounts = fees.map((fee) => amount(asRecord(fee)?.received_amount));
  if (amounts.length && amounts.every((entry): entry is number => entry !== null)) {
    return amounts.reduce((total, entry) => total + entry, 0);
  }

  if (depth < 3) {
    for (const key of ['check_refund_amount', 'cancel_booking', 'data', 'response']) {
      const nested = extractAmount(root[key], depth + 1);
      if (nested !== null) return nested;
    }
  }
  return null;
}

export function extractVendorRefundAmount(value: unknown): number | null {
  return extractAmount(value, 0);
}
