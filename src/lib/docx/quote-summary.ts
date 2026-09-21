import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from "docx";
import type { DerivedQuote, DerivedDay, DerivedLineItem } from "@/lib/quote/derive";
import { formatUsd } from "@/lib/money";
import { formatFullDate } from "@/lib/calc/trip-dates";
import { CATEGORY_LABELS, MEAL_PLAN_LABELS, SEASON_LABELS } from "@/types/line-items";

const SAGE = "8A9270";
const CHARCOAL = "2B2B27";
const MUTED = "6B6B63";

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, color: SAGE, bold: true })],
  });
}

function kv(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, color: CHARCOAL }),
      new TextRun({ text: value, color: CHARCOAL }),
    ],
  });
}

/** One or two lines describing a line item, mirroring the in-app display. */
function lineItemDescription(li: DerivedLineItem): string[] {
  const d = li.parsedData;
  switch (d.category) {
    case "ACCOMMODATION": {
      const lines = [
        `${d.accommodationName} — ${d.roomTypeName}`,
        `${MEAL_PLAN_LABELS[d.mealPlan]} — ${SEASON_LABELS[d.season]}`,
      ];
      return lines;
    }
    case "PRIVATE_TRANSPORT":
      return [li.description, `${d.vehicles} vehicle${d.vehicles !== 1 ? "s" : ""}`];
    case "TRAIN":
      return [li.description, `${d.passengers} passenger${d.passengers !== 1 ? "s" : ""}`];
    case "TAXI_TRANSFER":
      return [li.description, `${d.vehicles} vehicle${d.vehicles !== 1 ? "s" : ""}`];
    case "ACTIVITY":
      return [li.description, `${d.participants} participant${d.participants !== 1 ? "s" : ""}`];
    case "DOMESTIC_FLIGHT":
      return [li.description, `${d.passengers} passenger${d.passengers !== 1 ? "s" : ""}`];
    case "VILLA":
      return [li.description, `${d.nights} night${d.nights !== 1 ? "s" : ""}${d.quantity > 1 ? ` × ${d.quantity}` : ""}`];
    case "MISC":
      return [li.description, `Qty ${d.quantity}`];
    default:
      return [li.description];
  }
}

function lineItemParagraphs(li: DerivedLineItem): Paragraph[] {
  const [title, detail] = lineItemDescription(li);
  const paragraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 100, after: 20 },
      children: [new TextRun({ text: CATEGORY_LABELS[li.category], bold: true, size: 20, color: SAGE })],
    }),
    new Paragraph({
      spacing: { after: 10 },
      children: [new TextRun({ text: title, color: CHARCOAL })],
    }),
  ];
  if (detail) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 10 },
        children: [new TextRun({ text: detail, color: MUTED, size: 20 })],
      })
    );
  }
  paragraphs.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: formatUsd(li.totalUsdCents), bold: true, color: CHARCOAL })],
    })
  );
  return paragraphs;
}

function dayCell(day: DerivedDay): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 100, after: 100 },
      children: [
        new TextRun({ text: `Day ${day.dayNumber} – ${formatFullDate(day.date)}`, bold: true, color: CHARCOAL }),
      ],
    }),
  ];
  if (day.lineItems.length === 0) {
    paragraphs.push(
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "No items", italics: true, color: MUTED })] })
    );
  } else {
    for (const li of day.lineItems) paragraphs.push(...lineItemParagraphs(li));
  }
  paragraphs.push(
    new Paragraph({
      spacing: { before: 60, after: 200 },
      children: [new TextRun({ text: `Day Total: ${formatUsd(day.dayTotalUsdCents)}`, bold: true, color: SAGE })],
    })
  );
  return paragraphs;
}

export async function generateQuoteSummaryDocx(derived: DerivedQuote): Promise<Buffer> {
  const { quote, days, totalPax, numberOfDays, numberOfNights, travelPeriod, privateVehicleDays, totalUsdCents, perPersonUsdCents } =
    derived;

  const headerLines: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
      children: [new TextRun({ text: quote.tripTitle, bold: true, color: SAGE })],
    }),
    kv("Client", quote.clientName),
    kv("Travel period", travelPeriod),
    kv("Passengers", String(totalPax)),
    kv("Adults", String(quote.adults)),
  ];
  if (quote.children5to12 > 0) headerLines.push(kv("Children 5–12", String(quote.children5to12)));
  if (quote.childrenUnder5 > 0) headerLines.push(kv("Children under 5", String(quote.childrenUnder5)));
  headerLines.push(
    kv("Duration", `${numberOfDays} days / ${numberOfNights} nights`),
    kv("Private vehicle days", String(privateVehicleDays)),
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({ text: `Total party – ${quote.clientName}: `, bold: true, color: CHARCOAL }),
        new TextRun({ text: formatUsd(totalUsdCents), bold: true, color: SAGE }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "Price per person: ", bold: true, color: CHARCOAL }),
        new TextRun({ text: formatUsd(perPersonUsdCents), bold: true, color: SAGE }),
      ],
    })
  );

  const dayContent = days.flatMap((day) => dayCell(day));

  const totalsSection = [
    new Paragraph({ spacing: { before: 300 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: "D9D9D3" } }, children: [] }),
    new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [
        new TextRun({ text: `Total party – ${quote.clientName}: `, bold: true, size: 24, color: CHARCOAL }),
        new TextRun({ text: formatUsd(totalUsdCents), bold: true, size: 24, color: SAGE }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Price per person: ", bold: true, size: 22, color: CHARCOAL }),
        new TextRun({ text: formatUsd(perPersonUsdCents), bold: true, size: 22, color: SAGE }),
      ],
    }),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22, color: CHARCOAL } },
      },
    },
    sections: [
      {
        properties: {},
        children: [...headerLines, ...dayContent, ...totalsSection],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
