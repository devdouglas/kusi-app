/**
 * Date math for the trip header. Dates are treated as calendar days (time
 * component ignored) to avoid timezone-related off-by-one errors.
 */

function toMidnightUTC(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Number of days inclusive of both start and end dates. */
export function countDays(startDate: Date, endDate: Date): number {
  const diff = toMidnightUTC(endDate) - toMidnightUTC(startDate);
  return Math.round(diff / MS_PER_DAY) + 1;
}

/** Number of nights between start and end dates. */
export function countNights(startDate: Date, endDate: Date): number {
  const diff = toMidnightUTC(endDate) - toMidnightUTC(startDate);
  return Math.round(diff / MS_PER_DAY);
}

/** One Date per calendar day from startDate to endDate, inclusive. */
export function generateTripDates(startDate: Date, endDate: Date): Date[] {
  const days = countDays(startDate, endDate);
  const start = toMidnightUTC(startDate);
  return Array.from({ length: Math.max(days, 0) }, (_, i) => new Date(start + i * MS_PER_DAY));
}

const travelPeriodFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayOnlyFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  timeZone: "UTC",
});

/** "10–18 September 2026" (or "28 September – 2 October 2026" across months). */
export function formatTravelPeriod(startDate: Date, endDate: Date): string {
  const sameMonth =
    startDate.getUTCMonth() === endDate.getUTCMonth() &&
    startDate.getUTCFullYear() === endDate.getUTCFullYear();
  if (sameMonth) {
    const startDay = dayOnlyFormatter.format(startDate);
    return `${startDay}–${travelPeriodFormatter.format(endDate)}`;
  }
  const startFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `${startFormatter.format(startDate)} – ${travelPeriodFormatter.format(endDate)}`;
}

export function formatFullDate(date: Date): string {
  return travelPeriodFormatter.format(date);
}
