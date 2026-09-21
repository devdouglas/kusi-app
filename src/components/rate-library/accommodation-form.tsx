"use client";

import { useState } from "react";
import { createAccommodation, updateAccommodation } from "@/lib/actions/rate-library";
import { centsToAmount, type Currency } from "@/lib/money";
import { SEASON_LABELS, type Season, type MealPlan, type PricingBasis } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

export interface AccommodationRecord {
  id: string;
  name: string;
  location: string;
  notes: string | null;
  currency: Currency;
  pricingBasis: PricingBasis;
  archived: boolean;
  roomTypes: { id: string; name: string; sortOrder: number }[];
  rates: {
    id: string;
    roomTypeId: string;
    season: Season;
    mealPlan: MealPlan;
    adultSharingCents: number | null;
    child5to12Cents: number | null;
    childUnder5Cents: number | null;
    singleCents: number | null;
    standardRoomCents: number | null;
    singleRoomCents: number | null;
  }[];
}

interface RoomTypeRow {
  key: string;
  name: string;
}

interface RateRow {
  key: string;
  roomTypeKey: string;
  season: Season;
  mealPlan: MealPlan;
  adultSharing: string;
  child5to12: string;
  childUnder5: string;
  single: string;
  standardRoom: string;
  singleRoom: string;
}

const SEASONS: Season[] = ["LOW", "SHOULDER", "HIGH"];
const MEAL_PLANS: MealPlan[] = ["BB", "HB", "FB", "FI"];

let tempKeyCounter = 0;
function tempKey() {
  tempKeyCounter += 1;
  return `new-${Date.now()}-${tempKeyCounter}`;
}

function toRoomTypeRows(initial: AccommodationRecord | null): RoomTypeRow[] {
  if (!initial) return [{ key: tempKey(), name: "" }];
  return initial.roomTypes.map((rt) => ({ key: rt.id, name: rt.name }));
}

function toRateRows(initial: AccommodationRecord | null): RateRow[] {
  if (!initial) return [];
  return initial.rates.map((r) => ({
    key: r.id,
    roomTypeKey: r.roomTypeId,
    season: r.season,
    mealPlan: r.mealPlan,
    adultSharing: r.adultSharingCents != null ? String(centsToAmount(r.adultSharingCents)) : "",
    child5to12: r.child5to12Cents != null ? String(centsToAmount(r.child5to12Cents)) : "",
    childUnder5: r.childUnder5Cents != null ? String(centsToAmount(r.childUnder5Cents)) : "",
    single: r.singleCents != null ? String(centsToAmount(r.singleCents)) : "",
    standardRoom: r.standardRoomCents != null ? String(centsToAmount(r.standardRoomCents)) : "",
    singleRoom: r.singleRoomCents != null ? String(centsToAmount(r.singleRoomCents)) : "",
  }));
}

export function AccommodationForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: AccommodationRecord | null;
  rateMicros: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [pricingBasis, setPricingBasis] = useState<PricingBasis>(initial?.pricingBasis ?? "PER_PERSON");
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>(() => toRoomTypeRows(initial));
  const [rates, setRates] = useState<RateRow[]>(() => toRateRows(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addRoomType() {
    setRoomTypes((rows) => [...rows, { key: tempKey(), name: "" }]);
  }
  function removeRoomType(key: string) {
    setRoomTypes((rows) => rows.filter((r) => r.key !== key));
    setRates((rows) => rows.filter((r) => r.roomTypeKey !== key));
  }
  function renameRoomType(key: string, name: string) {
    setRoomTypes((rows) => rows.map((r) => (r.key === key ? { ...r, name } : r)));
  }

  function addRateRow() {
    setRates((rows) => [
      ...rows,
      {
        key: tempKey(),
        roomTypeKey: roomTypes[0]?.key ?? "",
        season: "LOW",
        mealPlan: "BB",
        adultSharing: "",
        child5to12: "",
        childUnder5: "",
        single: "",
        standardRoom: "",
        singleRoom: "",
      },
    ]);
  }
  function updateRateRow(key: string, patch: Partial<RateRow>) {
    setRates((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRateRow(key: string) {
    setRates((rows) => rows.filter((r) => r.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (roomTypes.some((r) => !r.name.trim())) {
      setError("Every room type needs a name.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        location,
        notes,
        currency,
        pricingBasis,
        roomTypes: roomTypes.map((rt) => ({ id: rt.key, name: rt.name.trim() })),
        rates: rates.map((r) => ({
          roomTypeId: r.roomTypeKey,
          season: r.season,
          mealPlan: r.mealPlan,
          adultSharing: pricingBasis === "PER_PERSON" && r.adultSharing !== "" ? Number(r.adultSharing) : undefined,
          child5to12: pricingBasis === "PER_PERSON" && r.child5to12 !== "" ? Number(r.child5to12) : undefined,
          childUnder5: pricingBasis === "PER_PERSON" && r.childUnder5 !== "" ? Number(r.childUnder5) : undefined,
          single: pricingBasis === "PER_PERSON" && r.single !== "" ? Number(r.single) : undefined,
          standardRoom: pricingBasis === "PER_ROOM" && r.standardRoom !== "" ? Number(r.standardRoom) : undefined,
          singleRoom: pricingBasis === "PER_ROOM" && r.singleRoom !== "" ? Number(r.singleRoom) : undefined,
        })),
      };
      if (initial) {
        await updateAccommodation(initial.id, payload);
      } else {
        await createAccommodation(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={initial ? "Edit accommodation" : "Add accommodation"} onClose={onClose} width="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Accommodation name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="location">Town / location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="USD">USD</option>
              <option value="KES">KES</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="basis">Pricing basis</Label>
            <Select id="basis" value={pricingBasis} onChange={(e) => setPricingBasis(e.target.value as PricingBasis)}>
              <option value="PER_PERSON">Per Person</option>
              <option value="PER_ROOM">Per Room</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Room types</Label>
            <Button type="button" size="sm" variant="secondary" onClick={addRoomType}>
              + Add room type
            </Button>
          </div>
          <div className="space-y-2">
            {roomTypes.map((rt) => (
              <div key={rt.key} className="flex items-center gap-2">
                <Input
                  value={rt.name}
                  onChange={(e) => renameRoomType(rt.key, e.target.value)}
                  placeholder="e.g. Deluxe Tent"
                />
                <Button type="button" size="sm" variant="ghost" onClick={() => removeRoomType(rt.key)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Rates ({currency})</Label>
            <Button type="button" size="sm" variant="secondary" onClick={addRateRow} disabled={roomTypes.length === 0}>
              + Add rate row
            </Button>
          </div>
          {rates.length === 0 ? (
            <p className="text-[13px] text-muted">
              No rates yet — add a row for each room type / season / meal plan combination you have a price for.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-sage-50 text-left text-[11px] font-medium uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">Room</th>
                    <th className="px-3 py-2">Season</th>
                    <th className="px-3 py-2">Meal Plan</th>
                    {pricingBasis === "PER_PERSON" ? (
                      <>
                        <th className="px-3 py-2">Adult Sharing</th>
                        <th className="px-3 py-2">Child 5–12</th>
                        <th className="px-3 py-2">Child &lt;5</th>
                        <th className="px-3 py-2">Single</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2">Standard Room</th>
                        <th className="px-3 py-2">Single Room</th>
                      </>
                    )}
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rates.map((row) => (
                    <tr key={row.key}>
                      <td className="px-3 py-2">
                        <Select
                          value={row.roomTypeKey}
                          onChange={(e) => updateRateRow(row.key, { roomTypeKey: e.target.value })}
                          className="min-w-32 py-1.5"
                        >
                          {roomTypes.map((rt) => (
                            <option key={rt.key} value={rt.key}>
                              {rt.name || "(unnamed)"}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={row.season}
                          onChange={(e) => updateRateRow(row.key, { season: e.target.value as Season })}
                          className="min-w-28 py-1.5"
                        >
                          {SEASONS.map((s) => (
                            <option key={s} value={s}>
                              {SEASON_LABELS[s]}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={row.mealPlan}
                          onChange={(e) => updateRateRow(row.key, { mealPlan: e.target.value as MealPlan })}
                          className="min-w-24 py-1.5"
                        >
                          {MEAL_PLANS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </Select>
                      </td>
                      {pricingBasis === "PER_PERSON" ? (
                        <>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.adultSharing}
                              onChange={(e) => updateRateRow(row.key, { adultSharing: e.target.value })}
                              className="w-24 py-1.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.child5to12}
                              onChange={(e) => updateRateRow(row.key, { child5to12: e.target.value })}
                              className="w-24 py-1.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.childUnder5}
                              onChange={(e) => updateRateRow(row.key, { childUnder5: e.target.value })}
                              className="w-24 py-1.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.single}
                              onChange={(e) => updateRateRow(row.key, { single: e.target.value })}
                              className="w-24 py-1.5"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.standardRoom}
                              onChange={(e) => updateRateRow(row.key, { standardRoom: e.target.value })}
                              className="w-24 py-1.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.singleRoom}
                              onChange={(e) => updateRateRow(row.key, { singleRoom: e.target.value })}
                              className="w-24 py-1.5"
                            />
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeRateRow(row.key)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
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
