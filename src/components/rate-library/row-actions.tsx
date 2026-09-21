"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RowActions({
  archived,
  onEdit,
  onDuplicate,
  onToggleArchive,
  onDelete,
}: {
  archived: boolean;
  onEdit: () => void;
  onDuplicate: () => Promise<void> | void;
  onToggleArchive: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(name: string, fn: () => Promise<void> | void) {
    setError(null);
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" disabled={busy === "dup"} onClick={() => run("dup", onDuplicate)}>
          Duplicate
        </Button>
        <Button size="sm" variant="ghost" disabled={busy === "archive"} onClick={() => run("archive", onToggleArchive)}>
          {archived ? "Unarchive" : "Archive"}
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={busy === "delete"}
          onClick={() => {
            if (confirm("Delete this item permanently? This cannot be undone.")) {
              run("delete", onDelete);
            }
          }}
        >
          Delete
        </Button>
      </div>
      {error && <p className="max-w-56 text-right text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
