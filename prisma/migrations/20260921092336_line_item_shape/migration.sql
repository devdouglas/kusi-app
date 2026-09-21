/*
  Warnings:

  - You are about to drop the column `libraryUnitCents` on the `QuoteLineItem` table. All the data in the column will be lost.
  - Added the required column `originalTotalCents` to the `QuoteLineItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuoteLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceId" TEXT,
    "description" TEXT NOT NULL,
    "originalCurrency" TEXT NOT NULL,
    "originalUnitCents" INTEGER,
    "quantity" INTEGER,
    "originalTotalCents" INTEGER NOT NULL,
    "rateMicros" INTEGER NOT NULL,
    "totalUsdCents" INTEGER NOT NULL,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "libraryTotalCents" INTEGER,
    "libraryCurrency" TEXT,
    "notes" TEXT,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteLineItem_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "QuoteDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuoteLineItem" ("category", "createdAt", "data", "dayId", "description", "id", "libraryCurrency", "manualOverride", "notes", "originalCurrency", "originalUnitCents", "quantity", "rateMicros", "sortOrder", "sourceId", "totalUsdCents", "updatedAt") SELECT "category", "createdAt", "data", "dayId", "description", "id", "libraryCurrency", "manualOverride", "notes", "originalCurrency", "originalUnitCents", "quantity", "rateMicros", "sortOrder", "sourceId", "totalUsdCents", "updatedAt" FROM "QuoteLineItem";
DROP TABLE "QuoteLineItem";
ALTER TABLE "new_QuoteLineItem" RENAME TO "QuoteLineItem";
CREATE INDEX "QuoteLineItem_dayId_idx" ON "QuoteLineItem"("dayId");
CREATE INDEX "QuoteLineItem_category_idx" ON "QuoteLineItem"("category");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
