"use server";

import { prisma } from "@/lib/prisma";
import { amountToCents } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { validateBracketSet } from "@/lib/calc/child-brackets";
import {
  accommodationInput,
  transportRateInput,
  trainJourneyInput,
  transferRateInput,
  activityRateInput,
  flightRateInput,
  parkInput,
  accommodationActivityInput,
  type AccommodationInput,
  type TransportRateInput,
  type TrainJourneyInput,
  type TransferRateInput,
  type ActivityRateInput,
  type FlightRateInput,
  type ParkInput,
  type AccommodationActivityInput,
} from "@/lib/validation/rate-library";

function revalidateLibrary() {
  // revalidatePath only works inside a Next.js request context; these
  // actions are also called directly from tests/scripts, so swallow the
  // invariant error there.
  try {
    revalidatePath("/rate-library");
  } catch {
    // no-op outside a Next.js request
  }
}

// ---------------------------------------------------------------------------
// Accommodation
// ---------------------------------------------------------------------------

export async function listAccommodations(opts: { search?: string; includeArchived?: boolean } = {}) {
  const { search, includeArchived } = opts;
  return prisma.accommodation.findMany({
    where: {
      archived: includeArchived ? undefined : false,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { location: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 50,
    include: {
      roomTypes: { orderBy: { sortOrder: "asc" } },
      rates: { include: { childRates: true } },
      childAgeBrackets: { orderBy: { sortOrder: "asc" } },
      activities: { orderBy: { name: "asc" } },
    },
  });
}

export async function getAccommodation(id: string) {
  return prisma.accommodation.findUnique({
    where: { id },
    include: {
      roomTypes: { orderBy: { sortOrder: "asc" } },
      rates: { include: { childRates: true } },
      childAgeBrackets: { orderBy: { sortOrder: "asc" } },
      activities: { orderBy: { name: "asc" } },
    },
  });
}

/** Reconciles the submitted child age brackets against what's already stored: update existing, create new, remove missing. Validates the whole set first (range + no overlaps) so a bad edit never reaches the database. */
async function reconcileChildAgeBrackets(accommodationId: string, input: AccommodationInput) {
  const validationError = validateBracketSet(input.childAgeBrackets);
  if (validationError) throw new Error(validationError);

  const existing = await prisma.accommodationChildAgeBracket.findMany({ where: { accommodationId } });
  const existingIds = new Set(existing.map((b) => b.id));
  const submittedIds = new Set(input.childAgeBrackets.filter((b) => b.id).map((b) => b.id as string));

  const toDelete = existing.filter((b) => !submittedIds.has(b.id));
  if (toDelete.length > 0) {
    await prisma.accommodationChildAgeBracket.deleteMany({ where: { id: { in: toDelete.map((b) => b.id) } } });
  }

  const bracketIdByLocalId = new Map<string, string>();
  for (let i = 0; i < input.childAgeBrackets.length; i++) {
    const b = input.childAgeBrackets[i];
    if (b.id && existingIds.has(b.id)) {
      await prisma.accommodationChildAgeBracket.update({
        where: { id: b.id },
        data: { minAge: b.minAge, maxAge: b.maxAge, label: b.label || null, sortOrder: i },
      });
      bracketIdByLocalId.set(b.id, b.id);
    } else {
      const created = await prisma.accommodationChildAgeBracket.create({
        data: { accommodationId, minAge: b.minAge, maxAge: b.maxAge, label: b.label || null, sortOrder: i },
      });
      bracketIdByLocalId.set(b.id ?? `${b.minAge}-${b.maxAge}`, created.id);
    }
  }
  return bracketIdByLocalId;
}

async function writeAccommodationRates(
  accommodationId: string,
  input: AccommodationInput,
  roomTypeIdByLocalId: Map<string, string>,
  bracketIdByLocalId: Map<string, string>
) {
  // Replace all rates for this accommodation with the submitted set — the
  // rate grid is edited as a whole, so a full replace is simpler and safer
  // than diffing individual cells.
  await prisma.accommodationRate.deleteMany({ where: { accommodationId } });

  for (const r of input.rates) {
    const roomTypeId = roomTypeIdByLocalId.get(r.roomTypeId) ?? r.roomTypeId;

    if (input.pricingBasis === "PER_PERSON") {
      if (r.adultSharing == null) continue;
      const rate = await prisma.accommodationRate.create({
        data: {
          accommodationId,
          roomTypeId,
          season: r.season,
          mealPlan: r.mealPlan,
          adultSharingCents: amountToCents(r.adultSharing),
          singleCents: r.single != null ? amountToCents(r.single) : null,
        },
      });
      const childPrices = (r.childPrices ?? []).filter((cp) => cp.price != null);
      if (childPrices.length > 0) {
        await prisma.accommodationChildRate.createMany({
          data: childPrices.map((cp) => ({
            accommodationRateId: rate.id,
            bracketId: bracketIdByLocalId.get(cp.bracketId) ?? cp.bracketId,
            priceCents: amountToCents(cp.price),
          })),
        });
      }
    } else {
      if (r.standardRoom == null) continue;
      await prisma.accommodationRate.create({
        data: {
          accommodationId,
          roomTypeId,
          season: r.season,
          mealPlan: r.mealPlan,
          standardRoomCents: amountToCents(r.standardRoom),
          singleRoomCents: r.singleRoom != null ? amountToCents(r.singleRoom) : null,
        },
      });
    }
  }
}

export async function createAccommodation(raw: AccommodationInput) {
  const input = accommodationInput.parse(raw);
  const validationError = validateBracketSet(input.childAgeBrackets);
  if (validationError) throw new Error(validationError);

  const accommodation = await prisma.accommodation.create({
    data: {
      name: input.name,
      location: input.location,
      notes: input.notes || null,
      currency: input.currency,
      pricingBasis: input.pricingBasis,
      roomTypes: {
        create: input.roomTypes.map((rt, i) => ({ name: rt.name, sortOrder: i })),
      },
    },
    include: { roomTypes: true },
  });

  const roomTypeIdByLocalId = new Map<string, string>();
  input.roomTypes.forEach((rt, i) => {
    const key = rt.id ?? rt.name;
    roomTypeIdByLocalId.set(key, accommodation.roomTypes[i].id);
    // also allow referencing by the created room type's own id if the
    // caller already generated one client-side for row linking
  });

  const bracketIdByLocalId = await reconcileChildAgeBrackets(accommodation.id, input);
  await writeAccommodationRates(accommodation.id, input, roomTypeIdByLocalId, bracketIdByLocalId);
  revalidateLibrary();
  return getAccommodation(accommodation.id);
}

export async function updateAccommodation(id: string, raw: AccommodationInput) {
  const input = accommodationInput.parse(raw);

  await prisma.accommodation.update({
    where: { id },
    data: {
      name: input.name,
      location: input.location,
      notes: input.notes || null,
      currency: input.currency,
      pricingBasis: input.pricingBasis,
    },
  });

  // Reconcile room types: update existing, create new, remove missing.
  const existing = await prisma.accommodationRoomType.findMany({ where: { accommodationId: id } });
  const existingIds = new Set(existing.map((r) => r.id));
  const submittedIds = new Set(input.roomTypes.filter((r) => r.id).map((r) => r.id as string));

  const toDelete = existing.filter((r) => !submittedIds.has(r.id));
  if (toDelete.length > 0) {
    await prisma.accommodationRoomType.deleteMany({
      where: { id: { in: toDelete.map((r) => r.id) } },
    });
  }

  const roomTypeIdByLocalId = new Map<string, string>();
  for (let i = 0; i < input.roomTypes.length; i++) {
    const rt = input.roomTypes[i];
    if (rt.id && existingIds.has(rt.id)) {
      await prisma.accommodationRoomType.update({
        where: { id: rt.id },
        data: { name: rt.name, sortOrder: i },
      });
      roomTypeIdByLocalId.set(rt.id, rt.id);
    } else {
      const created = await prisma.accommodationRoomType.create({
        data: { accommodationId: id, name: rt.name, sortOrder: i },
      });
      roomTypeIdByLocalId.set(rt.id ?? rt.name, created.id);
    }
  }

  const bracketIdByLocalId = await reconcileChildAgeBrackets(id, input);
  await writeAccommodationRates(id, input, roomTypeIdByLocalId, bracketIdByLocalId);
  revalidateLibrary();
  return getAccommodation(id);
}

export async function duplicateAccommodation(id: string) {
  const source = await getAccommodation(id);
  if (!source) throw new Error("Accommodation not found");

  const copy = await prisma.accommodation.create({
    data: {
      name: `${source.name} (Copy)`,
      location: source.location,
      notes: source.notes,
      currency: source.currency,
      pricingBasis: source.pricingBasis,
      roomTypes: {
        create: source.roomTypes.map((rt) => ({ name: rt.name, sortOrder: rt.sortOrder })),
      },
    },
    include: { roomTypes: { orderBy: { sortOrder: "asc" } } },
  });

  const roomTypeMap = new Map<string, string>();
  source.roomTypes.forEach((rt, i) => roomTypeMap.set(rt.id, copy.roomTypes[i].id));

  const bracketMap = new Map<string, string>();
  for (const bracket of source.childAgeBrackets) {
    const created = await prisma.accommodationChildAgeBracket.create({
      data: {
        accommodationId: copy.id,
        minAge: bracket.minAge,
        maxAge: bracket.maxAge,
        label: bracket.label,
        sortOrder: bracket.sortOrder,
      },
    });
    bracketMap.set(bracket.id, created.id);
  }

  for (const r of source.rates) {
    const rate = await prisma.accommodationRate.create({
      data: {
        accommodationId: copy.id,
        roomTypeId: roomTypeMap.get(r.roomTypeId)!,
        season: r.season,
        mealPlan: r.mealPlan,
        adultSharingCents: r.adultSharingCents,
        singleCents: r.singleCents,
        standardRoomCents: r.standardRoomCents,
        singleRoomCents: r.singleRoomCents,
      },
    });
    if (r.childRates.length > 0) {
      await prisma.accommodationChildRate.createMany({
        data: r.childRates.map((cr) => ({
          accommodationRateId: rate.id,
          bracketId: bracketMap.get(cr.bracketId)!,
          priceCents: cr.priceCents,
        })),
      });
    }
  }

  if (source.activities.length > 0) {
    await prisma.accommodationActivity.createMany({
      data: source.activities.map((a) => ({
        accommodationId: copy.id,
        name: a.name,
        pricingBasis: a.pricingBasis,
        amountCents: a.amountCents,
        currency: a.currency,
        notes: a.notes,
        archived: a.archived,
      })),
    });
  }

  revalidateLibrary();
  return getAccommodation(copy.id);
}

export async function archiveAccommodation(id: string, archived: boolean) {
  await prisma.accommodation.update({ where: { id }, data: { archived } });
  revalidateLibrary();
}

export async function deleteAccommodation(id: string) {
  const used = await prisma.quoteLineItem.findFirst({ where: { sourceId: id, category: "ACCOMMODATION" } });
  if (used) throw new Error("This accommodation is used in a saved quote — archive it instead of deleting.");
  const activityIds = (await prisma.accommodationActivity.findMany({ where: { accommodationId: id }, select: { id: true } })).map(
    (a) => a.id
  );
  if (activityIds.length > 0) {
    const usedActivity = await prisma.quoteLineItem.findFirst({
      where: { category: "LODGE_ACTIVITY", sourceId: { in: activityIds } },
    });
    if (usedActivity) {
      throw new Error("A Lodge Activity for this accommodation is used in a saved quote — archive it instead of deleting.");
    }
  }
  await prisma.accommodation.delete({ where: { id } });
  revalidateLibrary();
}

// ---------------------------------------------------------------------------
// Accommodation: Lodge Activities
// ---------------------------------------------------------------------------

export async function listAccommodationActivities(accommodationId: string, opts: { includeArchived?: boolean } = {}) {
  return prisma.accommodationActivity.findMany({
    where: { accommodationId, archived: opts.includeArchived ? undefined : false },
    orderBy: { name: "asc" },
  });
}

export async function createAccommodationActivity(accommodationId: string, raw: AccommodationActivityInput) {
  const input = accommodationActivityInput.parse(raw);
  const activity = await prisma.accommodationActivity.create({
    data: {
      accommodationId,
      name: input.name,
      pricingBasis: input.pricingBasis,
      amountCents: amountToCents(input.amount),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return activity;
}

export async function updateAccommodationActivity(id: string, raw: AccommodationActivityInput) {
  const input = accommodationActivityInput.parse(raw);
  const activity = await prisma.accommodationActivity.update({
    where: { id },
    data: {
      name: input.name,
      pricingBasis: input.pricingBasis,
      amountCents: amountToCents(input.amount),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return activity;
}

export async function duplicateAccommodationActivity(id: string) {
  const source = await prisma.accommodationActivity.findUniqueOrThrow({ where: { id } });
  const copy = await prisma.accommodationActivity.create({
    data: {
      accommodationId: source.accommodationId,
      name: `${source.name} (Copy)`,
      pricingBasis: source.pricingBasis,
      amountCents: source.amountCents,
      currency: source.currency,
      notes: source.notes,
    },
  });
  revalidateLibrary();
  return copy;
}

export async function archiveAccommodationActivity(id: string, archived: boolean) {
  await prisma.accommodationActivity.update({ where: { id }, data: { archived } });
  revalidateLibrary();
}

export async function deleteAccommodationActivity(id: string) {
  await assertNotUsed(id, "LODGE_ACTIVITY", "This activity is used in a saved quote — archive it instead of deleting.");
  await prisma.accommodationActivity.delete({ where: { id } });
  revalidateLibrary();
}

// ---------------------------------------------------------------------------
// Shared helpers for the five simple rate categories
// ---------------------------------------------------------------------------

async function assertNotUsed(sourceId: string, category: string, message: string) {
  const used = await prisma.quoteLineItem.findFirst({ where: { sourceId, category: category as never } });
  if (used) throw new Error(message);
}

// ---------------------------------------------------------------------------
// Private Transport & Guide
// ---------------------------------------------------------------------------

export async function listTransportRates(opts: { includeArchived?: boolean } = {}) {
  return prisma.transportRate.findMany({
    where: { archived: opts.includeArchived ? undefined : false },
    orderBy: { vehicleType: "asc" },
  });
}

export async function createTransportRate(raw: TransportRateInput) {
  const input = transportRateInput.parse(raw);
  const rate = await prisma.transportRate.create({
    data: {
      vehicleType: input.vehicleType,
      priceCents: amountToCents(input.price),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return rate;
}

export async function updateTransportRate(id: string, raw: TransportRateInput) {
  const input = transportRateInput.parse(raw);
  const rate = await prisma.transportRate.update({
    where: { id },
    data: {
      vehicleType: input.vehicleType,
      priceCents: amountToCents(input.price),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return rate;
}

export async function duplicateTransportRate(id: string) {
  const source = await prisma.transportRate.findUniqueOrThrow({ where: { id } });
  const copy = await prisma.transportRate.create({
    data: {
      vehicleType: source.vehicleType,
      priceCents: source.priceCents,
      currency: source.currency,
      notes: source.notes,
    },
  });
  revalidateLibrary();
  return copy;
}

export async function archiveTransportRate(id: string, archived: boolean) {
  await prisma.transportRate.update({ where: { id }, data: { archived } });
  revalidateLibrary();
}

export async function deleteTransportRate(id: string) {
  await assertNotUsed(id, "PRIVATE_TRANSPORT", "This rate is used in a saved quote — archive it instead of deleting.");
  await prisma.transportRate.delete({ where: { id } });
  revalidateLibrary();
}

// ---------------------------------------------------------------------------
// Train
// ---------------------------------------------------------------------------

export async function listTrainJourneys(opts: { search?: string; includeArchived?: boolean } = {}) {
  return prisma.trainJourney.findMany({
    where: {
      archived: opts.includeArchived ? undefined : false,
      ...(opts.search ? { route: { contains: opts.search } } : {}),
    },
    orderBy: { route: "asc" },
    take: 50,
  });
}

export async function createTrainJourney(raw: TrainJourneyInput) {
  const input = trainJourneyInput.parse(raw);
  const journey = await prisma.trainJourney.create({
    data: {
      route: input.route,
      firstClassCents: amountToCents(input.firstClass),
      secondClassCents: amountToCents(input.secondClass),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return journey;
}

export async function updateTrainJourney(id: string, raw: TrainJourneyInput) {
  const input = trainJourneyInput.parse(raw);
  const journey = await prisma.trainJourney.update({
    where: { id },
    data: {
      route: input.route,
      firstClassCents: amountToCents(input.firstClass),
      secondClassCents: amountToCents(input.secondClass),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return journey;
}

export async function duplicateTrainJourney(id: string) {
  const source = await prisma.trainJourney.findUniqueOrThrow({ where: { id } });
  const copy = await prisma.trainJourney.create({
    data: {
      route: `${source.route} (Copy)`,
      firstClassCents: source.firstClassCents,
      secondClassCents: source.secondClassCents,
      currency: source.currency,
      notes: source.notes,
    },
  });
  revalidateLibrary();
  return copy;
}

export async function archiveTrainJourney(id: string, archived: boolean) {
  await prisma.trainJourney.update({ where: { id }, data: { archived } });
  revalidateLibrary();
}

export async function deleteTrainJourney(id: string) {
  await assertNotUsed(id, "TRAIN", "This journey is used in a saved quote — archive it instead of deleting.");
  await prisma.trainJourney.delete({ where: { id } });
  revalidateLibrary();
}

// ---------------------------------------------------------------------------
// Taxi Transfer
// ---------------------------------------------------------------------------

export async function listTransferRates(opts: { search?: string; includeArchived?: boolean } = {}) {
  return prisma.transferRate.findMany({
    where: {
      archived: opts.includeArchived ? undefined : false,
      ...(opts.search ? { route: { contains: opts.search } } : {}),
    },
    orderBy: { route: "asc" },
    take: 50,
  });
}

export async function createTransferRate(raw: TransferRateInput) {
  const input = transferRateInput.parse(raw);
  const rate = await prisma.transferRate.create({
    data: {
      route: input.route,
      priceCents: amountToCents(input.price),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return rate;
}

export async function updateTransferRate(id: string, raw: TransferRateInput) {
  const input = transferRateInput.parse(raw);
  const rate = await prisma.transferRate.update({
    where: { id },
    data: {
      route: input.route,
      priceCents: amountToCents(input.price),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return rate;
}

export async function duplicateTransferRate(id: string) {
  const source = await prisma.transferRate.findUniqueOrThrow({ where: { id } });
  const copy = await prisma.transferRate.create({
    data: {
      route: `${source.route} (Copy)`,
      priceCents: source.priceCents,
      currency: source.currency,
      notes: source.notes,
    },
  });
  revalidateLibrary();
  return copy;
}

export async function archiveTransferRate(id: string, archived: boolean) {
  await prisma.transferRate.update({ where: { id }, data: { archived } });
  revalidateLibrary();
}

export async function deleteTransferRate(id: string) {
  await assertNotUsed(id, "TAXI_TRANSFER", "This transfer is used in a saved quote — archive it instead of deleting.");
  await prisma.transferRate.delete({ where: { id } });
  revalidateLibrary();
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export async function listActivityRates(opts: { search?: string; includeArchived?: boolean } = {}) {
  return prisma.activityRate.findMany({
    where: {
      archived: opts.includeArchived ? undefined : false,
      ...(opts.search
        ? { OR: [{ name: { contains: opts.search } }, { location: { contains: opts.search } }] }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 50,
  });
}

export async function createActivityRate(raw: ActivityRateInput) {
  const input = activityRateInput.parse(raw);
  const rate = await prisma.activityRate.create({
    data: {
      name: input.name,
      location: input.location,
      priceCents: amountToCents(input.price),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return rate;
}

export async function updateActivityRate(id: string, raw: ActivityRateInput) {
  const input = activityRateInput.parse(raw);
  const rate = await prisma.activityRate.update({
    where: { id },
    data: {
      name: input.name,
      location: input.location,
      priceCents: amountToCents(input.price),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return rate;
}

export async function duplicateActivityRate(id: string) {
  const source = await prisma.activityRate.findUniqueOrThrow({ where: { id } });
  const copy = await prisma.activityRate.create({
    data: {
      name: `${source.name} (Copy)`,
      location: source.location,
      priceCents: source.priceCents,
      currency: source.currency,
      notes: source.notes,
    },
  });
  revalidateLibrary();
  return copy;
}

export async function archiveActivityRate(id: string, archived: boolean) {
  await prisma.activityRate.update({ where: { id }, data: { archived } });
  revalidateLibrary();
}

export async function deleteActivityRate(id: string) {
  await assertNotUsed(id, "ACTIVITY", "This activity is used in a saved quote — archive it instead of deleting.");
  await prisma.activityRate.delete({ where: { id } });
  revalidateLibrary();
}

// ---------------------------------------------------------------------------
// Domestic Flights
// ---------------------------------------------------------------------------

export async function listFlightRates(opts: { search?: string; includeArchived?: boolean } = {}) {
  return prisma.flightRate.findMany({
    where: {
      archived: opts.includeArchived ? undefined : false,
      ...(opts.search ? { route: { contains: opts.search } } : {}),
    },
    orderBy: { route: "asc" },
    take: 50,
  });
}

export async function createFlightRate(raw: FlightRateInput) {
  const input = flightRateInput.parse(raw);
  const rate = await prisma.flightRate.create({
    data: {
      route: input.route,
      priceCents: amountToCents(input.price),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return rate;
}

export async function updateFlightRate(id: string, raw: FlightRateInput) {
  const input = flightRateInput.parse(raw);
  const rate = await prisma.flightRate.update({
    where: { id },
    data: {
      route: input.route,
      priceCents: amountToCents(input.price),
      currency: input.currency,
      notes: input.notes || null,
    },
  });
  revalidateLibrary();
  return rate;
}

export async function duplicateFlightRate(id: string) {
  const source = await prisma.flightRate.findUniqueOrThrow({ where: { id } });
  const copy = await prisma.flightRate.create({
    data: {
      route: `${source.route} (Copy)`,
      priceCents: source.priceCents,
      currency: source.currency,
      notes: source.notes,
    },
  });
  revalidateLibrary();
  return copy;
}

export async function archiveFlightRate(id: string, archived: boolean) {
  await prisma.flightRate.update({ where: { id }, data: { archived } });
  revalidateLibrary();
}

export async function deleteFlightRate(id: string) {
  await assertNotUsed(id, "DOMESTIC_FLIGHT", "This route is used in a saved quote — archive it instead of deleting.");
  await prisma.flightRate.delete({ where: { id } });
  revalidateLibrary();
}

// ---------------------------------------------------------------------------
// Park Entrance Fees
// ---------------------------------------------------------------------------

export async function listParks(opts: { search?: string; includeArchived?: boolean } = {}) {
  return prisma.park.findMany({
    where: {
      archived: opts.includeArchived ? undefined : false,
      ...(opts.search ? { name: { contains: opts.search } } : {}),
    },
    orderBy: { name: "asc" },
    take: 50,
    include: { childBrackets: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function getPark(id: string) {
  return prisma.park.findUnique({
    where: { id },
    include: { childBrackets: { orderBy: { sortOrder: "asc" } } },
  });
}

async function writeParkChildBrackets(parkId: string, input: ParkInput) {
  const validationError = validateBracketSet(input.childBrackets);
  if (validationError) throw new Error(validationError);

  // Same "replace the whole set" approach as the accommodation rate grid —
  // brackets are edited together as one form, so a full replace is simpler
  // and safer than diffing individual rows.
  await prisma.parkChildAgeBracket.deleteMany({ where: { parkId } });
  if (input.childBrackets.length > 0) {
    await prisma.parkChildAgeBracket.createMany({
      data: input.childBrackets.map((b, i) => ({
        parkId,
        minAge: b.minAge,
        maxAge: b.maxAge,
        priceCents: amountToCents(b.price),
        label: b.label || null,
        sortOrder: i,
      })),
    });
  }
}

export async function createPark(raw: ParkInput) {
  const input = parkInput.parse(raw);
  const validationError = validateBracketSet(input.childBrackets);
  if (validationError) throw new Error(validationError);

  const park = await prisma.park.create({
    data: {
      name: input.name,
      currency: input.currency,
      adultFeeCents: amountToCents(input.adultFee),
      notes: input.notes || null,
    },
  });
  await writeParkChildBrackets(park.id, input);
  revalidateLibrary();
  return getPark(park.id);
}

export async function updatePark(id: string, raw: ParkInput) {
  const input = parkInput.parse(raw);
  await prisma.park.update({
    where: { id },
    data: {
      name: input.name,
      currency: input.currency,
      adultFeeCents: amountToCents(input.adultFee),
      notes: input.notes || null,
    },
  });
  await writeParkChildBrackets(id, input);
  revalidateLibrary();
  return getPark(id);
}

export async function duplicatePark(id: string) {
  const source = await getPark(id);
  if (!source) throw new Error("Park not found");

  const copy = await prisma.park.create({
    data: {
      name: `${source.name} (Copy)`,
      currency: source.currency,
      adultFeeCents: source.adultFeeCents,
      notes: source.notes,
      childBrackets: {
        create: source.childBrackets.map((b) => ({
          minAge: b.minAge,
          maxAge: b.maxAge,
          priceCents: b.priceCents,
          label: b.label,
          sortOrder: b.sortOrder,
        })),
      },
    },
  });
  revalidateLibrary();
  return getPark(copy.id);
}

export async function archivePark(id: string, archived: boolean) {
  await prisma.park.update({ where: { id }, data: { archived } });
  revalidateLibrary();
}

export async function deletePark(id: string) {
  await assertNotUsed(id, "PARK_ENTRANCE_FEE", "This park is used in a saved quote — archive it instead of deleting.");
  await prisma.park.delete({ where: { id } });
  revalidateLibrary();
}
