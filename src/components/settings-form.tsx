"use client";

import { useState, useTransition } from "react";
import { updateExchangeRateAction } from "@/lib/actions/settings";
import { microsToRateNumber } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export function SettingsForm({ rateMicros }: { rateMicros: number }) {
  const [rate, setRate] = useState(() => microsToRateNumber(rateMicros));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateExchangeRateAction(rate);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save the exchange rate.");
      }
    });
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <h2 className="text-base font-semibold text-foreground">Exchange rate</h2>
        <p className="mt-1 text-sm text-muted">Used for all new quotes. Saved quotes keep the rate they were created with.</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="rate">1 USD =</Label>
            <div className="flex items-center gap-2">
              <Input
                id="rate"
                type="number"
                min={0}
                step="0.0001"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="max-w-40"
              />
              <span className="text-sm text-muted">KES</span>
            </div>
          </div>
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={isPending}>
              Save
            </Button>
            {saved && <span className="text-[13px] text-sage-700">Saved</span>}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
