import ExcelJS from "exceljs";
import {
  listAccommodations,
  listTransportRates,
  listTrainJourneys,
  listTransferRates,
  listActivityRates,
  listParks,
  listFlightRates,
} from "@/lib/actions/rate-library";
import type { RateMicros } from "@/lib/money";
import {
  flattenAccommodationRates,
  flattenTransportRates,
  flattenTrainJourneys,
  flattenTransferRates,
  flattenActivityRates,
  flattenParkEntranceRates,
  flattenFlightRates,
} from "@/lib/xlsx/flatten";
import {
  addCategorySheet,
  addExportInfoSheet,
  accommodationColumns,
  transportColumns,
  trainColumns,
  transferColumns,
  activityColumns,
  parkColumns,
  flightColumns,
} from "@/lib/xlsx/workbook";
import { EXPORT_CATEGORY_ORDER, EXPORT_CATEGORY_LABELS, type ExportCategory } from "@/lib/xlsx/types";

export interface RateLibraryExportOptions {
  categories: ExportCategory[];
  includeArchived: boolean;
  rateMicros: RateMicros;
}

/**
 * One function per Rate Library category: fetch its records (always with
 * archived rows included — the flatten layer decides whether to keep them)
 * and flatten to export rows. No pricing/conversion logic lives here — it's
 * all in money.ts and the flatten functions, so the export can never drift
 * from what the app actually charges.
 */
export async function exportAccommodationRates(opts: { includeArchived: boolean; rateMicros: RateMicros }) {
  const items = await listAccommodations({ includeArchived: true });
  return flattenAccommodationRates(items, opts);
}

export async function exportTransportRates(opts: { includeArchived: boolean; rateMicros: RateMicros }) {
  const items = await listTransportRates({ includeArchived: true });
  return flattenTransportRates(items, opts);
}

export async function exportTrainRates(opts: { includeArchived: boolean; rateMicros: RateMicros }) {
  const items = await listTrainJourneys({ includeArchived: true });
  return flattenTrainJourneys(items, opts);
}

export async function exportTransferRates(opts: { includeArchived: boolean; rateMicros: RateMicros }) {
  const items = await listTransferRates({ includeArchived: true });
  return flattenTransferRates(items, opts);
}

export async function exportActivityRates(opts: { includeArchived: boolean; rateMicros: RateMicros }) {
  const items = await listActivityRates({ includeArchived: true });
  return flattenActivityRates(items, opts);
}

export async function exportParkEntranceRates(opts: { includeArchived: boolean; rateMicros: RateMicros }) {
  const items = await listParks({ includeArchived: true });
  return flattenParkEntranceRates(items, opts);
}

export async function exportFlightRates(opts: { includeArchived: boolean; rateMicros: RateMicros }) {
  const items = await listFlightRates({ includeArchived: true });
  return flattenFlightRates(items, opts);
}

/** Builds the full workbook for the selected categories. Never touches the database — read-only, export only. */
export async function buildRateLibraryWorkbook(opts: RateLibraryExportOptions): Promise<ExcelJS.Workbook> {
  const { categories, includeArchived, rateMicros } = opts;
  const selected = new Set(categories);
  // Always emit sheets in the same order as the Rate Library tabs,
  // regardless of the order categories were checked in the modal.
  const orderedCategories = EXPORT_CATEGORY_ORDER.filter((c) => selected.has(c));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kusi Safaris Rates & Quotes";
  workbook.created = new Date();

  addExportInfoSheet(workbook, {
    exportedAt: new Date(),
    rateMicros,
    includedCategories: orderedCategories,
    includeArchived,
  });

  const flattenOpts = { includeArchived, rateMicros };

  for (const category of orderedCategories) {
    const sheetName = EXPORT_CATEGORY_LABELS[category];
    switch (category) {
      case "ACCOMMODATION": {
        const rows = await exportAccommodationRates(flattenOpts);
        addCategorySheet(workbook, sheetName, accommodationColumns(includeArchived), rows);
        break;
      }
      case "PRIVATE_TRANSPORT": {
        const rows = await exportTransportRates(flattenOpts);
        addCategorySheet(workbook, sheetName, transportColumns(includeArchived), rows);
        break;
      }
      case "TRAIN": {
        const rows = await exportTrainRates(flattenOpts);
        addCategorySheet(workbook, sheetName, trainColumns(includeArchived), rows);
        break;
      }
      case "TAXI_TRANSFER": {
        const rows = await exportTransferRates(flattenOpts);
        addCategorySheet(workbook, sheetName, transferColumns(includeArchived), rows);
        break;
      }
      case "ACTIVITY": {
        const rows = await exportActivityRates(flattenOpts);
        addCategorySheet(workbook, sheetName, activityColumns(includeArchived), rows);
        break;
      }
      case "PARK_ENTRANCE_FEE": {
        const rows = await exportParkEntranceRates(flattenOpts);
        addCategorySheet(workbook, sheetName, parkColumns(includeArchived), rows);
        break;
      }
      case "DOMESTIC_FLIGHT": {
        const rows = await exportFlightRates(flattenOpts);
        addCategorySheet(workbook, sheetName, flightColumns(includeArchived), rows);
        break;
      }
    }
  }

  return workbook;
}

export function rateLibraryExportFilename(date: Date = new Date()): string {
  const dateStr = date.toISOString().slice(0, 10);
  return `Kusi_Rate_Library_${dateStr}.xlsx`;
}
