import { z } from "zod";

const currency = z.enum(["USD", "KES"]);
const nonNegative = z.number().min(0, "Price cannot be negative");

export const roomTypeInput = z.object({
  id: z.string().optional(), // present when editing an existing room type
  name: z.string().trim().min(1, "Room type name is required"),
});

export const accommodationRateInput = z.object({
  id: z.string().optional(),
  roomTypeId: z.string().min(1),
  season: z.enum(["LOW", "SHOULDER", "HIGH"]),
  mealPlan: z.enum(["BB", "HB", "FB", "FI"]),
  // PER_PERSON
  adultSharing: nonNegative.optional(),
  child5to12: nonNegative.optional().nullable(),
  childUnder5: nonNegative.optional().nullable(),
  single: nonNegative.optional().nullable(),
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

export const flightRateInput = z.object({
  id: z.string().optional(),
  route: z.string().trim().min(1, "Route is required"),
  price: nonNegative,
  currency,
  notes: z.string().trim().optional().nullable(),
});
export type FlightRateInput = z.infer<typeof flightRateInput>;
