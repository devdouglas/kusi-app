import { computeLineTotal, type LineTotalResult } from "./line-total";
import type { Currency, RateMicros } from "@/lib/money";

/**
 * Thin, semantically-named wrappers around computeLineTotal for the
 * "quantity x unit price" categories. Keeping them separate (rather than
 * calling computeLineTotal directly at every call site) documents which
 * quantity each category multiplies by, and gives each rule its own home
 * for tests.
 */

/** Private Transport & Guide: vehicles x price per vehicle per day. */
export function computeTransportTotal(
  priceCentsPerVehicle: number,
  vehicles: number,
  currency: Currency,
  rateMicros: RateMicros
): LineTotalResult {
  return computeLineTotal(priceCentsPerVehicle, vehicles, currency, rateMicros);
}

/** Train: passengers x price per passenger (for the selected class). */
export function computeTrainTotal(
  priceCentsPerPassenger: number,
  passengers: number,
  currency: Currency,
  rateMicros: RateMicros
): LineTotalResult {
  return computeLineTotal(priceCentsPerPassenger, passengers, currency, rateMicros);
}

/** Taxi Transfer: vehicles x price per vehicle (never passengers). */
export function computeTransferTotal(
  priceCentsPerVehicle: number,
  vehicles: number,
  currency: Currency,
  rateMicros: RateMicros
): LineTotalResult {
  return computeLineTotal(priceCentsPerVehicle, vehicles, currency, rateMicros);
}

/** Activity: participants x price per participant. */
export function computeActivityTotal(
  priceCentsPerParticipant: number,
  participants: number,
  currency: Currency,
  rateMicros: RateMicros
): LineTotalResult {
  return computeLineTotal(priceCentsPerParticipant, participants, currency, rateMicros);
}

/** Domestic Flight: passengers x price per passenger. */
export function computeFlightTotal(
  priceCentsPerPassenger: number,
  passengers: number,
  currency: Currency,
  rateMicros: RateMicros
): LineTotalResult {
  return computeLineTotal(priceCentsPerPassenger, passengers, currency, rateMicros);
}

/** Villa: nightly rate x nights x quantity (number of villas). */
export function computeVillaTotal(
  nightlyRateCents: number,
  nights: number,
  quantity: number,
  currency: Currency,
  rateMicros: RateMicros
): LineTotalResult {
  return computeLineTotal(nightlyRateCents, nights * quantity, currency, rateMicros);
}

/** Misc: quantity x unit price. */
export function computeMiscTotal(
  unitPriceCents: number,
  quantity: number,
  currency: Currency,
  rateMicros: RateMicros
): LineTotalResult {
  return computeLineTotal(unitPriceCents, quantity, currency, rateMicros);
}
