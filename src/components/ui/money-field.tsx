"use client";

import { Input } from "./field";
import { amountToCents, formatUsdApprox, type Currency } from "@/lib/money";

/** Amount + currency toggle. Shows the live USD equivalent under a KES entry (spec section 5). */
export function MoneyField({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  rateMicros,
  placeholder,
  disabled,
}: {
  amount: number;
  currency: Currency;
  onAmountChange: (amount: number) => void;
  onCurrencyChange: (currency: Currency) => void;
  rateMicros: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex gap-2">
        <Input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={Number.isFinite(amount) ? amount : ""}
          placeholder={placeholder ?? "0.00"}
          disabled={disabled}
          onChange={(e) => onAmountChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="flex-1"
        />
        <div className="inline-flex overflow-hidden rounded-xl border border-border">
          {(["USD", "KES"] as const).map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => onCurrencyChange(c)}
              className={
                "px-3.5 py-2 text-sm font-medium transition-colors " +
                (currency === c ? "bg-sage-500 text-white" : "bg-white text-foreground/70 hover:bg-sage-50")
              }
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {currency === "KES" && amount > 0 && (
        <p className="mt-1.5 text-[12px] text-muted">{formatUsdApprox(amountToCents(amount), rateMicros)}</p>
      )}
    </div>
  );
}
