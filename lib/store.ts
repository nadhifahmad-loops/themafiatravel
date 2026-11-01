// lib/store.ts
// Aligned dengan schema.prisma terbaru — semua field nama-namanya 1:1 dengan Prisma model

import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

export const bookingStore = {

  // ── CREATE ───────────────────────────────────────────────────────────────
  // Menyimpan pesanan baru ke database.
  // Semua field opsional — Prisma akan ignore field undefined.
  create: async (data: {
    id: string;
    userId?: string;
    orderNumber: string;
    bookingType: string;
    status?: string;
    totalAmount: number;
    currency?: string;
    // Midtrans
    snapToken?: string;
    snapRedirectUrl?: string;
    // Hotel
    hotelName?: string;
    checkinDate?: string | Date | null;
    checkoutDate?: string | Date | null;
    // Flight / Train
    routeLabel?: string;
    origin?: string;
    destination?: string;
    departureDate?: string | Date | null;
    flightNumber?: string;
    airlineName?: string;
    // Orbis
    pnr?: string;
    provider?: string;
    // JSON blobs
    passengerData?: Prisma.InputJsonValue;
    bookingData?: Prisma.InputJsonValue;
    // Coupon
    couponId?: number;
    couponCode?: string;
    discountAmount?: number;
  }) => {
    return await prisma.booking.create({
      data: {
        id: data.id,
        userId: data.userId,
        orderNumber: data.orderNumber,
        bookingType: data.bookingType,
        status: data.status || 'pending_payment',
        totalAmount: data.totalAmount,
        currency: data.currency || 'IDR',
        // Midtrans
        snapToken: data.snapToken,
        snapRedirectUrl: data.snapRedirectUrl,
        // Hotel
        hotelName: data.hotelName,
        checkinDate: data.checkinDate ? new Date(data.checkinDate) : null,
        checkoutDate: data.checkoutDate ? new Date(data.checkoutDate) : null,
        // Flight / Train
        routeLabel: data.routeLabel,
        origin: data.origin,
        destination: data.destination,
        departureDate: data.departureDate ? new Date(data.departureDate) : null,
        flightNumber: data.flightNumber,
        airlineName: data.airlineName,
        // Orbis
        pnr: data.pnr,
        provider: data.provider,
        // JSON
        passengerData: data.passengerData ?? undefined,
        bookingData: data.bookingData ?? undefined,
        // Coupon
        couponId: data.couponId ?? null,
        couponCode: data.couponCode ?? null,
        discountAmount: data.discountAmount ?? 0,
      },
    });
  },

  // ── FIND BY ID ─────────────────────────────────────────────────────────────
  findById: async (id: string) => {
    return await prisma.booking.findUnique({ where: { id } });
  },

  // ── FIND BY ORDER NUMBER ───────────────────────────────────────────────────
  findByOrderNumber: async (orderNumber: string) => {
    return await prisma.booking.findUnique({ where: { orderNumber } });
  },

  // ── GET ALL USER BOOKINGS ──────────────────────────────────────────────────
  getUserBookings: async (userId: string) => {
    return await prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ── GET USER BOOKINGS BY TYPE ──────────────────────────────────────────────
  getUserBookingsByType: async (userId: string, bookingType: string) => {
    return await prisma.booking.findMany({
      where: { userId, bookingType },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ── FIND MANY (filter bebas) ───────────────────────────────────────────────
  findMany: async (args: {
    where?: { userId?: string; bookingType?: string; status?: string };
    orderBy?: Prisma.BookingOrderByWithRelationInput | Prisma.BookingOrderByWithRelationInput[];
    take?: number;
    skip?: number;
  }) => {
    return await prisma.booking.findMany({
      where: args.where,
      orderBy: args.orderBy || { createdAt: 'desc' },
      take: args.take,
      skip: args.skip,
    });
  },

  // ── MERGE BOOKING DATA ───────────────────────────────────────────────────
  // Read-modify-write pada kolom JSON dijalankan dalam transaksi supaya dua
  // penulis bersamaan (webhook + remider/expiry) tidak saling menimpa data.
  mergeBookingData: async (id: string, data: Record<string, unknown>) => {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({ where: { id } });
      if (!existing) return null;

      const nextBookingData = {
        ...(existing.bookingData as Record<string, unknown> | null),
        ...(data.bookingData as Record<string, unknown> | undefined),
      };

      return await tx.booking.update({
        where: { id },
        data: {
          ...(data.status ? { status: data.status } : {}),
          ...(data.paymentId ? { paymentId: data.paymentId } : {}),
          ...(data.paymentStatus ? { paymentStatus: data.paymentStatus } : {}),
          ...(data.paymentType ? { paymentType: data.paymentType } : {}),
          ...(data.paidAt ? { paidAt: data.paidAt } : {}),
          ...(data.bookingData ? { bookingData: nextBookingData as Prisma.InputJsonValue } : {}),
        },
      });
    });
  },

  recordFlightReschedule: async (id: string, change: {
    pnr: string;
    provider?: string;
    originalDepartureDate?: string | null;
    departureDate?: string | null;
    origin?: string | null;
    destination?: string | null;
    flightNumber?: string | null;
    amount?: number | null;
    adminFee?: number | null;
    providerBookings?: unknown[];
    journeys: Array<{
      pnr: string;
      origin: string;
      destination: string;
      departureDate: string;
      flightNumber?: string;
    }>;
  }) => {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({ where: { id } });
      if (!existing) return null;

      const currentData = existing.bookingData && typeof existing.bookingData === 'object'
        ? existing.bookingData as Record<string, unknown>
        : {};
      const previousHistory = Array.isArray(currentData.rescheduleHistory)
        ? currentData.rescheduleHistory
        : [];
      const event = {
        pnr: change.pnr,
        provider: change.provider ?? null,
        originalDepartureDate: change.originalDepartureDate ?? null,
        departureDate: change.departureDate ?? null,
        origin: change.origin ?? null,
        destination: change.destination ?? null,
        flightNumber: change.flightNumber ?? null,
        amount: change.amount ?? null,
        adminFee: change.adminFee ?? null,
        journeys: change.journeys,
        changedAt: new Date().toISOString(),
      };

      return await tx.booking.update({
        where: { id },
        data: {
          ...(change.departureDate ? { departureDate: new Date(change.departureDate) } : {}),
          ...(change.origin ? { origin: change.origin } : {}),
          ...(change.destination ? { destination: change.destination } : {}),
          ...(change.origin && change.destination
            ? { routeLabel: `${change.origin} → ${change.destination}` }
            : {}),
          ...(change.flightNumber ? { flightNumber: change.flightNumber } : {}),
          bookingData: {
            ...currentData,
            ...(change.providerBookings ? { provider_bookings: change.providerBookings } : {}),
            rescheduleHistory: [...previousHistory, event].slice(-20),
          } as Prisma.InputJsonValue,
        },
      });
    });
  },

  // ── UPDATE STATUS ──────────────────────────────────────────────────────────
  // Dipanggil oleh Midtrans webhook saat status pembayaran berubah.
  updateStatus: async (
    id: string,
    newStatus: string,
    extra?: {
      pnr?: string;
      paymentId?: string;
      paymentStatus?: string;
      paymentType?: string;
      paidAt?: Date;
    }
  ) => {
    return await prisma.booking.update({
      where: { id },
      data: {
        status: newStatus,
        ...(extra?.pnr && { pnr: extra.pnr }),
        ...(extra?.paymentId && { paymentId: extra.paymentId }),
        ...(extra?.paymentStatus && { paymentStatus: extra.paymentStatus }),
        ...(extra?.paymentType && { paymentType: extra.paymentType }),
        ...(extra?.paidAt && { paidAt: extra.paidAt }),
        // Tandai paidAt otomatis jika status = paid
        ...(newStatus === 'paid' && !extra?.paidAt && { paidAt: new Date() }),
      },
    });
  },

  // ── CANCEL BOOKING ─────────────────────────────────────────────────────────
  cancelBooking: async (
    id: string,
    options?: { reason?: string; cancelType?: 'void' | 'refund' }
  ) => {
    return await prisma.booking.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        ...(options?.reason && { cancelReason: options.reason }),
        ...(options?.cancelType && { cancelType: options.cancelType }),
      },
    });
  },

  // ── REQUEST REFUND (manual queue) ──────────────────────────────────────────
  // Booking dibatalkan di vendor, tapi dana belum dikembalikan — menunggu
  // review admin di /admin/refund-queue. Guard status memastikan booking yang
  // sudah diproses refund tidak bisa dimasukkan antrian dua kali.
  requestRefund: async (id: string, opts: { amount: number | null; reason?: string }) => {
    const eligible = ['paid', 'issued', 'pending_payment'];
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({ where: { id } });
      if (!existing) return null;
      if (!eligible.includes(existing.status)) {
        console.warn(`[store.requestRefund] status ${existing.status} tidak eligible; dilewati.`);
        return null;
      }
      const currentData = (existing.bookingData as Record<string, unknown>) || {};
      const updated = await tx.booking.updateMany({
        where: { id, status: { in: eligible } },
        data: {
          status: 'refund_requested',
          cancelType: 'refund',
          cancelledAt: new Date(),
          ...(opts.reason ? { cancelReason: opts.reason } : {}),
          bookingData: {
            ...currentData,
            refundRequest: {
              amount: opts.amount === null ? null : Math.round(opts.amount),
              reason: opts.reason || '',
              requestedAt: new Date().toISOString(),
              mode: 'manual',
            },
          } as Prisma.InputJsonValue,
        },
      });
      if (updated.count === 0) return null;
      return await tx.booking.findUnique({ where: { id } });
    });
  },

  // ── AUTO REFUND ────────────────────────────────────────────────────────────
  // Refund diproses otomatis (tanpa review): langsung cancelled + catat hasilnya.
  autoRefund: async (id: string, opts: { amount: number; reason?: string; midtrans?: unknown }) => {
    const eligible = ['paid', 'issued', 'pending_payment'];
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({ where: { id } });
      if (!existing) return null;
      if (!eligible.includes(existing.status)) {
        console.warn(`[store.autoRefund] status ${existing.status} tidak eligible; dilewati.`);
        return null;
      }
      const currentData = (existing.bookingData as Record<string, unknown>) || {};
      const now = new Date().toISOString();
      const updated = await tx.booking.updateMany({
        where: { id, status: { in: eligible } },
        data: {
          status: 'cancelled',
          cancelType: 'refund',
          cancelledAt: new Date(),
          ...(opts.reason ? { cancelReason: opts.reason } : {}),
          bookingData: {
            ...currentData,
            refundRequest: {
              amount: Math.round(opts.amount),
              reason: opts.reason || '',
              requestedAt: now,
              mode: 'auto',
            },
            refundResult: {
              amount: Math.round(opts.amount),
              refundedAt: now,
              processedBy: 'auto',
              midtrans: (opts.midtrans as Prisma.InputJsonValue) ?? null,
            },
          } as Prisma.InputJsonValue,
        },
      });
      if (updated.count === 0) return null;
      return await tx.booking.findUnique({ where: { id } });
    });
  },

  // ── COMPLETE REFUND (admin mengeksekusi dari queue) ─────────────────────
  completeRefund: async (id: string, opts: { amount: number; reason?: string; midtrans?: unknown; processedBy: string }) => {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({ where: { id } });
      if (!existing) return null;
      if (existing.status !== 'refund_requested') {
        console.warn(`[store.completeRefund] status ${existing.status} bukan refund_requested; dilewati.`);
        return null;
      }
      const currentData = (existing.bookingData as Record<string, unknown>) || {};
      const currentRefundRequest = currentData.refundRequest && typeof currentData.refundRequest === 'object'
        && !Array.isArray(currentData.refundRequest)
        ? currentData.refundRequest as Record<string, unknown>
        : {};
      const updated = await tx.booking.updateMany({
        where: { id, status: 'refund_requested' },
        data: {
          status: 'cancelled',
          cancelledAt: existing.cancelledAt || new Date(),
          ...(opts.reason ? { cancelReason: opts.reason } : {}),
          bookingData: {
            ...currentData,
            refundRequest: {
              ...currentRefundRequest,
              amount: Math.round(opts.amount),
              verifiedAt: new Date().toISOString(),
              verifiedBy: opts.processedBy,
            },
            refundResult: {
              amount: Math.round(opts.amount),
              refundedAt: new Date().toISOString(),
              processedBy: opts.processedBy,
              midtrans: (opts.midtrans as Prisma.InputJsonValue) ?? null,
            },
          } as Prisma.InputJsonValue,
        },
      });
      if (updated.count === 0) return null;
      return await tx.booking.findUnique({ where: { id } });
    });
  },

  // ── LOG PAYMENT ────────────────────────────────────────────────────────────
  // Simpan record Payment terpisah (untuk audit trail).
  logPayment: async (data: {
    bookingId: string;
    orderId: string;
    amount: number;
    snapToken?: string;
    snapRedirectUrl?: string;
    status?: string;
  }) => {
    return await prisma.payment.create({
      data: {
        bookingId: data.bookingId,
        orderId: data.orderId,
        amount: data.amount,
        status: data.status || 'pending',
        snapToken: data.snapToken,
        snapRedirectUrl: data.snapRedirectUrl,
      },
    });
  },

  // ── UPDATE PAYMENT ─────────────────────────────────────────────────────────
  // Update status Payment dari webhook Midtrans.
  updatePayment: async (
    orderId: string,
    data: {
      status: string;
      paymentType?: string;
      midtransResponse?: unknown;
      paidAt?: Date;
    }
  ) => {
    return await prisma.payment.update({
      where: { orderId },
      data: {
        status: data.status,
        ...(data.paymentType && { paymentType: data.paymentType }),
        ...(data.midtransResponse ? { midtransResponse: data.midtransResponse as Prisma.InputJsonValue } : {}),
        ...(data.paidAt && { paidAt: data.paidAt }),
        ...(data.status === 'settlement' && { paidAt: new Date() }),
      },
    });
  },
};

// ── ORBIS REFUND STATE MAPPING (§4.16) ────────────────────────────────────
// Maps Orbis vendor-side refund states to app-level statuses.
// Orbis states: draft → confirm → sent → finalize → done
// App statuses: refund_requested → cancelled (with refundResult)
export function mapOrbisRefundState(orbisState: string): string {
  const stateMap: Record<string, string> = {
    draft: 'refund_requested',
    confirm: 'refund_requested',
    sent: 'refund_requested',
    finalize: 'refund_processing',
    done: 'cancelled',
  };
  return stateMap[orbisState] || 'refund_requested';
}

export const ORBIS_REFUND_STATE_LABELS: Record<string, string> = {
  draft: 'Permintaan refund baru',
  confirm: 'Refund dikonfirmasi',
  sent: 'Refund dikirim ke vendor',
  finalize: 'Refund sedang diproses',
  done: 'Refund selesai',
};