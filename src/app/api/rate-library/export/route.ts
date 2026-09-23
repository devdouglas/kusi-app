import { NextResponse } from "next/server";
import { getExchangeRateMicros } from "@/lib/settings";
import { buildRateLibraryWorkbook, rateLibraryExportFilename } from "@/lib/xlsx/export-rate-library";
import { isExportCategory, type ExportCategory } from "@/lib/xlsx/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoriesParam = url.searchParams.get("categories") ?? "";
  const includeArchived = url.searchParams.get("archived") === "1";

  const categories = categoriesParam
    .split(",")
    .map((c) => c.trim())
    .filter((c): c is ExportCategory => isExportCategory(c));

  if (categories.length === 0) {
    return NextResponse.json({ error: "Select at least one category to export." }, { status: 400 });
  }

  try {
    const rateMicros = await getExchangeRateMicros();
    const workbook = await buildRateLibraryWorkbook({ categories, includeArchived, rateMicros });
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${rateLibraryExportFilename()}"`,
      },
    });
  } catch (err) {
    console.error("Failed to generate Rate Library Excel export", err);
    return NextResponse.json({ error: "Failed to generate the Excel export. Please try again." }, { status: 500 });
  }
}
