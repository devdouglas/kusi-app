import { describe, it, expect, afterAll, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { updateExchangeRate, getExchangeRateMicros } from "@/lib/settings";
import {
  createAccommodation,
  createTransportRate,
  createTrainJourney,
  createTransferRate,
  createActivityRate,
  createPark,
  createFlightRate,
  archiveFlightRate,
} from "@/lib/actions/rate-library";
import { buildRateLibraryWorkbook, rateLibraryExportFilename } from "@/lib/xlsx/export-rate-library";
import { microsToRateNumber } from "@/lib/money";
import { EXPORT_CATEGORY_LABELS } from "@/lib/xlsx/types";

const createdAccommodationIds: string[] = [];
const createdParkIds: string[] = [];
const createdTransportIds: string[] = [];
const createdTrainIds: string[] = [];
const createdTransferIds: string[] = [];
const createdActivityIds: string[] = [];
const createdFlightIds: string[] = [];

beforeAll(async () => {
  await updateExchangeRate(130);

  const acc = await createAccommodation({
    name: "Export Test Lodge",
    location: "Samburu",
    currency: "USD",
    pricingBasis: "PER_PERSON",
    roomTypes: [{ name: "Standard" }],
    childAgeBrackets: [{ minAge: 0, maxAge: 4, label: "Under 5" }, { minAge: 5, maxAge: 15, label: "5-15" }],
    rates: [
      {
        roomTypeId: "Standard",
        season: "HIGH",
        mealPlan: "FB",
        adultSharing: 220,
        single: 300,
        childPrices: [
          { bracketId: "0-4", price: 0 },
          { bracketId: "5-15", price: 130 },
        ],
      },
    ],
  });
  createdAccommodationIds.push(acc!.id);

  const transport = await createTransportRate({ vehicleType: "JEEP_5PAX", price: 150, currency: "USD" });
  createdTransportIds.push(transport.id);

  const train = await createTrainJourney({ route: "Nairobi → Mombasa", firstClass: 30, secondClass: 15, currency: "USD" });
  createdTrainIds.push(train.id);

  const transfer = await createTransferRate({ route: "Airport → Hotel", price: 40, currency: "USD" });
  createdTransferIds.push(transfer.id);

  const activity = await createActivityRate({ name: "Game Drive", location: "Samburu", price: 60, currency: "USD" });
  createdActivityIds.push(activity.id);

  const park = await createPark({
    name: "Samburu National Reserve",
    currency: "USD",
    adultFee: 80,
    childBrackets: [
      { minAge: 0, maxAge: 4, price: 0 },
      { minAge: 5, maxAge: 15, price: 40 },
    ],
  });
  createdParkIds.push(park!.id);

  const flightActive = await createFlightRate({ route: "Nairobi → Lamu", price: 200, currency: "USD" });
  createdFlightIds.push(flightActive.id);
  const flightArchived = await createFlightRate({ route: "Nairobi → Kisumu", price: 90, currency: "USD" });
  createdFlightIds.push(flightArchived.id);
  await archiveFlightRate(flightArchived.id, true);
});

afterAll(async () => {
  await prisma.accommodation.deleteMany({ where: { id: { in: createdAccommodationIds } } });
  await prisma.park.deleteMany({ where: { id: { in: createdParkIds } } });
  await prisma.transportRate.deleteMany({ where: { id: { in: createdTransportIds } } });
  await prisma.trainJourney.deleteMany({ where: { id: { in: createdTrainIds } } });
  await prisma.transferRate.deleteMany({ where: { id: { in: createdTransferIds } } });
  await prisma.activityRate.deleteMany({ where: { id: { in: createdActivityIds } } });
  await prisma.flightRate.deleteMany({ where: { id: { in: createdFlightIds } } });
});

/** Round-trips the workbook through a real .xlsx buffer to prove the output is a genuinely valid Excel file, not just an in-memory object. */
async function buildAndReload(...args: Parameters<typeof buildRateLibraryWorkbook>) {
  const workbook = await buildRateLibraryWorkbook(...args);
  const buffer = await workbook.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer as unknown as ArrayBuffer);
  return reloaded;
}

describe("Rate Library Excel export", () => {
  it("exports a single category as one worksheet, plus the Export Info sheet", async () => {
    const rateMicros = await getExchangeRateMicros();
    const wb = await buildAndReload({ categories: ["ACCOMMODATION"], includeArchived: false, rateMicros });

    expect(wb.worksheets.map((s) => s.name)).toEqual(["Export Info", "Accommodation"]);
  });

  it("exports several selected categories as their own worksheets, in Rate Library tab order regardless of selection order", async () => {
    const rateMicros = await getExchangeRateMicros();
    // Selected out of order on purpose.
    const wb = await buildAndReload({
      categories: ["DOMESTIC_FLIGHT", "ACCOMMODATION", "ACTIVITY"],
      includeArchived: false,
      rateMicros,
    });

    expect(wb.worksheets.map((s) => s.name)).toEqual(["Export Info", "Accommodation", "Activities", "Domestic Flights"]);
  });

  it("exports all seven categories as their own worksheets", async () => {
    const rateMicros = await getExchangeRateMicros();
    const wb = await buildAndReload({
      categories: [
        "ACCOMMODATION",
        "PRIVATE_TRANSPORT",
        "TRAIN",
        "TAXI_TRANSFER",
        "ACTIVITY",
        "PARK_ENTRANCE_FEE",
        "DOMESTIC_FLIGHT",
      ],
      includeArchived: false,
      rateMicros,
    });

    expect(wb.worksheets).toHaveLength(8); // Export Info + 7 categories
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      "Export Info",
      ...Object.values(EXPORT_CATEGORY_LABELS),
    ]);
  });

  it("does not include worksheets for categories that were not selected", async () => {
    const rateMicros = await getExchangeRateMicros();
    const wb = await buildAndReload({ categories: ["TRAIN"], includeArchived: false, rateMicros });

    const names = wb.worksheets.map((s) => s.name);
    expect(names).toContain("Train");
    expect(names).not.toContain("Accommodation");
    expect(names).not.toContain("Park Entrance Fees");
  });

  it("flattens accommodation nested rates and its own custom child brackets into readable rows in the actual sheet", async () => {
    const rateMicros = await getExchangeRateMicros();
    const wb = await buildAndReload({ categories: ["ACCOMMODATION"], includeArchived: false, rateMicros });
    const sheet = wb.getWorksheet("Accommodation")!;

    const header = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
    expect(header).toContain("Guest / Occupancy Type");
    expect(header).toContain("Child Minimum Age");
    expect(header).toContain("Child Maximum Age");

    const guestTypeCol = header.indexOf("Guest / Occupancy Type") + 1;
    const priceCol = header.indexOf("Price") + 1;
    const guestTypes: string[] = [];
    let childRowPrice: number | undefined;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const guestType = String(row.getCell(guestTypeCol).value);
      guestTypes.push(guestType);
      if (guestType === "Child" && Number(row.getCell(header.indexOf("Child Minimum Age") + 1).value) === 5) {
        childRowPrice = Number(row.getCell(priceCol).value);
      }
    });

    expect(guestTypes.sort()).toEqual(["Adult Sharing", "Child", "Child", "Single Occupancy"]);
    expect(childRowPrice).toBe(130);
  });

  it("flattens park entrance fees with the park's own child brackets into readable rows in the actual sheet", async () => {
    const rateMicros = await getExchangeRateMicros();
    const wb = await buildAndReload({ categories: ["PARK_ENTRANCE_FEE"], includeArchived: false, rateMicros });
    const sheet = wb.getWorksheet("Park Entrance Fees")!;

    expect(sheet.rowCount).toBe(4); // header + adult + 2 child brackets (0-4 and 5-15)
    const header = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
    const travellerTypeCol = header.indexOf("Traveller Type") + 1;
    const priceCol = header.indexOf("Price") + 1;
    const rows: { travellerType: string; price: number }[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({ travellerType: String(row.getCell(travellerTypeCol).value), price: Number(row.getCell(priceCol).value) });
    });
    expect(rows.find((r) => r.travellerType === "Adult")?.price).toBe(80);
    expect(rows.filter((r) => r.travellerType === "Child")).toHaveLength(2);
  });

  it("represents the current exchange rate correctly on the Export Info sheet", async () => {
    await updateExchangeRate(135);
    const rateMicros = await getExchangeRateMicros();
    const wb = await buildAndReload({ categories: ["TRAIN"], includeArchived: false, rateMicros });
    const info = wb.getWorksheet("Export Info")!;

    const rateRow = info.getRows(1, info.rowCount)!.find((r) => r.getCell(1).value === "Exchange Rate Used")!;
    expect(String(rateRow.getCell(2).value)).toContain(String(microsToRateNumber(rateMicros)));
    await updateExchangeRate(130); // restore for other tests in this file
  });

  it("excludes archived rates by default and includes them with a Status column when requested", async () => {
    const rateMicros = await getExchangeRateMicros();

    const defaultWb = await buildAndReload({ categories: ["DOMESTIC_FLIGHT"], includeArchived: false, rateMicros });
    const defaultSheet = defaultWb.getWorksheet("Domestic Flights")!;
    const defaultHeader = (defaultSheet.getRow(1).values as unknown[]).slice(1).map(String);
    expect(defaultHeader).not.toContain("Status");
    expect(defaultSheet.rowCount).toBe(2); // header + only the active route

    const withArchivedWb = await buildAndReload({ categories: ["DOMESTIC_FLIGHT"], includeArchived: true, rateMicros });
    const archivedSheet = withArchivedWb.getWorksheet("Domestic Flights")!;
    const archivedHeader = (archivedSheet.getRow(1).values as unknown[]).slice(1).map(String);
    expect(archivedHeader).toContain("Status");
    expect(archivedSheet.rowCount).toBe(3); // header + active + archived
  });

  it("creates a worksheet with headers but no data rows for a selected category with no rates, instead of failing", async () => {
    const rateMicros = await getExchangeRateMicros();
    // Taxi Transfer has no seeded rates besides the one created above; use a
    // fresh category-only assertion by clearing then re-checking row count.
    await prisma.transferRate.deleteMany({ where: { id: { in: createdTransferIds } } });
    createdTransferIds.length = 0;

    const wb = await buildAndReload({ categories: ["TAXI_TRANSFER"], includeArchived: false, rateMicros });
    const sheet = wb.getWorksheet("Taxi Transfer")!;

    expect(sheet.rowCount).toBe(1); // header row only
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toContain("Transfer / Route");
  });

  it("produces a genuinely valid .xlsx buffer that a fresh ExcelJS workbook can load without error", async () => {
    const rateMicros = await getExchangeRateMicros();
    const workbook = await buildRateLibraryWorkbook({ categories: ["ACCOMMODATION", "TRAIN"], includeArchived: false, rateMicros });
    const buffer = await workbook.xlsx.writeBuffer();

    expect(buffer.byteLength).toBeGreaterThan(0);
    const reloaded = new ExcelJS.Workbook();
    await expect(reloaded.xlsx.load(buffer as unknown as ArrayBuffer)).resolves.not.toThrow();
  });

  it("generates a stable, predictable filename", () => {
    expect(rateLibraryExportFilename(new Date("2026-09-23T12:00:00Z"))).toBe("Kusi_Rate_Library_2026-09-23.xlsx");
  });
});
