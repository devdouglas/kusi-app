import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateExchangeRate } from "@/lib/settings";
import { createAccommodation, updateAccommodation, createPark } from "@/lib/actions/rate-library";
import {
  createQuote,
  addMiscLineItem,
  updateMiscLineItem,
  applyLineItemOverride,
  addAccommodationLineItem,
  addParkLineItem,
  getQuote,
} from "@/lib/actions/quotes";
import { deriveQuote, type QuoteWithDays } from "@/lib/quote/derive";
import { amountToCents } from "@/lib/money";
import { serializeLineItemData } from "@/types/line-items";

const createdQuoteIds: string[] = [];
const createdAccommodationIds: string[] = [];
const createdParkIds: string[] = [];

afterAll(async () => {
  await prisma.quote.deleteMany({ where: { id: { in: createdQuoteIds } } });
  await prisma.accommodation.deleteMany({ where: { id: { in: createdAccommodationIds } } });
  await prisma.park.deleteMany({ where: { id: { in: createdParkIds } } });
});

async function derivedFor(quoteId: string) {
  const quote = await getQuote(quoteId);
  if (!quote) throw new Error("quote not found");
  return deriveQuote(quote as QuoteWithDays);
}

describe("Daily Totals", () => {
  it("computes each day's total as the aggregation of its own line items, with no double counting", async () => {
    await updateExchangeRate(130);
    const quote = await createQuote({
      clientName: "Daily Totals Test",
      tripTitle: "Daily Totals Trip",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-02"),
      adults: 2,
      children: [],
    });
    createdQuoteIds.push(quote.id);

    const days = await prisma.quoteDay.findMany({ where: { quoteId: quote.id }, orderBy: { dayNumber: "asc" } });
    const [day1, day2] = days;

    const item1 = await addMiscLineItem({ dayId: day1.id, itemName: "Park fee", price: 100, currency: "USD", quantity: 2 });
    const item2 = await addMiscLineItem({ dayId: day1.id, itemName: "Guide tip", price: 50, currency: "USD", quantity: 1 });
    await addMiscLineItem({ dayId: day2.id, itemName: "Souvenir", price: 30, currency: "USD", quantity: 1 });

    let derived = await derivedFor(quote.id);
    const d1 = derived.days.find((d) => d.id === day1.id)!;
    const d2 = derived.days.find((d) => d.id === day2.id)!;

    // Day 1: (100*2) + (50*1) = 250
    expect(d1.dayTotalUsdCents).toBe(amountToCents(250));
    // Day 2: 30
    expect(d2.dayTotalUsdCents).toBe(amountToCents(30));
    // Sum of day totals equals the Total Party price — never added separately.
    expect(d1.dayTotalUsdCents + d2.dayTotalUsdCents).toBe(derived.totalUsdCents);
    expect(derived.totalUsdCents).toBe(amountToCents(280));

    // Quantity change updates the Day Total.
    await updateMiscLineItem(item1.id, { dayId: day1.id, itemName: "Park fee", price: 100, currency: "USD", quantity: 3 });
    derived = await derivedFor(quote.id);
    const d1After = derived.days.find((d) => d.id === day1.id)!;
    // (100*3) + 50 = 350
    expect(d1After.dayTotalUsdCents).toBe(amountToCents(350));
    expect(derived.days.reduce((s, d) => s + d.dayTotalUsdCents, 0)).toBe(derived.totalUsdCents);

    // Manual override updates the Day Total too.
    await applyLineItemOverride({ lineItemId: item2.id, amount: 999, currency: "USD" });
    derived = await derivedFor(quote.id);
    const d1Overridden = derived.days.find((d) => d.id === day1.id)!;
    // (100*3) + 999 = 1299
    expect(d1Overridden.dayTotalUsdCents).toBe(amountToCents(1299));
    expect(derived.days.reduce((s, d) => s + d.dayTotalUsdCents, 0)).toBe(derived.totalUsdCents);
  });

  it("includes KES line items in the Day Total using the quote's stored exchange rate", async () => {
    await updateExchangeRate(130);
    const quote = await createQuote({
      clientName: "KES Daily Total Test",
      tripTitle: "KES Trip",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-01"),
      adults: 1,
      children: [],
    });
    createdQuoteIds.push(quote.id);

    const day = await prisma.quoteDay.findFirstOrThrow({ where: { quoteId: quote.id } });
    await addMiscLineItem({ dayId: day.id, itemName: "Market shopping", price: 13000, currency: "KES", quantity: 1 });

    const derived = await derivedFor(quote.id);
    // 13,000 KES / 130 = USD 100
    expect(derived.days[0].dayTotalUsdCents).toBe(amountToCents(100));
    expect(derived.totalUsdCents).toBe(derived.days[0].dayTotalUsdCents);
  });
});

describe("Accommodation child age brackets (integration)", () => {
  it("matches children in different brackets and mixes with adults correctly", async () => {
    await updateExchangeRate(130);
    const accommodation = await createAccommodation({
      name: "Bracket Test Lodge",
      location: "Test Town",
      currency: "USD",
      pricingBasis: "PER_PERSON",
      roomTypes: [{ name: "Standard" }],
      childAgeBrackets: [
        { minAge: 0, maxAge: 3, label: "0-3" },
        { minAge: 4, maxAge: 11, label: "4-11" },
        { minAge: 12, maxAge: 15, label: "12-15" },
      ],
      rates: [{ roomTypeId: "Standard", season: "LOW", mealPlan: "FB", adultSharing: 150 }],
    });
    if (!accommodation) throw new Error("not created");
    createdAccommodationIds.push(accommodation.id);

    // Fill in child prices for the (only) rate row via update.
    const rate = accommodation.rates[0];
    const bracket0to3 = accommodation.childAgeBrackets.find((b) => b.label === "0-3")!;
    const bracket4to11 = accommodation.childAgeBrackets.find((b) => b.label === "4-11")!;
    const bracket12to15 = accommodation.childAgeBrackets.find((b) => b.label === "12-15")!;

    const updated = await updateAccommodation(
      accommodation.id, {
      name: "Bracket Test Lodge",
      location: "Test Town",
      currency: "USD",
      pricingBasis: "PER_PERSON",
      roomTypes: [{ id: accommodation.roomTypes[0].id, name: "Standard" }],
      childAgeBrackets: accommodation.childAgeBrackets.map((b) => ({ id: b.id, minAge: b.minAge, maxAge: b.maxAge, label: b.label })),
      rates: [
        {
          id: rate.id,
          roomTypeId: accommodation.roomTypes[0].id,
          season: "LOW",
          mealPlan: "FB",
          adultSharing: 150,
          childPrices: [
            { bracketId: bracket0to3.id, price: 0 },
            { bracketId: bracket4to11.id, price: 90 },
            { bracketId: bracket12to15.id, price: 120 },
          ],
        },
      ],
    });
    if (!updated) throw new Error("not updated");

    const quote = await createQuote({
      clientName: "Bracket Test",
      tripTitle: "Bracket Trip",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-01"),
      adults: 2,
      children: [{ age: 3 }, { age: 9 }],
    });
    createdQuoteIds.push(quote.id);

    const day = await prisma.quoteDay.findFirstOrThrow({ where: { quoteId: quote.id } });
    await addAccommodationLineItem({
      dayId: day.id,
      accommodationId: updated.id,
      roomTypeId: updated.roomTypes[0].id,
      season: "LOW",
      mealPlan: "FB",
      adultsSharing: 2,
      adultsSingle: 0,
    });

    const derived = await derivedFor(quote.id);
    // 2 adults*150 + 1 child(0-3)*0 + 1 child(4-11)*90 = 300 + 0 + 90 = 390
    expect(derived.days[0].dayTotalUsdCents).toBe(amountToCents(390));
  });

  it("throws a clear error when a child's age matches no configured bracket, instead of guessing", async () => {
    await updateExchangeRate(130);
    const accommodation = await createAccommodation({
      name: "Narrow Bracket Lodge",
      location: "Test Town",
      currency: "USD",
      pricingBasis: "PER_PERSON",
      roomTypes: [{ name: "Standard" }],
      childAgeBrackets: [{ minAge: 0, maxAge: 10, label: "0-10" }],
      rates: [{ roomTypeId: "Standard", season: "LOW", mealPlan: "FB", adultSharing: 150 }],
    });
    if (!accommodation) throw new Error("not created");
    createdAccommodationIds.push(accommodation.id);

    const bracket = accommodation.childAgeBrackets[0];
    const rate = accommodation.rates[0];
    const updated = await updateAccommodation(
      accommodation.id, {
      name: "Narrow Bracket Lodge",
      location: "Test Town",
      currency: "USD",
      pricingBasis: "PER_PERSON",
      roomTypes: [{ id: accommodation.roomTypes[0].id, name: "Standard" }],
      childAgeBrackets: [{ id: bracket.id, minAge: 0, maxAge: 10, label: "0-10" }],
      rates: [
        {
          id: rate.id,
          roomTypeId: accommodation.roomTypes[0].id,
          season: "LOW",
          mealPlan: "FB",
          adultSharing: 150,
          childPrices: [{ bracketId: bracket.id, price: 90 }],
        },
      ],
    });
    if (!updated) throw new Error("not updated");

    const quote = await createQuote({
      clientName: "Missing Bracket Test",
      tripTitle: "Missing Bracket Trip",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-01"),
      adults: 1,
      children: [{ age: 14 }],
    });
    createdQuoteIds.push(quote.id);

    const day = await prisma.quoteDay.findFirstOrThrow({ where: { quoteId: quote.id } });
    await expect(
      addAccommodationLineItem({
        dayId: day.id,
        accommodationId: updated.id,
        roomTypeId: updated.roomTypes[0].id,
        season: "LOW",
        mealPlan: "FB",
        adultsSharing: 1,
        adultsSingle: 0,
      })
    ).rejects.toThrow(/No child rate configured for age 14/);
  });
});

describe("Park Entrance Fees (integration)", () => {
  it("prices adults and a child, and supports KES parks and manual overrides", async () => {
    await updateExchangeRate(130);
    const park = await createPark({
      name: "Integration Test Park",
      currency: "USD",
      adultFee: 80,
      childBrackets: [
        { minAge: 0, maxAge: 4, price: 0, label: "0-4" },
        { minAge: 5, maxAge: 15, price: 40, label: "5-15" },
      ],
    });
    if (!park) throw new Error("not created");
    createdParkIds.push(park.id);

    const quote = await createQuote({
      clientName: "Park Test",
      tripTitle: "Park Trip",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-01"),
      adults: 2,
      children: [{ age: 4 }, { age: 11 }],
    });
    createdQuoteIds.push(quote.id);

    const day = await prisma.quoteDay.findFirstOrThrow({ where: { quoteId: quote.id } });
    const lineItem = await addParkLineItem({ dayId: day.id, parkId: park.id });

    const derived = await derivedFor(quote.id);
    // 2*80 + 1*0(age4) + 1*40(age11) = 160+0+40 = 200
    expect(derived.days[0].dayTotalUsdCents).toBe(amountToCents(200));

    // Manual override.
    await applyLineItemOverride({ lineItemId: lineItem.id, amount: 175, currency: "USD" });
    const derivedOverridden = await derivedFor(quote.id);
    expect(derivedOverridden.days[0].dayTotalUsdCents).toBe(amountToCents(175));
  });

  it("supports a KES park rate and excluding one traveller from the visit", async () => {
    await updateExchangeRate(130);
    const park = await createPark({
      name: "KES Park",
      currency: "KES",
      adultFee: 2000,
      childBrackets: [
        { minAge: 0, maxAge: 2, price: 0, label: "0-2" },
        { minAge: 3, maxAge: 15, price: 1000, label: "3-15" },
      ],
    });
    if (!park) throw new Error("not created");
    createdParkIds.push(park.id);

    const quote = await createQuote({
      clientName: "KES Park Test",
      tripTitle: "KES Park Trip",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-01"),
      adults: 3,
      children: [{ age: 5 }],
    });
    createdQuoteIds.push(quote.id);

    const day = await prisma.quoteDay.findFirstOrThrow({ where: { quoteId: quote.id } });
    // Exclude one adult from this specific park visit (adults: 2 instead of 3);
    // the quote's own passenger composition is untouched.
    await addParkLineItem({ dayId: day.id, parkId: park.id, adults: 2, childAges: [5] });

    const derived = await derivedFor(quote.id);
    // 2*2000 + 1*1000 = 5000 KES -> /130
    expect(derived.days[0].dayTotalUsdCents).toBe(amountToCents(5000 / 130));

    const refreshedQuote = await getQuote(quote.id);
    expect(refreshedQuote!.adults).toBe(3); // main trip passenger composition unchanged
  });
});

describe("Legacy quote data stays readable", () => {
  it("does not crash rendering a quote saved with the old fixed child-category shape", async () => {
    const quote = await createQuote({
      clientName: "Legacy Test",
      tripTitle: "Legacy Trip",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-01"),
      adults: 2,
      children: [],
    });
    createdQuoteIds.push(quote.id);

    // Simulate a QuoteChild row migrated from the old aggregate categories:
    // no exact age known, only a legacy label.
    await prisma.quoteChild.create({ data: { quoteId: quote.id, age: null, legacyLabel: "5-12" } });

    const day = await prisma.quoteDay.findFirstOrThrow({ where: { quoteId: quote.id } });
    // A line item saved under the old AccommodationPerPersonDataLegacy shape.
    await prisma.quoteLineItem.create({
      data: {
        dayId: day.id,
        category: "ACCOMMODATION",
        sortOrder: 0,
        sourceId: null,
        description: "Legacy Lodge — Standard Room",
        originalCurrency: "USD",
        originalTotalCents: amountToCents(240),
        rateMicros: 130_000_000,
        totalUsdCents: amountToCents(240),
        manualOverride: false,
        libraryTotalCents: amountToCents(240),
        libraryCurrency: "USD",
        data: serializeLineItemData({
          category: "ACCOMMODATION",
          accommodationId: "legacy-id",
          accommodationName: "Legacy Lodge",
          location: "Legacy Town",
          roomTypeId: "legacy-room",
          roomTypeName: "Standard Room",
          season: "LOW",
          mealPlan: "FB",
          currency: "USD",
          basis: {
            pricingBasis: "PER_PERSON",
            legacy: true,
            adultsSharing: 2,
            child5to12: 1,
            childUnder5: 0,
            adultsSingle: 0,
            rates: { adultSharingCents: amountToCents(100), child5to12Cents: amountToCents(40), childUnder5Cents: null, singleCents: null },
            totalRooms: null,
            singleRooms: null,
          },
        }),
      },
    });

    const derived = await derivedFor(quote.id);
    expect(derived.days[0].dayTotalUsdCents).toBe(amountToCents(240));
    expect(derived.hasLegacyChildren).toBe(true);
    expect(derived.childAges).toEqual([]); // legacy child has no exact age, correctly excluded rather than invented
  });
});
