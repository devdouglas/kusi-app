import { listQuotes } from "@/lib/actions/quotes";
import { SavedQuotesClient } from "@/components/quote-builder/saved-quotes-client";

export default async function SavedQuotesPage() {
  const quotes = await listQuotes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Saved Quotes</h1>
        <p className="mt-1 text-sm text-muted">Find and manage existing calculations.</p>
      </div>
      <SavedQuotesClient quotes={quotes} />
    </div>
  );
}
