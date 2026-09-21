"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTransportRate,
  updateTransportRate,
  duplicateTransportRate,
  archiveTransportRate,
  deleteTransportRate,
} from "@/lib/actions/rate-library";
import { formatMoney, centsToAmount, type Currency } from "@/lib/money";
import { VEHICLE_TYPE_LABELS, type VehicleType } from "@/types/line-items";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { LibraryToolbar } from "@/components/rate-library/library-toolbar";
import { RowActions } from "@/components/rate-library/row-actions";

interface TransportRate {
  id: string;
  vehicleType: VehicleType;
  priceCents: number;
  currency: Currency;
  notes: string | null;
  archived: boolean;
}

const VEHICLE_TYPES: VehicleType[] = ["VAN", "JEEP_5PAX", "JEEP_8PAX"];

export function TransportLibraryClient({ items, rateMicros }: { items: TransportRate[]; rateMicros: number }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<TransportRate | "new" | null>(null);

  const filtered = useMemo(() => {
    return items
      .filter((i) => showArchived || !i.archived)
      .filter((i) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return VEHICLE_TYPE_LABELS[i.vehicleType].toLowerCase().includes(q) || (i.notes ?? "").toLowerCase().includes(q);
      });
  }, [items, search, showArchived]);

  return (
    <div className="space-y-4">
      <LibraryToolbar
        search={search}
        onSearchChange={setSearch}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
        onAdd={() => setEditing("new")}
        addLabel="Add vehicle rate"
        searchPlaceholder="Search vehicle type or notes…"
      />

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">No rates yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-medium uppercase tracking-wide text-muted">
                <th className="px-6 py-3">Vehicle Type</th>
                <th className="px-6 py-3">Price / vehicle / day</th>
                <th className="px-6 py-3">Notes</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className={item.archived ? "opacity-60" : undefined}>
                  <td className="px-6 py-3 font-medium text-foreground">
                    {VEHICLE_TYPE_LABELS[item.vehicleType]}
                    {item.archived && (
                      <Badge tone="neutral" >
                        {" "}Archived
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-3">{formatMoney(item.priceCents, item.currency)}</td>
                  <td className="px-6 py-3 text-muted">{item.notes || "—"}</td>
                  <td className="px-6 py-3">
                    <RowActions
                      archived={item.archived}
                      onEdit={() => setEditing(item)}
                      onDuplicate={async () => {
                        await duplicateTransportRate(item.id);
                        router.refresh();
                      }}
                      onToggleArchive={async () => {
                        await archiveTransportRate(item.id, !item.archived);
                        router.refresh();
                      }}
                      onDelete={async () => {
                        await deleteTransportRate(item.id);
                        router.refresh();
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <TransportForm
          rateMicros={rateMicros}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TransportForm({
  initial,
  rateMicros,
  onClose,
  onSaved,
}: {
  initial: TransportRate | null;
  rateMicros: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vehicleType, setVehicleType] = useState<VehicleType>(initial?.vehicleType ?? "VAN");
  const [amount, setAmount] = useState(initial ? centsToAmount(initial.priceCents) : 0);
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { vehicleType, price: amount, currency, notes };
      if (initial) {
        await updateTransportRate(initial.id, payload);
      } else {
        await createTransportRate(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={initial ? "Edit vehicle rate" : "Add vehicle rate"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="vehicleType">Vehicle type</Label>
          <Select id="vehicleType" value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)}>
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {VEHICLE_TYPE_LABELS[v]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Price per vehicle per day</Label>
          <MoneyField amount={amount} currency={currency} onAmountChange={setAmount} onCurrencyChange={setCurrency} rateMicros={rateMicros} />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
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
