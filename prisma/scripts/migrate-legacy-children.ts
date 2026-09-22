/**
 * One-off data migration: converts the old fixed child-age categories
 * (Quote.children5to12 / Quote.childrenUnder5, and
 * AccommodationRate.child5to12Cents / childUnder5Cents) into the new
 * exact-age / accommodation-specific-bracket model.
 *
 * MUST be run after the additive migration that adds QuoteChild,
 * AccommodationChildAgeBracket and AccommodationChildRate, and BEFORE the
 * follow-up migration that drops the old columns — see README.md
 * "Migrating existing child-pricing data" for the full sequence.
 *
 * Reads the legacy columns via raw SQL rather than the generated Prisma
 * Client, because by design this script targets an intermediate schema
 * state (old columns + new tables both present) that the *current*
 * generated client — matching the schema after the columns are dropped —
 * no longer has typed fields for.
 *
 * Safe to run multiple times (idempotent): it skips any quote/accommodation
 * it has already converted.
 *
 * Exact child ages cannot be recovered from an aggregate count, so migrated
 * quote children are stored with `age: null` and a `legacyLabel` (e.g.
 * "5-12") so old quotes stay readable without inventing false precision.
 * Migrated accommodation rates get two representative brackets (0-4 and
 * 5-12) so existing Rate Library data keeps working; Kusi can rename/adjust
 * these afterwards in the Rate Library UI.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface LegacyQuoteRow {
  id: string;
  children5to12: number;
  childrenUnder5: number;
}

interface LegacyAccommodationRateRow {
  id: string;
  accommodationId: string;
  child5to12Cents: number | null;
  childUnder5Cents: number | null;
}

async function migrateQuoteChildren() {
  const quotes = await prisma.$queryRawUnsafe<LegacyQuoteRow[]>(
    `SELECT id, children5to12, childrenUnder5 FROM "Quote" WHERE children5to12 > 0 OR childrenUnder5 > 0`
  );

  let migrated = 0;
  for (const quote of quotes) {
    const alreadyMigrated = await prisma.quoteChild.findFirst({
      where: { quoteId: quote.id, legacyLabel: { not: null } },
    });
    if (alreadyMigrated) continue;

    const rows: { quoteId: string; age: null; legacyLabel: string }[] = [];
    for (let i = 0; i < quote.childrenUnder5; i++) {
      rows.push({ quoteId: quote.id, age: null, legacyLabel: "Under 5" });
    }
    for (let i = 0; i < quote.children5to12; i++) {
      rows.push({ quoteId: quote.id, age: null, legacyLabel: "5-12" });
    }
    if (rows.length > 0) {
      await prisma.quoteChild.createMany({ data: rows });
      migrated++;
    }
  }
  console.log(`Quotes: migrated child counts for ${migrated} quote(s).`);
}

async function migrateAccommodationChildRates() {
  const legacyRates = await prisma.$queryRawUnsafe<LegacyAccommodationRateRow[]>(
    `SELECT id, accommodationId, child5to12Cents, childUnder5Cents FROM "AccommodationRate"
     WHERE child5to12Cents IS NOT NULL OR childUnder5Cents IS NOT NULL`
  );
  if (legacyRates.length === 0) {
    console.log("Accommodations: no legacy child rates found — nothing to migrate.");
    return;
  }

  const byAccommodation = new Map<string, LegacyAccommodationRateRow[]>();
  for (const rate of legacyRates) {
    const list = byAccommodation.get(rate.accommodationId) ?? [];
    list.push(rate);
    byAccommodation.set(rate.accommodationId, list);
  }

  let migrated = 0;
  for (const [accommodationId, rates] of byAccommodation) {
    const existingBrackets = await prisma.accommodationChildAgeBracket.count({ where: { accommodationId } });
    if (existingBrackets > 0) continue; // already migrated

    const under5 = await prisma.accommodationChildAgeBracket.create({
      data: { accommodationId, minAge: 0, maxAge: 4, label: "Under 5", sortOrder: 0 },
    });
    const fiveToTwelve = await prisma.accommodationChildAgeBracket.create({
      data: { accommodationId, minAge: 5, maxAge: 12, label: "5-12", sortOrder: 1 },
    });

    for (const rate of rates) {
      if (rate.childUnder5Cents != null) {
        await prisma.accommodationChildRate.create({
          data: { accommodationRateId: rate.id, bracketId: under5.id, priceCents: rate.childUnder5Cents },
        });
      }
      if (rate.child5to12Cents != null) {
        await prisma.accommodationChildRate.create({
          data: { accommodationRateId: rate.id, bracketId: fiveToTwelve.id, priceCents: rate.child5to12Cents },
        });
      }
    }
    migrated++;
  }
  console.log(`Accommodations: migrated child rates for ${migrated} accommodation(s).`);
}

async function main() {
  await migrateQuoteChildren();
  await migrateAccommodationChildRates();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
