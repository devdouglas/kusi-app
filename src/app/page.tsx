import Link from "next/link";
import { listQuotes } from "@/lib/actions/quotes";
import { formatUsd } from "@/lib/money";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_TONE = { DRAFT: "amber", FINAL: "sage", ARCHIVED: "neutral" } as const;

export default async function DashboardPage() {
  const recentQuotes = (await listQuotes()).slice(0, 5);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Kusi Safaris Rates &amp; Quotes</h1>
        <p className="mt-1 text-sm text-muted">Build tailor-made trip costings and keep the Rate Library up to date.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/quotes/new">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardBody>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sage-100 text-lg text-sage-700">
                +
              </div>
              <h2 className="text-base font-semibold text-foreground">New Quote</h2>
              <p className="mt-1 text-sm text-muted">Start a new tailor-made trip calculation.</p>
            </CardBody>
          </Card>
        </Link>
        <Link href="/rate-library">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardBody>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sage-100 text-lg text-sage-700">
                ▤
              </div>
              <h2 className="text-base font-semibold text-foreground">Rate Library</h2>
              <p className="mt-1 text-sm text-muted">Create, search and update supplier prices.</p>
            </CardBody>
          </Card>
        </Link>
        <Link href="/quotes">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardBody>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sage-100 text-lg text-sage-700">
                ⌕
              </div>
              <h2 className="text-base font-semibold text-foreground">Saved Quotes</h2>
              <p className="mt-1 text-sm text-muted">Find, duplicate and manage existing quotes.</p>
            </CardBody>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Recent quotes</h2>
        {recentQuotes.length === 0 ? (
          <Card>
            <CardBody className="text-sm text-muted">No quotes yet — create your first one to see it here.</CardBody>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {recentQuotes.map((q) => (
                <li key={q.id}>
                  <Link href={`/quotes/${q.id}`} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-sage-50">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {q.tripTitle} <span className="font-normal text-muted">— {q.clientName}</span>
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {q.totalPax} pax · Updated {new Date(q.updatedAt).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-foreground">{formatUsd(q.totalUsdCents)}</span>
                      <Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
