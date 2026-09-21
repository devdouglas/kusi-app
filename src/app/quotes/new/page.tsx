import { NewQuoteForm } from "@/components/quote-builder/new-quote-form";

export default function NewQuotePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New Quote</h1>
        <p className="mt-1 text-sm text-muted">Start a new tailor-made trip calculation.</p>
      </div>
      <NewQuoteForm />
    </div>
  );
}
