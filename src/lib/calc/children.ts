/** "0 / under 1", "1", "2", … "15" — the fixed set of selectable exact child ages. */
export const CHILD_AGE_OPTIONS: { age: number; label: string }[] = Array.from({ length: 16 }, (_, age) => ({
  age,
  label: age === 0 ? "0 / under 1" : String(age),
}));

export function childAgeLabel(age: number): string {
  return age === 0 ? "0 / under 1" : String(age);
}

/** "4 and 11" / "4, 7 and 11" / "4" — a natural-language list of ages, ascending. */
export function formatChildAgesList(ages: number[]): string {
  const sorted = [...ages].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return String(sorted[0]);
  if (sorted.length === 2) return `${sorted[0]} and ${sorted[1]}`;
  return `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

/**
 * "2, ages 4 and 11" / "1, age 7" — the standard passenger-composition
 * phrasing used wherever children are displayed. Returns null when there
 * are no children, so callers can omit the line entirely (spec: never show
 * "Children: 0").
 */
export function formatChildrenSummary(ages: number[]): string | null {
  if (ages.length === 0) return null;
  const noun = ages.length === 1 ? "age" : "ages";
  return `${ages.length}, ${noun} ${formatChildAgesList(ages)}`;
}
