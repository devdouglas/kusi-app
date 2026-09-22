"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { CATEGORY_LABELS, type LineItemCategory, type LineItemData } from "@/types/line-items";
import { AccommodationItemForm } from "./forms/accommodation-item-form";
import { TransportItemForm } from "./forms/transport-item-form";
import { TrainItemForm } from "./forms/train-item-form";
import { TransferItemForm } from "./forms/transfer-item-form";
import { ActivityItemForm } from "./forms/activity-item-form";
import { ParkItemForm } from "./forms/park-item-form";
import { FlightItemForm } from "./forms/flight-item-form";
import { VillaItemForm } from "./forms/villa-item-form";
import { MiscItemForm } from "./forms/misc-item-form";

const CATEGORY_ORDER: LineItemCategory[] = [
  "ACCOMMODATION",
  "PRIVATE_TRANSPORT",
  "TRAIN",
  "TAXI_TRANSFER",
  "ACTIVITY",
  "PARK_ENTRANCE_FEE",
  "DOMESTIC_FLIGHT",
  "VILLA",
  "MISC",
];

export interface EditContext {
  lineItemId: string;
  category: LineItemCategory;
  data: LineItemData;
  sourceId: string | null;
  quantity: number | null;
}

export interface QuoteBuilderContext {
  rateMicros: number;
  adults: number;
  childAges: number[];
  totalPax: number;
}

export function AddItemModal({
  dayId,
  quote,
  edit,
  onClose,
  onSaved,
}: {
  dayId: string;
  quote: QuoteBuilderContext;
  edit?: EditContext | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState<LineItemCategory | null>(edit?.category ?? null);

  const title = edit ? `Edit ${CATEGORY_LABELS[edit.category]}` : category ? `Add ${CATEGORY_LABELS[category]}` : "Add item";

  return (
    <Modal open title={title} onClose={onClose} width={category === "ACCOMMODATION" ? "max-w-2xl" : "max-w-lg"}>
      {!category && !edit ? (
        <div className="grid grid-cols-2 gap-2">
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className="rounded-xl border border-border px-4 py-3 text-left text-sm font-medium text-foreground hover:border-sage-400 hover:bg-sage-50"
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      ) : (
        renderForm(edit?.category ?? category!, dayId, quote, edit, onClose, onSaved)
      )}
    </Modal>
  );
}

function renderForm(
  category: LineItemCategory,
  dayId: string,
  quote: QuoteBuilderContext,
  edit: EditContext | null | undefined,
  onClose: () => void,
  onSaved: () => void
) {
  switch (category) {
    case "ACCOMMODATION":
      return (
        <AccommodationItemForm
          dayId={dayId}
          quote={quote}
          initial={edit?.data.category === "ACCOMMODATION" ? edit.data : undefined}
          lineItemId={edit?.lineItemId}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    case "PRIVATE_TRANSPORT":
      return (
        <TransportItemForm
          dayId={dayId}
          quote={quote}
          initialSourceId={edit?.sourceId}
          initialVehicles={edit?.quantity ?? undefined}
          lineItemId={edit?.lineItemId}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    case "TRAIN":
      return (
        <TrainItemForm
          dayId={dayId}
          quote={quote}
          initial={edit?.data.category === "TRAIN" ? edit.data : undefined}
          lineItemId={edit?.lineItemId}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    case "TAXI_TRANSFER":
      return (
        <TransferItemForm
          dayId={dayId}
          quote={quote}
          initial={edit?.data.category === "TAXI_TRANSFER" ? edit.data : undefined}
          lineItemId={edit?.lineItemId}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    case "ACTIVITY":
      return (
        <ActivityItemForm
          dayId={dayId}
          quote={quote}
          initial={edit?.data.category === "ACTIVITY" ? edit.data : undefined}
          lineItemId={edit?.lineItemId}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    case "PARK_ENTRANCE_FEE":
      return (
        <ParkItemForm
          dayId={dayId}
          quote={quote}
          initial={edit?.data.category === "PARK_ENTRANCE_FEE" ? edit.data : undefined}
          lineItemId={edit?.lineItemId}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    case "DOMESTIC_FLIGHT":
      return (
        <FlightItemForm
          dayId={dayId}
          quote={quote}
          initial={edit?.data.category === "DOMESTIC_FLIGHT" ? edit.data : undefined}
          lineItemId={edit?.lineItemId}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    case "VILLA":
      return (
        <VillaItemForm
          dayId={dayId}
          quote={quote}
          initial={edit?.data.category === "VILLA" ? edit.data : undefined}
          lineItemId={edit?.lineItemId}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    case "MISC":
      return (
        <MiscItemForm
          dayId={dayId}
          quote={quote}
          initial={edit?.data.category === "MISC" ? edit.data : undefined}
          lineItemId={edit?.lineItemId}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
  }
}
