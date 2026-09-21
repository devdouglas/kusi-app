import type { Quote, QuoteDay, QuoteLineItem } from "@prisma/client";
import { countDays, countNights, formatTravelPeriod } from "@/lib/calc/trip-dates";
import { countPrivateVehicleDays } from "@/lib/calc/vehicle-days";
import { computeQuoteTotals, computeTotalPax } from "@/lib/calc/quote-totals";
import { parseLineItemData, type LineItemData } from "@/types/line-items";

export type QuoteWithDays = Quote & { days: (QuoteDay & { lineItems: QuoteLineItem[] })[] };

export interface DerivedLineItem extends QuoteLineItem {
  parsedData: LineItemData;
}

export interface DerivedDay extends QuoteDay {
  lineItems: DerivedLineItem[];
  dayTotalUsdCents: number;
  hasPrivateTransport: boolean;
}

export interface DerivedQuote {
  quote: Quote;
  days: DerivedDay[];
  totalPax: number;
  numberOfDays: number;
  numberOfNights: number;
  travelPeriod: string;
  privateVehicleDays: number;
  totalUsdCents: number;
  perPersonUsdCents: number;
}

/**
 * Turns the raw nested Prisma record into everything the Quote Builder UI
 * and the Word export need: day totals, trip-length figures, the private
 * vehicle day count and the grand total / per-person price. Kept out of
 * React components and the docx generator so both read from one place.
 */
export function deriveQuote(quote: QuoteWithDays): DerivedQuote {
  const days: DerivedDay[] = [...quote.days]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => {
      const lineItems = [...day.lineItems]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((li) => ({ ...li, parsedData: parseLineItemData(li.data) }));
      const dayTotalUsdCents = lineItems.reduce((sum, li) => sum + li.totalUsdCents, 0);
      const hasPrivateTransport = lineItems.some((li) => li.category === "PRIVATE_TRANSPORT");
      return { ...day, lineItems, dayTotalUsdCents, hasPrivateTransport };
    });

  const totalPax = computeTotalPax(quote.adults, quote.children5to12, quote.childrenUnder5);
  const numberOfDays = countDays(quote.startDate, quote.endDate);
  const numberOfNights = countNights(quote.startDate, quote.endDate);
  const travelPeriod = formatTravelPeriod(quote.startDate, quote.endDate);
  const privateVehicleDays = countPrivateVehicleDays(
    days.map((d) => ({ dayId: d.id, hasPrivateTransport: d.hasPrivateTransport }))
  );
  const allLineTotals = days.flatMap((d) => d.lineItems.map((li) => li.totalUsdCents));
  const totals = computeQuoteTotals(allLineTotals, totalPax);

  return {
    quote,
    days,
    totalPax,
    numberOfDays,
    numberOfNights,
    travelPeriod,
    privateVehicleDays,
    totalUsdCents: totals.totalUsdCents,
    perPersonUsdCents: totals.perPersonUsdCents,
  };
}
