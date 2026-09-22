import { sumCents, toUsdCents, type Currency, type RateMicros } from "@/lib/money";
import type { LineTotalResult } from "./line-total";
import { matchChildrenToBrackets, type ChildAgeBracket, type ChildBracketMatch } from "./child-brackets";

export interface PerPersonQuantities {
  adultsSharing: number;
  child5to12: number;
  childUnder5: number;
  adultsSingle: number;
}

export interface PerPersonRates {
  adultSharingCents: number;
  child5to12Cents: number | null;
  childUnder5Cents: number | null;
  singleCents: number | null;
}

/**
 * Per-person accommodation total. Each guest category is priced
 * independently and summed in the original currency (exact integer
 * arithmetic) before a single USD conversion at the end.
 */
export function computeAccommodationPerPerson(
  rates: PerPersonRates,
  quantities: PerPersonQuantities,
  currency: Currency,
  rateMicros: RateMicros
): LineTotalResult {
  const parts = [
    quantities.adultsSharing * rates.adultSharingCents,
    quantities.child5to12 * (rates.child5to12Cents ?? 0),
    quantities.childUnder5 * (rates.childUnder5Cents ?? 0),
    quantities.adultsSingle * (rates.singleCents ?? 0),
  ];
  const originalTotalCents = sumCents(parts.map((p) => Math.round(p)));
  const usdTotalCents = toUsdCents(originalTotalCents, currency, rateMicros);
  return { originalTotalCents, usdTotalCents };
}

export interface AccommodationChildBracketRate extends ChildAgeBracket {
  priceCents: number;
}

export type AccommodationPerPersonWithChildrenResult =
  | {
      ok: true;
      originalTotalCents: number;
      usdTotalCents: number;
      matchedChildren: ChildBracketMatch<AccommodationChildBracketRate>[];
    }
  | { ok: false; unmatchedAges: number[] };

/**
 * Per-person accommodation total using the accommodation's own child age
 * brackets: every child age is matched against `childBracketRates` (only
 * brackets with a price configured on this specific rate row) and priced
 * independently. If any child's age matches no bracket, this reports which
 * ages so the caller can surface a clear warning rather than guessing a
 * price (spec: "never silently guess a child rate").
 */
export function computeAccommodationPerPersonWithChildren(
  adultSharingCents: number,
  singleCents: number | null,
  childBracketRates: AccommodationChildBracketRate[],
  childAges: number[],
  adultsSharing: number,
  adultsSingle: number,
  currency: Currency,
  rateMicros: RateMicros
): AccommodationPerPersonWithChildrenResult {
  const { matched, unmatchedAges } = matchChildrenToBrackets(childAges, childBracketRates);
  if (unmatchedAges.length > 0) {
    return { ok: false, unmatchedAges };
  }

  const parts = [
    Math.round(adultsSharing * adultSharingCents),
    Math.round(adultsSingle * (singleCents ?? 0)),
    ...matched.map((m) => Math.round(m.ages.length * m.bracket.priceCents)),
  ];
  const originalTotalCents = sumCents(parts);
  const usdTotalCents = toUsdCents(originalTotalCents, currency, rateMicros);
  return { ok: true, originalTotalCents, usdTotalCents, matchedChildren: matched };
}

export interface PerRoomQuantities {
  totalRooms: number;
  singleRooms: number;
}

export interface PerRoomRates {
  standardRoomCents: number;
  singleRoomCents: number | null;
}

/**
 * Per-room accommodation total. standardRooms = totalRooms - singleRooms.
 * Callers are responsible for validating singleRooms <= totalRooms.
 */
export function computeAccommodationPerRoom(
  rates: PerRoomRates,
  quantities: PerRoomQuantities,
  currency: Currency,
  rateMicros: RateMicros
): LineTotalResult & { standardRooms: number } {
  const standardRooms = Math.max(0, quantities.totalRooms - quantities.singleRooms);
  const originalTotalCents = sumCents([
    Math.round(standardRooms * rates.standardRoomCents),
    Math.round(quantities.singleRooms * (rates.singleRoomCents ?? 0)),
  ]);
  const usdTotalCents = toUsdCents(originalTotalCents, currency, rateMicros);
  return { originalTotalCents, usdTotalCents, standardRooms };
}
