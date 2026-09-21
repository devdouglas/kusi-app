import { notFound } from "next/navigation";
import { getQuote } from "@/lib/actions/quotes";
import { deriveQuote } from "@/lib/quote/derive";
import { getExchangeRateMicros } from "@/lib/settings";
import { QuoteBuilderClient } from "@/components/quote-builder/quote-builder-client";

export default async function QuoteBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quote, currentRateMicros] = await Promise.all([getQuote(id), getExchangeRateMicros()]);
  if (!quote) notFound();

  const derived = deriveQuote(quote);

  return <QuoteBuilderClient derived={derived} currentRateMicros={currentRateMicros} />;
}
