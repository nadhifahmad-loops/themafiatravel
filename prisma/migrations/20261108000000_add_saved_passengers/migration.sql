-- CreateTable
CREATE TABLE "SavedPassenger" (
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

-- CreateIndex
CREATE INDEX "SavedPassenger_userId_idx" ON "SavedPassenger"("userId");

-- CreateIndex
CREATE INDEX "SavedPassenger_userId_identityType_identityNumber_idx" ON "SavedPassenger"("userId", "identityType", "identityNumber");

-- AddForeignKey
ALTER TABLE "SavedPassenger" ADD CONSTRAINT "SavedPassenger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
