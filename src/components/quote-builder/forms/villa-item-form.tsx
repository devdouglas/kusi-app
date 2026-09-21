"use client";

import { useMemo, useState } from "react";
import { addVillaLineItem, updateVillaLineItem } from "@/lib/actions/quotes";
import { computeVillaTotal } from "@/lib/calc/simple";
import { formatMoney, amountToCents, centsToAmount, type Currency } from "@/lib/money";
import type { VillaLineData } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { MoneyField } from "@/components/ui/money-field";

export function VillaItemForm({
  dayId,
  quote,
  initial,
  lineItemId,
  onClose,
  onSaved,
}: {
  dayId: string;
  quote: { rateMicros: number };
  initial?: VillaLineData;
  lineItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [villaName, setVillaName] = useState(initial?.villaName ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [amount, setAmount] = useState(initial ? centsToAmount(initial.nightlyRateCents) : 0);
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [nights, setNights] = useState(initial?.nights ?? 1);
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () => computeVillaTotal(amountToCents(amount), nights, quantity, currency, quote.rateMicros),
    [amount, nights, quantity, currency, quote.rateMicros]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!villaName.trim()) {
      setError("Villa name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { dayId, villaName, location, price: amount, currency, nights, quantity, notes };
      if (lineItemId) {
        await updateVillaLineItem(lineItemId, payload);
      } else {
        await addVillaLineItem(payload);
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
        <Label htmlFor="villaName">Villa name</Label>
        <Input id="villaName" value={villaName} onChange={(e) => setVillaName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="location">Town / location</Label>
        <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div>
        <Label>Price per night</Label>
        <MoneyField amount={amount} currency={currency} onAmountChange={setAmount} onCurrencyChange={setCurrency} rateMicros={quote.rateMicros} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Number of nights</Label>
          <Stepper value={nights} onChange={setNights} min={1} />
        </div>
        <div>
          <Label>Quantity (villas)</Label>
          <Stepper value={quantity} onChange={setQuantity} min={1} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
