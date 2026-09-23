"use client";

import { useState } from "react";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ExportModal } from "@/components/rate-library/export-modal";

export function LibraryToolbar({
  search,
  onSearchChange,
  showArchived,
  onShowArchivedChange,
  onAdd,
  addLabel,
  searchPlaceholder = "Search…",
}: {
  search: string;
  onSearchChange: (v: string) => void;
  showArchived: boolean;
  onShowArchivedChange: (v: boolean) => void;
  onAdd: () => void;
  addLabel: string;
  searchPlaceholder?: string;
}) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-64"
        />
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => onShowArchivedChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-[#8A9270]"
          />
          Show archived
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => setExportOpen(true)}>
          Export to Excel
        </Button>
        <Button variant="primary" onClick={onAdd}>
          + {addLabel}
        </Button>
      </div>
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
