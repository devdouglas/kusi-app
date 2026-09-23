import ExcelJS from "exceljs";
import { microsToRateNumber, type RateMicros } from "@/lib/money";
import {
  EXPORT_CATEGORY_LABELS,
  type ExportCategory,
  type ExportColumn,
  type AccommodationExportRow,
  type TransportExportRow,
  type TrainExportRow,
  type TransferExportRow,
  type ActivityExportRow,
  type ParkExportRow,
  type FlightExportRow,
} from "@/lib/xlsx/types";

const SAGE = "FF8A9270";

/** Excel worksheet names: max 31 chars, and `: \ / ? * [ ]` are illegal. */
export function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, "-").trim();
  return cleaned.slice(0, 31) || "Sheet";
}

function statusColumn<Row extends { status?: string }>(): ExportColumn<Row> {
  return { header: "Status", key: "status", width: 11, value: (row) => row.status ?? null };
}

function ageColumn<Row>(header: string, key: string, get: (row: Row) => number | null): ExportColumn<Row> {
  return { header, key, width: 12, numeric: true, numFmt: "0", value: get };
}

function moneyColumns<Row>(
  priceGetter: (row: Row) => number,
  currencyGetter: (row: Row) => string,
  usdGetter: (row: Row) => number
): ExportColumn<Row>[] {
  return [
    { header: "Price", key: "price", width: 12, numeric: true, value: priceGetter },
    { header: "Currency", key: "currency", width: 10, value: currencyGetter },
    { header: "USD Equivalent", key: "usdEquivalent", width: 15, numeric: true, value: usdGetter },
  ];
}

function notesColumn<Row>(get: (row: Row) => string | null): ExportColumn<Row> {
  return { header: "Notes", key: "notes", width: 32, wrap: true, value: get };
}

export function accommodationColumns(includeArchived: boolean): ExportColumn<AccommodationExportRow>[] {
  return [
    { header: "Accommodation", key: "accommodation", width: 26, value: (r) => r.accommodation },
    { header: "Location", key: "location", width: 18, value: (r) => r.location },
    { header: "Room Type", key: "roomType", width: 16, value: (r) => r.roomType },
    { header: "Season", key: "season", width: 14, value: (r) => r.season },
    { header: "Meal Plan", key: "mealPlan", width: 16, value: (r) => r.mealPlan },
    { header: "Pricing Basis", key: "pricingBasis", width: 13, value: (r) => r.pricingBasis },
    { header: "Guest / Occupancy Type", key: "guestType", width: 20, value: (r) => r.guestType },
    ageColumn("Child Minimum Age", "childMinAge", (r) => r.childMinAge),
    ageColumn("Child Maximum Age", "childMaxAge", (r) => r.childMaxAge),
    ...moneyColumns<AccommodationExportRow>((r) => r.price, (r) => r.currency, (r) => r.usdEquivalent),
    notesColumn((r) => r.notes),
    ...(includeArchived ? [statusColumn<AccommodationExportRow>()] : []),
  ];
}

export function transportColumns(includeArchived: boolean): ExportColumn<TransportExportRow>[] {
  return [
    { header: "Vehicle Type", key: "vehicleType", width: 20, value: (r) => r.vehicleType },
    { header: "Pricing Basis", key: "pricingBasis", width: 20, value: (r) => r.pricingBasis },
    ...moneyColumns<TransportExportRow>((r) => r.price, (r) => r.currency, (r) => r.usdEquivalent),
    notesColumn((r) => r.notes),
    ...(includeArchived ? [statusColumn<TransportExportRow>()] : []),
  ];
}

export function trainColumns(includeArchived: boolean): ExportColumn<TrainExportRow>[] {
  return [
    { header: "Route", key: "route", width: 26, value: (r) => r.route },
    { header: "Class", key: "trainClass", width: 14, value: (r) => r.trainClass },
    { header: "Price Per Passenger", key: "pricePerPassenger", width: 18, numeric: true, value: (r) => r.pricePerPassenger },
    { header: "Currency", key: "currency", width: 10, value: (r) => r.currency },
    { header: "USD Equivalent", key: "usdEquivalent", width: 15, numeric: true, value: (r) => r.usdEquivalent },
    notesColumn((r) => r.notes),
    ...(includeArchived ? [statusColumn<TrainExportRow>()] : []),
  ];
}

export function transferColumns(includeArchived: boolean): ExportColumn<TransferExportRow>[] {
  return [
    { header: "Transfer / Route", key: "route", width: 26, value: (r) => r.route },
    { header: "Pricing Basis", key: "pricingBasis", width: 15, value: (r) => r.pricingBasis },
    ...moneyColumns<TransferExportRow>((r) => r.price, (r) => r.currency, (r) => r.usdEquivalent),
    notesColumn((r) => r.notes),
    ...(includeArchived ? [statusColumn<TransferExportRow>()] : []),
  ];
}

export function activityColumns(includeArchived: boolean): ExportColumn<ActivityExportRow>[] {
  return [
    { header: "Activity", key: "activity", width: 26, value: (r) => r.activity },
    { header: "Location", key: "location", width: 18, value: (r) => r.location },
    { header: "Pricing Basis", key: "pricingBasis", width: 15, value: (r) => r.pricingBasis },
    ...moneyColumns<ActivityExportRow>((r) => r.price, (r) => r.currency, (r) => r.usdEquivalent),
    notesColumn((r) => r.notes),
    ...(includeArchived ? [statusColumn<ActivityExportRow>()] : []),
  ];
}

export function parkColumns(includeArchived: boolean): ExportColumn<ParkExportRow>[] {
  return [
    { header: "Park", key: "park", width: 26, value: (r) => r.park },
    { header: "Traveller Type", key: "travellerType", width: 15, value: (r) => r.travellerType },
    ageColumn("Minimum Age", "minAge", (r) => r.minAge),
    ageColumn("Maximum Age", "maxAge", (r) => r.maxAge),
    { header: "Pricing Basis", key: "pricingBasis", width: 24, value: (r) => r.pricingBasis },
    ...moneyColumns<ParkExportRow>((r) => r.price, (r) => r.currency, (r) => r.usdEquivalent),
    notesColumn((r) => r.notes),
    ...(includeArchived ? [statusColumn<ParkExportRow>()] : []),
  ];
}

export function flightColumns(includeArchived: boolean): ExportColumn<FlightExportRow>[] {
  return [
    { header: "Route", key: "route", width: 26, value: (r) => r.route },
    { header: "Pricing Basis", key: "pricingBasis", width: 15, value: (r) => r.pricingBasis },
    ...moneyColumns<FlightExportRow>((r) => r.price, (r) => r.currency, (r) => r.usdEquivalent),
    notesColumn((r) => r.notes),
    ...(includeArchived ? [statusColumn<FlightExportRow>()] : []),
  ];
}

/** Adds one formatted worksheet: bold header row, frozen top row, autofilter, sensible widths, numeric price cells, no merged cells. */
export function addCategorySheet<Row>(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  columns: ExportColumn<Row>[],
  rows: Row[]
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(sanitizeSheetName(sheetName), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SAGE } };
  headerRow.alignment = { vertical: "middle" };

  for (const row of rows) {
    const values: Record<string, string | number | null> = {};
    for (const col of columns) values[col.key] = col.value(row);
    sheet.addRow(values);
  }

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const excelCol = sheet.getColumn(i + 1);
    if (col.numeric) excelCol.numFmt = col.numFmt ?? "#,##0.00";
    if (col.wrap) excelCol.alignment = { wrapText: true, vertical: "top" };
  }

  if (rows.length > 0 || columns.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  }

  return sheet;
}

/** A small info sheet so the exchange rate used is always visible, without repeating a banner row on every category tab. */
export function addExportInfoSheet(
  workbook: ExcelJS.Workbook,
  opts: { exportedAt: Date; rateMicros: RateMicros; includedCategories: ExportCategory[]; includeArchived: boolean }
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet("Export Info", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Field", key: "field", width: 24 },
    { header: "Value", key: "value", width: 46 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SAGE } };

  const rate = microsToRateNumber(opts.rateMicros);
  const dateStr = opts.exportedAt.toISOString().slice(0, 10);

  const rows: [string, string][] = [
    ["Workbook", "Kusi Safaris — Rate Library Export"],
    ["Export Date", dateStr],
    ["Exchange Rate Used", `1 USD = ${rate.toLocaleString("en-US", { maximumFractionDigits: 2 })} KES`],
    ["Categories Included", opts.includedCategories.map((c) => EXPORT_CATEGORY_LABELS[c]).join(", ")],
    ["Archived Rates", opts.includeArchived ? "Included" : "Excluded"],
  ];
  for (const [field, value] of rows) {
    const added = sheet.addRow({ field, value });
    added.getCell(1).font = { bold: true };
  }

  return sheet;
}
