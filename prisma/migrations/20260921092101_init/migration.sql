-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "rateMicros" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Accommodation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "notes" TEXT,
    "currency" TEXT NOT NULL,
    "pricingBasis" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AccommodationRoomType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accommodationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AccommodationRoomType_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccommodationRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accommodationId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "mealPlan" TEXT NOT NULL,
    "adultSharingCents" INTEGER,
    "child5to12Cents" INTEGER,
    "childUnder5Cents" INTEGER,
    "singleCents" INTEGER,
    "standardRoomCents" INTEGER,
    "singleRoomCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccommodationRate_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccommodationRate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "AccommodationRoomType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleType" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TrainJourney" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route" TEXT NOT NULL,
    "firstClassCents" INTEGER NOT NULL,
    "secondClassCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TransferRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FlightRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientName" TEXT NOT NULL,
    "tripTitle" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children5to12" INTEGER NOT NULL DEFAULT 0,
    "childrenUnder5" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rateMicros" INTEGER NOT NULL,
    "marginPercent" INTEGER,
    "sellingPriceCents" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuoteDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    CONSTRAINT "QuoteDay_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceId" TEXT,
    "description" TEXT NOT NULL,
    "originalCurrency" TEXT NOT NULL,
    "originalUnitCents" INTEGER NOT NULL,
    "rateMicros" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalUsdCents" INTEGER NOT NULL,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "libraryUnitCents" INTEGER,
    "libraryCurrency" TEXT,
    "notes" TEXT,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteLineItem_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "QuoteDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Accommodation_name_idx" ON "Accommodation"("name");

-- CreateIndex
CREATE INDEX "Accommodation_archived_idx" ON "Accommodation"("archived");

-- CreateIndex
CREATE INDEX "AccommodationRoomType_accommodationId_idx" ON "AccommodationRoomType"("accommodationId");

-- CreateIndex
CREATE INDEX "AccommodationRate_accommodationId_idx" ON "AccommodationRate"("accommodationId");

-- CreateIndex
CREATE UNIQUE INDEX "AccommodationRate_roomTypeId_season_mealPlan_key" ON "AccommodationRate"("roomTypeId", "season", "mealPlan");

-- CreateIndex
CREATE INDEX "TransportRate_vehicleType_idx" ON "TransportRate"("vehicleType");

-- CreateIndex
CREATE INDEX "TransportRate_archived_idx" ON "TransportRate"("archived");

-- CreateIndex
CREATE INDEX "TrainJourney_route_idx" ON "TrainJourney"("route");

-- CreateIndex
CREATE INDEX "TrainJourney_archived_idx" ON "TrainJourney"("archived");

-- CreateIndex
CREATE INDEX "TransferRate_route_idx" ON "TransferRate"("route");

-- CreateIndex
CREATE INDEX "TransferRate_archived_idx" ON "TransferRate"("archived");

-- CreateIndex
CREATE INDEX "ActivityRate_name_idx" ON "ActivityRate"("name");

-- CreateIndex
CREATE INDEX "ActivityRate_archived_idx" ON "ActivityRate"("archived");

-- CreateIndex
CREATE INDEX "FlightRate_route_idx" ON "FlightRate"("route");

-- CreateIndex
CREATE INDEX "FlightRate_archived_idx" ON "FlightRate"("archived");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_clientName_idx" ON "Quote"("clientName");

-- CreateIndex
CREATE INDEX "QuoteDay_quoteId_idx" ON "QuoteDay"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteDay_quoteId_dayNumber_key" ON "QuoteDay"("quoteId", "dayNumber");

-- CreateIndex
CREATE INDEX "QuoteLineItem_dayId_idx" ON "QuoteLineItem"("dayId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_category_idx" ON "QuoteLineItem"("category");
