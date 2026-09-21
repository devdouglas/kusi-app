-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'KES');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('LOW', 'SHOULDER', 'HIGH');

-- CreateEnum
CREATE TYPE "MealPlan" AS ENUM ('BB', 'HB', 'FB', 'FI');

-- CreateEnum
CREATE TYPE "PricingBasis" AS ENUM ('PER_PERSON', 'PER_ROOM');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('VAN', 'JEEP_5PAX', 'JEEP_8PAX');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'FINAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LineItemCategory" AS ENUM ('ACCOMMODATION', 'PRIVATE_TRANSPORT', 'TRAIN', 'TAXI_TRANSFER', 'ACTIVITY', 'DOMESTIC_FLIGHT', 'VILLA', 'MISC');

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "rateMicros" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accommodation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "notes" TEXT,
    "currency" "Currency" NOT NULL,
    "pricingBasis" "PricingBasis" NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationRoomType" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccommodationRoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationRate" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "season" "Season" NOT NULL,
    "mealPlan" "MealPlan" NOT NULL,
    "adultSharingCents" INTEGER,
    "child5to12Cents" INTEGER,
    "childUnder5Cents" INTEGER,
    "singleCents" INTEGER,
    "standardRoomCents" INTEGER,
    "singleRoomCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccommodationRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportRate" (
    "id" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainJourney" (
    "id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "firstClassCents" INTEGER NOT NULL,
    "secondClassCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferRate" (
    "id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightRate" (
    "id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "tripTitle" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children5to12" INTEGER NOT NULL DEFAULT 0,
    "childrenUnder5" INTEGER NOT NULL DEFAULT 0,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "rateMicros" INTEGER NOT NULL,
    "marginPercent" INTEGER,
    "sellingPriceCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteDay" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dayNumber" INTEGER NOT NULL,

    CONSTRAINT "QuoteDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "category" "LineItemCategory" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceId" TEXT,
    "description" TEXT NOT NULL,
    "originalCurrency" "Currency" NOT NULL,
    "originalUnitCents" INTEGER,
    "quantity" INTEGER,
    "originalTotalCents" INTEGER NOT NULL,
    "rateMicros" INTEGER NOT NULL,
    "totalUsdCents" INTEGER NOT NULL,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "libraryTotalCents" INTEGER,
    "libraryCurrency" "Currency",
    "notes" TEXT,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "AccommodationRoomType" ADD CONSTRAINT "AccommodationRoomType_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationRate" ADD CONSTRAINT "AccommodationRate_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationRate" ADD CONSTRAINT "AccommodationRate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "AccommodationRoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteDay" ADD CONSTRAINT "QuoteDay_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "QuoteDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

