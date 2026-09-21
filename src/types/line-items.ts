import type { Currency } from "@/lib/money";

export type Season = "LOW" | "SHOULDER" | "HIGH";
export type MealPlan = "BB" | "HB" | "FB" | "FI";
export type PricingBasis = "PER_PERSON" | "PER_ROOM";
export type VehicleType = "VAN" | "JEEP_5PAX" | "JEEP_8PAX";
export type TrainClass = "FIRST" | "SECOND";

export const SEASON_LABELS: Record<Season, string> = {
  LOW: "Low Season",
  SHOULDER: "Shoulder Season",
  HIGH: "High Season",
};

export const MEAL_PLAN_LABELS: Record<MealPlan, string> = {
  BB: "Bed & Breakfast",
  HB: "Half Board",
  FB: "Full Board",
  FI: "Fully Inclusive",
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  VAN: "Van",
  JEEP_5PAX: "Jeep – 5 pax",
  JEEP_8PAX: "Jeep – 8 pax",
};

export interface AccommodationPerPersonData {
  pricingBasis: "PER_PERSON";
  adultsSharing: number;
  child5to12: number;
  childUnder5: number;
  adultsSingle: number;
  rates: {
    adultSharingCents: number;
    child5to12Cents: number | null;
    childUnder5Cents: number | null;
    singleCents: number | null;
  };
  /** Informational only — never multiplies the rate again. */
  totalRooms: number | null;
  singleRooms: number | null;
}

export interface AccommodationPerRoomData {
  pricingBasis: "PER_ROOM";
  totalRooms: number;
  singleRooms: number;
  standardRooms: number;
  rates: {
    standardRoomCents: number;
    singleRoomCents: number | null;
  };
}

export interface AccommodationLineData {
  category: "ACCOMMODATION";
  accommodationId: string;
  accommodationName: string;
  location: string;
  roomTypeId: string;
  roomTypeName: string;
  season: Season;
  mealPlan: MealPlan;
  currency: Currency;
  basis: AccommodationPerPersonData | AccommodationPerRoomData;
}

export interface TransportLineData {
  category: "PRIVATE_TRANSPORT";
  vehicleType: VehicleType;
  vehicles: number;
  priceCentsPerVehicle: number;
  currency: Currency;
}

export interface TrainLineData {
  category: "TRAIN";
  journeyId: string | null;
  route: string;
  trainClass: TrainClass;
  passengers: number;
  priceCentsPerPassenger: number;
  currency: Currency;
}

export interface TransferLineData {
  category: "TAXI_TRANSFER";
  transferId: string | null;
  route: string;
  isManual: boolean;
  vehicles: number;
  priceCentsPerVehicle: number;
  currency: Currency;
}

export interface ActivityLineData {
  category: "ACTIVITY";
  activityId: string | null;
  activityName: string;
  location: string;
  participants: number;
  priceCentsPerParticipant: number;
  currency: Currency;
}

export interface FlightLineData {
  category: "DOMESTIC_FLIGHT";
  flightId: string | null;
  route: string;
  isManual: boolean;
  passengers: number;
  priceCentsPerPassenger: number;
  currency: Currency;
}

export interface VillaLineData {
  category: "VILLA";
  villaName: string;
  location: string;
  nights: number;
  quantity: number;
  nightlyRateCents: number;
  currency: Currency;
}

export interface MiscLineData {
  category: "MISC";
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  currency: Currency;
}

export type LineItemData =
  | AccommodationLineData
  | TransportLineData
  | TrainLineData
  | TransferLineData
  | ActivityLineData
  | FlightLineData
  | VillaLineData
  | MiscLineData;

export type LineItemCategory = LineItemData["category"];

export const CATEGORY_LABELS: Record<LineItemCategory, string> = {
  ACCOMMODATION: "Accommodation",
  PRIVATE_TRANSPORT: "Private Transport & Guide",
  TRAIN: "Train",
  TAXI_TRANSFER: "Taxi Transfer",
  ACTIVITY: "Activity",
  DOMESTIC_FLIGHT: "Domestic Flight",
  VILLA: "Villa",
  MISC: "Misc",
};

export function parseLineItemData(json: string): LineItemData {
  return JSON.parse(json) as LineItemData;
}

export function serializeLineItemData(data: LineItemData): string {
  return JSON.stringify(data);
}
