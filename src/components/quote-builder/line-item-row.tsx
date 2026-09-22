"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeLineItem, duplicateLineItem } from "@/lib/actions/quotes";
import { formatUsd, formatMoney } from "@/lib/money";
import {
  CATEGORY_LABELS,
  MEAL_PLAN_LABELS,
  SEASON_LABELS,
  VEHICLE_TYPE_LABELS,
  isLegacyPerPersonBasis,
  type LineItemData,
} from "@/types/line-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OverrideModal } from "./override-modal";
import type { EditContext } from "./add-item-modal";

export interface LineItemRowData {
  id: string;
  category: LineItemData["category"];
  description: string;
  sourceId: string | null;
  quantity: number | null;
  totalUsdCents: number;
  originalTotalCents: number;
  originalCurrency: "USD" | "KES";
  manualOverride: boolean;
  libraryTotalCents: number | null;
  libraryCurrency: "USD" | "KES" | null;
  rateMicros: number;
  data: LineItemData;
}

function bracketLines(brackets: { ages: number[]; label: string }[]): string[] {
  return brackets.map((b) => {
    const noun = b.ages.length === 1 ? "child" : "children";
    const ageWord = b.ages.length === 1 ? "age" : "ages";
    return `${b.label}: ${b.ages.length} ${noun}, ${ageWord} ${[...b.ages].sort((a, c) => a - c).join(", ")}`;
  });
}

function detailLines(data: LineItemData): string[] {
  switch (data.category) {
    case "ACCOMMODATION": {
      const lines = [`${data.roomTypeName} · ${MEAL_PLAN_LABELS[data.mealPlan]} · ${SEASON_LABELS[data.season]}`];
      if (!isLegacyPerPersonBasis(data.basis) && data.basis.pricingBasis === "PER_PERSON") {
        lines.push(...bracketLines(data.basis.childBrackets));
      }
      return lines;
    }
    case "PRIVATE_TRANSPORT":
      return [`${VEHICLE_TYPE_LABELS[data.vehicleType]} × ${data.vehicles}`];
    case "TRAIN":
      return [`${data.trainClass === "FIRST" ? "First Class" : "Second Class"} · ${data.passengers} passenger${data.passengers !== 1 ? "s" : ""}`];
    case "TAXI_TRANSFER":
      return [`${data.vehicles} vehicle${data.vehicles !== 1 ? "s" : ""}`];
    case "ACTIVITY":
      return [`${data.participants} participant${data.participants !== 1 ? "s" : ""}`];
    case "PARK_ENTRANCE_FEE": {
      const lines = data.adults > 0 ? [`${data.adults} adult${data.adults !== 1 ? "s" : ""}`] : [];
      lines.push(...bracketLines(data.childBrackets));
      return lines;
    }
    case "DOMESTIC_FLIGHT":
      return [`${data.passengers} passenger${data.passengers !== 1 ? "s" : ""}`];
    case "VILLA":
      return [`${data.nights} night${data.nights !== 1 ? "s" : ""}${data.quantity > 1 ? ` × ${data.quantity}` : ""}`];
    case "MISC":
      return [`Qty ${data.quantity}`];
    default:
      return [];
  }
}

const CAN_OVERRIDE: Record<LineItemData["category"], boolean> = {
  ACCOMMODATION: true,
  PRIVATE_TRANSPORT: true,
  TRAIN: false, // train already supports inline price edits
  TAXI_TRANSFER: true,
  ACTIVITY: true,
  PARK_ENTRANCE_FEE: true,
  DOMESTIC_FLIGHT: true,
  VILLA: false,
  MISC: false,
};

export function LineItemRow({
  item,
  onEdit,
}: {
  item: LineItemRowData;
  onEdit: (ctx: EditContext) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const details = detailLines(item.data);
  const canOverride = CAN_OVERRIDE[item.category] && item.libraryTotalCents != null;

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-white px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="sage">{CATEGORY_LABELS[item.category]}</Badge>
          {item.manualOverride && <Badge tone="amber">Manual rate</Badge>}
        </div>
        <p className="mt-1 text-sm font-medium text-foreground">{item.description}</p>
        {details.map((line, i) => (
          <p key={i} className="text-[12px] text-muted">
            {line}
          </p>
        ))}
        {item.originalCurrency !== "USD" && (
          <p className="text-[12px] text-muted">{formatMoney(item.originalTotalCents, item.originalCurrency)}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-sm font-semibold text-foreground">{formatUsd(item.totalUsdCents)}</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onEdit({ lineItemId: item.id, category: item.category, data: item.data, sourceId: item.sourceId, quantity: item.quantity })
            }
          >
            Edit
          </Button>
          {canOverride && (
            <Button size="sm" variant="ghost" onClick={() => setShowOverride(true)}>
              Override
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await duplicateLineItem(item.id);
              router.refresh();
            }}
          >
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await removeLineItem(item.id);
              router.refresh();
            }}
          >
            Remove
          </Button>
        </div>
      </div>

      {showOverride && item.libraryTotalCents != null && item.libraryCurrency != null && (
        <OverrideModal
          lineItemId={item.id}
          libraryTotalCents={item.libraryTotalCents}
          libraryCurrency={item.libraryCurrency}
          currentTotalCents={item.originalTotalCents}
          currentCurrency={item.originalCurrency}
          manualOverride={item.manualOverride}
          rateMicros={item.rateMicros}
          onClose={() => setShowOverride(false)}
          onSaved={() => {
            setShowOverride(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
