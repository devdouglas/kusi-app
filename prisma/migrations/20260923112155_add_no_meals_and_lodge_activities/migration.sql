-- CreateEnum
CREATE TYPE "LodgeActivityPricingBasis" AS ENUM ('PER_PERSON', 'PER_GROUP', 'FIXED_PRICE');

-- AlterEnum
ALTER TYPE "LineItemCategory" ADD VALUE IF NOT EXISTS 'LODGE_ACTIVITY';

-- AlterEnum
ALTER TYPE "MealPlan" ADD VALUE IF NOT EXISTS 'NO_MEALS';

-- CreateTable
CREATE TABLE "AccommodationActivity" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricingBasis" "LodgeActivityPricingBasis" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccommodationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccommodationActivity_accommodationId_idx" ON "AccommodationActivity"("accommodationId");

-- CreateIndex
CREATE INDEX "AccommodationActivity_archived_idx" ON "AccommodationActivity"("archived");

-- AddForeignKey
ALTER TABLE "AccommodationActivity" ADD CONSTRAINT "AccommodationActivity_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
