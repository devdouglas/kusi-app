"use client";

import { useState } from "react";
import { addActivityLineItem, addActivityManualLineItem, updateActivityLineItem, updateActivityManualLineItem } from "@/lib/actions/quotes";
import { listActivityRates } from "@/lib/actions/rate-library";
import { computeActivityTotal } from "@/lib/calc/simple";
import { formatMoney, amountToCents, type Currency } from "@/lib/money";
import type { ActivityLineData } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { MoneyField } from "@/components/ui/money-field";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";

export function ActivityItemForm({
  dayId,
  quote,
  initial,
  lineItemId,
  onClose,
  onSaved,
}: {
  dayId: string;
  quote: { rateMicros: number; totalPax: number };
  initial?: ActivityLineData;
  lineItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"library" | "manual" | "pick">(initial ? (initial.activityId ? "library" : "manual") : "pick");
  const [activityId, setActivityId] = useState<string | null>(initial?.activityId ?? null);
  const [name, setName] = useState(initial?.activityName ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [libraryPrice, setLibraryPrice] = useState({ cents: initial?.priceCentsPerParticipant ?? 0, currency: (initial?.currency ?? "USD") as Currency });
  const [manualAmount, setManualAmount] = useState(!initial?.activityId && initial ? initial.priceCentsPerParticipant / 100 : 0);
  const [manualCurrency, setManualCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [participants, setParticipants] = useState(initial?.participants ?? quote.totalPax);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function fetchOptions(query: string): Promise<SearchableSelectOption[]> {
    const results = await listActivityRates({ search: query });
    return results.map((r) => ({ id: r.id, label: r.name, sublabel: `${r.location} · ${formatMoney(r.priceCents, r.currency)}` }));
  }

  async function handleSelect(opt: SearchableSelectOption | "pinned") {
    if (opt === "pinned") {
      setMode("manual");
      setActivityId(null);
      return;
    }
    const results = await listActivityRates({ search: opt.label });
    const rate = results.find((r) => r.id === opt.id);
    if (!rate) return;
    setMode("library");
    setActivityId(rate.id);
    setName(rate.name);
    setLocation(rate.location);
    setLibraryPrice({ cents: rate.priceCents, currency: rate.currency });
  }

  const preview =
    mode === "library"
      ? computeActivityTotal(libraryPrice.cents, participants, libraryPrice.currency, quote.rateMicros)
      : mode === "manual"
        ? computeActivityTotal(amountToCents(manualAmount), participants, manualCurrency, quote.rateMicros)
        : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (mode === "library" && activityId) {
        const payload = { dayId, activityId, participants };
        if (lineItemId) await updateActivityLineItem(lineItemId, payload);
        else await addActivityLineItem(payload);
      } else if (mode === "manual") {
        if (!name.trim()) throw new Error("Activity name is required.");
        const payload = { dayId, name, location, price: manualAmount, currency: manualCurrency, participants };
        if (lineItemId) await updateActivityManualLineItem(lineItemId, payload);
        else await addActivityManualLineItem(payload);
      } else {
        throw new Error("Select an activity.");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Activity</Label>
        {mode === "pick" ? (
          <SearchableSelect
            placeholder="Search activities…"
            pinnedOption={{ label: "Other / Manual Activity" }}
            fetchOptions={fetchOptions}
            onSelect={handleSelect}
          />
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2 text-sm">
            <span>{mode === "manual" ? "Other / Manual Activity" : name}</span>
            <button type="button" className="text-[12px] font-medium text-sage-700 hover:underline" onClick={() => setMode("pick")}>
              Change
            </button>
          </div>
        )}
      </div>

      {mode === "manual" && (
        <>
          <div>
            <Label htmlFor="name">Activity name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <Label>Price per participant</Label>
            <MoneyField
              amount={manualAmount}
              currency={manualCurrency}
              onAmountChange={setManualAmount}
              onCurrencyChange={setManualCurrency}
              rateMicros={quote.rateMicros}
            />
          </div>
        </>
      )}

      {mode !== "pick" && (
        <div>
          <Label>Number of participants</Label>
          <Stepper value={participants} onChange={setParticipants} min={1} />
        </div>
      )}

      {preview && (
        <div className="rounded-xl bg-sage-50 px-4 py-3 text-sm font-medium text-sage-700">
          Total: {formatMoney(preview.originalTotalCents, mode === "library" ? libraryPrice.currency : manualCurrency)}
          {(mode === "library" ? libraryPrice.currency : manualCurrency) !== "USD" && (
            <span className="ml-1 font-normal text-muted">({formatMoney(preview.usdTotalCents, "USD")})</span>
          )}
        </div>
      )}

      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving || mode === "pick"}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
