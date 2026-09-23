import { describe, it, expect } from "vitest";
import { lineItemDescription } from "@/lib/docx/quote-summary";
import type { DerivedLineItem } from "@/lib/quote/derive";
import type { LineItemData } from "@/types/line-items";

/** A minimally-filled DerivedLineItem for testing lineItemDescription in isolation, without a database. */
function fakeLineItem(description: string, data: LineItemData): DerivedLineItem {
  return {
    id: "li-1",
    dayId: "day-1",
    category: data.category,
    sortOrder: 0,
    sourceId: null,
    description,
    originalCurrency: "USD",
    originalUnitCents: null,
    quantity: null,
    originalTotalCents: 0,
    rateMicros: 1_000_000,
    totalUsdCents: 0,
    manualOverride: false,
    libraryTotalCents: null,
    libraryCurrency: null,
    notes: null,
    data: JSON.stringify(data),
    createdAt: new Date(),
    updatedAt: new Date(),
    parsedData: data,
  };
}

describe("lineItemDescription — Accommodation meal plan", () => {
  it("renders No Meals like any other meal plan", () => {
    const li = fakeLineItem("Test Lodge — Standard", {
      category: "ACCOMMODATION",
      accommodationId: "acc-1",
      accommodationName: "Test Lodge",
      location: "Samburu",
      roomTypeId: "rt-1",
      roomTypeName: "Standard",
      season: "LOW",
      mealPlan: "NO_MEALS",
      currency: "USD",
      basis: {
        pricingBasis: "PER_PERSON",
        adultsSharing: 2,
        adultsSingle: 0,
        childBrackets: [],
        unmatchedChildAges: [],
        rates: { adultSharingCents: 15000, singleCents: null },
        totalRooms: null,
        singleRooms: null,
      },
    });

    const [title, detail] = lineItemDescription(li);
    expect(title).toBe("Test Lodge — Standard");
    expect(detail).toBe("No Meals — Low Season");
  });

  it("preserves a long room type name in full, untruncated, in the title line", () => {
    const longName =
      "Family Safari Tent with Two Bedrooms, Private Veranda, Outdoor Shower and Uninterrupted Views of the Samburu Riverine Forest";
    const li = fakeLineItem(`Test Lodge — ${longName}`, {
      category: "ACCOMMODATION",
      accommodationId: "acc-1",
      accommodationName: "Test Lodge",
      location: "Samburu",
      roomTypeId: "rt-1",
      roomTypeName: longName,
      season: "HIGH",
      mealPlan: "FB",
      currency: "USD",
      basis: {
        pricingBasis: "PER_PERSON",
        adultsSharing: 2,
        adultsSingle: 0,
        childBrackets: [],
        unmatchedChildAges: [],
        rates: { adultSharingCents: 22000, singleCents: null },
        totalRooms: null,
        singleRooms: null,
      },
    });

    const [title] = lineItemDescription(li);
    expect(title).toBe(`Test Lodge — ${longName}`);
    expect(title).toContain(longName);
  });
});

describe("lineItemDescription — Lodge Activity", () => {
  it("Per Person: shows accommodation name and 'N participants × price'", () => {
    const li = fakeLineItem("Guided Bush Walk", {
      category: "LODGE_ACTIVITY",
      accommodationId: "acc-1",
      accommodationName: "Samburu Example Lodge",
      activityId: "act-1",
      activityName: "Guided Bush Walk",
      pricingBasis: "PER_PERSON",
      quantity: 4,
      unitPriceCents: 3500,
      currency: "USD",
      notes: null,
    });

    expect(lineItemDescription(li)).toEqual(["Guided Bush Walk", "Samburu Example Lodge", "4 participants × USD 35.00"]);
  });

  it("Per Group: shows 'N groups × price'", () => {
    const li = fakeLineItem("Bush Breakfast", {
      category: "LODGE_ACTIVITY",
      accommodationId: "acc-1",
      accommodationName: "Samburu Example Lodge",
      activityId: "act-2",
      activityName: "Bush Breakfast",
      pricingBasis: "PER_GROUP",
      quantity: 2,
      unitPriceCents: 12000,
      currency: "USD",
      notes: null,
    });

    expect(lineItemDescription(li)).toEqual(["Bush Breakfast", "Samburu Example Lodge", "2 groups × USD 120.00"]);
  });

  it("Fixed Price: shows the flat amount with no multiplication", () => {
    const li = fakeLineItem("Private Charter", {
      category: "LODGE_ACTIVITY",
      accommodationId: "acc-1",
      accommodationName: "Samburu Example Lodge",
      activityId: "act-3",
      activityName: "Private Charter",
      pricingBasis: "FIXED_PRICE",
      quantity: 1,
      unitPriceCents: 50000,
      currency: "USD",
      notes: null,
    });

    expect(lineItemDescription(li)).toEqual(["Private Charter", "Samburu Example Lodge", "USD 500.00"]);
  });
});
