-- AlterEnum
ALTER TYPE "LineItemCategory" ADD VALUE 'PARK_ENTRANCE_FEE';

-- CreateTable
CREATE TABLE "AccommodationChildAgeBracket" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccommodationChildAgeBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationChildRate" (
    "id" TEXT NOT NULL,
    "accommodationRateId" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,

    CONSTRAINT "AccommodationChildRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Park" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "adultFeeCents" INTEGER NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Park_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkChildAgeBracket" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ParkChildAgeBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteChild" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "age" INTEGER,
    "legacyLabel" TEXT,

    CONSTRAINT "QuoteChild_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccommodationChildAgeBracket_accommodationId_idx" ON "AccommodationChildAgeBracket"("accommodationId");

-- CreateIndex
CREATE INDEX "AccommodationChildRate_accommodationRateId_idx" ON "AccommodationChildRate"("accommodationRateId");

-- CreateIndex
CREATE INDEX "AccommodationChildRate_bracketId_idx" ON "AccommodationChildRate"("bracketId");

-- CreateIndex
CREATE UNIQUE INDEX "AccommodationChildRate_accommodationRateId_bracketId_key" ON "AccommodationChildRate"("accommodationRateId", "bracketId");

-- CreateIndex
CREATE INDEX "Park_name_idx" ON "Park"("name");

-- CreateIndex
CREATE INDEX "Park_archived_idx" ON "Park"("archived");

-- CreateIndex
CREATE INDEX "ParkChildAgeBracket_parkId_idx" ON "ParkChildAgeBracket"("parkId");

-- CreateIndex
CREATE INDEX "QuoteChild_quoteId_idx" ON "QuoteChild"("quoteId");

-- AddForeignKey
ALTER TABLE "AccommodationChildAgeBracket" ADD CONSTRAINT "AccommodationChildAgeBracket_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationChildRate" ADD CONSTRAINT "AccommodationChildRate_accommodationRateId_fkey" FOREIGN KEY ("accommodationRateId") REFERENCES "AccommodationRate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationChildRate" ADD CONSTRAINT "AccommodationChildRate_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "AccommodationChildAgeBracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkChildAgeBracket" ADD CONSTRAINT "ParkChildAgeBracket_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteChild" ADD CONSTRAINT "QuoteChild_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
