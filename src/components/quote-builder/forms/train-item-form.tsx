"use client";

import { useMemo, useState } from "react";
import { addTrainLineItem, addTrainManualLineItem, updateTrainLineItem, updateTrainManualLineItem } from "@/lib/actions/quotes";
import { listTrainJourneys } from "@/lib/actions/rate-library";
import { computeTrainTotal } from "@/lib/calc/simple";
import { formatMoney, centsToAmount, amountToCents, type Currency } from "@/lib/money";
import type { TrainLineData, TrainClass } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { MoneyField } from "@/components/ui/money-field";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";

export function TrainItemForm({
  dayId,
  quote,
  initial,
  lineItemId,
  onClose,
  onSaved,
}: {
  dayId: string;
  quote: { rateMicros: number };
  initial?: TrainLineData;
  lineItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [journeyId, setJourneyId] = useState<string | null>(initial?.journeyId ?? null);
  const [trainClass, setTrainClass] = useState<TrainClass>(initial?.trainClass ?? "FIRST");
  const [route, setRoute] = useState(initial?.route ?? "");
  const [amount, setAmount] = useState(initial ? centsToAmount(initial.priceCentsPerPassenger) : 0);
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [passengers, setPassengers] = useState(initial?.passengers ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function fetchOptions(query: string): Promise<SearchableSelectOption[]> {
    const results = await listTrainJourneys({ search: query });
    return results.map((j) => ({
      id: j.id,
      label: j.route,
      sublabel: `1st ${formatMoney(j.firstClassCents, j.currency)} · 2nd ${formatMoney(j.secondClassCents, j.currency)}`,
    }));
  }

  async function handleSelect(opt: SearchableSelectOption | "pinned") {
    if (opt === "pinned") return;
    const journeys = await listTrainJourneys({ search: opt.label });
    const journey = journeys.find((j) => j.id === opt.id);
    if (!journey) return;
    setJourneyId(journey.id);
    setRoute(journey.route);
    setCurrency(journey.currency);
    setAmount(centsToAmount(trainClass === "FIRST" ? journey.firstClassCents : journey.secondClassCents));
  }

  async function handleClassChange(next: TrainClass) {
    setTrainClass(next);
    if (!journeyId) return;
    // Re-sync the price from the library for the newly selected class.
    const journeys = await listTrainJourneys({ search: route });
    const journey = journeys.find((j) => j.id === journeyId);
    if (journey) setAmount(centsToAmount(next === "FIRST" ? journey.firstClassCents : journey.secondClassCents));
  }

  const preview = useMemo(
    () => computeTrainTotal(amountToCents(amount), passengers, currency, quote.rateMicros),
    [amount, passengers, currency, quote.rateMicros]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!route.trim()) {
      setError("Journey description is required.");
      return;
    }
    setSaving(true);
    try {
      if (journeyId) {
        const payload = { dayId, journeyId, trainClass, passengers };
        if (lineItemId) await updateTrainLineItem(lineItemId, payload);
        else await addTrainLineItem(payload);
      } else {
        const payload = { dayId, route, price: amount, currency, passengers };
        if (lineItemId) await updateTrainManualLineItem(lineItemId, payload);
        else await addTrainManualLineItem(payload);
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
        <Label>Journey</Label>
        {journeyId ? (
          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2 text-sm">
            <span>{route}</span>
            <button type="button" className="text-[12px] font-medium text-sage-700 hover:underline" onClick={() => setJourneyId(null)}>
              Change
            </button>
          </div>
        ) : (
          <SearchableSelect placeholder="Search train journeys…" fetchOptions={fetchOptions} onSelect={handleSelect} />
        )}
      </div>

      {journeyId && (
        <div>
          <Label htmlFor="trainClass">Class</Label>
          <Select id="trainClass" value={trainClass} onChange={(e) => handleClassChange(e.target.value as TrainClass)}>
            <option value="FIRST">First Class</option>
            <option value="SECOND">Second Class</option>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="route">Journey description</Label>
        <Input id="route" value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Nairobi → Mombasa" required />
      </div>

      <div>
        <Label>Price per passenger</Label>
        <MoneyField amount={amount} currency={currency} onAmountChange={setAmount} onCurrencyChange={setCurrency} rateMicros={quote.rateMicros} />
      </div>

      <div>
        <Label>Number of passengers</Label>
        <Stepper value={passengers} onChange={setPassengers} min={1} />
      </div>

      <div className="rounded-xl bg-sage-50 px-4 py-3 text-sm font-medium text-sage-700">
        Total: {formatMoney(preview.originalTotalCents, currency)}
        {currency !== "USD" && <span className="ml-1 font-normal text-muted">({formatMoney(preview.usdTotalCents, "USD")})</span>}
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
