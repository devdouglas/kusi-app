import { describe, it, expect } from "vitest";
import { amountToCents, rateToMicros } from "@/lib/money";
import { computeAccommodationPerPersonWithChildren, type AccommodationChildBracketRate } from "./accommodation";

const RATE = rateToMicros(130);

const BRACKETS: AccommodationChildBracketRate[] = [
  { id: "b0-3", minAge: 0, maxAge: 3, label: null, priceCents: 0 },
  { id: "b4-11", minAge: 4, maxAge: 11, label: null, priceCents: amountToCents(90) },
  { id: "b12-15", minAge: 12, maxAge: 15, label: null, priceCents: amountToCents(120) },
];

describe("accommodation per-person pricing with child age brackets", () => {
  it("prices multiple children in the same bracket", () => {
    const result = computeAccommodationPerPersonWithChildren(
      amountToCents(150),
      amountToCents(190),
      BRACKETS,
      [5, 9],
      2,
      0,
      "USD",
      RATE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2 adults * 150 + 2 children * 90 = 480
    expect(result.originalTotalCents).toBe(amountToCents(480));
    expect(result.matchedChildren).toHaveLength(1);
    expect(result.matchedChildren[0].ages.sort()).toEqual([5, 9]);
  });

  it("prices children split across different brackets separately", () => {
    // spec example: adults 2 x 150, children aged 4 and 11 both in 4-11 -> 2 x 90
    const result = computeAccommodationPerPersonWithChildren(
      amountToCents(150),
      null,
      BRACKETS,
      [4, 11],
      2,
      0,
      "USD",
      RATE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.originalTotalCents).toBe(amountToCents(300 + 180));
  });

  it("prices children in different brackets as separate line groups (ages 3 and 9)", () => {
    const result = computeAccommodationPerPersonWithChildren(
      amountToCents(150),
      null,
      BRACKETS,
      [3, 9],
      2,
      0,
      "USD",
      RATE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2 adults*150 + 1 child(0-3)*0 + 1 child(4-11)*90 = 300 + 0 + 90 = 390
    expect(result.originalTotalCents).toBe(amountToCents(390));
    expect(result.matchedChildren).toHaveLength(2);
  });

  it("mixes adults sharing, adults single and children", () => {
    const result = computeAccommodationPerPersonWithChildren(
      amountToCents(150),
      amountToCents(190),
      BRACKETS,
      [7],
      2,
      1,
      "USD",
      RATE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2*150 + 1*190 + 1*90 = 300 + 190 + 90 = 580
    expect(result.originalTotalCents).toBe(amountToCents(580));
  });

  it("reports unmatched ages instead of guessing a price", () => {
    const result = computeAccommodationPerPersonWithChildren(
      amountToCents(150),
      null,
      BRACKETS,
      [14, 20],
      2,
      0,
      "USD",
      RATE
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.unmatchedAges).toEqual([20]);
  });

  it("converts KES accommodation currency to USD using the quote's rate", () => {
    const kesBrackets: AccommodationChildBracketRate[] = [
      { id: "b0-4", minAge: 0, maxAge: 4, label: null, priceCents: amountToCents(5000) },
    ];
    const result = computeAccommodationPerPersonWithChildren(
      amountToCents(13000),
      null,
      kesBrackets,
      [2],
      1,
      0,
      "KES",
      RATE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.originalTotalCents).toBe(amountToCents(18000));
    expect(result.usdTotalCents).toBe(amountToCents(18000 / 130));
  });
});
