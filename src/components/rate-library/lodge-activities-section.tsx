"use client";

import { useState } from "react";
import {
  createAccommodationActivity,
  updateAccommodationActivity,
  duplicateAccommodationActivity,
  archiveAccommodationActivity,
  deleteAccommodationActivity,
} from "@/lib/actions/rate-library";
import { centsToAmount, formatMoney, type Currency } from "@/lib/money";
import { LODGE_ACTIVITY_PRICING_BASIS_LABELS, type LodgeActivityPricingBasis } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Modal } from "@/components/ui/modal";
import { RowActions } from "@/components/rate-library/row-actions";

export interface AccommodationActivityRecord {
  id: string;
  accommodationId: string;
  name: string;
  pricingBasis: LodgeActivityPricingBasis;
  amountCents: number;
  currency: Currency;
  notes: string | null;
  archived: boolean;
}

const PRICING_BASES: LodgeActivityPricingBasis[] = ["PER_PERSON", "PER_GROUP", "FIXED_PRICE"];

/**
 * Lodge Activities belong to one accommodation and are managed as their own
 * small CRUD list inside the Accommodation Rate Library record — never
 * mixed into the room-rate grid (different data, per spec) and never
 * surfaced as general standalone Activities.
 */
export function LodgeActivitiesSection({
  accommodationId,
  activities,
  rateMicros,
  onChange,
}: {
  accommodationId: string;
  activities: AccommodationActivityRecord[];
  rateMicros: number;
  onChange: (activities: AccommodationActivityRecord[]) => void;
}) {
  const [editing, setEditing] = useState<AccommodationActivityRecord | "new" | null>(null);

  function upsert(record: AccommodationActivityRecord) {
    const exists = activities.some((a) => a.id === record.id);
    onChange(exists ? activities.map((a) => (a.id === record.id ? record : a)) : [...activities, record]);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <Label>Lodge Activities</Label>
          <p className="text-[12px] text-muted">Activities offered only to guests staying at this accommodation.</p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setEditing("new")}>
          + Add Activity
        </Button>
      </div>

      {activities.length === 0 ? (
        <p className="text-[13px] text-muted">No Lodge Activities yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-sage-50 text-left text-[11px] font-medium uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Activity</th>
                <th className="px-3 py-2">Pricing Basis</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activities.map((a) => (
                <tr key={a.id} className={a.archived ? "opacity-60" : undefined}>
                  <td className="px-3 py-2 font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">
                      {a.name}
                      {a.archived && <Badge tone="neutral">Archived</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{LODGE_ACTIVITY_PRICING_BASIS_LABELS[a.pricingBasis]}</td>
                  <td className="px-3 py-2 text-muted">{formatMoney(a.amountCents, a.currency)}</td>
                  <td className="px-3 py-2 text-muted">{a.notes || "—"}</td>
                  <td className="px-3 py-2">
                    <RowActions
                      archived={a.archived}
                      onEdit={() => setEditing(a)}
                      onDuplicate={async () => {
                        const copy = await duplicateAccommodationActivity(a.id);
                        onChange([...activities, copy]);
                      }}
                      onToggleArchive={async () => {
                        await archiveAccommodationActivity(a.id, !a.archived);
                        onChange(activities.map((row) => (row.id === a.id ? { ...row, archived: !row.archived } : row)));
                      }}
                      onDelete={async () => {
                        await deleteAccommodationActivity(a.id);
                        onChange(activities.filter((row) => row.id !== a.id));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <LodgeActivityFormModal
          accommodationId={accommodationId}
          initial={editing === "new" ? null : editing}
          rateMicros={rateMicros}
          onClose={() => setEditing(null)}
          onSaved={(record) => {
            upsert(record);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function LodgeActivityFormModal({
  accommodationId,
  initial,
  rateMicros,
  onClose,
  onSaved,
}: {
  accommodationId: string;
  initial: AccommodationActivityRecord | null;
  rateMicros: number;
  onClose: () => void;
  onSaved: (record: AccommodationActivityRecord) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [pricingBasis, setPricingBasis] = useState<LodgeActivityPricingBasis>(initial?.pricingBasis ?? "PER_PERSON");
  const [amount, setAmount] = useState(initial ? centsToAmount(initial.amountCents) : 0);
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Activity name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), pricingBasis, amount, currency, notes };
      const saved = initial
        ? await updateAccommodationActivity(initial.id, payload)
        : await createAccommodationActivity(accommodationId, payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={initial ? "Edit Lodge Activity" : "Add Lodge Activity"} onClose={onClose} width="max-w-[95vw]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="activityName">Activity name</Label>
          <Input id="activityName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Guided Bush Walk" required />
        </div>
        <div>
          <Label htmlFor="pricingBasis">Pricing basis</Label>
          <Select id="pricingBasis" value={pricingBasis} onChange={(e) => setPricingBasis(e.target.value as LodgeActivityPricingBasis)}>
            {PRICING_BASES.map((b) => (
              <option key={b} value={b}>
                {LODGE_ACTIVITY_PRICING_BASIS_LABELS[b]}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-[12px] text-muted">
            {pricingBasis === "PER_PERSON" && "Multiplied by the number of participants when added to a quote."}
            {pricingBasis === "PER_GROUP" && "One amount per group/activity booking; quantity can be increased in the quote."}
            {pricingBasis === "FIXED_PRICE" && "Used once, exactly as entered."}
          </p>
        </div>
        <div>
          <Label>Price</Label>
          <MoneyField amount={amount} currency={currency} onAmountChange={setAmount} onCurrencyChange={setCurrency} rateMicros={rateMicros} />
        </div>
        <div>
          <Label htmlFor="activityNotes">Notes (optional)</Label>
          <Textarea id="activityNotes" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
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
