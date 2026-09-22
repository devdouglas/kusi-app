import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines conditional classes (clsx) and then resolves conflicting
 * Tailwind utilities so the last one wins (twMerge) — e.g. a caller-passed
 * `w-24` reliably overrides a component's own base `w-full`, regardless of
 * which utility Tailwind happened to generate first in the stylesheet.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
