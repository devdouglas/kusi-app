import { sumCents, toUsdCents, type Currency, type RateMicros } from "@/lib/money";
import { matchChildrenToBrackets, type ChildAgeBracket, type ChildBracketMatch } from "./child-brackets";

export interface ParkChildBracketRate extends ChildAgeBracket {
  priceCents: number;
}

export type ParkEntranceFeeResult =
  | {
      ok: true;
      originalTotalCents: number;
      usdTotalCents: number;
      matchedChildren: ChildBracketMatch<ParkChildBracketRate>[];
    }
  | { ok: false; unmatchedAges: number[] };

/**
 * Park Entrance Fee total: adults at the flat adult fee, plus every
 * travelling child matched to the park's own age brackets. Mirrors
 * computeAccommodationPerPersonWithChildren's "never guess" behaviour — an
 * age with no matching bracket is reported rather than priced.
 */
export function computeParkEntranceFee(
  adultFeeCents: number,
  childBracketRates: ParkChildBracketRate[],
  adults: number,
  childAges: number[],
  currency: Currency,
  rateMicros: RateMicros
): ParkEntranceFeeResult {
  const { matched, unmatchedAges } = matchChildrenToBrackets(childAges, childBracketRates);
  if (unmatchedAges.length > 0) {
    return { ok: false, unmatchedAges };
  }

  const parts = [
    Math.round(adults * adultFeeCents),
    ...matched.map((m) => Math.round(m.ages.length * m.bracket.priceCents)),
  ];
  const originalTotalCents = sumCents(parts);
  const usdTotalCents = toUsdCents(originalTotalCents, currency, rateMicros);
  return { ok: true, originalTotalCents, usdTotalCents, matchedChildren: matched };
}
