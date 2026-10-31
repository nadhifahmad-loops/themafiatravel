-- Kartu promo dinamis di halaman utama (pesawat / hotel / kereta)
CREATE TABLE "PromoRoute" (
    "id" SERIAL NOT NULL,
    "service" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "titleEn" TEXT,
    "badgeId" TEXT,
    "badgeEn" TEXT,
    "image" TEXT NOT NULL,
    "priceFrom" INTEGER NOT NULL,
    "validUntil" TIMESTAMP(3),
    "origin" TEXT,
    "destination" TEXT,
    "airline" TEXT,
    "airlineImg" TEXT,
    "destinationId" TEXT,
    "q" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoRoute_pkey" PRIMARY KEY ("id")
);

-- Pembacaan homepage: WHERE service = ? AND isActive AND validUntil >= now ORDER BY sortOrder
CREATE INDEX "PromoRoute_service_isActive_sortOrder_idx" ON "PromoRoute"("service", "isActive", "sortOrder");

-- Filter kedaluwarsa di endpoint publik
CREATE INDEX "PromoRoute_validUntil_idx" ON "PromoRoute"("validUntil");
