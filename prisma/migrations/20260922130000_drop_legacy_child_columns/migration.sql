-- AlterTable
ALTER TABLE "AccommodationRate" DROP COLUMN "child5to12Cents",
DROP COLUMN "childUnder5Cents";

-- AlterTable
ALTER TABLE "Quote" DROP COLUMN "children5to12",
DROP COLUMN "childrenUnder5";
