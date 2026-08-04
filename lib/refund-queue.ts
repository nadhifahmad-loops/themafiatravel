export const REFUND_QUEUE_STATUSES = ['refund_requested', 'refund'] as const;

export function isRefundQueueBooking(status?: string | null) {
  return Boolean(status && REFUND_QUEUE_STATUSES.includes(status as (typeof REFUND_QUEUE_STATUSES)[number]));
}

export function getRefundQueueStatuses() {
  return [...REFUND_QUEUE_STATUSES];
}
