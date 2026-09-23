import { describe, it, expect } from "vitest";
import { rateToMicros, toUsdCents } from "@/lib/money";
import {
  flattenAccommodationRates,
  flattenTransportRates,
  flattenParkEntranceRates,
  flattenFlightRates,
  flattenLodgeActivities,
} from "@/lib/xlsx/flatten";
import type { AccommodationRecord } from "@/components/rate-library/accommodation-form";
import type { ParkRecord } from "@/components/rate-library/park-form";
import type { AccommodationActivityRecord } from "@/components/rate-library/lodge-activities-section";
import type { TransportRate, FlightRate } from "@prisma/client";

const RATE_MICROS = rateToMicros(130);

function accommodation(overrides: Partial<AccommodationRecord> = {}): AccommodationRecord {
  return {
    id: "acc-1",
    name: "Samburu Example Lodge",
    location: "Samburu",
    notes: null,
    currency: "USD",
    pricingBasis: "PER_PERSON",
    archived: false,
    activities: [],
    roomTypes: [{ id: "rt-1", name: "Standard", sortOrder: 0 }],
    childAgeBrackets: [
      { id: "b-1", minAge: 0, maxAge: 4, label: "Under 5", sortOrder: 0 },
      { id: "b-2", minAge: 5, maxAge: 11, label: null, sortOrder: 1 },
    ],
    rates: [
      {
        id: "rate-1",
        roomTypeId: "rt-1",
        season: "HIGH",
        mealPlan: "FB",
        adultSharingCents: 22000,
        singleCents: 30000,
        standardRoomCents: null,
        singleRoomCents: null,
        childRates: [
          { bracketId: "b-1", priceCents: 0 },
          { bracketId: "b-2", priceCents: 13000 },
        ],
      },
    ],
    ...overrides,
  };
}

describe("flattenAccommodationRates", () => {
  it("flattens each rate combination into its own row (adult sharing, single, and each child bracket)", () => {
    const rows = flattenAccommodationRates([accommodation()], { rateMicros: RATE_MICROS, includeArchived: false });

    expect(rows).toHaveLength(4);
    const adultRow = rows.find((r) => r.guestType === "Adult Sharing")!;
    expect(adultRow).toMatchObject({
      accommodation: "Samburu Example Lodge",
      location: "Samburu",
      roomType: "Standard",
      season: "High Season",
      mealPlan: "Full Board",
      pricingBasis: "Per Person",
      childMinAge: null,
      childMaxAge: null,
      price: 220,
      currency: "USD",
      usdEquivalent: 220,
    });

    const singleRow = rows.find((r) => r.guestType === "Single Occupancy")!;
    expect(singleRow.price).toBe(300);
  });

  it("exports each accommodation's own custom child age brackets, matching spec's worked example (5–11 → 130)", () => {
    const rows = flattenAccommodationRates([accommodation()], { rateMicros: RATE_MICROS, includeArchived: false });
    const childRows = rows.filter((r) => r.guestType === "Child");

    expect(childRows).toHaveLength(2);
    const under5 = childRows.find((r) => r.childMinAge === 0)!;
    expect(under5).toMatchObject({ childMinAge: 0, childMaxAge: 4, price: 0 });
    const fiveToEleven = childRows.find((r) => r.childMinAge === 5)!;
    expect(fiveToEleven).toMatchObject({ childMinAge: 5, childMaxAge: 11, price: 130 });
  });

  it("uses a different bracket count/range for a second accommodation, proving brackets are never global", () => {
    const other = accommodation({
      id: "acc-2",
      name: "Different Lodge",
      childAgeBrackets: [{ id: "c-1", minAge: 0, maxAge: 15, label: "All children", sortOrder: 0 }],
      rates: [
        {
          id: "rate-2",
          roomTypeId: "rt-1",
          season: "LOW",
          mealPlan: "BB",
          adultSharingCents: 10000,
          singleCents: null,
          standardRoomCents: null,
          singleRoomCents: null,
          childRates: [{ bracketId: "c-1", priceCents: 5000 }],
        },
      ],
    });

    const rows = flattenAccommodationRates([accommodation(), other], {
      rateMicros: RATE_MICROS,
      includeArchived: false,
    });
    const otherChildRow = rows.find((r) => r.accommodation === "Different Lodge" && r.guestType === "Child")!;
    expect(otherChildRow).toMatchObject({ childMinAge: 0, childMaxAge: 15, price: 50 });
  });

  it("flattens per-room pricing into Standard Room / Single Occupancy rows", () => {
    const perRoom = accommodation({
      pricingBasis: "PER_ROOM",
      rates: [
        {
          id: "rate-3",
          roomTypeId: "rt-1",
          season: "HIGH",
          mealPlan: "FI",
          adultSharingCents: null,
          singleCents: null,
          standardRoomCents: 40000,
          singleRoomCents: 25000,
          childRates: [],
        },
      ],
    });
    const rows = flattenAccommodationRates([perRoom], { rateMicros: RATE_MICROS, includeArchived: false });

    expect(rows.map((r) => r.guestType).sort()).toEqual(["Single Occupancy", "Standard Room"]);
    expect(rows.find((r) => r.guestType === "Standard Room")?.price).toBe(400);
  });

  it("computes the correct USD equivalent for a KES rate using the current exchange rate", () => {
    const kesAcc = accommodation({ currency: "KES", rates: [{ ...accommodation().rates[0], adultSharingCents: 2_860_000 }] });
    const rows = flattenAccommodationRates([kesAcc], { rateMicros: RATE_MICROS, includeArchived: false });
    const adultRow = rows.find((r) => r.guestType === "Adult Sharing")!;

    const expectedUsdCents = toUsdCents(2_860_000, "KES", RATE_MICROS);
    expect(adultRow.currency).toBe("KES");
    expect(Math.round(adultRow.usdEquivalent * 100)).toBe(expectedUsdCents);
    expect(adultRow.usdEquivalent).toBeCloseTo(220, 2); // 2,860,000 cents KES / 130 = 22,000 cents USD = $220
  });

  it("excludes archived accommodations by default and includes them (with a Status column value) when requested", () => {
    const archived = accommodation({ id: "acc-archived", name: "Closed Lodge", archived: true });

    const defaultRows = flattenAccommodationRates([accommodation(), archived], {
      rateMicros: RATE_MICROS,
      includeArchived: false,
    });
    expect(defaultRows.every((r) => r.accommodation !== "Closed Lodge")).toBe(true);
    expect(defaultRows[0].status).toBeUndefined();

    const withArchived = flattenAccommodationRates([accommodation(), archived], {
      rateMicros: RATE_MICROS,
      includeArchived: true,
    });
    expect(withArchived.some((r) => r.accommodation === "Closed Lodge")).toBe(true);
    expect(withArchived.find((r) => r.accommodation === "Closed Lodge")?.status).toBe("Archived");
    expect(withArchived.find((r) => r.accommodation === "Samburu Example Lodge")?.status).toBe("Active");
  });

  it("returns an empty array (never throws) for an accommodation list with no rates", () => {
    const rows = flattenAccommodationRates([], { rateMicros: RATE_MICROS, includeArchived: false });
    expect(rows).toEqual([]);
  });

  it("exports a No Meals rate row exactly like any other meal plan", () => {
    const noMeals = accommodation({
      rates: [{ ...accommodation().rates[0], mealPlan: "NO_MEALS" }],
    });
    const rows = flattenAccommodationRates([noMeals], { rateMicros: RATE_MICROS, includeArchived: false });
    expect(rows[0].mealPlan).toBe("No Meals");
  });

  it("exports a long room type name in full, untruncated", () => {
    const longName =
      "Family Safari Tent with Two Bedrooms, Private Veranda, Outdoor Shower and Uninterrupted Views of the Samburu Riverine Forest";
    const longRoom = accommodation({
      roomTypes: [{ id: "rt-1", name: longName, sortOrder: 0 }],
    });
    const rows = flattenAccommodationRates([longRoom], { rateMicros: RATE_MICROS, includeArchived: false });
    expect(rows[0].roomType).toBe(longName);
    expect(rows[0].roomType.length).toBe(longName.length);
  });
});

describe("flattenParkEntranceRates", () => {
  function park(overrides: Partial<ParkRecord> = {}): ParkRecord {
    return {
      id: "park-1",
      name: "Samburu National Reserve",
      currency: "USD",
      adultFeeCents: 8000,
      notes: null,
      archived: false,
      childBrackets: [
        { id: "pb-1", minAge: 0, maxAge: 4, priceCents: 0, label: null },
        { id: "pb-2", minAge: 5, maxAge: 15, priceCents: 4000, label: null },
      ],
      ...overrides,
    };
  }

  it("matches the spec's worked example exactly: adult row + one row per child bracket", () => {
    const rows = flattenParkEntranceRates([park()], { rateMicros: RATE_MICROS, includeArchived: false });

    expect(rows).toEqual([
      expect.objectContaining({ park: "Samburu National Reserve", travellerType: "Adult", minAge: null, maxAge: null, price: 80, currency: "USD" }),
      expect.objectContaining({ park: "Samburu National Reserve", travellerType: "Child", minAge: 0, maxAge: 4, price: 0, currency: "USD" }),
      expect.objectContaining({ park: "Samburu National Reserve", travellerType: "Child", minAge: 5, maxAge: 15, price: 40, currency: "USD" }),
    ]);
  });

  it("uses a park-specific bracket set independent of any accommodation's brackets", () => {
    const otherPark = park({
      id: "park-2",
      name: "Amboseli National Park",
      childBrackets: [{ id: "pb-3", minAge: 0, maxAge: 15, priceCents: 2000, label: "All children" }],
    });
    const rows = flattenParkEntranceRates([otherPark], { rateMicros: RATE_MICROS, includeArchived: false });
    expect(rows.filter((r) => r.travellerType === "Child")).toHaveLength(1);
    expect(rows.find((r) => r.travellerType === "Child")).toMatchObject({ minAge: 0, maxAge: 15, price: 20 });
  });

  it("computes correct USD equivalents for a KES-denominated park fee", () => {
    const kesPark = park({ currency: "KES", adultFeeCents: 1_040_000 });
    const rows = flattenParkEntranceRates([kesPark], { rateMicros: RATE_MICROS, includeArchived: false });
    const adultRow = rows.find((r) => r.travellerType === "Adult")!;
    expect(adultRow.usdEquivalent).toBeCloseTo(80, 2); // 1,040,000 KES cents / 130 = 8,000 USD cents = $80
  });

  it("excludes an archived park by default and includes it when requested", () => {
    const archivedPark = park({ id: "park-archived", name: "Old Park", archived: true });
    const defaultRows = flattenParkEntranceRates([park(), archivedPark], { rateMicros: RATE_MICROS, includeArchived: false });
    expect(defaultRows.some((r) => r.park === "Old Park")).toBe(false);

    const withArchived = flattenParkEntranceRates([park(), archivedPark], { rateMicros: RATE_MICROS, includeArchived: true });
    expect(withArchived.some((r) => r.park === "Old Park" && r.status === "Archived")).toBe(true);
  });
});

describe("flattenTransportRates / flattenFlightRates (simple categories)", () => {
  it("carries USD rates through with usdEquivalent equal to the original price", () => {
    const rate: TransportRate = {
      id: "t-1",
      vehicleType: "JEEP_5PAX",
      priceCents: 15000,
      currency: "USD",
      notes: null,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const rows = flattenTransportRates([rate], { rateMicros: RATE_MICROS, includeArchived: false });
    expect(rows).toEqual([
      expect.objectContaining({ vehicleType: "Jeep – 5 pax", pricingBasis: "Per Vehicle Per Day", price: 150, currency: "USD", usdEquivalent: 150 }),
    ]);
  });

  it("an empty category (no flight rates at all) produces an empty row list without throwing", () => {
    const rows = flattenFlightRates([], { rateMicros: RATE_MICROS, includeArchived: false });
    expect(rows).toEqual([]);
  });

  it("excludes archived flight rates by default", () => {
    const active: FlightRate = {
      id: "f-1",
      route: "Nairobi → Mombasa",
      priceCents: 12000,
      currency: "USD",
      notes: null,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const archived: FlightRate = { ...active, id: "f-2", route: "Nairobi → Malindi", archived: true };

    expect(flattenFlightRates([active, archived], { rateMicros: RATE_MICROS, includeArchived: false })).toHaveLength(1);
    const withArchived = flattenFlightRates([active, archived], { rateMicros: RATE_MICROS, includeArchived: true });
    expect(withArchived).toHaveLength(2);
    expect(withArchived.find((r) => r.route === "Nairobi → Malindi")?.status).toBe("Archived");
  });
});

describe("flattenLodgeActivities", () => {
  function activity(overrides: Partial<AccommodationActivityRecord> = {}): AccommodationActivityRecord {
    return {
      id: "act-1",
      accommodationId: "acc-1",
      name: "Guided Bush Walk",
      pricingBasis: "PER_PERSON",
      amountCents: 3500,
      currency: "USD",
      notes: null,
      archived: false,
      ...overrides,
    };
  }

  it("links each activity to its own accommodation (name and location), never mixing lodges", () => {
    const lodgeA = accommodation({ id: "acc-a", name: "Lodge A", location: "Samburu" });
    const lodgeB = accommodation({ id: "acc-b", name: "Lodge B", location: "Amboseli" });
    lodgeA.activities = [activity({ accommodationId: "acc-a", name: "Lodge A Walk" })];
    lodgeB.activities = [activity({ accommodationId: "acc-b", id: "act-2", name: "Lodge B Walk" })];

    const rows = flattenLodgeActivities([lodgeA, lodgeB], { rateMicros: RATE_MICROS, includeArchived: false });

    expect(rows).toEqual([
      expect.objectContaining({ accommodation: "Lodge A", location: "Samburu", activity: "Lodge A Walk" }),
      expect.objectContaining({ accommodation: "Lodge B", location: "Amboseli", activity: "Lodge B Walk" }),
    ]);
  });

  it("shows the correct pricing basis label and USD price for a USD activity", () => {
    const lodge = accommodation({ activities: [activity({ pricingBasis: "PER_GROUP", amountCents: 12000 })] });
    const rows = flattenLodgeActivities([lodge], { rateMicros: RATE_MICROS, includeArchived: false });
    expect(rows[0]).toMatchObject({ pricingBasis: "Per Group", price: 120, currency: "USD", usdEquivalent: 120 });
  });

  it("computes the correct USD equivalent for a KES-denominated activity", () => {
    const lodge = accommodation({ activities: [activity({ currency: "KES", amountCents: 130_000 })] });
    const rows = flattenLodgeActivities([lodge], { rateMicros: RATE_MICROS, includeArchived: false });
    expect(rows[0].currency).toBe("KES");
    expect(rows[0].usdEquivalent).toBeCloseTo(10, 2); // 1,300 KES / 130 = USD 10
  });

  it("excludes an archived activity by default and includes it (with Status) when requested", () => {
    const lodge = accommodation({
      activities: [activity({ id: "act-active", name: "Active Activity" }), activity({ id: "act-archived", name: "Archived Activity", archived: true })],
    });

    const defaultRows = flattenLodgeActivities([lodge], { rateMicros: RATE_MICROS, includeArchived: false });
    expect(defaultRows.map((r) => r.activity)).toEqual(["Active Activity"]);

    const withArchived = flattenLodgeActivities([lodge], { rateMicros: RATE_MICROS, includeArchived: true });
    expect(withArchived.map((r) => r.activity)).toEqual(["Active Activity", "Archived Activity"]);
    expect(withArchived.find((r) => r.activity === "Archived Activity")?.status).toBe("Archived");
  });

  it("returns an empty array for an accommodation with zero Lodge Activities", () => {
    const lodge = accommodation({ activities: [] });
    expect(flattenLodgeActivities([lodge], { rateMicros: RATE_MICROS, includeArchived: false })).toEqual([]);
  });
});
