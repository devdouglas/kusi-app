"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EXPORT_CATEGORY_ORDER, EXPORT_CATEGORY_LABELS, type ExportCategory } from "@/lib/xlsx/types";

const CHECKBOX_CLASS = "h-3.5 w-3.5 rounded border-border accent-[#8A9270]";

export function ExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<ExportCategory>>(new Set(EXPORT_CATEGORY_ORDER));
  const [includeArchived, setIncludeArchived] = useState(false);

  const allSelected = selected.size === EXPORT_CATEGORY_ORDER.length;
  const noneSelected = selected.size === 0;

  function toggleCategory(category: ExportCategory) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(EXPORT_CATEGORY_ORDER));
  }

  const exportUrl = (() => {
    const params = new URLSearchParams();
    params.set("categories", Array.from(selected).join(","));
    if (includeArchived) params.set("archived", "1");
    return `/api/rate-library/export?${params.toString()}`;
  })();

  return (
    <Modal open={open} onClose={onClose} title="Export to Excel" width="max-w-md">
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-foreground/80">Categories</p>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-[12px] font-medium text-sage-600 hover:underline"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="space-y-2 rounded-xl border border-border p-3">
            {EXPORT_CATEGORY_ORDER.map((category) => (
              <label key={category} className="flex items-center gap-2.5 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={selected.has(category)}
                  onChange={() => toggleCategory(category)}
                />
                {EXPORT_CATEGORY_LABELS[category]}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-[13px] text-foreground">
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Include archived rates
        </label>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {noneSelected ? (
            <Button variant="primary" disabled>
              Export to Excel
            </Button>
          ) : (
            <a href={exportUrl} onClick={onClose}>
              <Button variant="primary">Export to Excel</Button>
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}
