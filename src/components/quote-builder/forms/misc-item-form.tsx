"use client";

import { useMemo, useState } from "react";
import { addMiscLineItem, updateMiscLineItem } from "@/lib/actions/quotes";
import { computeMiscTotal } from "@/lib/calc/simple";
import { formatMoney, amountToCents, centsToAmount, type Currency } from "@/lib/money";
import type { MiscLineData } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { MoneyField } from "@/components/ui/money-field";

export function MiscItemForm({
  dayId,
  quote,
  initial,
  lineItemId,
  onClose,
  onSaved,
}: {
  dayId: string;
  quote: { rateMicros: number };
  initial?: MiscLineData;
  lineItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [itemName, setItemName] = useState(initial?.itemName ?? "");
  const [amount, setAmount] = useState(initial ? centsToAmount(initial.unitPriceCents) : 0);
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () => computeMiscTotal(amountToCents(amount), quantity, currency, quote.rateMicros),
    [amount, quantity, currency, quote.rateMicros]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!itemName.trim()) {
      setError("Item/service name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { dayId, itemName, price: amount, currency, quantity, notes };
      if (lineItemId) {
        await updateMiscLineItem(lineItemId, payload);
      } else {
        await addMiscLineItem(payload);
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
        <Label htmlFor="itemName">Item / service name</Label>
        <Input id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
      </div>
      <div>
        <Label>Unit price</Label>
        <MoneyField amount={amount} currency={currency} onAmountChange={setAmount} onCurrencyChange={setCurrency} rateMicros={quote.rateMicros} />
      </div>
      <div>
        <Label>Quantity</Label>
        <Stepper value={quantity} onChange={setQuantity} min={1} />
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
