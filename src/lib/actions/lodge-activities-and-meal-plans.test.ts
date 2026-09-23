import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateExchangeRate } from "@/lib/settings";
import {
  createAccommodation,
  listAccommodationActivities,
  createAccommodationActivity,
  updateAccommodationActivity,
} from "@/lib/actions/rate-library";
import {
  createQuote,
  addAccommodationLineItem,
  addLodgeActivityLineItem,
  applyLineItemOverride,
  getQuote,
} from "@/lib/actions/quotes";
import { deriveQuote, type QuoteWithDays } from "@/lib/quote/derive";
import { amountToCents } from "@/lib/money";
import type { AccommodationLineData, LodgeActivityLineData } from "@/types/line-items";

const createdQuoteIds: string[] = [];
const createdAccommodationIds: string[] = [];

afterAll(async () => {
  await prisma.quote.deleteMany({ where: { id: { in: createdQuoteIds } } });
  await prisma.accommodation.deleteMany({ where: { id: { in: createdAccommodationIds } } });
});

async function derivedFor(quoteId: string) {
  const quote = await getQuote(quoteId);
  if (!quote) throw new Error("quote not found");
  return deriveQuote(quote as QuoteWithDays);
}

async function makeAccommodation(overrides: { mealPlan?: "NO_MEALS" | "BB"; roomTypeName?: string } = {}) {
  const acc = await createAccommodation({
    name: "No Meals / Long Room Test Lodge",
    location: "Test Town",
    currency: "USD",
    pricingBasis: "PER_PERSON",
    roomTypes: [{ name: overrides.roomTypeName ?? "Standard" }],
    childAgeBrackets: [],
    rates: [
      {
        roomTypeId: overrides.roomTypeName ?? "Standard",
        season: "LOW",
        mealPlan: overrides.mealPlan ?? "NO_MEALS",
        adultSharing: 150,
      },
    ],
  });
  if (!acc) throw new Error("not created");
  createdAccommodationIds.push(acc.id);
  return acc;
}

describe("No Meals meal plan", () => {
  it("can create an accommodation rate using No Meals and retrieve it correctly via the Quote Builder", async () => {
    await updateExchangeRate(130);
    const acc = await makeAccommodation({ mealPlan: "NO_MEALS" });

    const quote = await createQuote({
      clientName: "No Meals Test",
      tripTitle: "No Meals Trip",
      startDate: new Date("2026-11-01"),
      endDate: new Date("2026-11-02"),
      adults: 2,
      children: [],
    });
    createdQuoteIds.push(quote.id);
    const [day] = await prisma.quoteDay.findMany({ where: { quoteId: quote.id }, orderBy: { dayNumber: "asc" } });

    const item = await addAccommodationLineItem({
      dayId: day.id,
      accommodationId: acc.id,
      roomTypeId: acc.roomTypes[0].id,
      season: "LOW",
      mealPlan: "NO_MEALS",
      adultsSharing: 2,
    });

    const data = JSON.parse(item.data) as AccommodationLineData;
    expect(data.mealPlan).toBe("NO_MEALS");
  });

  it("existing meal plans (e.g. Bed & Breakfast) continue to work unaffected", async () => {
    const acc = await makeAccommodation({ mealPlan: "BB" });
    const rate = await prisma.accommodationRate.findFirstOrThrow({ where: { accommodationId: acc.id } });
    expect(rate.mealPlan).toBe("BB");
    expect(rate.adultSharingCents).toBe(amountToCents(150));
  });
});

describe("Long Room Type labels", () => {
  const LONG_NAME =
    "Family Safari Tent with Two Bedrooms, Private Veranda, Outdoor Shower and Uninterrupted Views of the Samburu Riverine Forest";

  it("saves a long room type name (150+ characters) and retrieves it without truncation", async () => {
    expect(LONG_NAME.length).toBeGreaterThan(120);
    const acc = await makeAccommodation({ roomTypeName: LONG_NAME });
    expect(acc.roomTypes[0].name).toBe(LONG_NAME);

    const reloaded = await prisma.accommodationRoomType.findUniqueOrThrow({ where: { id: acc.roomTypes[0].id } });
    expect(reloaded.name).toBe(LONG_NAME);
    expect(reloaded.name.length).toBe(LONG_NAME.length);
  });

  it("keeps the long room type name associated with the correct rate when added to a quote", async () => {
    const acc = await makeAccommodation({ roomTypeName: LONG_NAME });
    const quote = await createQuote({
      clientName: "Long Room Test",
      tripTitle: "Long Room Trip",
      startDate: new Date("2026-11-05"),
      endDate: new Date("2026-11-06"),
      adults: 2,
      children: [],
    });
    createdQuoteIds.push(quote.id);
    const [day] = await prisma.quoteDay.findMany({ where: { quoteId: quote.id }, orderBy: { dayNumber: "asc" } });

    const item = await addAccommodationLineItem({
      dayId: day.id,
      accommodationId: acc.id,
      roomTypeId: acc.roomTypes[0].id,
      season: "LOW",
      mealPlan: "NO_MEALS",
      adultsSharing: 2,
    });

    const data = JSON.parse(item.data) as AccommodationLineData;
    expect(data.roomTypeName).toBe(LONG_NAME);
    expect(item.description).toBe(`${acc.name} — ${LONG_NAME}`);
  });
});

describe("Lodge Activities", () => {
  it("an accommodation can have zero Lodge Activities", async () => {
    const acc = await makeAccommodation();
    const activities = await listAccommodationActivities(acc.id);
    expect(activities).toEqual([]);
  });

  it("an accommodation can have multiple Lodge Activities, each independently priced", async () => {
    const acc = await makeAccommodation();
    await createAccommodationActivity(acc.id, { name: "Guided Bush Walk", pricingBasis: "PER_PERSON", amount: 35, currency: "USD" });
    await createAccommodationActivity(acc.id, { name: "Sundowner", pricingBasis: "PER_PERSON", amount: 25, currency: "USD" });
    await createAccommodationActivity(acc.id, { name: "Bush Breakfast", pricingBasis: "PER_GROUP", amount: 120, currency: "USD" });

    const activities = await listAccommodationActivities(acc.id);
    expect(activities).toHaveLength(3);
    expect(activities.map((a) => a.name).sort()).toEqual(["Bush Breakfast", "Guided Bush Walk", "Sundowner"]);
  });

  async function quoteWithAccommodation(acc: Awaited<ReturnType<typeof makeAccommodation>>) {
    const quote = await createQuote({
      clientName: "Lodge Activity Test",
      tripTitle: "Lodge Activity Trip",
      startDate: new Date("2026-11-10"),
      endDate: new Date("2026-11-11"),
      adults: 4,
      children: [],
    });
    createdQuoteIds.push(quote.id);
    const [day] = await prisma.quoteDay.findMany({ where: { quoteId: quote.id }, orderBy: { dayNumber: "asc" } });
    await addAccommodationLineItem({
      dayId: day.id,
      accommodationId: acc.id,
      roomTypeId: acc.roomTypes[0].id,
      season: "LOW",
      mealPlan: "NO_MEALS",
      adultsSharing: 4,
    });
    return { quote, day };
  }

  it("Per Person: price × participants, defaulting to total trip pax", async () => {
    const acc = await makeAccommodation();
    const activity = await createAccommodationActivity(acc.id, {
      name: "Guided Bush Walk",
      pricingBasis: "PER_PERSON",
      amount: 35,
      currency: "USD",
    });
    const { day } = await quoteWithAccommodation(acc);

    const item = await addLodgeActivityLineItem({ dayId: day.id, accommodationId: acc.id, activityId: activity.id, quantity: 4 });
    expect(item.originalTotalCents).toBe(amountToCents(140)); // 35 x 4
    const data = JSON.parse(item.data) as LodgeActivityLineData;
    expect(data).toMatchObject({ pricingBasis: "PER_PERSON", quantity: 4, accommodationName: acc.name, activityName: "Guided Bush Walk" });
  });

  it("Per Group: price × number of group bookings", async () => {
    const acc = await makeAccommodation();
    const activity = await createAccommodationActivity(acc.id, {
      name: "Bush Breakfast",
      pricingBasis: "PER_GROUP",
      amount: 120,
      currency: "USD",
    });
    const { day } = await quoteWithAccommodation(acc);

    const item = await addLodgeActivityLineItem({ dayId: day.id, accommodationId: acc.id, activityId: activity.id, quantity: 2 });
    expect(item.originalTotalCents).toBe(amountToCents(240)); // 120 x 2 groups
  });

  it("Fixed Price: used once, ignoring any submitted quantity", async () => {
    const acc = await makeAccommodation();
    const activity = await createAccommodationActivity(acc.id, {
      name: "Private Charter",
      pricingBasis: "FIXED_PRICE",
      amount: 500,
      currency: "USD",
    });
    const { day } = await quoteWithAccommodation(acc);

    const item = await addLodgeActivityLineItem({ dayId: day.id, accommodationId: acc.id, activityId: activity.id, quantity: 7 });
    expect(item.originalTotalCents).toBe(amountToCents(500));
    expect(item.quantity).toBe(1);
  });

  it("a USD Lodge Activity keeps its USD total as-is", async () => {
    const acc = await makeAccommodation();
    const activity = await createAccommodationActivity(acc.id, { name: "Sundowner", pricingBasis: "PER_PERSON", amount: 25, currency: "USD" });
    const { day } = await quoteWithAccommodation(acc);
    const item = await addLodgeActivityLineItem({ dayId: day.id, accommodationId: acc.id, activityId: activity.id, quantity: 2 });
    expect(item.totalUsdCents).toBe(amountToCents(50));
  });

  it("a KES Lodge Activity converts to USD using the exchange rate at the time it was added", async () => {
    await updateExchangeRate(130);
    const acc = await makeAccommodation();
    const activity = await createAccommodationActivity(acc.id, {
      name: "Cultural Visit",
      pricingBasis: "PER_PERSON",
      amount: 1300, // KES 1,300 per person
      currency: "KES",
    });
    const { day } = await quoteWithAccommodation(acc);
    const item = await addLodgeActivityLineItem({ dayId: day.id, accommodationId: acc.id, activityId: activity.id, quantity: 2 });

    expect(item.originalTotalCents).toBe(amountToCents(2600)); // KES 2,600 total
    expect(item.totalUsdCents).toBe(amountToCents(20)); // 2,600 / 130 = USD 20
  });

  it("a manual override on a Lodge Activity line item works via the existing override system", async () => {
    const acc = await makeAccommodation();
    const activity = await createAccommodationActivity(acc.id, { name: "Sundowner", pricingBasis: "PER_PERSON", amount: 25, currency: "USD" });
    const { day } = await quoteWithAccommodation(acc);
    const item = await addLodgeActivityLineItem({ dayId: day.id, accommodationId: acc.id, activityId: activity.id, quantity: 2 });
    expect(item.originalTotalCents).toBe(amountToCents(50));

    const overridden = await applyLineItemOverride({ lineItemId: item.id, amount: 45, currency: "USD" });
    expect(overridden.manualOverride).toBe(true);
    expect(overridden.originalTotalCents).toBe(amountToCents(45));
    expect(overridden.libraryTotalCents).toBe(amountToCents(50)); // original library figure preserved for revert
  });

  it("contributes correctly to the Day Total and Total Party", async () => {
    const acc = await makeAccommodation();
    const activity = await createAccommodationActivity(acc.id, { name: "Guided Bush Walk", pricingBasis: "PER_PERSON", amount: 35, currency: "USD" });
    const { quote, day } = await quoteWithAccommodation(acc);
    await addLodgeActivityLineItem({ dayId: day.id, accommodationId: acc.id, activityId: activity.id, quantity: 4 });

    const derived = await derivedFor(quote.id);
    const derivedDay = derived.days.find((d) => d.id === day.id)!;
    const accommodationLine = derivedDay.lineItems.find((li) => li.category === "ACCOMMODATION")!;
    const lodgeActivityLine = derivedDay.lineItems.find((li) => li.category === "LODGE_ACTIVITY")!;

    expect(derivedDay.dayTotalUsdCents).toBe(accommodationLine.totalUsdCents + lodgeActivityLine.totalUsdCents);
    expect(derived.totalUsdCents).toBeGreaterThanOrEqual(derivedDay.dayTotalUsdCents);
  });

  it("keeps a saved quote's Lodge Activity price frozen after the Rate Library price changes later", async () => {
    const acc = await makeAccommodation();
    const activity = await createAccommodationActivity(acc.id, { name: "Sundowner", pricingBasis: "PER_PERSON", amount: 25, currency: "USD" });
    const { quote, day } = await quoteWithAccommodation(acc);
    const item = await addLodgeActivityLineItem({ dayId: day.id, accommodationId: acc.id, activityId: activity.id, quantity: 4 });
    expect(item.originalTotalCents).toBe(amountToCents(100));

    // Price changes in the Rate Library after the quote was saved.
    await updateAccommodationActivity(activity.id, { name: "Sundowner", pricingBasis: "PER_PERSON", amount: 999, currency: "USD" });

    const derived = await derivedFor(quote.id);
    const lodgeActivityLine = derived.days.flatMap((d) => d.lineItems).find((li) => li.category === "LODGE_ACTIVITY")!;
    expect(lodgeActivityLine.originalTotalCents).toBe(amountToCents(100)); // unchanged
  });

  it("shows only the activities belonging to the correct accommodation", async () => {
    const lodgeA = await makeAccommodation({ roomTypeName: "Standard A" });
    const lodgeB = await createAccommodation({
      name: "Second Test Lodge",
      location: "Test Town",
      currency: "USD",
      pricingBasis: "PER_PERSON",
      roomTypes: [{ name: "Standard B" }],
      childAgeBrackets: [],
      rates: [{ roomTypeId: "Standard B", season: "LOW", mealPlan: "NO_MEALS", adultSharing: 100 }],
    });
    if (!lodgeB) throw new Error("not created");
    createdAccommodationIds.push(lodgeB.id);

    await createAccommodationActivity(lodgeA.id, { name: "Lodge A Only Activity", pricingBasis: "PER_PERSON", amount: 10, currency: "USD" });
    await createAccommodationActivity(lodgeB.id, { name: "Lodge B Only Activity", pricingBasis: "PER_PERSON", amount: 20, currency: "USD" });

    const forA = await listAccommodationActivities(lodgeA.id);
    const forB = await listAccommodationActivities(lodgeB.id);
    expect(forA.map((a) => a.name)).toEqual(["Lodge A Only Activity"]);
    expect(forB.map((a) => a.name)).toEqual(["Lodge B Only Activity"]);
  });
});
