"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuote } from "@/lib/actions/quotes";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FormRow } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { ChildAgesEditor } from "./child-ages-editor";

export function NewQuoteForm() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [tripTitle, setTripTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setChildrenCount(count: number) {
    setChildAges((ages) => {
      if (count <= ages.length) return ages.slice(0, count);
      return [...ages, ...Array(count - ages.length).fill(0)];
    });
  }

  const totalPax = adults + childAges.length;

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
        children: childAges.map((age) => ({ age })),
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

            {childAges.length === 0 ? (
              <button
                type="button"
                onClick={() => setChildrenCount(1)}
                className="mt-3 text-[13px] font-medium text-sage-700 hover:underline"
              >
                + Add children
              </button>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <Label>Children</Label>
                  <Stepper value={childAges.length} onChange={setChildrenCount} min={0} />
                </div>
                <ChildAgesEditor ages={childAges} onChange={setChildAges} />
                <button
                  type="button"
                  onClick={() => setChildAges([])}
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
