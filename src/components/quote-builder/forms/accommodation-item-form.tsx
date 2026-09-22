"use client";

import { useEffect, useMemo, useState } from "react";
import { addAccommodationLineItem, updateAccommodationLineItem } from "@/lib/actions/quotes";
import { listAccommodations, getAccommodation } from "@/lib/actions/rate-library";
import { computeAccommodationPerPersonWithChildren, computeAccommodationPerRoom } from "@/lib/calc/accommodation";
import { bracketLabel } from "@/lib/calc/child-brackets";
import { formatMoney, amountToCents, toUsdCents, type Currency } from "@/lib/money";
import {
  SEASON_LABELS,
  MEAL_PLAN_LABELS,
  isLegacyPerPersonBasis,
  type Season,
  type MealPlan,
  type AccommodationLineData,
} from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { MoneyField } from "@/components/ui/money-field";
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
  quote: { rateMicros: number; adults: number; childAges: number[] };
  initial?: AccommodationLineData;
  lineItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [accommodation, setAccommodation] = useState<AccommodationDetail | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(!!initial);
  const [roomTypeId, setRoomTypeId] = useState(initial?.roomTypeId ?? "");
  const [comboKey, setComboKey] = useState(initial ? `${initial.season}__${initial.mealPlan}` : "");
  const initialPerPerson =
    initial && !isLegacyPerPersonBasis(initial.basis) && initial.basis.pricingBasis === "PER_PERSON" ? initial.basis : null;
  const [adultsSharing, setAdultsSharing] = useState(initialPerPerson?.adultsSharing ?? quote.adults);
  const [adultsSingle, setAdultsSingle] = useState(initialPerPerson?.adultsSingle ?? 0);
  // Accommodation always prices every child on the trip (unlike Park
  // Entrance Fees, which supports excluding individual travellers).
  const childAges = quote.childAges;
  const [infoRooms, setInfoRooms] = useState(initialPerPerson?.totalRooms ?? 0);
  const [infoSingleRooms, setInfoSingleRooms] = useState(initialPerPerson?.singleRooms ?? 0);
  const [roomTotalRooms, setRoomTotalRooms] = useState(
    initial?.basis.pricingBasis === "PER_ROOM" ? initial.basis.totalRooms : 1
  );
  const [roomSingleRooms, setRoomSingleRooms] = useState(
    initial?.basis.pricingBasis === "PER_ROOM" ? initial.basis.singleRooms : 0
  );
  const [manualAmount, setManualAmount] = useState(0);
  const [manualCurrency, setManualCurrency] = useState<Currency>("USD");
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

  const bracketRates = useMemo(() => {
    if (!accommodation || !selectedRate) return [];
    return accommodation.childAgeBrackets
      .map((b) => {
        const priceCents = selectedRate.childRates.find((cr) => cr.bracketId === b.id)?.priceCents;
        return priceCents == null ? null : { id: b.id, minAge: b.minAge, maxAge: b.maxAge, label: b.label, priceCents };
      })
      .filter((b): b is { id: string; minAge: number; maxAge: number; label: string | null; priceCents: number } => b !== null);
  }, [accommodation, selectedRate]);

  const perPersonResult = useMemo(() => {
    if (!accommodation || !selectedRate || accommodation.pricingBasis !== "PER_PERSON") return null;
    if (selectedRate.adultSharingCents == null) return null;
    return computeAccommodationPerPersonWithChildren(
      selectedRate.adultSharingCents,
      selectedRate.singleCents,
      bracketRates,
      childAges,
      adultsSharing,
      adultsSingle,
      accommodation.currency,
      quote.rateMicros
    );
  }, [accommodation, selectedRate, bracketRates, childAges, adultsSharing, adultsSingle, quote.rateMicros]);

  const perRoomResult = useMemo(() => {
    if (!accommodation || !selectedRate || accommodation.pricingBasis !== "PER_ROOM") return null;
    if (selectedRate.standardRoomCents == null) return null;
    return computeAccommodationPerRoom(
      { standardRoomCents: selectedRate.standardRoomCents, singleRoomCents: selectedRate.singleRoomCents },
      { totalRooms: roomTotalRooms, singleRooms: Math.min(roomSingleRooms, roomTotalRooms) },
      accommodation.currency,
      quote.rateMicros
    );
  }, [accommodation, selectedRate, roomTotalRooms, roomSingleRooms, quote.rateMicros]);

  const hasUnmatchedChildren = perPersonResult != null && !perPersonResult.ok;

  // Unified figure for the preview box: the successfully computed
  // per-person/per-room total, or the manual rescue total once unmatched
  // children are resolved that way.
  const previewTotal =
    perRoomResult ??
    (perPersonResult?.ok ? perPersonResult : null) ??
    (hasUnmatchedChildren && manualAmount > 0
      ? {
          originalTotalCents: amountToCents(manualAmount),
          usdTotalCents: toUsdCents(amountToCents(manualAmount), manualCurrency, quote.rateMicros),
        }
      : null);
  const previewCurrency = hasUnmatchedChildren && manualAmount > 0 ? manualCurrency : accommodation?.currency;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accommodation || !roomTypeId || !selectedRate) {
      setError("Select an accommodation, room type, season and meal plan.");
      return;
    }
    if (hasUnmatchedChildren && manualAmount <= 0) {
      setError("Enter a manual total to proceed, or add a matching child age bracket in the Rate Library.");
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
        adultsSingle,
        childAges,
        totalRooms: infoRooms || null,
        singleRooms: infoSingleRooms || null,
        roomTotalRooms,
        roomSingleRooms: Math.min(roomSingleRooms, roomTotalRooms),
        manualTotalOverride: hasUnmatchedChildren ? { amount: manualAmount, currency: manualCurrency } : undefined,
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
              {selectedRate.singleCents != null && (
                <div>
                  <Label>Adults in single occupancy</Label>
                  <Stepper value={adultsSingle} onChange={setAdultsSingle} min={0} />
                </div>
              )}

              {childAges.length > 0 && (
                <div className="border-t border-border pt-4">
                  <Label>Children travelling (from trip passengers)</Label>
                  <p className="text-[12px] text-muted">
                    Ages: {childAges.join(", ")} — matched automatically against {accommodation.name}&rsquo;s age brackets below.
                  </p>
                  <ul className="mt-2 space-y-1 text-[13px]">
                    {bracketRates.map((b) => {
                      const ages = childAges.filter((age) => age >= b.minAge && age <= b.maxAge);
                      if (ages.length === 0) return null;
                      return (
                        <li key={b.id} className="flex items-center justify-between">
                          <span>
                            {bracketLabel(b)}: {ages.length} child{ages.length !== 1 ? "ren" : ""}, age{ages.length !== 1 ? "s" : ""}{" "}
                            {ages.join(", ")}
                          </span>
                          <span className="font-medium text-foreground">
                            {ages.length} × {formatMoney(b.priceCents, accommodation.currency)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {hasUnmatchedChildren && perPersonResult && !perPersonResult.ok && (
                <div className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800">
                  <p>
                    No child rate configured for age{perPersonResult.unmatchedAges.length !== 1 ? "s" : ""}{" "}
                    {perPersonResult.unmatchedAges.join(", ")} at {accommodation.name}. Add a matching age bracket in the Rate Library, or
                    enter a manual total below to proceed.
                  </p>
                  <div className="mt-2">
                    <MoneyField
                      amount={manualAmount}
                      currency={manualCurrency}
                      onAmountChange={setManualAmount}
                      onCurrencyChange={setManualCurrency}
                      rateMicros={quote.rateMicros}
                      placeholder="Manual total for this accommodation"
                    />
                  </div>
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

          {previewTotal && previewCurrency && (
            <div className="rounded-xl bg-sage-50 px-4 py-3 text-sm font-medium text-sage-700">
              {hasUnmatchedChildren ? "Total (manual): " : "Total: "}
              {formatMoney(previewTotal.originalTotalCents, previewCurrency)}
              {previewCurrency !== "USD" && (
                <span className="ml-1 font-normal text-muted">({formatMoney(previewTotal.usdTotalCents, "USD")})</span>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving || !previewTotal}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
