import { divideCents, sumCents } from "@/lib/money";

export interface QuoteTotals {
  totalUsdCents: number;
  totalPax: number;
  perPersonUsdCents: number;
}

/** Total party price (USD) and price per person, from a list of line USD totals. */
export function computeQuoteTotals(
  lineTotalsUsdCents: number[],
  totalPax: number
): QuoteTotals {
  const totalUsdCents = sumCents(lineTotalsUsdCents);
  const perPersonUsdCents = totalPax > 0 ? divideCents(totalUsdCents, totalPax) : 0;
  return { totalUsdCents, totalPax, perPersonUsdCents };
}

export function computeTotalPax(
  adults: number,
  children5to12: number,
  childrenUnder5: number
): number {
  return adults + children5to12 + childrenUnder5;
}
