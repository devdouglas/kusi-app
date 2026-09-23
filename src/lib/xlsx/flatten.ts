import type { TransportRate, TrainJourney, TransferRate, ActivityRate, FlightRate } from "@prisma/client";
import { centsToAmount, toUsdCents, type RateMicros } from "@/lib/money";
import {
  SEASON_LABELS,
  MEAL_PLAN_LABELS,
  VEHICLE_TYPE_LABELS,
  LODGE_ACTIVITY_PRICING_BASIS_LABELS,
  type Season,
  type MealPlan,
} from "@/types/line-items";
import { bracketLabel } from "@/lib/calc/child-brackets";
import type { AccommodationRecord } from "@/components/rate-library/accommodation-form";
import type { ParkRecord } from "@/components/rate-library/park-form";
import type {
  AccommodationExportRow,
  TransportExportRow,
  TrainExportRow,
  TransferExportRow,
  ActivityExportRow,
  ParkExportRow,
  FlightExportRow,
  LodgeActivityExportRow,
  ExportStatus,
} from "@/lib/xlsx/types";

/**
 * Pure flatten functions: Rate Library records in → human-readable export
 * rows out. No I/O, no pricing logic of their own — every USD figure comes
 * from the same money.ts conversion used everywhere else in the app, so the
 * export can never drift from what the Quote Builder actually charges.
 */

interface ArchivableOpts {
  rateMicros: RateMicros;
  includeArchived: boolean;
}

function status(archived: boolean): ExportStatus {
  return archived ? "Archived" : "Active";
}

function withStatus<Row extends { status?: ExportStatus }>(row: Row, archived: boolean, includeArchived: boolean): Row {
  if (!includeArchived) return row;
  return { ...row, status: status(archived) };
}

export function flattenAccommodationRates(
  items: AccommodationRecord[],
  { rateMicros, includeArchived }: ArchivableOpts
): AccommodationExportRow[] {
  const rows: AccommodationExportRow[] = [];

  for (const acc of items) {
    if (!includeArchived && acc.archived) continue;

    const roomTypeById = new Map(acc.roomTypes.map((rt) => [rt.id, rt.name]));
    const bracketById = new Map(acc.childAgeBrackets.map((b) => [b.id, b]));

    for (const rate of acc.rates) {
      const base = {
        accommodation: acc.name,
        location: acc.location,
        roomType: roomTypeById.get(rate.roomTypeId) ?? "—",
        season: SEASON_LABELS[rate.season as Season],
        mealPlan: MEAL_PLAN_LABELS[rate.mealPlan as MealPlan],
        pricingBasis: acc.pricingBasis === "PER_PERSON" ? "Per Person" : "Per Room",
        currency: acc.currency,
        notes: acc.notes,
      };

      function pushRow(guestType: string, priceCents: number, childMinAge: number | null, childMaxAge: number | null) {
        rows.push(
          withStatus<AccommodationExportRow>(
            {
              ...base,
              guestType,
              childMinAge,
              childMaxAge,
              price: centsToAmount(priceCents),
              usdEquivalent: centsToAmount(toUsdCents(priceCents, acc.currency, rateMicros)),
            },
            acc.archived,
            includeArchived
          )
        );
      }

      if (acc.pricingBasis === "PER_PERSON") {
        if (rate.adultSharingCents != null) pushRow("Adult Sharing", rate.adultSharingCents, null, null);
        if (rate.singleCents != null) pushRow("Single Occupancy", rate.singleCents, null, null);
        for (const childRate of rate.childRates) {
          const bracket = bracketById.get(childRate.bracketId);
          if (!bracket) continue;
          pushRow("Child", childRate.priceCents, bracket.minAge, bracket.maxAge);
        }
      } else {
        if (rate.standardRoomCents != null) pushRow("Standard Room", rate.standardRoomCents, null, null);
        if (rate.singleRoomCents != null) pushRow("Single Occupancy", rate.singleRoomCents, null, null);
      }
    }
  }

  return rows;
}

export function flattenTransportRates(
  items: TransportRate[],
  { rateMicros, includeArchived }: ArchivableOpts
): TransportExportRow[] {
  return items
    .filter((r) => includeArchived || !r.archived)
    .map((r) =>
      withStatus<TransportExportRow>(
        {
          vehicleType: VEHICLE_TYPE_LABELS[r.vehicleType],
          pricingBasis: "Per Vehicle Per Day",
          price: centsToAmount(r.priceCents),
          currency: r.currency,
          usdEquivalent: centsToAmount(toUsdCents(r.priceCents, r.currency, rateMicros)),
          notes: r.notes,
        },
        r.archived,
        includeArchived
      )
    );
}

export function flattenTrainJourneys(
  items: TrainJourney[],
  { rateMicros, includeArchived }: ArchivableOpts
): TrainExportRow[] {
  const rows: TrainExportRow[] = [];
  for (const j of items) {
    if (!includeArchived && j.archived) continue;
    const base = { route: j.route, currency: j.currency, notes: j.notes };
    rows.push(
      withStatus<TrainExportRow>(
        {
          ...base,
          trainClass: "First Class",
          pricePerPassenger: centsToAmount(j.firstClassCents),
          usdEquivalent: centsToAmount(toUsdCents(j.firstClassCents, j.currency, rateMicros)),
        },
        j.archived,
        includeArchived
      )
    );
    rows.push(
      withStatus<TrainExportRow>(
        {
          ...base,
          trainClass: "Second Class",
          pricePerPassenger: centsToAmount(j.secondClassCents),
          usdEquivalent: centsToAmount(toUsdCents(j.secondClassCents, j.currency, rateMicros)),
        },
        j.archived,
        includeArchived
      )
    );
  }
  return rows;
}

export function flattenTransferRates(
  items: TransferRate[],
  { rateMicros, includeArchived }: ArchivableOpts
): TransferExportRow[] {
  return items
    .filter((r) => includeArchived || !r.archived)
    .map((r) =>
      withStatus<TransferExportRow>(
        {
          route: r.route,
          pricingBasis: "Per Vehicle",
          price: centsToAmount(r.priceCents),
          currency: r.currency,
          usdEquivalent: centsToAmount(toUsdCents(r.priceCents, r.currency, rateMicros)),
          notes: r.notes,
        },
        r.archived,
        includeArchived
      )
    );
}

export function flattenActivityRates(
  items: ActivityRate[],
  { rateMicros, includeArchived }: ArchivableOpts
): ActivityExportRow[] {
  return items
    .filter((r) => includeArchived || !r.archived)
    .map((r) =>
      withStatus<ActivityExportRow>(
        {
          activity: r.name,
          location: r.location,
          pricingBasis: "Per Participant",
          price: centsToAmount(r.priceCents),
          currency: r.currency,
          usdEquivalent: centsToAmount(toUsdCents(r.priceCents, r.currency, rateMicros)),
          notes: r.notes,
        },
        r.archived,
        includeArchived
      )
    );
}

export function flattenParkEntranceRates(
  items: ParkRecord[],
  { rateMicros, includeArchived }: ArchivableOpts
): ParkExportRow[] {
  const rows: ParkExportRow[] = [];

  for (const park of items) {
    if (!includeArchived && park.archived) continue;

    const base = {
      park: park.name,
      pricingBasis: "Per Person Per Entrance/Day",
      currency: park.currency,
      notes: park.notes,
    };

    rows.push(
      withStatus<ParkExportRow>(
        {
          ...base,
          travellerType: "Adult",
          minAge: null,
          maxAge: null,
          price: centsToAmount(park.adultFeeCents),
          usdEquivalent: centsToAmount(toUsdCents(park.adultFeeCents, park.currency, rateMicros)),
        },
        park.archived,
        includeArchived
      )
    );

    for (const bracket of park.childBrackets) {
      rows.push(
        withStatus<ParkExportRow>(
          {
            ...base,
            travellerType: "Child",
            minAge: bracket.minAge,
            maxAge: bracket.maxAge,
            price: centsToAmount(bracket.priceCents),
            usdEquivalent: centsToAmount(toUsdCents(bracket.priceCents, park.currency, rateMicros)),
            notes: bracket.label ? `${park.notes ? park.notes + " — " : ""}${bracketLabel(bracket)}` : park.notes,
          },
          park.archived,
          includeArchived
        )
      );
    }
  }

  return rows;
}

export function flattenFlightRates(
  items: FlightRate[],
  { rateMicros, includeArchived }: ArchivableOpts
): FlightExportRow[] {
  return items
    .filter((r) => includeArchived || !r.archived)
    .map((r) =>
      withStatus<FlightExportRow>(
        {
          route: r.route,
          pricingBasis: "Per Passenger",
          price: centsToAmount(r.priceCents),
          currency: r.currency,
          usdEquivalent: centsToAmount(toUsdCents(r.priceCents, r.currency, rateMicros)),
          notes: r.notes,
        },
        r.archived,
        includeArchived
      )
    );
}

/**
 * Lodge Activities are accommodation-specific (never general Activities), so
 * this is never a standalone export category — it's only generated as an
 * extra worksheet when Accommodation itself is selected for export.
 */
export function flattenLodgeActivities(
  items: AccommodationRecord[],
  { rateMicros, includeArchived }: ArchivableOpts
): LodgeActivityExportRow[] {
  const rows: LodgeActivityExportRow[] = [];

  for (const acc of items) {
    if (!includeArchived && acc.archived) continue;
    for (const activity of acc.activities) {
      if (!includeArchived && activity.archived) continue;
      rows.push(
        withStatus<LodgeActivityExportRow>(
          {
            accommodation: acc.name,
            location: acc.location,
            activity: activity.name,
            pricingBasis: LODGE_ACTIVITY_PRICING_BASIS_LABELS[activity.pricingBasis],
            price: centsToAmount(activity.amountCents),
            currency: activity.currency,
            usdEquivalent: centsToAmount(toUsdCents(activity.amountCents, activity.currency, rateMicros)),
            notes: activity.notes,
          },
          activity.archived,
          includeArchived
        )
      );
    }
  }

  return rows;
}
