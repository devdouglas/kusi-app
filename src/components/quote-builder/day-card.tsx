"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/money";
import { formatFullDate } from "@/lib/calc/trip-dates";
import { LineItemRow, type LineItemRowData } from "./line-item-row";
import type { EditContext } from "./add-item-modal";

export function DayCard({
  dayNumber,
  date,
  lineItems,
  dayTotalUsdCents,
  onAddItem,
  onEditItem,
}: {
  dayNumber: number;
  date: Date;
  lineItems: LineItemRowData[];
  dayTotalUsdCents: number;
  onAddItem: () => void;
  onEditItem: (ctx: EditContext) => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Day {dayNumber}</h3>
          <p className="text-[13px] text-muted">{formatFullDate(date)}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onAddItem}>
          + Add Item
        </Button>
      </div>
      <div className="space-y-2.5 px-6 py-4">
        {lineItems.length === 0 ? (
          <p className="text-[13px] text-muted">No items yet.</p>
        ) : (
          lineItems.map((item) => <LineItemRow key={item.id} item={item} onEdit={onEditItem} />)
        )}
      </div>
      {lineItems.length > 0 && (
        <div className="border-t border-border px-6 py-3 text-right text-sm font-semibold text-foreground">
          Day Total: {formatUsd(dayTotalUsdCents)}
        </div>
      )}
    </Card>
  );
}
