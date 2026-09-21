import { NextResponse } from "next/server";
import { getQuote } from "@/lib/actions/quotes";
import { deriveQuote } from "@/lib/quote/derive";
import { generateQuoteSummaryDocx } from "@/lib/docx/quote-summary";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let quote;
  try {
    quote = await getQuote(id);
  } catch {
    return NextResponse.json({ error: "Failed to load quote." }, { status: 500 });
  }
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  try {
    const derived = deriveQuote(quote);
    const buffer = await generateQuoteSummaryDocx(derived);
    const safeName = `${quote.tripTitle} - ${quote.clientName}`.replace(/[\\/:*?"<>|]/g, "").trim() || "Quote Summary";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName}.docx"`,
      },
    });
  } catch (err) {
    console.error("Failed to generate quote summary docx", err);
    return NextResponse.json({ error: "Failed to generate the Word summary. Please try again." }, { status: 500 });
  }
}
