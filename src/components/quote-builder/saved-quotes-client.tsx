"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { duplicateQuote, setQuoteStatus, deleteQuote } from "@/lib/actions/quotes";
import { formatUsd } from "@/lib/money";
import { formatTravelPeriod } from "@/lib/calc/trip-dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

export interface SavedQuoteRow {
  id: string;
  clientName: string;
  tripTitle: string;
  startDate: Date;
  endDate: Date;
  status: "DRAFT" | "FINAL" | "ARCHIVED";
  totalPax: number;
  totalUsdCents: number;
  updatedAt: Date;
}

const STATUS_TONE = { DRAFT: "amber", FINAL: "sage", ARCHIVED: "neutral" } as const;

export function SavedQuotesClient({ quotes }: { quotes: SavedQuoteRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "DRAFT" | "FINAL" | "ARCHIVED">("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes
      .filter((quote) => status === "ALL" || quote.status === status)
      .filter((quote) => !q || quote.clientName.toLowerCase().includes(q) || quote.tripTitle.toLowerCase().includes(q));
  }, [quotes, search, status]);

  async function handleDuplicate(id: string) {
    setBusyId(id);
    try {
      const copy = await duplicateQuote(id);
      router.push(`/quotes/${copy.id}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(id: string, archived: boolean) {
    setBusyId(id);
    try {
      await setQuoteStatus(id, archived ? "ARCHIVED" : "DRAFT");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this quote permanently? This cannot be undone.")) return;
    setBusyId(id);
    try {
      await deleteQuote(id);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client or trip title…" className="w-72" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-40">
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="FINAL">Final</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="px-6 py-8 text-center text-sm text-muted">No quotes match your search.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((quote) => (
            <Card key={quote.id}>
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                <Link href={`/quotes/${quote.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">{quote.tripTitle}</h3>
                    <Badge tone={STATUS_TONE[quote.status]}>{quote.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">{quote.clientName}</p>
                  <p className="mt-1 text-[12px] text-muted">
                    {formatTravelPeriod(quote.startDate, quote.endDate)} · {quote.totalPax} pax · Updated{" "}
                    {new Date(quote.updatedAt).toLocaleDateString("en-GB")}
                  </p>
                </Link>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-foreground">{formatUsd(quote.totalUsdCents)}</span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" disabled={busyId === quote.id} onClick={() => handleDuplicate(quote.id)}>
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === quote.id}
                      onClick={() => handleArchive(quote.id, quote.status !== "ARCHIVED")}
                    >
                      {quote.status === "ARCHIVED" ? "Unarchive" : "Archive"}
                    </Button>
                    <Button size="sm" variant="danger" disabled={busyId === quote.id} onClick={() => handleDelete(quote.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
