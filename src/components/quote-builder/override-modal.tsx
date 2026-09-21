"use client";

import { useState } from "react";
import { applyLineItemOverride, clearLineItemOverride } from "@/lib/actions/quotes";
import { formatMoney, centsToAmount, type Currency } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Modal } from "@/components/ui/modal";

export function OverrideModal({
  lineItemId,
  libraryTotalCents,
  libraryCurrency,
  currentTotalCents,
  currentCurrency,
  manualOverride,
  rateMicros,
  onClose,
  onSaved,
}: {
  lineItemId: string;
  libraryTotalCents: number;
  libraryCurrency: Currency;
  currentTotalCents: number;
  currentCurrency: Currency;
  manualOverride: boolean;
  rateMicros: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(centsToAmount(currentTotalCents));
  const [currency, setCurrency] = useState<Currency>(currentCurrency);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleApply() {
    setError(null);
    setSaving(true);
    try {
      await applyLineItemOverride({ lineItemId, amount, currency });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    try {
      await clearLineItemOverride(lineItemId);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revert.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Override price" onClose={onClose} width="max-w-sm">
      <div className="space-y-4">
        <p className="text-[13px] text-muted">
          Library rate: <span className="font-medium text-foreground">{formatMoney(libraryTotalCents, libraryCurrency)}</span>
        </p>
        <div>
          <Label>Quote rate</Label>
          <MoneyField amount={amount} currency={currency} onAmountChange={setAmount} onCurrencyChange={setCurrency} rateMicros={rateMicros} />
        </div>
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {manualOverride ? (
            <Button type="button" variant="ghost" disabled={saving} onClick={handleClear}>
              Revert to library rate
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="primary" disabled={saving} onClick={handleApply}>
              {saving ? "Saving…" : "Apply"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
