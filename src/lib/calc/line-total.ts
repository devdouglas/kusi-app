import { multiplyCents, toUsdCents, type Currency, type RateMicros } from "@/lib/money";

export interface LineTotalResult {
  /** quantity * unitCents, in the original currency, exact integer cents. */
  originalTotalCents: number;
  /** originalTotalCents converted to USD using rateMicros. */
  usdTotalCents: number;
}

/**
 * The shared shape used by every category calculator: a unit price in its
 * original currency times a quantity, converted to USD once at the end so
 * rounding only happens a single time per line item.
 */
export function computeLineTotal(
  unitCents: number,
  quantity: number,
  currency: Currency,
  rateMicros: RateMicros
): LineTotalResult {
  const originalTotalCents = multiplyCents(unitCents, quantity);
  const usdTotalCents = toUsdCents(originalTotalCents, currency, rateMicros);
  return { originalTotalCents, usdTotalCents };
}
