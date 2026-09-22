import { describe, it, expect } from "vitest";
import { amountToCents, rateToMicros } from "@/lib/money";
import {
  computeAccommodationPerPerson,
  computeAccommodationPerRoom,
} from "./accommodation";
import {
  computeTransportTotal,
  computeTrainTotal,
  computeTransferTotal,
  computeActivityTotal,
  computeFlightTotal,
  computeVillaTotal,
  computeMiscTotal,
} from "./simple";
import { computeQuoteTotals, computeTotalPax } from "./quote-totals";
import { countPrivateVehicleDays } from "./vehicle-days";
import { countDays, countNights, generateTripDates, formatTravelPeriod } from "./trip-dates";

const RATE = rateToMicros(130); // 1 USD = 130 KES

describe("accommodation — per person", () => {
  it("prices adults sharing, children and single occupancy", () => {
    const result = computeAccommodationPerPerson(
      {
        adultSharingCents: amountToCents(150),
        child5to12Cents: amountToCents(90),
        childUnder5Cents: 0,
        singleCents: amountToCents(190),
      },
      { adultsSharing: 2, child5to12: 1, childUnder5: 0, adultsSingle: 0 },
      "USD",
      RATE
    );
    // 2*150 + 1*90 = 390
    expect(result.originalTotalCents).toBe(amountToCents(390));
    expect(result.usdTotalCents).toBe(amountToCents(390));
  });

  it("handles mixed sharing + single occupancy", () => {
    // Trip: 4 adults -> 2 sharing, 2 single
    const result = computeAccommodationPerPerson(
      {
        adultSharingCents: amountToCents(150),
        child5to12Cents: null,
        childUnder5Cents: null,
        singleCents: amountToCents(190),
      },
      { adultsSharing: 2, child5to12: 0, childUnder5: 0, adultsSingle: 2 },
      "USD",
      RATE
    );
    // 2*150 + 2*190 = 680
    expect(result.originalTotalCents).toBe(amountToCents(680));
  });
});

describe("accommodation — per room", () => {
  it("computes standard rooms as total - single, then prices both", () => {
    const result = computeAccommodationPerRoom(
      { standardRoomCents: amountToCents(200), singleRoomCents: amountToCents(260) },
      { totalRooms: 5, singleRooms: 2 },
      "USD",
      RATE
    );
    expect(result.standardRooms).toBe(3);
    // 3*200 + 2*260 = 1120
    expect(result.originalTotalCents).toBe(amountToCents(1120));
  });
});

describe("private transport & guide", () => {
  it("vehicles x price per vehicle per day", () => {
    const result = computeTransportTotal(amountToCents(180), 2, "USD", RATE);
    expect(result.originalTotalCents).toBe(amountToCents(360));
  });
});

describe("train", () => {
  it("passengers x price per passenger", () => {
    const result = computeTrainTotal(amountToCents(45), 3, "USD", RATE);
    expect(result.originalTotalCents).toBe(amountToCents(135));
  });
});

describe("taxi transfer", () => {
  it("vehicles x price per vehicle (never passengers)", () => {
    const result = computeTransferTotal(amountToCents(40), 2, "USD", RATE);
    expect(result.originalTotalCents).toBe(amountToCents(80));
  });
});

describe("activity", () => {
  it("participants x price per participant", () => {
    const result = computeActivityTotal(amountToCents(35), 4, "USD", RATE);
    expect(result.originalTotalCents).toBe(amountToCents(140));
  });
});

describe("domestic flight", () => {
  it("passengers x price per passenger", () => {
    const result = computeFlightTotal(amountToCents(220), 2, "USD", RATE);
    expect(result.originalTotalCents).toBe(amountToCents(440));
  });
});

describe("villa", () => {
  it("nightly rate x nights x quantity", () => {
    const result = computeVillaTotal(amountToCents(500), 3, 1, "USD", RATE);
    expect(result.originalTotalCents).toBe(amountToCents(1500));
  });
});

describe("misc", () => {
  it("quantity x unit price", () => {
    const result = computeMiscTotal(amountToCents(25), 4, "USD", RATE);
    expect(result.originalTotalCents).toBe(amountToCents(100));
  });
});

describe("KES line items convert to USD using the line's rate", () => {
  it("converts a KES transfer total to USD", () => {
    const result = computeTransferTotal(amountToCents(5000), 1, "KES", RATE);
    expect(result.originalTotalCents).toBe(amountToCents(5000));
    expect(result.usdTotalCents).toBe(amountToCents(5000 / 130));
  });
});

describe("quote totals", () => {
  it("sums line items and divides by total pax", () => {
    const totals = computeQuoteTotals(
      [amountToCents(4000), amountToCents(3000), amountToCents(1450)],
      4
    );
    expect(totals.totalUsdCents).toBe(amountToCents(8450));
    expect(totals.perPersonUsdCents).toBe(amountToCents(2112.5));
  });

  it("computes total pax from adults plus number of children", () => {
    expect(computeTotalPax(2, 1)).toBe(3);
    expect(computeTotalPax(4, 0)).toBe(4);
  });
});

describe("private vehicle days", () => {
  it("counts unique days with at least one transport item, not vehicle count", () => {
    const count = countPrivateVehicleDays([
      { dayId: "d1", hasPrivateTransport: true },
      { dayId: "d2", hasPrivateTransport: true },
      { dayId: "d3", hasPrivateTransport: false },
      { dayId: "d4", hasPrivateTransport: true }, // two vehicles that day, still 1
    ]);
    expect(count).toBe(3);
  });
});

describe("trip dates", () => {
  it("counts days inclusive and nights as the difference", () => {
    const start = new Date(Date.UTC(2026, 8, 10)); // 10 Sep
    const end = new Date(Date.UTC(2026, 8, 18)); // 18 Sep
    expect(countDays(start, end)).toBe(9);
    expect(countNights(start, end)).toBe(8);
    expect(generateTripDates(start, end)).toHaveLength(9);
  });

  it("formats the travel period", () => {
    const start = new Date(Date.UTC(2026, 8, 10));
    const end = new Date(Date.UTC(2026, 8, 18));
    expect(formatTravelPeriod(start, end)).toBe("10–18 September 2026");
  });
});
