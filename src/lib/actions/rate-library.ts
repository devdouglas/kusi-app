"use server";

import { prisma } from "@/lib/prisma";
import { amountToCents } from "@/lib/money";
import { revalidatePath } from "next/cache";
import {
  accommodationInput,
  transportRateInput,
  trainJourneyInput,
  transferRateInput,
  activityRateInput,
  flightRateInput,
  type AccommodationInput,
  type TransportRateInput,
  type TrainJourneyInput,
  type TransferRateInput,
  type ActivityRateInput,
  type FlightRateInput,
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
    include: { roomTypes: { orderBy: { sortOrder: "asc" } }, rates: true },
  });
}

export async function getAccommodation(id: string) {
  return prisma.accommodation.findUnique({
    where: { id },
    include: { roomTypes: { orderBy: { sortOrder: "asc" } }, rates: true },
  });
}

async function writeAccommodationRates(
  accommodationId: string,
  input: AccommodationInput,
  roomTypeIdByLocalId: Map<string, string>
) {
  // Replace all rates for this accommodation with the submitted set — the
  // rate grid is edited as a whole, so a full replace is simpler and safer
  // than diffing individual cells.
  await prisma.accommodationRate.deleteMany({ where: { accommodationId } });
  const rows = input.rates
    .map((r) => {
      const roomTypeId = roomTypeIdByLocalId.get(r.roomTypeId) ?? r.roomTypeId;
      if (input.pricingBasis === "PER_PERSON") {
        if (r.adultSharing == null) return null;
        return {
          accommodationId,
          roomTypeId,
          season: r.season,
          mealPlan: r.mealPlan,
          adultSharingCents: amountToCents(r.adultSharing),
          child5to12Cents: r.child5to12 != null ? amountToCents(r.child5to12) : null,
          childUnder5Cents: r.childUnder5 != null ? amountToCents(r.childUnder5) : null,
          singleCents: r.single != null ? amountToCents(r.single) : null,
        };
      }
      if (r.standardRoom == null) return null;
      return {
        accommodationId,
        roomTypeId,
        season: r.season,
        mealPlan: r.mealPlan,
        standardRoomCents: amountToCents(r.standardRoom),
        singleRoomCents: r.singleRoom != null ? amountToCents(r.singleRoom) : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length > 0) {
    await prisma.accommodationRate.createMany({ data: rows });
  }
}

export async function createAccommodation(raw: AccommodationInput) {
  const input = accommodationInput.parse(raw);
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

  await writeAccommodationRates(accommodation.id, input, roomTypeIdByLocalId);
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

  await writeAccommodationRates(id, input, roomTypeIdByLocalId);
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

  if (source.rates.length > 0) {
    await prisma.accommodationRate.createMany({
      data: source.rates.map((r) => ({
        accommodationId: copy.id,
        roomTypeId: roomTypeMap.get(r.roomTypeId)!,
        season: r.season,
        mealPlan: r.mealPlan,
        adultSharingCents: r.adultSharingCents,
        child5to12Cents: r.child5to12Cents,
        childUnder5Cents: r.childUnder5Cents,
        singleCents: r.singleCents,
        standardRoomCents: r.standardRoomCents,
        singleRoomCents: r.singleRoomCents,
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
  await prisma.accommodation.delete({ where: { id } });
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
