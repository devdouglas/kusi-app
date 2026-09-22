-- CreateTable
CREATE TABLE "AccommodationChildAgeBracket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accommodationId" TEXT NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AccommodationChildAgeBracket_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccommodationChildRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accommodationRateId" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    CONSTRAINT "AccommodationChildRate_accommodationRateId_fkey" FOREIGN KEY ("accommodationRateId") REFERENCES "AccommodationRate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccommodationChildRate_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "AccommodationChildAgeBracket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Park" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "adultFeeCents" INTEGER NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ParkChildAgeBracket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parkId" TEXT NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ParkChildAgeBracket_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteChild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "age" INTEGER,
    "legacyLabel" TEXT,
    CONSTRAINT "QuoteChild_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
