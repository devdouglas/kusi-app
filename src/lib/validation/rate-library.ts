import { z } from "zod";
import { MIN_CHILD_AGE, MAX_CHILD_AGE } from "@/lib/calc/child-brackets";

const currency = z.enum(["USD", "KES"]);
const nonNegative = z.number().min(0, "Price cannot be negative");
const childAgeNum = z.number().int().min(MIN_CHILD_AGE, `Ages cannot be below ${MIN_CHILD_AGE}`).max(MAX_CHILD_AGE, `Ages cannot be above ${MAX_CHILD_AGE}`);

export const roomTypeInput = z.object({
  id: z.string().optional(), // present when editing an existing room type
  // Room type names can be elaborate ("Family Safari Tent with Two Bedrooms
  // and Private Veranda") — 300 is a generous ceiling, not a realistic
  // limit, and the underlying column is unbounded Postgres `text` so this
  // is purely a sanity cap, never a truncation.
  name: z.string().trim().min(1, "Room type name is required").max(300, "Room type name is too long"),
});

/** An accommodation-specific child age bracket (no price here — price lives per rate row, see accommodationRateInput.childPrices). */
export const childAgeBracketInput = z
  .object({
    id: z.string().optional(),
    minAge: childAgeNum,
    maxAge: childAgeNum,
    label: z.string().trim().optional().nullable(),
  })
  .refine((b) => b.minAge <= b.maxAge, { message: "Minimum age cannot exceed maximum age", path: ["maxAge"] });

export const accommodationRateInput = z.object({
  id: z.string().optional(),
  roomTypeId: z.string().min(1),
  season: z.enum(["LOW", "SHOULDER", "HIGH"]),
  mealPlan: z.enum(["NO_MEALS", "BB", "HB", "FB", "FI"]),
  // PER_PERSON
  adultSharing: nonNegative.optional(),
  single: nonNegative.optional().nullable(),
  /** One price per configured child age bracket (by local/db bracket id); brackets with no entry here have no price for this rate row. */
  childPrices: z.array(z.object({ bracketId: z.string().min(1), price: nonNegative })).optional(),
  // PER_ROOM
  standardRoom: nonNegative.optional(),
  singleRoom: nonNegative.optional().nullable(),
});

export const accommodationInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Accommodation name is required"),
  location: z.string().trim().min(1, "Town/location is required"),
  notes: z.string().trim().optional().nullable(),
  currency,
  pricingBasis: z.enum(["PER_PERSON", "PER_ROOM"]),
  roomTypes: z.array(roomTypeInput).min(1, "Add at least one room type"),
  childAgeBrackets: z.array(childAgeBracketInput).default([]),
  rates: z.array(accommodationRateInput),
});
export type AccommodationInput = z.infer<typeof accommodationInput>;

export const transportRateInput = z.object({
  id: z.string().optional(),
  vehicleType: z.enum(["VAN", "JEEP_5PAX", "JEEP_8PAX"]),
  price: nonNegative,
  currency,
  notes: z.string().trim().optional().nullable(),
});
export type TransportRateInput = z.infer<typeof transportRateInput>;

export const trainJourneyInput = z.object({
  id: z.string().optional(),
  route: z.string().trim().min(1, "Route is required"),
  firstClass: nonNegative,
  secondClass: nonNegative,
  currency,
  notes: z.string().trim().optional().nullable(),
});
export type TrainJourneyInput = z.infer<typeof trainJourneyInput>;

export const transferRateInput = z.object({
  id: z.string().optional(),
  route: z.string().trim().min(1, "Transfer/route name is required"),
  price: nonNegative,
  currency,
  notes: z.string().trim().optional().nullable(),
});
export type TransferRateInput = z.infer<typeof transferRateInput>;

export const activityRateInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Activity name is required"),
  location: z.string().trim().min(1, "Location is required"),
  price: nonNegative,
  currency,
  notes: z.string().trim().optional().nullable(),
});
export type ActivityRateInput = z.infer<typeof activityRateInput>;

/** A park's own child age bracket — unlike accommodation, the price lives directly on the bracket since a park has only one rate. */
export const parkChildBracketInput = z
  .object({
    id: z.string().optional(),
    minAge: childAgeNum,
    maxAge: childAgeNum,
    price: nonNegative,
    label: z.string().trim().optional().nullable(),
  })
  .refine((b) => b.minAge <= b.maxAge, { message: "Minimum age cannot exceed maximum age", path: ["maxAge"] });

export const parkInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Park name is required"),
  currency,
  adultFee: nonNegative,
  notes: z.string().trim().optional().nullable(),
  childBrackets: z.array(parkChildBracketInput).default([]),
});
export type ParkInput = z.infer<typeof parkInput>;

export const flightRateInput = z.object({
  id: z.string().optional(),
  route: z.string().trim().min(1, "Route is required"),
  price: nonNegative,
  currency,
  notes: z.string().trim().optional().nullable(),
});
export type FlightRateInput = z.infer<typeof flightRateInput>;

/** A Lodge Activity: an activity specific to one accommodation (see AccommodationActivity in schema.prisma). */
export const accommodationActivityInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Activity name is required"),
  pricingBasis: z.enum(["PER_PERSON", "PER_GROUP", "FIXED_PRICE"]),
  amount: nonNegative,
  currency,
  notes: z.string().trim().optional().nullable(),
});
export type AccommodationActivityInput = z.infer<typeof accommodationActivityInput>;
