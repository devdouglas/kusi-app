-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AccommodationRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accommodationId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "mealPlan" TEXT NOT NULL,
    "adultSharingCents" INTEGER,
    "singleCents" INTEGER,
    "standardRoomCents" INTEGER,
    "singleRoomCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccommodationRate_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccommodationRate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "AccommodationRoomType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AccommodationRate" ("accommodationId", "adultSharingCents", "createdAt", "id", "mealPlan", "roomTypeId", "season", "singleCents", "singleRoomCents", "standardRoomCents", "updatedAt") SELECT "accommodationId", "adultSharingCents", "createdAt", "id", "mealPlan", "roomTypeId", "season", "singleCents", "singleRoomCents", "standardRoomCents", "updatedAt" FROM "AccommodationRate";
DROP TABLE "AccommodationRate";
ALTER TABLE "new_AccommodationRate" RENAME TO "AccommodationRate";
CREATE INDEX "AccommodationRate_accommodationId_idx" ON "AccommodationRate"("accommodationId");
CREATE UNIQUE INDEX "AccommodationRate_roomTypeId_season_mealPlan_key" ON "AccommodationRate"("roomTypeId", "season", "mealPlan");
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientName" TEXT NOT NULL,
    "tripTitle" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rateMicros" INTEGER NOT NULL,
    "marginPercent" INTEGER,
    "sellingPriceCents" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Quote" ("adults", "clientName", "createdAt", "endDate", "id", "marginPercent", "notes", "rateMicros", "sellingPriceCents", "startDate", "status", "tripTitle", "updatedAt") SELECT "adults", "clientName", "createdAt", "endDate", "id", "marginPercent", "notes", "rateMicros", "sellingPriceCents", "startDate", "status", "tripTitle", "updatedAt" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
CREATE INDEX "Quote_clientName_idx" ON "Quote"("clientName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

