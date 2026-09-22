import { describe, it, expect } from "vitest";
import { amountToCents, rateToMicros } from "@/lib/money";
import { computeParkEntranceFee, type ParkChildBracketRate } from "./park";

const RATE = rateToMicros(130);

describe("park entrance fee pricing", () => {
  it("prices adults only", () => {
    const result = computeParkEntranceFee(amountToCents(80), [], 2, [], "USD", RATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.originalTotalCents).toBe(amountToCents(160));
  });

  it("prices adults plus one child, per the spec example", () => {
    const brackets: ParkChildBracketRate[] = [
      { id: "b0-4", minAge: 0, maxAge: 4, label: null, priceCents: 0 },
      { id: "b5-15", minAge: 5, maxAge: 15, label: null, priceCents: amountToCents(40) },
    ];
    const result = computeParkEntranceFee(amountToCents(80), brackets, 2, [4, 11], "USD", RATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2 adults*80 + 1 child(0-4)*0 + 1 child(5-15)*40 = 160 + 0 + 40 = 200
    expect(result.originalTotalCents).toBe(amountToCents(200));
  });

  it("prices multiple children across multiple brackets", () => {
    const brackets: ParkChildBracketRate[] = [
      { id: "b0-4", minAge: 0, maxAge: 4, label: null, priceCents: 0 },
      { id: "b5-11", minAge: 5, maxAge: 11, label: null, priceCents: amountToCents(40) },
      { id: "b12-15", minAge: 12, maxAge: 15, label: null, priceCents: amountToCents(60) },
    ];
    const result = computeParkEntranceFee(amountToCents(80), brackets, 2, [3, 8, 8, 14], "USD", RATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2*80 + 1*0 + 2*40 + 1*60 = 160 + 0 + 80 + 60 = 300
    expect(result.originalTotalCents).toBe(amountToCents(300));
  });

  it("converts a KES park rate to USD using the quote's exchange rate", () => {
    const brackets: ParkChildBracketRate[] = [
      { id: "b0-2", minAge: 0, maxAge: 2, label: null, priceCents: 0 },
      { id: "b3-15", minAge: 3, maxAge: 15, label: null, priceCents: amountToCents(1000) },
    ];
    const result = computeParkEntranceFee(amountToCents(2000), brackets, 2, [5], "KES", RATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2*2000 + 1*1000 = 5000 KES
    expect(result.originalTotalCents).toBe(amountToCents(5000));
    expect(result.usdTotalCents).toBe(amountToCents(5000 / 130));
  });

  it("reports unmatched child ages instead of guessing a price", () => {
    const brackets: ParkChildBracketRate[] = [{ id: "b0-10", minAge: 0, maxAge: 10, label: null, priceCents: amountToCents(40) }];
    const result = computeParkEntranceFee(amountToCents(80), brackets, 2, [14], "USD", RATE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.unmatchedAges).toEqual([14]);
  });
});
