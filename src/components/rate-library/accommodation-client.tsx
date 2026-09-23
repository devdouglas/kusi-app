"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  duplicateAccommodation,
  archiveAccommodation,
  deleteAccommodation,
} from "@/lib/actions/rate-library";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LibraryToolbar } from "@/components/rate-library/library-toolbar";
import { RowActions } from "@/components/rate-library/row-actions";
import { AccommodationForm, type AccommodationRecord } from "@/components/rate-library/accommodation-form";

export function AccommodationLibraryClient({
  items,
  rateMicros,
}: {
  items: AccommodationRecord[];
  rateMicros: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<AccommodationRecord | "new" | null>(null);

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
        addLabel="Add accommodation"
        searchPlaceholder="Search name or location…"
      />

      {filtered.length === 0 ? (
        <Card>
          <p className="px-6 py-8 text-center text-sm text-muted">No accommodations yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((item) => (
            <Card key={item.id} className={item.archived ? "opacity-60" : undefined}>
              <div className="flex items-start justify-between gap-4 px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{item.name}</h3>
                    {item.archived && <Badge tone="neutral">Archived</Badge>}
                    <Badge tone="sage">{item.pricingBasis === "PER_PERSON" ? "Per Person" : "Per Room"}</Badge>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">{item.location}</p>
                  <p className="mt-1.5 text-[12px] text-muted">
                    {item.roomTypes.length} room type{item.roomTypes.length !== 1 ? "s" : ""} · {item.rates.length} rate
                    {item.rates.length !== 1 ? "s" : ""} · {item.currency}
                    {item.activities.length > 0 &&
                      ` · ${item.activities.length} lodge activit${item.activities.length !== 1 ? "ies" : "y"}`}
                  </p>
                </div>
                <RowActions
                  archived={item.archived}
                  onEdit={() => setEditing(item)}
                  onDuplicate={async () => {
                    await duplicateAccommodation(item.id);
                    router.refresh();
                  }}
                  onToggleArchive={async () => {
                    await archiveAccommodation(item.id, !item.archived);
                    router.refresh();
                  }}
                  onDelete={async () => {
                    await deleteAccommodation(item.id);
                    router.refresh();
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <AccommodationForm
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
