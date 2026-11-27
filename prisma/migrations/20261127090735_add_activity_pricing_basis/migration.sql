-- CreateEnum
CREATE TYPE "ActivityPricingBasis" AS ENUM ('PER_PERSON', 'PER_GROUP');

-- AlterTable
ALTER TABLE "ActivityRate" ADD COLUMN     "pricingBasis" "ActivityPricingBasis" NOT NULL DEFAULT 'PER_PERSON';
