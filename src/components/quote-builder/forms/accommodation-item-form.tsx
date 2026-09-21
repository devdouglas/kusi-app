"use client";

import { useEffect, useMemo, useState } from "react";
import { addAccommodationLineItem, updateAccommodationLineItem } from "@/lib/actions/quotes";
import { listAccommodations, getAccommodation } from "@/lib/actions/rate-library";
import { computeAccommodationPerPerson, computeAccommodationPerRoom } from "@/lib/calc/accommodation";
import { formatMoney } from "@/lib/money";
import { SEASON_LABELS, MEAL_PLAN_LABELS, type Season, type MealPlan, type AccommodationLineData } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";

type AccommodationDetail = NonNullable<Awaited<ReturnType<typeof getAccommodation>>>;

export function AccommodationItemForm({
  dayId,
  quote,
  initial,
  lineItemId,
  onClose,
  onSaved,
}: {
  dayId: string;
  quote: { rateMicros: number; adults: number; children5to12: number; childrenUnder5: number };
  initial?: AccommodationLineData;
  lineItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [accommodation, setAccommodation] = useState<AccommodationDetail | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(!!initial);
  const [roomTypeId, setRoomTypeId] = useState(initial?.roomTypeId ?? "");
  const [comboKey, setComboKey] = useState(initial ? `${initial.season}__${initial.mealPlan}` : "");
  const [adultsSharing, setAdultsSharing] = useState(
    initial?.basis.pricingBasis === "PER_PERSON" ? initial.basis.adultsSharing : quote.adults
  );
  const [child5to12, setChild5to12] = useState(
    initial?.basis.pricingBasis === "PER_PERSON" ? initial.basis.child5to12 : quote.children5to12
  );
  const [childUnder5, setChildUnder5] = useState(
    initial?.basis.pricingBasis === "PER_PERSON" ? initial.basis.childUnder5 : quote.childrenUnder5
  );
  const [adultsSingle, setAdultsSingle] = useState(
    initial?.basis.pricingBasis === "PER_PERSON" ? initial.basis.adultsSingle : 0
  );
  const [infoRooms, setInfoRooms] = useState(
    (initial?.basis.pricingBasis === "PER_PERSON" ? initial.basis.totalRooms : null) ?? 0
  );
  const [infoSingleRooms, setInfoSingleRooms] = useState(
    (initial?.basis.pricingBasis === "PER_PERSON" ? initial.basis.singleRooms : null) ?? 0
  );
  const [roomTotalRooms, setRoomTotalRooms] = useState(
    initial?.basis.pricingBasis === "PER_ROOM" ? initial.basis.totalRooms : 1
  );
  const [roomSingleRooms, setRoomSingleRooms] = useState(
    initial?.basis.pricingBasis === "PER_ROOM" ? initial.basis.singleRooms : 0
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Resolve the initial accommodation record on first load when editing.
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    getAccommodation(initial.accommodationId).then((full) => {
      if (cancelled) return;
      if (full) setAccommodation(full);
      setLoadingInitial(false);
    });
    return () => {
      cancelled = true;
    };
    // Only run once, on mount, for the initial edit value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchOptions(query: string): Promise<SearchableSelectOption[]> {
    const results = await listAccommodations({ search: query });
    return results.map((a) => ({ id: a.id, label: a.name, sublabel: a.location }));
  }

  async function handleSelectAccommodation(opt: SearchableSelectOption | "pinned") {
    if (opt === "pinned") return;
    const full = await getAccommodation(opt.id);
    if (!full) return;
    setAccommodation(full);
    setRoomTypeId(full.roomTypes[0]?.id ?? "");
    setComboKey("");
  }

  const roomTypeOptions = accommodation?.roomTypes ?? [];

  const comboOptions = useMemo(() => {
    if (!accommodation || !roomTypeId) return [];
    return accommodation.rates
      .filter((r) => r.roomTypeId === roomTypeId)
      .map((r) => ({ key: `${r.season}__${r.mealPlan}`, season: r.season, mealPlan: r.mealPlan, rate: r }));
  }, [accommodation, roomTypeId]);

  const selectedRate = comboOptions.find((c) => c.key === comboKey)?.rate ?? null;

  const preview = useMemo(() => {
    if (!accommodation || !selectedRate) return null;
    if (accommodation.pricingBasis === "PER_PERSON") {
      if (selectedRate.adultSharingCents == null) return null;
      return computeAccommodationPerPerson(
        {
          adultSharingCents: selectedRate.adultSharingCents,
          child5to12Cents: selectedRate.child5to12Cents,
          childUnder5Cents: selectedRate.childUnder5Cents,
          singleCents: selectedRate.singleCents,
        },
        { adultsSharing, child5to12, childUnder5, adultsSingle },
        accommodation.currency,
        quote.rateMicros
      );
    }
    if (selectedRate.standardRoomCents == null) return null;
    return computeAccommodationPerRoom(
      { standardRoomCents: selectedRate.standardRoomCents, singleRoomCents: selectedRate.singleRoomCents },
      { totalRooms: roomTotalRooms, singleRooms: Math.min(roomSingleRooms, roomTotalRooms) },
      accommodation.currency,
      quote.rateMicros
    );
  }, [accommodation, selectedRate, adultsSharing, child5to12, childUnder5, adultsSingle, roomTotalRooms, roomSingleRooms, quote.rateMicros]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accommodation || !roomTypeId || !selectedRate) {
      setError("Select an accommodation, room type, season and meal plan.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        dayId,
        accommodationId: accommodation.id,
        roomTypeId,
        season: selectedRate.season,
        mealPlan: selectedRate.mealPlan,
        adultsSharing,
        child5to12,
        childUnder5,
        adultsSingle,
        totalRooms: infoRooms || null,
        singleRooms: infoSingleRooms || null,
        roomTotalRooms,
        roomSingleRooms: Math.min(roomSingleRooms, roomTotalRooms),
      };
      if (lineItemId) {
        await updateAccommodationLineItem(lineItemId, payload);
      } else {
        await addAccommodationLineItem(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingInitial) return <p className="py-6 text-center text-sm text-muted">Loading…</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Accommodation</Label>
        {accommodation ? (
          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2 text-sm">
            <span>
              {accommodation.name} <span className="text-muted">— {accommodation.location}</span>
            </span>
            <button type="button" className="text-[12px] font-medium text-sage-700 hover:underline" onClick={() => setAccommodation(null)}>
              Change
            </button>
          </div>
        ) : (
          <SearchableSelect placeholder="Search accommodations…" fetchOptions={fetchOptions} onSelect={handleSelectAccommodation} />
        )}
      </div>

      {accommodation && (
        <>
          <div>
            <Label htmlFor="roomType">Room type</Label>
            <Select
              id="roomType"
              value={roomTypeId}
              onChange={(e) => {
                setRoomTypeId(e.target.value);
                setComboKey("");
              }}
            >
              {roomTypeOptions.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="seasonMealPlan">Season / meal plan</Label>
            <Select id="seasonMealPlan" value={comboKey} onChange={(e) => setComboKey(e.target.value)}>
              <option value="">Select…</option>
              {comboOptions.map((c) => (
                <option key={c.key} value={c.key}>
                  {SEASON_LABELS[c.season as Season]} {"—"} {MEAL_PLAN_LABELS[c.mealPlan as MealPlan]}
                </option>
              ))}
            </Select>
            {roomTypeId && comboOptions.length === 0 && (
              <p className="mt-1.5 text-[12px] text-muted">No rates stored yet for this room type.</p>
            )}
          </div>

          {selectedRate && accommodation.pricingBasis === "PER_PERSON" && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <div>
                <Label>Adults sharing</Label>
                <Stepper value={adultsSharing} onChange={setAdultsSharing} min={0} />
              </div>
              {selectedRate.child5to12Cents != null && (
                <div>
                  <Label>Children 5–12</Label>
                  <Stepper value={child5to12} onChange={setChild5to12} min={0} />
                </div>
              )}
              {selectedRate.childUnder5Cents != null && (
                <div>
                  <Label>Children under 5</Label>
                  <Stepper value={childUnder5} onChange={setChildUnder5} min={0} />
                </div>
              )}
              {selectedRate.singleCents != null && (
                <div>
                  <Label>Adults in single occupancy</Label>
                  <Stepper value={adultsSingle} onChange={setAdultsSingle} min={0} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div>
                  <Label>Total rooms (informational)</Label>
                  <Stepper value={infoRooms} onChange={setInfoRooms} min={0} />
                </div>
                <div>
                  <Label>Single rooms (informational)</Label>
                  <Stepper value={infoSingleRooms} onChange={setInfoSingleRooms} min={0} max={infoRooms} />
                </div>
              </div>
            </div>
          )}

          {selectedRate && accommodation.pricingBasis === "PER_ROOM" && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <div>
                <Label>Total rooms</Label>
                <Stepper value={roomTotalRooms} onChange={setRoomTotalRooms} min={1} />
              </div>
              <div>
                <Label>Single rooms</Label>
                <Stepper value={roomSingleRooms} onChange={setRoomSingleRooms} min={0} max={roomTotalRooms} />
              </div>
              <p className="text-[12px] text-muted">Standard rooms: {Math.max(0, roomTotalRooms - roomSingleRooms)}</p>
            </div>
          )}

          {preview && (
            <div className="rounded-xl bg-sage-50 px-4 py-3 text-sm font-medium text-sage-700">
              Total: {formatMoney(preview.originalTotalCents, accommodation.currency)}
              {accommodation.currency !== "USD" && <span className="ml-1 font-normal text-muted">({formatMoney(preview.usdTotalCents, "USD")})</span>}
            </div>
          )}
        </>
      )}

      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving || !preview}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
