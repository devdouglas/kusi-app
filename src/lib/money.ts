import Decimal from "decimal.js";

/**
 * All monetary amounts move through this module as integer "cents" (the
 * smallest unit of the currency) to keep arithmetic exact. Decimal.js is
 * used internally for the operations that aren't naturally integer-safe
 * (currency conversion, division for per-person prices) and results are
 * always rounded back to whole cents before leaving this module.
 */

export type Currency = "USD" | "KES";

/** KES per 1 USD, scaled by 1,000,000 (six decimal places of precision). */
export type RateMicros = number;

const MICROS = 1_000_000;

export function rateToMicros(rate: number | string): RateMicros {
  return new Decimal(rate).times(MICROS).round().toNumber();
}

export function microsToRateDecimal(rateMicros: RateMicros): Decimal {
  return new Decimal(rateMicros).div(MICROS);
}

export function microsToRateNumber(rateMicros: RateMicros): number {
  return microsToRateDecimal(rateMicros).toNumber();
}

/** Parse a user-entered decimal amount (e.g. "1245.5") into integer cents. */
export function amountToCents(amount: number | string): number {
  return new Decimal(amount).times(100).round().toNumber();
}

export function centsToAmount(cents: number): number {
  return new Decimal(cents).div(100).toNumber();
}

export function centsToDecimal(cents: number): Decimal {
  return new Decimal(cents).div(100);
}

/** Convert an amount (in cents, in `currency`) to USD cents. */
export function toUsdCents(
  cents: number,
  currency: Currency,
  rateMicros: RateMicros
): number {
  if (currency === "USD") return Math.round(cents);
  const rate = microsToRateDecimal(rateMicros);
  return new Decimal(cents).div(rate).round().toNumber();
}

/** Convert a USD cents amount to KES cents using the given rate. */
export function usdCentsToKesCents(
  usdCents: number,
  rateMicros: RateMicros
): number {
  const rate = microsToRateDecimal(rateMicros);
  return new Decimal(usdCents).times(rate).round().toNumber();
}

/** Convert an amount from one currency to the other. */
export function convertCents(
  cents: number,
  from: Currency,
  to: Currency,
  rateMicros: RateMicros
): number {
  if (from === to) return Math.round(cents);
  if (from === "KES" && to === "USD") return toUsdCents(cents, "KES", rateMicros);
  return usdCentsToKesCents(cents, rateMicros);
}

/** cents * quantity — exact integer multiplication. */
export function multiplyCents(unitCents: number, quantity: number): number {
  return Math.round(unitCents * quantity);
}

/** Sum of integer cents. */
export function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Divide a total (cents) into `n` equal shares, rounded to the nearest cent. */
export function divideCents(totalCents: number, n: number): number {
  if (n <= 0) return 0;
  return new Decimal(totalCents).div(n).round().toNumber();
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const kesFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "USD 1,245.50" / "KES 160,000" */
export function formatMoney(cents: number, currency: Currency): string {
  const amount = centsToAmount(cents);
  if (currency === "USD") return `USD ${usdFormatter.format(amount)}`;
  return `KES ${kesFormatter.format(amount)}`;
}

export function formatUsd(cents: number): string {
  return formatMoney(cents, "USD");
}

export function formatKes(cents: number): string {
  return formatMoney(cents, "KES");
}

/** "≈ USD 116.28" — used under a KES entry field. */
export function formatUsdApprox(kesCents: number, rateMicros: RateMicros): string {
  const usdCents = toUsdCents(kesCents, "KES", rateMicros);
  return `≈ ${formatUsd(usdCents)}`;
}
