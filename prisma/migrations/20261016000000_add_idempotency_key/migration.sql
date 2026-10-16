-- CreateTable: IdempotencyKey (anti double-order checkout)
-- Satu baris = SATU attempt checkout. Primary key tunggal `${bookingType}:${userId ?? 'anon'}:${uuidClient}`
-- menjamin keunikan untuk login maupun guest (Postgres menganggap NULL ≠ NULL,
-- sehingga unique constraint terpisah pada userId tidak cukup untuk guest).
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "bookingType" TEXT NOT NULL,
    "userId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "orderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "response" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_bookingType_userId_idx" ON "IdempotencyKey"("bookingType", "userId");
