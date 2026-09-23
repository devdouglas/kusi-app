import type { Currency } from "@/lib/money";

/**
 * The seven Rate Library categories that support Excel export, in the same
 * order as the Rate Library tabs (src/components/rate-library/tabs.tsx).
 * Villa/Misc are quote-only manual categories with no Rate Library backing,
 * so they're intentionally excluded here.
 */
export type ExportCategory =
  | "ACCOMMODATION"
  | "PRIVATE_TRANSPORT"
  | "TRAIN"
  | "TAXI_TRANSFER"
  | "ACTIVITY"
  | "PARK_ENTRANCE_FEE"
  | "DOMESTIC_FLIGHT";

export const EXPORT_CATEGORY_ORDER: ExportCategory[] = [
  "ACCOMMODATION",
  "PRIVATE_TRANSPORT",
  "TRAIN",
  "TAXI_TRANSFER",
  "ACTIVITY",
  "PARK_ENTRANCE_FEE",
  "DOMESTIC_FLIGHT",
];

export const EXPORT_CATEGORY_LABELS: Record<ExportCategory, string> = {
  ACCOMMODATION: "Accommodation",
  PRIVATE_TRANSPORT: "Private Transport & Guide",
  TRAIN: "Train",
  TAXI_TRANSFER: "Taxi Transfer",
  ACTIVITY: "Activities",
  PARK_ENTRANCE_FEE: "Park Entrance Fees",
  DOMESTIC_FLIGHT: "Domestic Flights",
};

export function isExportCategory(value: string): value is ExportCategory {
  return (EXPORT_CATEGORY_ORDER as string[]).includes(value);
}

/** A column definition shared between the row-building and workbook layers. */
export interface ExportColumn<Row> {
  header: string;
  key: string;
  width: number;
  /** Numeric price/USD/age columns are written as real numbers, not text. */
  numeric?: boolean;
  /** Excel number format for numeric columns (default "#,##0.00"). */
  numFmt?: string;
  wrap?: boolean;
  value: (row: Row) => string | number | null;
}

export type ExportStatus = "Active" | "Archived";

export interface AccommodationExportRow {
  accommodation: string;
  location: string;
  roomType: string;
  season: string;
  mealPlan: string;
  pricingBasis: string;
  guestType: string;
  childMinAge: number | null;
  childMaxAge: number | null;
  price: number;
  currency: Currency;
  usdEquivalent: number;
  notes: string | null;
  status?: ExportStatus;
}

export interface TransportExportRow {
  vehicleType: string;
  pricingBasis: string;
  price: number;
  currency: Currency;
  usdEquivalent: number;
  notes: string | null;
  status?: ExportStatus;
}

export interface TrainExportRow {
  route: string;
  trainClass: string;
  pricePerPassenger: number;
  currency: Currency;
  usdEquivalent: number;
  notes: string | null;
  status?: ExportStatus;
}

export interface TransferExportRow {
  route: string;
  pricingBasis: string;
  price: number;
  currency: Currency;
  usdEquivalent: number;
  notes: string | null;
  status?: ExportStatus;
}

export interface ActivityExportRow {
  activity: string;
  location: string;
  pricingBasis: string;
  price: number;
  currency: Currency;
  usdEquivalent: number;
  notes: string | null;
  status?: ExportStatus;
}

export interface ParkExportRow {
  park: string;
  travellerType: string;
  minAge: number | null;
  maxAge: number | null;
  pricingBasis: string;
  price: number;
  currency: Currency;
  usdEquivalent: number;
  notes: string | null;
  status?: ExportStatus;
}

export interface FlightExportRow {
  route: string;
  pricingBasis: string;
  price: number;
  currency: Currency;
  usdEquivalent: number;
  notes: string | null;
  status?: ExportStatus;
}
