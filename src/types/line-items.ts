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

/** One accommodation-specific child age bracket, with how many/which children in it. */
export interface ChildBracketSelection {
  bracketId: string;
  /** Frozen display label at the time of booking (e.g. "4–11 years"). */
  label: string;
  minAge: number;
  maxAge: number;
  priceCents: number;
  /** Exact ages of the children counted in this bracket. */
  ages: number[];
}

export interface AccommodationPerPersonData {
  pricingBasis: "PER_PERSON";
  adultsSharing: number;
  adultsSingle: number;
  childBrackets: ChildBracketSelection[];
  /** Ages that matched no configured bracket — only non-empty when a manual total override was used to proceed (see spec: "never silently guess"). */
  unmatchedChildAges: number[];
  rates: {
    adultSharingCents: number;
    singleCents: number | null;
  };
  /** Informational only — never multiplies the rate again. */
  totalRooms: number | null;
  singleRooms: number | null;
}

/**
 * Legacy shape for accommodation quotes saved before the exact-age /
 * accommodation-specific-bracket model. Never produced by new code — kept
 * only so old saved quotes remain readable. See README "Migrating existing
 * child-pricing data".
 */
export interface AccommodationPerPersonDataLegacy {
  pricingBasis: "PER_PERSON";
  legacy: true;
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
  basis: AccommodationPerPersonData | AccommodationPerPersonDataLegacy | AccommodationPerRoomData;
}

export function isLegacyPerPersonBasis(
  basis: AccommodationPerPersonData | AccommodationPerPersonDataLegacy | AccommodationPerRoomData
): basis is AccommodationPerPersonDataLegacy {
  return basis.pricingBasis === "PER_PERSON" && "legacy" in basis && basis.legacy === true;
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

/** Park Entrance Fees: adults at the flat adult fee, children matched to the park's own age brackets. */
export interface ParkEntranceFeeLineData {
  category: "PARK_ENTRANCE_FEE";
  parkId: string;
  parkName: string;
  currency: Currency;
  adultFeeCents: number;
  /** Adult quantity actually applied to this visit — may be reduced from the trip's full adult count. */
  adults: number;
  childBrackets: ChildBracketSelection[];
  /** Ages that matched no configured bracket — only non-empty when a manual total override was used to proceed. */
  unmatchedChildAges: number[];
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
  | ParkEntranceFeeLineData
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
  PARK_ENTRANCE_FEE: "Park Entrance Fee",
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
