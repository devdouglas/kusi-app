"use client";

import { useState } from "react";
import { updateQuoteHeader } from "@/lib/actions/quotes";
import { Button } from "@/components/ui/button";
import { Input, Label, FormRow } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { Modal } from "@/components/ui/modal";
import { ChildAgesEditor } from "./child-ages-editor";
import type { Quote } from "@prisma/client";

function toDateInput(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

export function TripHeaderForm({
  quote,
  childAges: initialChildAges,
  onClose,
  onSaved,
}: {
  quote: Quote;
  childAges: number[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientName, setClientName] = useState(quote.clientName);
  const [tripTitle, setTripTitle] = useState(quote.tripTitle);
  const [startDate, setStartDate] = useState(toDateInput(quote.startDate));
  const [endDate, setEndDate] = useState(toDateInput(quote.endDate));
  const [adults, setAdults] = useState(quote.adults);
  const [childAges, setChildAges] = useState<number[]>(initialChildAges);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setChildrenCount(count: number) {
    setChildAges((ages) => {
      if (count <= ages.length) return ages.slice(0, count);
      return [...ages, ...Array(count - ages.length).fill(0)];
    });
  }

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
        children: childAges.map((age) => ({ age })),
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
          {childAges.length === 0 ? (
            <button type="button" onClick={() => setChildrenCount(1)} className="mt-3 text-[13px] font-medium text-sage-700 hover:underline">
              + Add children
            </button>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <Label>Children</Label>
                <Stepper value={childAges.length} onChange={setChildrenCount} min={0} />
              </div>
              <ChildAgesEditor ages={childAges} onChange={setChildAges} />
              <button type="button" onClick={() => setChildAges([])} className="text-[13px] font-medium text-muted hover:underline">
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
