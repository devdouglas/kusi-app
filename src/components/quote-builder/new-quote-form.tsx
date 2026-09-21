"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuote } from "@/lib/actions/quotes";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FormRow } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";

export function NewQuoteForm() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [tripTitle, setTripTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [hasChildren, setHasChildren] = useState(false);
  const [children5to12, setChildren5to12] = useState(0);
  const [childrenUnder5, setChildrenUnder5] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalPax = adults + (hasChildren ? children5to12 + childrenUnder5 : 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!startDate || !endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError("End date cannot be before start date.");
      return;
    }
    setSubmitting(true);
    try {
      const quote = await createQuote({
        clientName,
        tripTitle,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        adults,
        children5to12: hasChildren ? children5to12 : 0,
        childrenUnder5: hasChildren ? childrenUnder5 : 0,
      });
      router.push(`/quotes/${quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create the quote.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <h2 className="text-base font-semibold text-foreground">Trip information</h2>
      </CardHeader>
      <CardBody>
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

          <div className="border-t border-border pt-5">
            <div className="flex items-center justify-between">
              <Label htmlFor="adults">Adults</Label>
            </div>
            <Stepper value={adults} onChange={setAdults} min={1} />

            {!hasChildren ? (
              <button
                type="button"
                onClick={() => setHasChildren(true)}
                className="mt-3 text-[13px] font-medium text-sage-700 hover:underline"
              >
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

            <p className="mt-4 text-sm text-muted">
              Total Pax: <span className="font-semibold text-foreground">{totalPax}</span>
            </p>
          </div>

          {error && <p className="text-[13px] text-red-600">{error}</p>}

          <div className="flex justify-end border-t border-border pt-4">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create Quote"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
