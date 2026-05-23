// lib/store.ts
// Aligned dengan schema.prisma terbaru — semua field nama-namanya 1:1 dengan Prisma model

import { prisma } from './prisma';

export const bookingStore = {

  // ── CREATE ─────────────────────────────────────────────────────────────────
  // Menyimpan pesanan baru ke database.
  // Semua field opsional — Prisma akan ignore field undefined.
  create: async (data: {
    id: string;
    userId: string;
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
    passengerData?: any;
    bookingData?: any;
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
    orderBy?: any;
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
      midtransResponse?: any;
      paidAt?: Date;
    }
  ) => {
    return await prisma.payment.update({
      where: { orderId },
      data: {
        status: data.status,
        ...(data.paymentType && { paymentType: data.paymentType }),
        ...(data.midtransResponse && { midtransResponse: data.midtransResponse }),
        ...(data.paidAt && { paidAt: data.paidAt }),
        ...(data.status === 'settlement' && { paidAt: new Date() }),
      },
    });
  },
};