"use client";

import { useState } from "react";
import { updateQuoteHeader } from "@/lib/actions/quotes";
import { Button } from "@/components/ui/button";
import { Input, Label, FormRow } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { Modal } from "@/components/ui/modal";
import type { Quote } from "@prisma/client";

function toDateInput(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

export function TripHeaderForm({
  quote,
  onClose,
  onSaved,
}: {
  quote: Quote;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientName, setClientName] = useState(quote.clientName);
  const [tripTitle, setTripTitle] = useState(quote.tripTitle);
  const [startDate, setStartDate] = useState(toDateInput(quote.startDate));
  const [endDate, setEndDate] = useState(toDateInput(quote.endDate));
  const [adults, setAdults] = useState(quote.adults);
  const [hasChildren, setHasChildren] = useState(quote.children5to12 > 0 || quote.childrenUnder5 > 0);
  const [children5to12, setChildren5to12] = useState(quote.children5to12);
  const [childrenUnder5, setChildrenUnder5] = useState(quote.childrenUnder5);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (new Date(endDate) < new Date(startDate)) {
      setError("End date cannot be before start date.");
      return;
    }
    setSaving(true);
    try {
      await updateQuoteHeader(quote.id, {
        clientName,
        tripTitle,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        adults,
        children5to12: hasChildren ? children5to12 : 0,
        childrenUnder5: hasChildren ? childrenUnder5 : 0,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save trip details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Edit trip details" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormRow>
          <div>
            <Label htmlFor="clientName">Client name</Label>
            <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="tripTitle">Trip title</Label>
            <Input id="tripTitle" value={tripTitle} onChange={(e) => setTripTitle(e.target.value)} required />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <Label htmlFor="startDate">Start date</Label>
            <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
        </FormRow>
        <p className="text-[12px] text-muted">
          Changing the dates adds or removes days at the end of the itinerary; items on days that stay in range are kept.
        </p>

        <div className="border-t border-border pt-4">
          <Label>Adults</Label>
          <Stepper value={adults} onChange={setAdults} min={1} />
          {!hasChildren ? (
            <button type="button" onClick={() => setHasChildren(true)} className="mt-3 text-[13px] font-medium text-sage-700 hover:underline">
              + Add children
            </button>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <Label>Children 5–12</Label>
                <Stepper value={children5to12} onChange={setChildren5to12} min={0} />
              </div>
              <div>
                <Label>Children under 5</Label>
                <Stepper value={childrenUnder5} onChange={setChildrenUnder5} min={0} />
              </div>
              <button
                type="button"
                onClick={() => {
                  setHasChildren(false);
                  setChildren5to12(0);
                  setChildrenUnder5(0);
                }}
                className="text-[13px] font-medium text-muted hover:underline"
              >
                Remove children
              </button>
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
