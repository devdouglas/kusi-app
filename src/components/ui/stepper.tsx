"use client";

import { cn } from "@/lib/cn";

/**
 * Quantity control: "- N +" with the number also directly typeable, per
 * spec section 53. Used for rooms, vehicles, participants, passengers, etc.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  className,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  disabled?: boolean;
}) {
  function clamp(n: number) {
    let v = Number.isFinite(n) ? Math.trunc(n) : min;
    if (v < min) v = min;
    if (max != null && v > max) v = max;
    return v;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl border border-border bg-white",
        disabled && "opacity-60",
        className
      )}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-l-xl text-foreground/70 hover:bg-sage-50 disabled:text-muted disabled:hover:bg-transparent"
        aria-label="Decrease"
      >
        {"−"}
      </button>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="h-9 w-14 border-x border-border text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        disabled={disabled || (max != null && value >= max)}
        onClick={() => onChange(clamp(value + 1))}
        className="flex h-9 w-9 items-center justify-center rounded-r-xl text-foreground/70 hover:bg-sage-50 disabled:text-muted disabled:hover:bg-transparent"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
