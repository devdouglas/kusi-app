"use client";

import { useState } from "react";
import { addFlightLineItem, addFlightManualLineItem, updateFlightLineItem, updateFlightManualLineItem } from "@/lib/actions/quotes";
import { listFlightRates } from "@/lib/actions/rate-library";
import { computeFlightTotal } from "@/lib/calc/simple";
import { formatMoney, amountToCents, type Currency } from "@/lib/money";
import type { FlightLineData } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { MoneyField } from "@/components/ui/money-field";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";

export function FlightItemForm({
  dayId,
  quote,
  initial,
  lineItemId,
  onClose,
  onSaved,
}: {
  dayId: string;
  quote: { rateMicros: number; totalPax: number };
  initial?: FlightLineData;
  lineItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"library" | "manual" | "pick">(initial ? (initial.isManual ? "manual" : "library") : "pick");
  const [flightId, setFlightId] = useState<string | null>(initial?.flightId ?? null);
  const [route, setRoute] = useState(initial?.route ?? "");
  const [libraryPrice, setLibraryPrice] = useState({ cents: initial?.priceCentsPerPassenger ?? 0, currency: (initial?.currency ?? "USD") as Currency });
  const [manualAmount, setManualAmount] = useState(initial?.isManual && initial ? initial.priceCentsPerPassenger / 100 : 0);
  const [manualCurrency, setManualCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [passengers, setPassengers] = useState(initial?.passengers ?? quote.totalPax);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function fetchOptions(query: string): Promise<SearchableSelectOption[]> {
    const results = await listFlightRates({ search: query });
    return results.map((r) => ({ id: r.id, label: r.route, sublabel: formatMoney(r.priceCents, r.currency) }));
  }

  async function handleSelect(opt: SearchableSelectOption | "pinned") {
    if (opt === "pinned") {
      setMode("manual");
      setFlightId(null);
      return;
    }
    const results = await listFlightRates({ search: opt.label });
    const rate = results.find((r) => r.id === opt.id);
    if (!rate) return;
    setMode("library");
    setFlightId(rate.id);
    setRoute(rate.route);
    setLibraryPrice({ cents: rate.priceCents, currency: rate.currency });
  }

  const preview =
    mode === "library"
      ? computeFlightTotal(libraryPrice.cents, passengers, libraryPrice.currency, quote.rateMicros)
      : mode === "manual"
        ? computeFlightTotal(amountToCents(manualAmount), passengers, manualCurrency, quote.rateMicros)
        : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (mode === "library" && flightId) {
        const payload = { dayId, flightId, passengers };
        if (lineItemId) await updateFlightLineItem(lineItemId, payload);
        else await addFlightLineItem(payload);
      } else if (mode === "manual") {
        if (!route.trim()) throw new Error("Route is required.");
        const payload = { dayId, route, price: manualAmount, currency: manualCurrency, passengers };
        if (lineItemId) await updateFlightManualLineItem(lineItemId, payload);
        else await addFlightManualLineItem(payload);
      } else {
        throw new Error("Select a flight route.");
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
        <Label>Flight route</Label>
        {mode === "pick" ? (
          <SearchableSelect
            placeholder="Search domestic flight routes…"
            pinnedOption={{ label: "Other / Manual Flight" }}
            fetchOptions={fetchOptions}
            onSelect={handleSelect}
          />
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2 text-sm">
            <span>{mode === "manual" ? "Other / Manual Flight" : route}</span>
            <button type="button" className="text-[12px] font-medium text-sage-700 hover:underline" onClick={() => setMode("pick")}>
              Change
            </button>
          </div>
        )}
      </div>

      {mode === "manual" && (
        <>
          <div>
            <Label htmlFor="route">Route</Label>
            <Input id="route" value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Nairobi → Samburu" required />
          </div>
          <div>
            <Label>Price per passenger</Label>
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
          <Label>Number of passengers</Label>
          <Stepper value={passengers} onChange={setPassengers} min={1} />
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
