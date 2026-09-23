"use client";

import { useEffect, useMemo, useState } from "react";
import { addLodgeActivityLineItem, updateLodgeActivityLineItem } from "@/lib/actions/quotes";
import { listAccommodationActivities } from "@/lib/actions/rate-library";
import type { AccommodationActivityRecord } from "@/components/rate-library/lodge-activities-section";
import { computeLodgeActivityTotal } from "@/lib/calc/simple";
import { formatMoney } from "@/lib/money";
import type { LodgeActivityLineData } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";

export function LodgeActivityItemForm({
  dayId,
  quote,
  initial,
  lineItemId,
  onClose,
  onSaved,
}: {
  dayId: string;
  quote: { rateMicros: number; totalPax: number; accommodationsInQuote: { id: string; name: string }[] };
  initial?: LodgeActivityLineData;
  lineItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const accommodationOptions = useMemo(() => {
    if (!initial) return quote.accommodationsInQuote;
    if (quote.accommodationsInQuote.some((a) => a.id === initial.accommodationId)) return quote.accommodationsInQuote;
    // The accommodation may since have been removed from the quote; keep the
    // existing line item editable rather than breaking on an orphaned id.
    return [...quote.accommodationsInQuote, { id: initial.accommodationId, name: initial.accommodationName }];
  }, [quote.accommodationsInQuote, initial]);

  const [accommodationId, setAccommodationId] = useState(initial?.accommodationId ?? accommodationOptions[0]?.id ?? "");
  const [activities, setActivities] = useState<AccommodationActivityRecord[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(!!accommodationId);
  const [activityId, setActivityId] = useState(initial?.activityId ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? quote.totalPax);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accommodationId) return;
    let cancelled = false;
    // Archived activities are included so an existing line item referencing
    // one that's since been archived can still be viewed/edited.
    listAccommodationActivities(accommodationId, { includeArchived: true }).then((rows) => {
      if (cancelled) return;
      setActivities(rows);
      setLoadingActivities(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accommodationId]);

  const selectedActivity = activities.find((a) => a.id === activityId) ?? null;

  function handleSelectActivity(id: string) {
    setActivityId(id);
    const activity = activities.find((a) => a.id === id);
    if (activity) setQuantity(activity.pricingBasis === "PER_PERSON" ? quote.totalPax : 1);
  }

  const effectiveQuantity = selectedActivity?.pricingBasis === "FIXED_PRICE" ? 1 : quantity;
  const preview = selectedActivity
    ? computeLodgeActivityTotal(selectedActivity.amountCents, effectiveQuantity, selectedActivity.currency, quote.rateMicros)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accommodationId) {
      setError("Select an accommodation.");
      return;
    }
    if (!selectedActivity) {
      setError("Select a Lodge Activity.");
      return;
    }
    setSaving(true);
    try {
      const payload = { dayId, accommodationId, activityId: selectedActivity.id, quantity: effectiveQuantity };
      if (lineItemId) await updateLodgeActivityLineItem(lineItemId, payload);
      else await addLodgeActivityLineItem(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (accommodationOptions.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-muted">
          Add an accommodation to this quote first — its Lodge Activities will then be available here.
        </p>
        <div className="flex justify-end border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="accommodation">Accommodation</Label>
        <Select
          id="accommodation"
          value={accommodationId}
          onChange={(e) => {
            setAccommodationId(e.target.value);
            setActivityId("");
            setLoadingActivities(true);
          }}
        >
          {accommodationOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="activity">Lodge Activity</Label>
        {loadingActivities ? (
          <p className="text-[13px] text-muted">Loading…</p>
        ) : activities.length === 0 ? (
          <p className="text-[13px] text-muted">This accommodation has no Lodge Activities yet.</p>
        ) : (
          <Select id="activity" value={activityId} onChange={(e) => handleSelectActivity(e.target.value)}>
            <option value="">Select…</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id} disabled={a.archived && a.id !== initial?.activityId}>
                {a.name} — {formatMoney(a.amountCents, a.currency)}
                {a.archived ? " (archived)" : ""}
              </option>
            ))}
          </Select>
        )}
      </div>

      {selectedActivity && (
        <>
          {selectedActivity.pricingBasis !== "FIXED_PRICE" && (
            <div>
              <Label>{selectedActivity.pricingBasis === "PER_PERSON" ? "Participants" : "Number of groups"}</Label>
              <Stepper value={quantity} onChange={setQuantity} min={1} />
              {selectedActivity.pricingBasis === "PER_PERSON" && (
                <p className="mt-1 text-[12px] text-muted">Defaults to the full trip party; adjust if not everyone is joining.</p>
              )}
            </div>
          )}
          {selectedActivity.notes && <p className="text-[13px] text-muted">{selectedActivity.notes}</p>}
        </>
      )}

      {preview && selectedActivity && (
        <div className="rounded-xl bg-sage-50 px-4 py-3 text-sm font-medium text-sage-700">
          Total: {formatMoney(preview.originalTotalCents, selectedActivity.currency)}
          {selectedActivity.currency !== "USD" && (
            <span className="ml-1 font-normal text-muted">({formatMoney(preview.usdTotalCents, "USD")})</span>
          )}
        </div>
      )}

      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving || !selectedActivity}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
