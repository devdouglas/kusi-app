"use client";

import { useState } from "react";
import { createPark, updatePark } from "@/lib/actions/rate-library";
import { validateBracketSet } from "@/lib/calc/child-brackets";
import { centsToAmount, type Currency } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Modal } from "@/components/ui/modal";

export interface ParkRecord {
  id: string;
  name: string;
  currency: Currency;
  adultFeeCents: number;
  notes: string | null;
  archived: boolean;
  childBrackets: { id: string; minAge: number; maxAge: number; priceCents: number; label: string | null }[];
}

interface BracketRow {
  key: string;
  minAge: string;
  maxAge: string;
  price: string;
  label: string;
}

let tempKeyCounter = 0;
function tempKey() {
  tempKeyCounter += 1;
  return `new-${Date.now()}-${tempKeyCounter}`;
}

function toBracketRows(initial: ParkRecord | null): BracketRow[] {
  if (!initial) return [];
  return initial.childBrackets.map((b) => ({
    key: b.id,
    minAge: String(b.minAge),
    maxAge: String(b.maxAge),
    price: String(centsToAmount(b.priceCents)),
    label: b.label ?? "",
  }));
}

export function ParkForm({
  initial,
  rateMicros,
  onClose,
  onSaved,
}: {
  initial: ParkRecord | null;
  rateMicros: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [adultFee, setAdultFee] = useState(initial ? centsToAmount(initial.adultFeeCents) : 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [brackets, setBrackets] = useState<BracketRow[]>(() => toBracketRows(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addBracket() {
    setBrackets((rows) => [...rows, { key: tempKey(), minAge: "", maxAge: "", price: "", label: "" }]);
  }
  function updateBracket(key: string, patch: Partial<BracketRow>) {
    setBrackets((rows) => rows.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }
  function removeBracket(key: string) {
    setBrackets((rows) => rows.filter((b) => b.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedBrackets = brackets.map((b) => ({ id: b.key, minAge: Number(b.minAge), maxAge: Number(b.maxAge), label: b.label }));
    const bracketError = validateBracketSet(parsedBrackets);
    if (bracketError) {
      setError(bracketError);
      return;
    }
    if (brackets.some((b) => b.price === "")) {
      setError("Every child age bracket needs a price (use 0 for free entry).");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        currency,
        adultFee,
        notes,
        childBrackets: brackets.map((b) => ({
          id: b.key,
          minAge: Number(b.minAge),
          maxAge: Number(b.maxAge),
          price: Number(b.price),
          label: b.label,
        })),
      };
      if (initial) {
        await updatePark(initial.id, payload);
      } else {
        await createPark(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={initial ? "Edit park" : "Add park"} onClose={onClose} width="max-w-[95vw]">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="name">Park name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="USD">USD</option>
              <option value="KES">KES</option>
            </Select>
          </div>
          <div>
            <Label>Adult entrance fee</Label>
            <MoneyField amount={adultFee} currency={currency} onAmountChange={setAdultFee} onCurrencyChange={setCurrency} rateMicros={rateMicros} />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Child age brackets</Label>
            <Button type="button" size="sm" variant="secondary" onClick={addBracket}>
              + Add age bracket
            </Button>
          </div>
          {brackets.length === 0 ? (
            <p className="text-[13px] text-muted">No child age brackets yet — children will have no price configured until you add one.</p>
          ) : (
            <div className="space-y-2">
              {brackets.map((b) => (
                <div key={b.key} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    placeholder="Min age"
                    value={b.minAge}
                    onChange={(e) => updateBracket(b.key, { minAge: e.target.value })}
                    className="w-20"
                  />
                  <span className="text-muted">–</span>
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    placeholder="Max age"
                    value={b.maxAge}
                    onChange={(e) => updateBracket(b.key, { maxAge: e.target.value })}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Price"
                    value={b.price}
                    onChange={(e) => updateBracket(b.key, { price: e.target.value })}
                    className="w-28"
                  />
                  <div className="min-w-0 flex-1">
                    <Input
                      placeholder="Label (optional)"
                      value={b.label}
                      onChange={(e) => updateBracket(b.key, { label: e.target.value })}
                    />
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeBracket(b.key)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
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
    </Modal>
  );
}
