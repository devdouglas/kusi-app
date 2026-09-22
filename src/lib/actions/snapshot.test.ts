import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateExchangeRate } from "@/lib/settings";
import {
  createAccommodation,
  updateAccommodation,
} from "@/lib/actions/rate-library";
import {
  createQuote,
  addAccommodationLineItem,
  getQuote,
  refreshQuoteExchangeRate,
} from "@/lib/actions/quotes";
import { amountToCents } from "@/lib/money";

const createdAccommodationIds: string[] = [];
const createdQuoteIds: string[] = [];

afterAll(async () => {
  await prisma.quote.deleteMany({ where: { id: { in: createdQuoteIds } } });
  await prisma.accommodation.deleteMany({ where: { id: { in: createdAccommodationIds } } });
});

describe("Rate Library snapshot (spec section 63)", () => {
  it("keeps a saved quote's price frozen after the library rate changes", async () => {
    await updateExchangeRate(130);

    const accommodation = await createAccommodation({
      name: "Test Lodge",
      location: "Test Town",
      currency: "USD",
      pricingBasis: "PER_PERSON",
      roomTypes: [{ name: "Standard Room" }],
      childAgeBrackets: [],
      rates: [
        {
          roomTypeId: "Standard Room",
          season: "LOW",
          mealPlan: "FB",
          adultSharing: 100,
        },
      ],
    });
    if (!accommodation) throw new Error("accommodation not created");
    createdAccommodationIds.push(accommodation.id);

    const quote = await createQuote({
      clientName: "Snapshot Test",
      tripTitle: "Snapshot Trip",
      startDate: new Date("2026-09-10"),
      endDate: new Date("2026-09-12"),
      adults: 2,
      children: [],
    });
    createdQuoteIds.push(quote.id);

    const day = await prisma.quoteDay.findFirstOrThrow({ where: { quoteId: quote.id }, orderBy: { dayNumber: "asc" } });

    await addAccommodationLineItem({
      dayId: day.id,
      accommodationId: accommodation.id,
      roomTypeId: accommodation.roomTypes[0].id,
      season: "LOW",
      mealPlan: "FB",
      adultsSharing: 2,
      adultsSingle: 0,
    });

    const quoteBefore = await getQuote(quote.id);
    const lineBefore = quoteBefore!.days[0].lineItems[0];
    // 2 adults x USD 100 = USD 200
    expect(lineBefore.totalUsdCents).toBe(amountToCents(200));

    // Now the Rate Library price changes from 100 -> 120.
    await updateAccommodation(accommodation.id, {
      name: "Test Lodge",
      location: "Test Town",
      currency: "USD",
      pricingBasis: "PER_PERSON",
      roomTypes: [{ id: accommodation.roomTypes[0].id, name: "Standard Room" }],
      childAgeBrackets: [],
      rates: [
        {
          roomTypeId: accommodation.roomTypes[0].id,
          season: "LOW",
          mealPlan: "FB",
          adultSharing: 120,
        },
      ],
    });

    const quoteAfter = await getQuote(quote.id);
    const lineAfter = quoteAfter!.days[0].lineItems[0];
    // Still USD 200 — the saved quote must not change.
    expect(lineAfter.totalUsdCents).toBe(amountToCents(200));
  });
});

describe("Exchange rate snapshot (spec section 63)", () => {
  it("keeps a saved quote calculated at its original exchange rate until explicitly refreshed", async () => {
    await updateExchangeRate(130);

    const accommodation = await createAccommodation({
      name: "Test Lodge KES",
      location: "Test Town",
      currency: "KES",
      pricingBasis: "PER_PERSON",
      roomTypes: [{ name: "Standard Room" }],
      childAgeBrackets: [],
      rates: [
        { roomTypeId: "Standard Room", season: "LOW", mealPlan: "FB", adultSharing: 13000 },
      ],
    });
    if (!accommodation) throw new Error("accommodation not created");
    createdAccommodationIds.push(accommodation.id);

    const quote = await createQuote({
      clientName: "Rate Snapshot Test",
      tripTitle: "Rate Snapshot Trip",
      startDate: new Date("2026-09-10"),
      endDate: new Date("2026-09-11"),
      adults: 1,
      children: [],
    });
    createdQuoteIds.push(quote.id);
    expect(quote.rateMicros).toBe(130_000_000);

    const day = await prisma.quoteDay.findFirstOrThrow({ where: { quoteId: quote.id } });
    await addAccommodationLineItem({
      dayId: day.id,
      accommodationId: accommodation.id,
      roomTypeId: accommodation.roomTypes[0].id,
      season: "LOW",
      mealPlan: "FB",
      adultsSharing: 1,
      adultsSingle: 0,
    });

    const quoteBefore = await getQuote(quote.id);
    // 13,000 KES / 130 = USD 100
    expect(quoteBefore!.days[0].lineItems[0].totalUsdCents).toBe(amountToCents(100));

    // Global exchange rate changes from 130 -> 135.
    await updateExchangeRate(135);

    const quoteStillOld = await getQuote(quote.id);
    expect(quoteStillOld!.rateMicros).toBe(130_000_000);
    expect(quoteStillOld!.days[0].lineItems[0].totalUsdCents).toBe(amountToCents(100));

    // A new quote created now should pick up the new rate.
    const quoteB = await createQuote({
      clientName: "Rate Snapshot Test B",
      tripTitle: "Rate Snapshot Trip B",
      startDate: new Date("2026-09-10"),
      endDate: new Date("2026-09-11"),
      adults: 1,
      children: [],
    });
    createdQuoteIds.push(quoteB.id);
    expect(quoteB.rateMicros).toBe(135_000_000);

    // Only an explicit refresh moves the Draft quote onto the new rate.
    await refreshQuoteExchangeRate(quote.id);
    const quoteRefreshed = await getQuote(quote.id);
    expect(quoteRefreshed!.rateMicros).toBe(135_000_000);
    // 13,000 KES / 135 = 96.30 (rounded)
    expect(quoteRefreshed!.days[0].lineItems[0].totalUsdCents).toBe(amountToCents(96.3));
  });
});
