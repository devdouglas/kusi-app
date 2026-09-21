"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTransferRate,
  updateTransferRate,
  duplicateTransferRate,
  archiveTransferRate,
  deleteTransferRate,
} from "@/lib/actions/rate-library";
import { formatMoney, centsToAmount, type Currency } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { LibraryToolbar } from "@/components/rate-library/library-toolbar";
import { RowActions } from "@/components/rate-library/row-actions";

interface TransferRate {
  id: string;
  route: string;
  priceCents: number;
  currency: Currency;
  notes: string | null;
  archived: boolean;
}

export function TransferLibraryClient({ items, rateMicros }: { items: TransferRate[]; rateMicros: number }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<TransferRate | "new" | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => showArchived || !i.archived).filter((i) => !q || i.route.toLowerCase().includes(q));
  }, [items, search, showArchived]);

  return (
    <div className="space-y-4">
      <LibraryToolbar
        search={search}
        onSearchChange={setSearch}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
        onAdd={() => setEditing("new")}
        addLabel="Add transfer"
        searchPlaceholder="Search transfer route…"
      />
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">No transfers yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-medium uppercase tracking-wide text-muted">
                <th className="px-6 py-3">Transfer / Route</th>
                <th className="px-6 py-3">Price per vehicle</th>
                <th className="px-6 py-3">Notes</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className={item.archived ? "opacity-60" : undefined}>
                  <td className="px-6 py-3 font-medium text-foreground">
                    {item.route} {item.archived && <Badge tone="neutral"> Archived</Badge>}
                  </td>
                  <td className="px-6 py-3">{formatMoney(item.priceCents, item.currency)}</td>
                  <td className="px-6 py-3 text-muted">{item.notes || "—"}</td>
                  <td className="px-6 py-3">
                    <RowActions
                      archived={item.archived}
                      onEdit={() => setEditing(item)}
                      onDuplicate={async () => {
                        await duplicateTransferRate(item.id);
                        router.refresh();
                      }}
                      onToggleArchive={async () => {
                        await archiveTransferRate(item.id, !item.archived);
                        router.refresh();
                      }}
                      onDelete={async () => {
                        await deleteTransferRate(item.id);
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
        <TransferForm
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

function TransferForm({
  initial,
  rateMicros,
  onClose,
  onSaved,
}: {
  initial: TransferRate | null;
  rateMicros: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [route, setRoute] = useState(initial?.route ?? "");
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
      const payload = { route, price: amount, currency, notes };
      if (initial) {
        await updateTransferRate(initial.id, payload);
      } else {
        await createTransferRate(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={initial ? "Edit transfer" : "Add transfer"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="route">Transfer / route name</Label>
          <Input id="route" value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Nairobi Airport → Karen" required />
        </div>
        <div>
          <Label>Price per vehicle</Label>
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
