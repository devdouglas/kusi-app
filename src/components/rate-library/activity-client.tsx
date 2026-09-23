"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createActivityRate,
  updateActivityRate,
  duplicateActivityRate,
  archiveActivityRate,
  deleteActivityRate,
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

interface ActivityRate {
  id: string;
  name: string;
  location: string;
  priceCents: number;
  currency: Currency;
  notes: string | null;
  archived: boolean;
}

export function ActivityLibraryClient({ items, rateMicros }: { items: ActivityRate[]; rateMicros: number }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ActivityRate | "new" | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => showArchived || !i.archived)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.location.toLowerCase().includes(q));
  }, [items, search, showArchived]);

  return (
    <div className="space-y-4">
      <LibraryToolbar
        search={search}
        onSearchChange={setSearch}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
        onAdd={() => setEditing("new")}
        addLabel="Add activity"
        searchPlaceholder="Search activity or location…"
      />
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">No activities yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-medium uppercase tracking-wide text-muted">
                <th className="px-6 py-3">Activity</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3">Price per participant</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className={item.archived ? "opacity-60" : undefined}>
                  <td className="px-6 py-3 font-medium text-foreground">
                    {item.name} {item.archived && <Badge tone="neutral"> Archived</Badge>}
                  </td>
                  <td className="px-6 py-3 text-muted">{item.location}</td>
                  <td className="px-6 py-3">{formatMoney(item.priceCents, item.currency)}</td>
                  <td className="px-6 py-3">
                    <RowActions
                      archived={item.archived}
                      onEdit={() => setEditing(item)}
                      onDuplicate={async () => {
                        await duplicateActivityRate(item.id);
                        router.refresh();
                      }}
                      onToggleArchive={async () => {
                        await archiveActivityRate(item.id, !item.archived);
                        router.refresh();
                      }}
                      onDelete={async () => {
                        await deleteActivityRate(item.id);
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
        <ActivityForm
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

function ActivityForm({
  initial,
  rateMicros,
  onClose,
  onSaved,
}: {
  initial: ActivityRate | null;
  rateMicros: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
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
      const payload = { name, location, price: amount, currency, notes };
      if (initial) {
        await updateActivityRate(initial.id, payload);
      } else {
        await createActivityRate(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={initial ? "Edit activity" : "Add activity"} onClose={onClose} width="max-w-[95vw]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Activity name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hell's Gate Cycling" required />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Naivasha" required />
        </div>
        <div>
          <Label>Price per participant</Label>
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
