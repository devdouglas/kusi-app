"use client";

import { useEffect, useState } from "react";
import { addTransportLineItem, updateTransportLineItem } from "@/lib/actions/quotes";
import { listTransportRates } from "@/lib/actions/rate-library";
import { computeTransportTotal } from "@/lib/calc/simple";
import { formatMoney } from "@/lib/money";
import { VEHICLE_TYPE_LABELS } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";

interface TransportRateOption {
  id: string;
  vehicleType: "VAN" | "JEEP_5PAX" | "JEEP_8PAX";
  priceCents: number;
  currency: "USD" | "KES";
}

export function TransportItemForm({
  dayId,
  quote,
  initialSourceId,
  initialVehicles,
  lineItemId,
  onClose,
  onSaved,
}: {
  dayId: string;
  quote: { rateMicros: number };
  initialSourceId?: string | null;
  initialVehicles?: number;
  lineItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rates, setRates] = useState<TransportRateOption[] | null>(null);
  const [selectedId, setSelectedId] = useState(initialSourceId ?? "");
  const [vehicles, setVehicles] = useState(initialVehicles ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listTransportRates().then((items) => {
      setRates(items);
      if (!selectedId && items.length > 0) setSelectedId(items[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = rates?.find((r) => r.id === selectedId) ?? null;
  const preview = selected ? computeTransportTotal(selected.priceCents, vehicles, selected.currency, quote.rateMicros) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedId) {
      setError("Select a vehicle type.");
      return;
    }
    setSaving(true);
    try {
      const payload = { dayId, transportRateId: selectedId, vehicles };
      if (lineItemId) {
        await updateTransportLineItem(lineItemId, payload);
      } else {
        await addTransportLineItem(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (!rates) return <p className="py-6 text-center text-sm text-muted">Loading…</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="vehicleType">Vehicle type</Label>
        <Select id="vehicleType" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {rates.length === 0 && <option value="">No vehicle rates in the Rate Library yet</option>}
          {rates.map((r) => (
            <option key={r.id} value={r.id}>
              {VEHICLE_TYPE_LABELS[r.vehicleType]} — {formatMoney(r.priceCents, r.currency)} / day
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Number of vehicles</Label>
        <Stepper value={vehicles} onChange={setVehicles} min={1} />
      </div>
      {preview && (
        <div className="rounded-xl bg-sage-50 px-4 py-3 text-sm font-medium text-sage-700">
          Total: {formatMoney(preview.originalTotalCents, selected!.currency)}
          {selected!.currency !== "USD" && <span className="ml-1 font-normal text-muted">({formatMoney(preview.usdTotalCents, "USD")})</span>}
        </div>
      )}
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving || !selectedId}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
