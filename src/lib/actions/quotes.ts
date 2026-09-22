"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { amountToCents, toUsdCents, type Currency } from "@/lib/money";
import { getExchangeRateMicros } from "@/lib/settings";
import { generateTripDates } from "@/lib/calc/trip-dates";
import { computeTotalPax } from "@/lib/calc/quote-totals";
import { bracketLabel } from "@/lib/calc/child-brackets";
import {
  computeAccommodationPerRoom,
  computeAccommodationPerPersonWithChildren,
  type AccommodationChildBracketRate,
} from "@/lib/calc/accommodation";
import { computeParkEntranceFee, type ParkChildBracketRate } from "@/lib/calc/park";
import {
  computeTransportTotal,
  computeTrainTotal,
  computeTransferTotal,
  computeActivityTotal,
  computeFlightTotal,
  computeVillaTotal,
  computeMiscTotal,
} from "@/lib/calc/simple";
import {
  serializeLineItemData,
  VEHICLE_TYPE_LABELS,
  type AccommodationLineData,
  type ChildBracketSelection,
  type TransportLineData,
  type TrainLineData,
  type TransferLineData,
  type ActivityLineData,
  type ParkEntranceFeeLineData,
  type FlightLineData,
  type VillaLineData,
  type MiscLineData,
} from "@/types/line-items";
import {
  quoteHeaderInput,
  accommodationLineInput,
  parkLineInput,
  transportLineInput,
  trainLineInput,
  trainManualLineInput,
  transferLineInput,
  transferManualLineInput,
  activityLineInput,
  activityManualLineInput,
  flightLineInput,
  flightManualLineInput,
  villaLineInput,
  miscLineInput,
  overrideLineInput,
  type QuoteHeaderInput,
} from "@/lib/validation/quote";
import type { Prisma } from "@prisma/client";

/** Missing-bracket error message, shared by accommodation and park entrance fee builders. */
function noChildRateError(age: number, supplierName: string): Error {
  return new Error(`No child rate configured for age ${age} at ${supplierName}.`);
}

function safeRevalidate(path: string) {
  // revalidatePath only works inside a Next.js request context; these
  // actions are also called directly from tests/scripts, so swallow the
  // invariant error there.
  try {
    revalidatePath(path);
  } catch {
    // no-op outside a Next.js request
  }
}

function revalidateQuote(id: string) {
  safeRevalidate(`/quotes/${id}`);
  safeRevalidate("/quotes");
}

// ---------------------------------------------------------------------------
// Saved Quotes list
// ---------------------------------------------------------------------------

export async function listQuotes(opts: { search?: string; status?: "DRAFT" | "FINAL" | "ARCHIVED" } = {}) {
  const quotes = await prisma.quote.findMany({
    where: {
      status: opts.status,
      ...(opts.search
        ? { OR: [{ clientName: { contains: opts.search } }, { tripTitle: { contains: opts.search } }] }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { days: { include: { lineItems: true } }, children: true },
  });

  return quotes.map((q) => {
    const totalUsdCents = q.days.flatMap((d) => d.lineItems).reduce((s, li) => s + li.totalUsdCents, 0);
    const totalPax = computeTotalPax(q.adults, q.children.length);
    return {
      id: q.id,
      clientName: q.clientName,
      tripTitle: q.tripTitle,
      startDate: q.startDate,
      endDate: q.endDate,
      status: q.status,
      totalPax,
      totalUsdCents,
      updatedAt: q.updatedAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Quote CRUD
// ---------------------------------------------------------------------------

export async function getQuote(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      days: { include: { lineItems: true }, orderBy: { dayNumber: "asc" } },
      children: true,
    },
  });
}

export async function createQuote(raw: QuoteHeaderInput) {
  const input = quoteHeaderInput.parse(raw);
  const rateMicros = await getExchangeRateMicros();
  const dates = generateTripDates(input.startDate, input.endDate);

  const quote = await prisma.quote.create({
    data: {
      clientName: input.clientName,
      tripTitle: input.tripTitle,
      startDate: input.startDate,
      endDate: input.endDate,
      adults: input.adults,
      rateMicros,
      days: {
        create: dates.map((date, i) => ({ date, dayNumber: i + 1 })),
      },
      children: {
        create: input.children.map((c) => ({ age: c.age })),
      },
    },
  });

  safeRevalidate("/quotes");
  return quote;
}

export async function updateQuoteHeader(id: string, raw: QuoteHeaderInput) {
  const input = quoteHeaderInput.parse(raw);
  const existing = await prisma.quote.findUniqueOrThrow({
    where: { id },
    include: { days: true },
  });

  const datesChanged =
    existing.startDate.getTime() !== input.startDate.getTime() ||
    existing.endDate.getTime() !== input.endDate.getTime();

  await prisma.quote.update({
    where: { id },
    data: {
      clientName: input.clientName,
      tripTitle: input.tripTitle,
      startDate: input.startDate,
      endDate: input.endDate,
      adults: input.adults,
    },
  });

  // The children list is edited as a whole in the trip-details form, so a
  // full replace is simpler and safer than diffing individual rows — and it
  // never touches a previously-created line item's own frozen child-age
  // snapshot (see buildAccommodationLine / buildParkEntranceFeeLine).
  await prisma.quoteChild.deleteMany({ where: { quoteId: id } });
  if (input.children.length > 0) {
    await prisma.quoteChild.createMany({ data: input.children.map((c) => ({ quoteId: id, age: c.age })) });
  }

  if (datesChanged) {
    const newDates = generateTripDates(input.startDate, input.endDate);
    const existingByTime = new Map(existing.days.map((d) => [d.date.getTime(), d]));
    const keepIds = new Set<string>();

    for (let i = 0; i < newDates.length; i++) {
      const date = newDates[i];
      const dayNumber = i + 1;
      const match = existingByTime.get(date.getTime());
      if (match) {
        keepIds.add(match.id);
        if (match.dayNumber !== dayNumber) {
          await prisma.quoteDay.update({ where: { id: match.id }, data: { dayNumber } });
        }
      } else {
        // Temporarily offset dayNumber to avoid unique-constraint collisions
        // while renumbering below; final numbers are fixed in the pass above.
        await prisma.quoteDay.create({ data: { quoteId: id, date, dayNumber: 1000 + i } });
      }
    }
    const toRemove = existing.days.filter((d) => !keepIds.has(d.id));
    if (toRemove.length > 0) {
      await prisma.quoteDay.deleteMany({ where: { id: { in: toRemove.map((d) => d.id) } } });
    }
    // Second pass: fix up dayNumbers for newly created days (they were
    // given temporary numbers above to dodge the unique constraint).
    const finalDays = await prisma.quoteDay.findMany({ where: { quoteId: id }, orderBy: { date: "asc" } });
    for (let i = 0; i < finalDays.length; i++) {
      if (finalDays[i].dayNumber !== i + 1) {
        await prisma.quoteDay.update({ where: { id: finalDays[i].id }, data: { dayNumber: i + 1 } });
      }
    }
  }

  revalidateQuote(id);
  return getQuote(id);
}

/** Explicit, user-confirmed refresh of a Draft quote's exchange rate (spec section 6). */
export async function refreshQuoteExchangeRate(id: string) {
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id },
    include: { days: { include: { lineItems: true } } },
  });
  if (quote.status !== "DRAFT") {
    throw new Error("Only Draft quotes can have their exchange rate refreshed.");
  }
  const newRateMicros = await getExchangeRateMicros();

  await prisma.$transaction([
    prisma.quote.update({ where: { id }, data: { rateMicros: newRateMicros } }),
    ...quote.days
      .flatMap((d) => d.lineItems)
      .map((li) =>
        prisma.quoteLineItem.update({
          where: { id: li.id },
          data: {
            rateMicros: newRateMicros,
            totalUsdCents: toUsdCents(li.originalTotalCents, li.originalCurrency, newRateMicros),
          },
        })
      ),
  ]);

  revalidateQuote(id);
  return getQuote(id);
}

export async function setQuoteStatus(id: string, status: "DRAFT" | "FINAL" | "ARCHIVED") {
  await prisma.quote.update({ where: { id }, data: { status } });
  revalidateQuote(id);
}

export async function deleteQuote(id: string) {
  await prisma.quote.delete({ where: { id } });
  safeRevalidate("/quotes");
}

export async function duplicateQuote(id: string) {
  const source = await prisma.quote.findUniqueOrThrow({
    where: { id },
    include: { days: { include: { lineItems: true }, orderBy: { dayNumber: "asc" } }, children: true },
  });

  const copy = await prisma.quote.create({
    data: {
      clientName: source.clientName,
      tripTitle: `${source.tripTitle} (Copy)`,
      startDate: source.startDate,
      endDate: source.endDate,
      adults: source.adults,
      status: "DRAFT",
      rateMicros: source.rateMicros,
      notes: source.notes,
      children: {
        create: source.children.map((c) => ({ age: c.age, legacyLabel: c.legacyLabel })),
      },
      days: {
        create: source.days.map((day) => ({
          date: day.date,
          dayNumber: day.dayNumber,
          lineItems: {
            create: day.lineItems.map((li) => ({
              category: li.category,
              sortOrder: li.sortOrder,
              sourceId: li.sourceId,
              description: li.description,
              originalCurrency: li.originalCurrency,
              originalUnitCents: li.originalUnitCents,
              quantity: li.quantity,
              originalTotalCents: li.originalTotalCents,
              rateMicros: li.rateMicros,
              totalUsdCents: li.totalUsdCents,
              manualOverride: li.manualOverride,
              libraryTotalCents: li.libraryTotalCents,
              libraryCurrency: li.libraryCurrency,
              notes: li.notes,
              data: li.data,
            })),
          },
        })),
      },
    },
  });

  safeRevalidate("/quotes");
  return copy;
}

// ---------------------------------------------------------------------------
// Line item helpers
// ---------------------------------------------------------------------------

async function getDayWithQuote(dayId: string) {
  const day = await prisma.quoteDay.findUnique({
    where: { id: dayId },
    include: { quote: { include: { children: true } } },
  });
  if (!day) throw new Error("Day not found");
  return day;
}

/** Exact ages of every child on the quote (legacy rows with no exact age are skipped — they can't be matched to any bracket). */
function quoteChildAges(quote: { children: { age: number | null }[] }): number[] {
  return quote.children.map((c) => c.age).filter((age): age is number => age != null);
}

async function nextSortOrder(dayId: string) {
  const max = await prisma.quoteLineItem.aggregate({ where: { dayId }, _max: { sortOrder: true } });
  return (max._max.sortOrder ?? -1) + 1;
}

type LineItemCreateCore = Omit<Prisma.QuoteLineItemUncheckedCreateInput, "dayId" | "sortOrder">;

async function replaceLineItemCore(id: string, core: LineItemCreateCore) {
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: true } });
  const updated = await prisma.quoteLineItem.update({ where: { id }, data: core });
  revalidateQuote(existing.day.quoteId);
  return updated;
}

export async function removeLineItem(id: string) {
  const li = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: true } });
  await prisma.quoteLineItem.delete({ where: { id } });
  revalidateQuote(li.day.quoteId);
}

export async function duplicateLineItem(id: string) {
  const li = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: true } });
  const sortOrder = await nextSortOrder(li.dayId);
  const copy = await prisma.quoteLineItem.create({
    data: {
      dayId: li.dayId,
      sortOrder,
      category: li.category,
      sourceId: li.sourceId,
      description: li.description,
      originalCurrency: li.originalCurrency,
      originalUnitCents: li.originalUnitCents,
      quantity: li.quantity,
      originalTotalCents: li.originalTotalCents,
      rateMicros: li.rateMicros,
      totalUsdCents: li.totalUsdCents,
      manualOverride: li.manualOverride,
      libraryTotalCents: li.libraryTotalCents,
      libraryCurrency: li.libraryCurrency,
      notes: li.notes,
      data: li.data,
    },
  });
  revalidateQuote(li.day.quoteId);
  return copy;
}

export async function applyLineItemOverride(raw: { lineItemId: string; amount: number; currency: Currency }) {
  const input = overrideLineInput.parse(raw);
  const li = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id: input.lineItemId }, include: { day: true } });
  const originalTotalCents = amountToCents(input.amount);
  const updated = await prisma.quoteLineItem.update({
    where: { id: input.lineItemId },
    data: {
      manualOverride: true,
      originalCurrency: input.currency,
      originalTotalCents,
      totalUsdCents: toUsdCents(originalTotalCents, input.currency, li.rateMicros),
      // Preserve the first-ever library reference; only capture it if this
      // is the first override on an item that didn't have one yet.
      libraryTotalCents: li.libraryTotalCents ?? li.originalTotalCents,
      libraryCurrency: li.libraryCurrency ?? li.originalCurrency,
    },
  });
  revalidateQuote(li.day.quoteId);
  return updated;
}

export async function clearLineItemOverride(lineItemId: string) {
  const li = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id: lineItemId }, include: { day: true } });
  if (li.libraryTotalCents == null || li.libraryCurrency == null) {
    throw new Error("This line item has no library rate to revert to.");
  }
  const updated = await prisma.quoteLineItem.update({
    where: { id: lineItemId },
    data: {
      manualOverride: false,
      originalCurrency: li.libraryCurrency,
      originalTotalCents: li.libraryTotalCents,
      totalUsdCents: toUsdCents(li.libraryTotalCents, li.libraryCurrency, li.rateMicros),
    },
  });
  revalidateQuote(li.day.quoteId);
  return updated;
}

// ---------------------------------------------------------------------------
// Accommodation
// ---------------------------------------------------------------------------

async function buildAccommodationLine(
  input: ReturnType<typeof accommodationLineInput.parse>,
  quote: { adults: number; children: { age: number | null }[]; rateMicros: number }
): Promise<LineItemCreateCore> {
  const accommodation = await prisma.accommodation.findUniqueOrThrow({
    where: { id: input.accommodationId },
    include: { childAgeBrackets: true },
  });
  const roomType = await prisma.accommodationRoomType.findUniqueOrThrow({ where: { id: input.roomTypeId } });
  const rate = await prisma.accommodationRate.findUnique({
    where: { roomTypeId_season_mealPlan: { roomTypeId: input.roomTypeId, season: input.season, mealPlan: input.mealPlan } },
    include: { childRates: true },
  });
  if (!rate) {
    throw new Error("No rate is stored in the Rate Library for that room type, season and meal plan combination.");
  }

  let originalTotalCents: number;
  let data: AccommodationLineData;

  if (accommodation.pricingBasis === "PER_PERSON") {
    if (rate.adultSharingCents == null) {
      throw new Error("This combination has no per-person rate stored yet.");
    }
    const adultsSharing = input.adultsSharing ?? quote.adults;
    const adultsSingle = input.adultsSingle ?? 0;
    const childAges = input.childAges ?? quoteChildAges(quote);

    // Only brackets that have a configured price on THIS specific rate row
    // are usable — a bracket can exist on the accommodation without every
    // room/season/meal-plan combination pricing it.
    const bracketRates: AccommodationChildBracketRate[] = accommodation.childAgeBrackets
      .map((b) => {
        const priceCents = rate.childRates.find((cr) => cr.bracketId === b.id)?.priceCents;
        return priceCents == null ? null : { id: b.id, minAge: b.minAge, maxAge: b.maxAge, label: b.label, priceCents };
      })
      .filter((b): b is AccommodationChildBracketRate => b !== null);

    const calc = computeAccommodationPerPersonWithChildren(
      rate.adultSharingCents,
      rate.singleCents,
      bracketRates,
      childAges,
      adultsSharing,
      adultsSingle,
      accommodation.currency,
      quote.rateMicros
    );

    let childBrackets: ChildBracketSelection[];
    let unmatchedChildAges: number[];

    if (calc.ok) {
      originalTotalCents = calc.originalTotalCents;
      childBrackets = calc.matchedChildren.map((m) => ({
        bracketId: m.bracket.id,
        label: bracketLabel(m.bracket),
        minAge: m.bracket.minAge,
        maxAge: m.bracket.maxAge,
        priceCents: m.bracket.priceCents,
        ages: m.ages,
      }));
      unmatchedChildAges = [];
    } else if (input.manualTotalOverride) {
      // Rescue path: a child's age matched no configured bracket, and the
      // consultant chose to proceed with a manual total instead of
      // guessing (spec: "never silently guess a child rate").
      originalTotalCents = amountToCents(input.manualTotalOverride.amount);
      childBrackets = [];
      unmatchedChildAges = calc.unmatchedAges;
    } else {
      throw noChildRateError(calc.unmatchedAges[0], accommodation.name);
    }

    data = {
      category: "ACCOMMODATION",
      accommodationId: accommodation.id,
      accommodationName: accommodation.name,
      location: accommodation.location,
      roomTypeId: roomType.id,
      roomTypeName: roomType.name,
      season: input.season,
      mealPlan: input.mealPlan,
      currency: calc.ok ? accommodation.currency : input.manualTotalOverride!.currency,
      basis: {
        pricingBasis: "PER_PERSON",
        adultsSharing,
        adultsSingle,
        childBrackets,
        unmatchedChildAges,
        rates: { adultSharingCents: rate.adultSharingCents, singleCents: rate.singleCents },
        totalRooms: input.totalRooms ?? null,
        singleRooms: input.singleRooms ?? null,
      },
    };

    const lineCurrency = calc.ok ? accommodation.currency : input.manualTotalOverride!.currency;
    const usdTotalCents = toUsdCents(originalTotalCents, lineCurrency, quote.rateMicros);

    return {
      category: "ACCOMMODATION",
      sourceId: accommodation.id,
      description: `${accommodation.name} — ${roomType.name}`,
      originalCurrency: lineCurrency,
      originalUnitCents: null,
      quantity: null,
      originalTotalCents,
      rateMicros: quote.rateMicros,
      totalUsdCents: usdTotalCents,
      manualOverride: !calc.ok,
      libraryTotalCents: calc.ok ? originalTotalCents : null,
      libraryCurrency: calc.ok ? accommodation.currency : null,
      data: serializeLineItemData(data),
    };
  } else {
    if (rate.standardRoomCents == null) {
      throw new Error("This combination has no per-room rate stored yet.");
    }
    const totalRooms = input.roomTotalRooms ?? 1;
    const singleRooms = Math.min(input.roomSingleRooms ?? 0, totalRooms);
    const result = computeAccommodationPerRoom(
      { standardRoomCents: rate.standardRoomCents, singleRoomCents: rate.singleRoomCents },
      { totalRooms, singleRooms },
      accommodation.currency,
      quote.rateMicros
    );
    originalTotalCents = result.originalTotalCents;
    data = {
      category: "ACCOMMODATION",
      accommodationId: accommodation.id,
      accommodationName: accommodation.name,
      location: accommodation.location,
      roomTypeId: roomType.id,
      roomTypeName: roomType.name,
      season: input.season,
      mealPlan: input.mealPlan,
      currency: accommodation.currency,
      basis: {
        pricingBasis: "PER_ROOM",
        totalRooms,
        singleRooms,
        standardRooms: result.standardRooms,
        rates: { standardRoomCents: rate.standardRoomCents, singleRoomCents: rate.singleRoomCents },
      },
    };
  }

  const usdTotalCents = toUsdCents(originalTotalCents, accommodation.currency, quote.rateMicros);

  return {
    category: "ACCOMMODATION",
    sourceId: accommodation.id,
    description: `${accommodation.name} — ${roomType.name}`,
    originalCurrency: accommodation.currency,
    originalUnitCents: null,
    quantity: null,
    originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: usdTotalCents,
    manualOverride: false,
    libraryTotalCents: originalTotalCents,
    libraryCurrency: accommodation.currency,
    data: serializeLineItemData(data),
  };
}

export async function addAccommodationLineItem(raw: unknown) {
  const input = accommodationLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildAccommodationLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function updateAccommodationLineItem(id: string, raw: unknown) {
  const input = accommodationLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildAccommodationLine(input, existing.day.quote);
  const updated = await prisma.quoteLineItem.update({ where: { id }, data: core });
  revalidateQuote(existing.day.quoteId);
  return updated;
}

// ---------------------------------------------------------------------------
// Park Entrance Fees
// ---------------------------------------------------------------------------

async function buildParkEntranceFeeLine(
  input: ReturnType<typeof parkLineInput.parse>,
  quote: { adults: number; children: { age: number | null }[]; rateMicros: number }
): Promise<LineItemCreateCore> {
  const park = await prisma.park.findUniqueOrThrow({
    where: { id: input.parkId },
    include: { childBrackets: true },
  });

  const adults = input.adults ?? quote.adults;
  const childAges = input.childAges ?? quoteChildAges(quote);
  const bracketRates: ParkChildBracketRate[] = park.childBrackets.map((b) => ({
    id: b.id,
    minAge: b.minAge,
    maxAge: b.maxAge,
    label: b.label,
    priceCents: b.priceCents,
  }));

  const calc = computeParkEntranceFee(park.adultFeeCents, bracketRates, adults, childAges, park.currency, quote.rateMicros);

  let originalTotalCents: number;
  let childBrackets: ChildBracketSelection[];
  let unmatchedChildAges: number[];
  let currency = park.currency;

  if (calc.ok) {
    originalTotalCents = calc.originalTotalCents;
    childBrackets = calc.matchedChildren.map((m) => ({
      bracketId: m.bracket.id,
      label: bracketLabel(m.bracket),
      minAge: m.bracket.minAge,
      maxAge: m.bracket.maxAge,
      priceCents: m.bracket.priceCents,
      ages: m.ages,
    }));
    unmatchedChildAges = [];
  } else if (input.manualTotalOverride) {
    originalTotalCents = amountToCents(input.manualTotalOverride.amount);
    currency = input.manualTotalOverride.currency;
    childBrackets = [];
    unmatchedChildAges = calc.unmatchedAges;
  } else {
    throw noChildRateError(calc.unmatchedAges[0], park.name);
  }

  const data: ParkEntranceFeeLineData = {
    category: "PARK_ENTRANCE_FEE",
    parkId: park.id,
    parkName: park.name,
    currency,
    adultFeeCents: park.adultFeeCents,
    adults,
    childBrackets,
    unmatchedChildAges,
  };

  const usdTotalCents = toUsdCents(originalTotalCents, currency, quote.rateMicros);

  return {
    category: "PARK_ENTRANCE_FEE",
    sourceId: park.id,
    description: park.name,
    originalCurrency: currency,
    originalUnitCents: null,
    quantity: null,
    originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: usdTotalCents,
    manualOverride: !calc.ok,
    libraryTotalCents: calc.ok ? originalTotalCents : null,
    libraryCurrency: calc.ok ? park.currency : null,
    data: serializeLineItemData(data),
  };
}

export async function addParkLineItem(raw: unknown) {
  const input = parkLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildParkEntranceFeeLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function updateParkLineItem(id: string, raw: unknown) {
  const input = parkLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildParkEntranceFeeLine(input, existing.day.quote);
  const updated = await prisma.quoteLineItem.update({ where: { id }, data: core });
  revalidateQuote(existing.day.quoteId);
  return updated;
}

// ---------------------------------------------------------------------------
// Private Transport & Guide
// ---------------------------------------------------------------------------

async function buildTransportLine(
  input: ReturnType<typeof transportLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const rate = await prisma.transportRate.findUniqueOrThrow({ where: { id: input.transportRateId } });
  const result = computeTransportTotal(rate.priceCents, input.vehicles, rate.currency, quote.rateMicros);
  const data: TransportLineData = {
    category: "PRIVATE_TRANSPORT",
    vehicleType: rate.vehicleType,
    vehicles: input.vehicles,
    priceCentsPerVehicle: rate.priceCents,
    currency: rate.currency,
  };
  return {
    category: "PRIVATE_TRANSPORT",
    sourceId: rate.id,
    description: VEHICLE_TYPE_LABELS[rate.vehicleType],
    originalCurrency: rate.currency,
    originalUnitCents: rate.priceCents,
    quantity: input.vehicles,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: result.originalTotalCents,
    libraryCurrency: rate.currency,
    data: serializeLineItemData(data),
  };
}

export async function addTransportLineItem(raw: unknown) {
  const input = transportLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildTransportLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function updateTransportLineItem(id: string, raw: unknown) {
  const input = transportLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildTransportLine(input, existing.day.quote);
  const updated = await prisma.quoteLineItem.update({ where: { id }, data: core });
  revalidateQuote(existing.day.quoteId);
  return updated;
}

// ---------------------------------------------------------------------------
// Train
// ---------------------------------------------------------------------------

async function buildTrainLine(
  input: ReturnType<typeof trainLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const journey = await prisma.trainJourney.findUniqueOrThrow({ where: { id: input.journeyId } });
  const priceCents = input.trainClass === "FIRST" ? journey.firstClassCents : journey.secondClassCents;
  const result = computeTrainTotal(priceCents, input.passengers, journey.currency, quote.rateMicros);
  const data: TrainLineData = {
    category: "TRAIN",
    journeyId: journey.id,
    route: journey.route,
    trainClass: input.trainClass,
    passengers: input.passengers,
    priceCentsPerPassenger: priceCents,
    currency: journey.currency,
  };
  return {
    category: "TRAIN",
    sourceId: journey.id,
    description: `${journey.route} — ${input.trainClass === "FIRST" ? "First Class" : "Second Class"}`,
    originalCurrency: journey.currency,
    originalUnitCents: priceCents,
    quantity: input.passengers,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: result.originalTotalCents,
    libraryCurrency: journey.currency,
    data: serializeLineItemData(data),
  };
}

async function buildTrainManualLine(
  input: ReturnType<typeof trainManualLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const priceCents = amountToCents(input.price);
  const result = computeTrainTotal(priceCents, input.passengers, input.currency, quote.rateMicros);
  const data: TrainLineData = {
    category: "TRAIN",
    journeyId: null,
    route: input.route,
    trainClass: "FIRST",
    passengers: input.passengers,
    priceCentsPerPassenger: priceCents,
    currency: input.currency,
  };
  return {
    category: "TRAIN",
    sourceId: null,
    description: input.route,
    originalCurrency: input.currency,
    originalUnitCents: priceCents,
    quantity: input.passengers,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: null,
    libraryCurrency: null,
    data: serializeLineItemData(data),
  };
}

export async function addTrainLineItem(raw: unknown) {
  const input = trainLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildTrainLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function addTrainManualLineItem(raw: unknown) {
  const input = trainManualLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildTrainManualLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function updateTrainLineItem(id: string, raw: unknown) {
  const input = trainLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildTrainLine(input, existing.day.quote);
  return replaceLineItemCore(id, core);
}

export async function updateTrainManualLineItem(id: string, raw: unknown) {
  const input = trainManualLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildTrainManualLine(input, existing.day.quote);
  return replaceLineItemCore(id, core);
}

// ---------------------------------------------------------------------------
// Taxi Transfer
// ---------------------------------------------------------------------------

async function buildTransferLine(
  input: ReturnType<typeof transferLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const rate = await prisma.transferRate.findUniqueOrThrow({ where: { id: input.transferId } });
  const result = computeTransferTotal(rate.priceCents, input.vehicles, rate.currency, quote.rateMicros);
  const data: TransferLineData = {
    category: "TAXI_TRANSFER",
    transferId: rate.id,
    route: rate.route,
    isManual: false,
    vehicles: input.vehicles,
    priceCentsPerVehicle: rate.priceCents,
    currency: rate.currency,
  };
  return {
    category: "TAXI_TRANSFER",
    sourceId: rate.id,
    description: rate.route,
    originalCurrency: rate.currency,
    originalUnitCents: rate.priceCents,
    quantity: input.vehicles,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: result.originalTotalCents,
    libraryCurrency: rate.currency,
    data: serializeLineItemData(data),
  };
}

async function buildTransferManualLine(
  input: ReturnType<typeof transferManualLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const priceCents = amountToCents(input.price);
  const result = computeTransferTotal(priceCents, input.vehicles, input.currency, quote.rateMicros);
  const data: TransferLineData = {
    category: "TAXI_TRANSFER",
    transferId: null,
    route: input.route,
    isManual: true,
    vehicles: input.vehicles,
    priceCentsPerVehicle: priceCents,
    currency: input.currency,
  };
  return {
    category: "TAXI_TRANSFER",
    sourceId: null,
    description: input.route,
    originalCurrency: input.currency,
    originalUnitCents: priceCents,
    quantity: input.vehicles,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: null,
    libraryCurrency: null,
    data: serializeLineItemData(data),
  };
}

export async function addTransferLineItem(raw: unknown) {
  const input = transferLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildTransferLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function addTransferManualLineItem(raw: unknown) {
  const input = transferManualLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildTransferManualLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function updateTransferLineItem(id: string, raw: unknown) {
  const input = transferLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildTransferLine(input, existing.day.quote);
  return replaceLineItemCore(id, core);
}

export async function updateTransferManualLineItem(id: string, raw: unknown) {
  const input = transferManualLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildTransferManualLine(input, existing.day.quote);
  return replaceLineItemCore(id, core);
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

async function buildActivityLine(
  input: ReturnType<typeof activityLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const rate = await prisma.activityRate.findUniqueOrThrow({ where: { id: input.activityId } });
  const result = computeActivityTotal(rate.priceCents, input.participants, rate.currency, quote.rateMicros);
  const data: ActivityLineData = {
    category: "ACTIVITY",
    activityId: rate.id,
    activityName: rate.name,
    location: rate.location,
    participants: input.participants,
    priceCentsPerParticipant: rate.priceCents,
    currency: rate.currency,
  };
  return {
    category: "ACTIVITY",
    sourceId: rate.id,
    description: rate.name,
    originalCurrency: rate.currency,
    originalUnitCents: rate.priceCents,
    quantity: input.participants,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: result.originalTotalCents,
    libraryCurrency: rate.currency,
    data: serializeLineItemData(data),
  };
}

async function buildActivityManualLine(
  input: ReturnType<typeof activityManualLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const priceCents = amountToCents(input.price);
  const result = computeActivityTotal(priceCents, input.participants, input.currency, quote.rateMicros);
  const data: ActivityLineData = {
    category: "ACTIVITY",
    activityId: null,
    activityName: input.name,
    location: input.location ?? "",
    participants: input.participants,
    priceCentsPerParticipant: priceCents,
    currency: input.currency,
  };
  return {
    category: "ACTIVITY",
    sourceId: null,
    description: input.name,
    originalCurrency: input.currency,
    originalUnitCents: priceCents,
    quantity: input.participants,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: null,
    libraryCurrency: null,
    data: serializeLineItemData(data),
  };
}

export async function addActivityLineItem(raw: unknown) {
  const input = activityLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildActivityLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function addActivityManualLineItem(raw: unknown) {
  const input = activityManualLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildActivityManualLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function updateActivityLineItem(id: string, raw: unknown) {
  const input = activityLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildActivityLine(input, existing.day.quote);
  return replaceLineItemCore(id, core);
}

export async function updateActivityManualLineItem(id: string, raw: unknown) {
  const input = activityManualLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildActivityManualLine(input, existing.day.quote);
  return replaceLineItemCore(id, core);
}

// ---------------------------------------------------------------------------
// Domestic Flights
// ---------------------------------------------------------------------------

async function buildFlightLine(
  input: ReturnType<typeof flightLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const rate = await prisma.flightRate.findUniqueOrThrow({ where: { id: input.flightId } });
  const result = computeFlightTotal(rate.priceCents, input.passengers, rate.currency, quote.rateMicros);
  const data: FlightLineData = {
    category: "DOMESTIC_FLIGHT",
    flightId: rate.id,
    route: rate.route,
    isManual: false,
    passengers: input.passengers,
    priceCentsPerPassenger: rate.priceCents,
    currency: rate.currency,
  };
  return {
    category: "DOMESTIC_FLIGHT",
    sourceId: rate.id,
    description: rate.route,
    originalCurrency: rate.currency,
    originalUnitCents: rate.priceCents,
    quantity: input.passengers,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: result.originalTotalCents,
    libraryCurrency: rate.currency,
    data: serializeLineItemData(data),
  };
}

async function buildFlightManualLine(
  input: ReturnType<typeof flightManualLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const priceCents = amountToCents(input.price);
  const result = computeFlightTotal(priceCents, input.passengers, input.currency, quote.rateMicros);
  const data: FlightLineData = {
    category: "DOMESTIC_FLIGHT",
    flightId: null,
    route: input.route,
    isManual: true,
    passengers: input.passengers,
    priceCentsPerPassenger: priceCents,
    currency: input.currency,
  };
  return {
    category: "DOMESTIC_FLIGHT",
    sourceId: null,
    description: input.route,
    originalCurrency: input.currency,
    originalUnitCents: priceCents,
    quantity: input.passengers,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: null,
    libraryCurrency: null,
    data: serializeLineItemData(data),
  };
}

export async function addFlightLineItem(raw: unknown) {
  const input = flightLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildFlightLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function addFlightManualLineItem(raw: unknown) {
  const input = flightManualLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildFlightManualLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function updateFlightLineItem(id: string, raw: unknown) {
  const input = flightLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildFlightLine(input, existing.day.quote);
  return replaceLineItemCore(id, core);
}

export async function updateFlightManualLineItem(id: string, raw: unknown) {
  const input = flightManualLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildFlightManualLine(input, existing.day.quote);
  return replaceLineItemCore(id, core);
}

// ---------------------------------------------------------------------------
// Villa (manual only — not in the Rate Library)
// ---------------------------------------------------------------------------

async function buildVillaLine(
  input: ReturnType<typeof villaLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const nightlyRateCents = amountToCents(input.price);
  const result = computeVillaTotal(nightlyRateCents, input.nights, input.quantity, input.currency, quote.rateMicros);
  const data: VillaLineData = {
    category: "VILLA",
    villaName: input.villaName,
    location: input.location ?? "",
    nights: input.nights,
    quantity: input.quantity,
    nightlyRateCents,
    currency: input.currency,
  };
  return {
    category: "VILLA",
    sourceId: null,
    description: input.villaName,
    originalCurrency: input.currency,
    originalUnitCents: nightlyRateCents,
    quantity: input.nights * input.quantity,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: null,
    libraryCurrency: null,
    notes: input.notes || null,
    data: serializeLineItemData(data),
  };
}

export async function addVillaLineItem(raw: unknown) {
  const input = villaLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildVillaLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function updateVillaLineItem(id: string, raw: unknown) {
  const input = villaLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildVillaLine(input, existing.day.quote);
  const updated = await prisma.quoteLineItem.update({ where: { id }, data: core });
  revalidateQuote(existing.day.quoteId);
  return updated;
}

// ---------------------------------------------------------------------------
// Misc (manual only)
// ---------------------------------------------------------------------------

async function buildMiscLine(
  input: ReturnType<typeof miscLineInput.parse>,
  quote: { rateMicros: number }
): Promise<LineItemCreateCore> {
  const unitPriceCents = amountToCents(input.price);
  const result = computeMiscTotal(unitPriceCents, input.quantity, input.currency, quote.rateMicros);
  const data: MiscLineData = {
    category: "MISC",
    itemName: input.itemName,
    quantity: input.quantity,
    unitPriceCents,
    currency: input.currency,
  };
  return {
    category: "MISC",
    sourceId: null,
    description: input.itemName,
    originalCurrency: input.currency,
    originalUnitCents: unitPriceCents,
    quantity: input.quantity,
    originalTotalCents: result.originalTotalCents,
    rateMicros: quote.rateMicros,
    totalUsdCents: result.usdTotalCents,
    manualOverride: false,
    libraryTotalCents: null,
    libraryCurrency: null,
    notes: input.notes || null,
    data: serializeLineItemData(data),
  };
}

export async function addMiscLineItem(raw: unknown) {
  const input = miscLineInput.parse(raw);
  const day = await getDayWithQuote(input.dayId);
  const core = await buildMiscLine(input, day.quote);
  const sortOrder = await nextSortOrder(input.dayId);
  const created = await prisma.quoteLineItem.create({ data: { dayId: input.dayId, sortOrder, ...core } });
  revalidateQuote(day.quoteId);
  return created;
}

export async function updateMiscLineItem(id: string, raw: unknown) {
  const input = miscLineInput.parse(raw);
  const existing = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id }, include: { day: { include: { quote: { include: { children: true } } } } } });
  const core = await buildMiscLine(input, existing.day.quote);
  const updated = await prisma.quoteLineItem.update({ where: { id }, data: core });
  revalidateQuote(existing.day.quoteId);
  return updated;
}
