import { z } from "zod";

const currency = z.enum(["USD", "KES"]);
const nonNegativeInt = z.number().int().min(0);
const positiveInt = z.number().int().min(1, "Must be at least 1");

export const quoteHeaderInput = z
  .object({
    clientName: z.string().trim().min(1, "Client name is required"),
    tripTitle: z.string().trim().min(1, "Trip title is required"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    adults: positiveInt,
    children5to12: nonNegativeInt,
    childrenUnder5: nonNegativeInt,
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date cannot be before start date",
    path: ["endDate"],
  });
export type QuoteHeaderInput = z.infer<typeof quoteHeaderInput>;

export const accommodationLineInput = z.object({
  dayId: z.string().min(1),
  accommodationId: z.string().min(1),
  roomTypeId: z.string().min(1),
  season: z.enum(["LOW", "SHOULDER", "HIGH"]),
  mealPlan: z.enum(["BB", "HB", "FB", "FI"]),
  // per-person
  adultsSharing: nonNegativeInt.optional(),
  child5to12: nonNegativeInt.optional(),
  childUnder5: nonNegativeInt.optional(),
  adultsSingle: nonNegativeInt.optional(),
  totalRooms: nonNegativeInt.optional().nullable(),
  singleRooms: nonNegativeInt.optional().nullable(),
  // per-room
  roomTotalRooms: nonNegativeInt.optional(),
  roomSingleRooms: nonNegativeInt.optional(),
});
export type AccommodationLineInput = z.infer<typeof accommodationLineInput>;

export const transportLineInput = z.object({
  dayId: z.string().min(1),
  transportRateId: z.string().min(1),
  vehicles: positiveInt,
});

export const trainLineInput = z.object({
  dayId: z.string().min(1),
  journeyId: z.string().min(1),
  trainClass: z.enum(["FIRST", "SECOND"]),
  passengers: positiveInt,
});

export const trainManualLineInput = z.object({
  dayId: z.string().min(1),
  route: z.string().trim().min(1, "Journey description is required"),
  price: z.number().min(0),
  currency,
  passengers: positiveInt,
});

export const transferLineInput = z.object({
  dayId: z.string().min(1),
  transferId: z.string().min(1),
  vehicles: positiveInt,
});

export const transferManualLineInput = z.object({
  dayId: z.string().min(1),
  route: z.string().trim().min(1, "Transfer name/route is required"),
  price: z.number().min(0),
  currency,
  vehicles: positiveInt,
});

export const activityLineInput = z.object({
  dayId: z.string().min(1),
  activityId: z.string().min(1),
  participants: positiveInt,
});

export const activityManualLineInput = z.object({
  dayId: z.string().min(1),
  name: z.string().trim().min(1, "Activity name is required"),
  location: z.string().trim().optional(),
  price: z.number().min(0),
  currency,
  participants: positiveInt,
});

export const flightLineInput = z.object({
  dayId: z.string().min(1),
  flightId: z.string().min(1),
  passengers: positiveInt,
});

export const flightManualLineInput = z.object({
  dayId: z.string().min(1),
  route: z.string().trim().min(1, "Route is required"),
  price: z.number().min(0),
  currency,
  passengers: positiveInt,
});

export const villaLineInput = z.object({
  dayId: z.string().min(1),
  villaName: z.string().trim().min(1, "Villa name is required"),
  location: z.string().trim().optional(),
  price: z.number().min(0),
  currency,
  nights: positiveInt,
  quantity: positiveInt,
  notes: z.string().trim().optional(),
});

export const miscLineInput = z.object({
  dayId: z.string().min(1),
  itemName: z.string().trim().min(1, "Item/service name is required"),
  price: z.number().min(0),
  currency,
  quantity: positiveInt,
  notes: z.string().trim().optional(),
});

export const overrideLineInput = z.object({
  lineItemId: z.string().min(1),
  amount: z.number().min(0, "Prices cannot be negative"),
  currency,
});
