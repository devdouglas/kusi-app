"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DerivedQuote } from "@/lib/quote/derive";
import { setQuoteStatus, duplicateQuote, deleteQuote, refreshQuoteExchangeRate } from "@/lib/actions/quotes";
import { formatUsd } from "@/lib/money";
import { microsToRateNumber } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { DayCard } from "./day-card";
import { AddItemModal, type EditContext } from "./add-item-modal";
import { TripHeaderForm } from "./trip-header-form";
import type { LineItemData } from "@/types/line-items";

const STATUS_TONE = { DRAFT: "amber", FINAL: "sage", ARCHIVED: "neutral" } as const;

export function QuoteBuilderClient({
  derived,
  currentRateMicros,
}: {
  derived: DerivedQuote;
  currentRateMicros: number;
}) {
  const router = useRouter();
  const { quote, days, totalPax, numberOfDays, numberOfNights, travelPeriod, privateVehicleDays, totalUsdCents, perPersonUsdCents } = derived;

  const [addItemDayId, setAddItemDayId] = useState<string | null>(null);
  const [editContext, setEditContext] = useState<{ dayId: string; edit: EditContext } | null>(null);
  const [showHeaderForm, setShowHeaderForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const quoteContext = {
    rateMicros: quote.rateMicros,
    adults: quote.adults,
    children5to12: quote.children5to12,
    childrenUnder5: quote.childrenUnder5,
    totalPax,
  };

  const rateOutOfDate = quote.status === "DRAFT" && quote.rateMicros !== currentRateMicros;

  async function handleStatusChange(status: "DRAFT" | "FINAL" | "ARCHIVED") {
    setBusy(true);
    try {
      await setQuoteStatus(quote.id, status);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      const copy = await duplicateQuote(quote.id);
      router.push(`/quotes/${copy.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this quote permanently? This cannot be undone.")) return;
    setBusy(true);
    try {
      await deleteQuote(quote.id);
      router.push("/quotes");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshRate() {
    if (!confirm(`Refresh this quote to the current exchange rate (1 USD = ${microsToRateNumber(currentRateMicros)} KES)?`)) return;
    setBusy(true);
    try {
      await refreshQuoteExchangeRate(quote.id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{quote.tripTitle}</h1>
            <Badge tone={STATUS_TONE[quote.status]}>{quote.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{quote.clientName}</p>
          <button
            type="button"
            onClick={() => setShowHeaderForm(true)}
            className="mt-1.5 text-[13px] font-medium text-sage-700 hover:underline"
          >
            Edit trip details
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={quote.status}
            disabled={busy}
            onChange={(e) => handleStatusChange(e.target.value as "DRAFT" | "FINAL" | "ARCHIVED")}
            className="w-32"
          >
            <option value="DRAFT">Draft</option>
            <option value="FINAL">Final</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <Button variant="secondary" disabled={busy} onClick={handleDuplicate}>
            Duplicate
          </Button>
          <a href={`/api/quotes/${quote.id}/docx`}>
            <Button variant="primary">Summarise Quote</Button>
          </a>
          <Button variant="danger" disabled={busy} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {rateOutOfDate && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-[13px] text-amber-800">
              A new exchange rate is available (1 USD = {microsToRateNumber(currentRateMicros)} KES). This draft is still using 1 USD ={" "}
              {microsToRateNumber(quote.rateMicros)} KES.
            </p>
            <Button size="sm" variant="secondary" disabled={busy} onClick={handleRefreshRate}>
              Refresh rate
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-4 px-6 py-4 sm:grid-cols-4">
          <Stat label="Travel period" value={travelPeriod} />
          <Stat label="Days / Nights" value={`${numberOfDays} days / ${numberOfNights} nights`} />
          <Stat label="Private vehicle days" value={String(privateVehicleDays)} />
          <Stat label="Total Pax" value={String(totalPax)} />
        </div>
      </Card>

      <div className="space-y-4">
        {days.map((day) => (
          <DayCard
            key={day.id}
            dayNumber={day.dayNumber}
            date={day.date}
            lineItems={day.lineItems.map((li) => ({
              id: li.id,
              category: li.category as LineItemData["category"],
              description: li.description,
              sourceId: li.sourceId,
              quantity: li.quantity,
              totalUsdCents: li.totalUsdCents,
              originalTotalCents: li.originalTotalCents,
              originalCurrency: li.originalCurrency,
              manualOverride: li.manualOverride,
              libraryTotalCents: li.libraryTotalCents,
              libraryCurrency: li.libraryCurrency,
              rateMicros: li.rateMicros,
              data: li.parsedData,
            }))}
            dayTotalUsdCents={day.dayTotalUsdCents}
            onAddItem={() => setAddItemDayId(day.id)}
            onEditItem={(ctx) => setEditContext({ dayId: day.id, edit: ctx })}
          />
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-5">
          <div>
            <p className="text-[13px] text-muted">Total party – {quote.clientName}</p>
            <p className="text-xl font-bold text-foreground">{formatUsd(totalUsdCents)}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-muted">Price per person</p>
            <p className="text-lg font-semibold text-sage-700">{formatUsd(perPersonUsdCents)}</p>
          </div>
        </div>
      </Card>

      {addItemDayId && (
        <AddItemModal
          dayId={addItemDayId}
          quote={quoteContext}
          onClose={() => setAddItemDayId(null)}
          onSaved={() => {
            setAddItemDayId(null);
            router.refresh();
          }}
        />
      )}

      {editContext && (
        <AddItemModal
          dayId={editContext.dayId}
          quote={quoteContext}
          edit={editContext.edit}
          onClose={() => setEditContext(null)}
          onSaved={() => {
            setEditContext(null);
            router.refresh();
          }}
        />
      )}

      {showHeaderForm && (
        <TripHeaderForm quote={quote} onClose={() => setShowHeaderForm(false)} onSaved={() => { setShowHeaderForm(false); router.refresh(); }} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
