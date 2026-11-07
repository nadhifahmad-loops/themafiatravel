-- Catch-up migration: menyelaraskan database hasil `prisma migrate deploy`
-- dengan prisma/schema.prisma.
--
-- Latar belakang: sebagian tabel/kolom (User.twoFactor*, Coupon.isFeatured,
-- Booking.paidAt/cancel*/dst, SavedPassenger, PasswordReset, AuditLog,
-- BlogPost, Career, Banner, SiteSetting, dll.) sebelumnya hanya ada di
-- schema.prisma dan dibuat lewat `prisma db push`, sehingga database baru
-- yang dibuat dari migrasi tidak lengkap.
--
-- Migrasi ini IDEMPOTEN (IF NOT EXISTS): aman dijalankan pada database baru
-- maupun database yang sudah pernah di-`db push` / sudah punya sebagian objek.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" JSONB;
-- Booking.userId opsional di schema (booking tetap tersimpan saat user dihapus,
-- FK ON DELETE SET NULL). Migrasi 20260805100000 hanya mengganti FK, tetapi kolom
-- masih NOT NULL sehingga penghapusan akun yang punya booking tetap gagal.
ALTER TABLE "Booking" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SavedPassenger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "gender" TEXT,
    "nationalityCode" TEXT NOT NULL DEFAULT 'ID',
    "identityType" TEXT NOT NULL,
    "identityNumber" TEXT NOT NULL,
    "identityExpDate" DATE,
    "identityCountryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPassenger_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentType" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "destinationId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "hotelIdOrbis" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "roomCount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "adultCount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "childCount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "mealType" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "roomDescription" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "priceCode" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "originalPrice" DOUBLE PRECISION;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "nights" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "routeLabel" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "origin" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "destination" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "departureDate" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "flightNumber" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "airlineName" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelType" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
-- CreateTable
CREATE TABLE IF NOT EXISTS "MarkupSetting" (
    "key" TEXT NOT NULL,
    "flight" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "flight_type" TEXT NOT NULL DEFAULT 'flat',
    "hotel" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "hotel_type" TEXT NOT NULL DEFAULT 'percent',
    "train" DOUBLE PRECISION NOT NULL DEFAULT 15000,
    "train_type" TEXT NOT NULL DEFAULT 'flat',
    "insurance" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "insurance_type" TEXT NOT NULL DEFAULT 'percent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarkupSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminNotificationRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerNotificationRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Banner" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "link" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Career" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'full-time',
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Career_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BlogPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "author" TEXT NOT NULL DEFAULT 'Admin',
    "category" TEXT NOT NULL DEFAULT 'Travel Tips',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedPassenger_userId_idx" ON "SavedPassenger"("userId");
CREATE INDEX IF NOT EXISTS "SavedPassenger_userId_identityType_identityNumber_idx" ON "SavedPassenger"("userId", "identityType", "identityNumber");
CREATE INDEX IF NOT EXISTS "Booking_userId_idx" ON "Booking"("userId");
CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status");
CREATE INDEX IF NOT EXISTS "Booking_bookingType_idx" ON "Booking"("bookingType");
CREATE INDEX IF NOT EXISTS "Booking_createdAt_idx" ON "Booking"("createdAt");
CREATE INDEX IF NOT EXISTS "Payment_bookingId_idx" ON "Payment"("bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerification_token_key" ON "EmailVerification"("token");
CREATE INDEX IF NOT EXISTS "EmailVerification_userId_idx" ON "EmailVerification"("userId");
CREATE INDEX IF NOT EXISTS "EmailVerification_token_idx" ON "EmailVerification"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordReset_token_key" ON "PasswordReset"("token");
CREATE INDEX IF NOT EXISTS "PasswordReset_userId_idx" ON "PasswordReset"("userId");
CREATE INDEX IF NOT EXISTS "PasswordReset_token_idx" ON "PasswordReset"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminNotificationRead_userId_key_key" ON "AdminNotificationRead"("userId", "key");
CREATE INDEX IF NOT EXISTS "AdminNotificationRead_userId_idx" ON "AdminNotificationRead"("userId");
CREATE INDEX IF NOT EXISTS "AdminNotificationRead_key_idx" ON "AdminNotificationRead"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerNotificationRead_userId_key_key" ON "CustomerNotificationRead"("userId", "key");
CREATE INDEX IF NOT EXISTS "CustomerNotificationRead_userId_idx" ON "CustomerNotificationRead"("userId");
CREATE INDEX IF NOT EXISTS "CustomerNotificationRead_key_idx" ON "CustomerNotificationRead"("key");
CREATE INDEX IF NOT EXISTS "AuditLog_adminId_idx" ON "AuditLog"("adminId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SiteSetting_key_key" ON "SiteSetting"("key");
CREATE INDEX IF NOT EXISTS "SiteSetting_key_idx" ON "SiteSetting"("key");
CREATE INDEX IF NOT EXISTS "Banner_isActive_sortOrder_idx" ON "Banner"("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "Career_isActive_sortOrder_idx" ON "Career"("isActive", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX IF NOT EXISTS "BlogPost_isPublished_sortOrder_idx" ON "BlogPost"("isPublished", "sortOrder");
CREATE INDEX IF NOT EXISTS "BlogPost_slug_idx" ON "BlogPost"("slug");
CREATE INDEX IF NOT EXISTS "BlogPost_category_idx" ON "BlogPost"("category");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedPassenger_userId_fkey') THEN
    ALTER TABLE "SavedPassenger" ADD CONSTRAINT "SavedPassenger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_bookingId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PasswordReset_userId_fkey') THEN
    ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminNotificationRead_userId_fkey') THEN
    ALTER TABLE "AdminNotificationRead" ADD CONSTRAINT "AdminNotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerNotificationRead_userId_fkey') THEN
    ALTER TABLE "CustomerNotificationRead" ADD CONSTRAINT "CustomerNotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
