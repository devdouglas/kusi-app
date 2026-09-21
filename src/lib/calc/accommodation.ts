import { sumCents, toUsdCents, type Currency, type RateMicros } from "@/lib/money";
import type { LineTotalResult } from "./line-total";

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
