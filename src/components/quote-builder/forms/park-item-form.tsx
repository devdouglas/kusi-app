"use client";

import { useEffect, useMemo, useState } from "react";
import { addParkLineItem, updateParkLineItem } from "@/lib/actions/quotes";
import { listParks, getPark } from "@/lib/actions/rate-library";
import { computeParkEntranceFee, type ParkChildBracketRate } from "@/lib/calc/park";
import { bracketLabel } from "@/lib/calc/child-brackets";
import { formatMoney, amountToCents, toUsdCents, type Currency } from "@/lib/money";
import { childAgeLabel } from "@/lib/calc/children";
import type { ParkEntranceFeeLineData } from "@/types/line-items";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { MoneyField } from "@/components/ui/money-field";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";

type ParkDetail = NonNullable<Awaited<ReturnType<typeof getPark>>>;

export function ParkItemForm({
  dayId,
  quote,
  initial,
  lineItemId,
  onClose,
  onSaved,
}: {
  dayId: string;
  quote: { rateMicros: number; adults: number; childAges: number[] };
  initial?: ParkEntranceFeeLineData;
  lineItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [park, setPark] = useState<ParkDetail | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(!!initial);
  const [adults, setAdults] = useState(initial?.adults ?? quote.adults);
  // One toggle per trip child (by index), defaulting to included. When
  // editing, pre-select whichever ages were included in the saved snapshot.
  const [included, setIncluded] = useState<boolean[]>(() => quote.childAges.map(() => true));
  const [manualAmount, setManualAmount] = useState(0);
  const [manualCurrency, setManualCurrency] = useState<Currency>("USD");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    getPark(initial.parkId).then((full) => {
      if (cancelled) return;
      if (full) setPark(full);
      setLoadingInitial(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchOptions(query: string): Promise<SearchableSelectOption[]> {
    const results = await listParks({ search: query });
    return results.map((p) => ({ id: p.id, label: p.name, sublabel: formatMoney(p.adultFeeCents, p.currency) }));
  }

  async function handleSelect(opt: SearchableSelectOption | "pinned") {
    if (opt === "pinned") return;
    const full = await getPark(opt.id);
    if (!full) return;
    setPark(full);
  }

  const includedChildAges = quote.childAges.filter((_, i) => included[i]);

  const bracketRates: ParkChildBracketRate[] = useMemo(
    () => (park ? park.childBrackets.map((b) => ({ id: b.id, minAge: b.minAge, maxAge: b.maxAge, label: b.label, priceCents: b.priceCents })) : []),
    [park]
  );

  const calc = useMemo(() => {
    if (!park) return null;
    return computeParkEntranceFee(park.adultFeeCents, bracketRates, adults, includedChildAges, park.currency, quote.rateMicros);
  }, [park, bracketRates, adults, includedChildAges, quote.rateMicros]);

  const hasUnmatchedChildren = calc != null && !calc.ok;

  const previewTotal =
    calc?.ok
      ? calc
      : hasUnmatchedChildren && manualAmount > 0
        ? {
            originalTotalCents: amountToCents(manualAmount),
            usdTotalCents: toUsdCents(amountToCents(manualAmount), manualCurrency, quote.rateMicros),
          }
        : null;
  const previewCurrency = hasUnmatchedChildren && manualAmount > 0 ? manualCurrency : park?.currency;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!park) {
      setError("Select a park.");
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
        parkId: park.id,
        adults,
        childAges: includedChildAges,
        manualTotalOverride: hasUnmatchedChildren ? { amount: manualAmount, currency: manualCurrency } : undefined,
      };
      if (lineItemId) {
        await updateParkLineItem(lineItemId, payload);
      } else {
        await addParkLineItem(payload);
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
        <Label>Park</Label>
        {park ? (
          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2 text-sm">
            <span>{park.name}</span>
            <button type="button" className="text-[12px] font-medium text-sage-700 hover:underline" onClick={() => setPark(null)}>
              Change
            </button>
          </div>
        ) : (
          <SearchableSelect placeholder="Search parks…" minChars={3} fetchOptions={fetchOptions} onSelect={handleSelect} />
        )}
      </div>

      {park && (
        <>
          <div className="space-y-4 rounded-xl border border-border p-4">
            <div>
              <Label>Adults</Label>
              <Stepper value={adults} onChange={setAdults} min={0} max={quote.adults} />
              <p className="mt-1 text-[12px] text-muted">Defaults to the full trip party; reduce if not everyone is visiting.</p>
            </div>

            {quote.childAges.length > 0 && (
              <div className="border-t border-border pt-4">
                <Label>Children travelling</Label>
                <div className="mt-1.5 space-y-1.5">
                  {quote.childAges.map((age, i) => (
                    <label key={i} className="flex items-center gap-2 text-[13px] text-foreground">
                      <input
                        type="checkbox"
                        checked={included[i]}
                        onChange={(e) => setIncluded((rows) => rows.map((v, idx) => (idx === i ? e.target.checked : v)))}
                        className="h-3.5 w-3.5 rounded border-border accent-[#8A9270]"
                      />
                      Age {childAgeLabel(age)}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {includedChildAges.length > 0 && calc?.ok && (
              <ul className="space-y-1 border-t border-border pt-4 text-[13px]">
                {calc.matchedChildren.map((m) => (
                  <li key={m.bracket.id} className="flex items-center justify-between">
                    <span>
                      {bracketLabel(m.bracket)}: {m.ages.length} child{m.ages.length !== 1 ? "ren" : ""}, age
                      {m.ages.length !== 1 ? "s" : ""} {m.ages.join(", ")}
                    </span>
                    <span className="font-medium text-foreground">
                      {m.ages.length} × {formatMoney(m.bracket.priceCents, park.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {hasUnmatchedChildren && calc && !calc.ok && (
              <div className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800">
                <p>
                  No child rate configured for age{calc.unmatchedAges.length !== 1 ? "s" : ""} {calc.unmatchedAges.join(", ")} at{" "}
                  {park.name}. Add a matching age bracket in the Rate Library, or enter a manual total below to proceed.
                </p>
                <div className="mt-2">
                  <MoneyField
                    amount={manualAmount}
                    currency={manualCurrency}
                    onAmountChange={setManualAmount}
                    onCurrencyChange={setManualCurrency}
                    rateMicros={quote.rateMicros}
                    placeholder="Manual total for this park entrance fee"
                  />
                </div>
              </div>
            )}
          </div>

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
