"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { duplicatePark, archivePark, deletePark } from "@/lib/actions/rate-library";
import { formatMoney } from "@/lib/money";
import { bracketLabel } from "@/lib/calc/child-brackets";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LibraryToolbar } from "@/components/rate-library/library-toolbar";
import { RowActions } from "@/components/rate-library/row-actions";
import { ParkForm, type ParkRecord } from "@/components/rate-library/park-form";

export function ParkLibraryClient({ items, rateMicros }: { items: ParkRecord[]; rateMicros: number }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ParkRecord | "new" | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => showArchived || !i.archived).filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [items, search, showArchived]);

  return (
    <div className="space-y-4">
      <LibraryToolbar
        search={search}
        onSearchChange={setSearch}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
        onAdd={() => setEditing("new")}
        addLabel="Add park"
        searchPlaceholder="Search park name…"
      />

      {filtered.length === 0 ? (
        <Card>
          <p className="px-6 py-8 text-center text-sm text-muted">No parks yet.</p>
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
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">Adult: {formatMoney(item.adultFeeCents, item.currency)}</p>
                  {item.childBrackets.length > 0 && (
                    <p className="mt-1 text-[12px] text-muted">
                      {item.childBrackets
                        .map((b) => `${bracketLabel(b)}: ${formatMoney(b.priceCents, item.currency)}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <RowActions
                  archived={item.archived}
                  onEdit={() => setEditing(item)}
                  onDuplicate={async () => {
                    await duplicatePark(item.id);
                    router.refresh();
                  }}
                  onToggleArchive={async () => {
                    await archivePark(item.id, !item.archived);
                    router.refresh();
                  }}
                  onDelete={async () => {
                    await deletePark(item.id);
                    router.refresh();
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <ParkForm
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
