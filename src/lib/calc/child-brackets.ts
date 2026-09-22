/**
 * Generic child age-bracket matching and validation, shared by Accommodation
 * and Park Entrance Fees (each defines its own brackets — see spec: "the
 * whole purpose of this change is that each supplier/entity may define them
 * differently"). Kept provider-agnostic on purpose: callers attach whatever
 * price/id fields they need to a bracket shape that extends ChildAgeBracket.
 */

export const MIN_CHILD_AGE = 0;
export const MAX_CHILD_AGE = 15;

export interface ChildAgeBracket {
  id: string;
  minAge: number;
  maxAge: number;
  label: string | null;
}

/** "4–11 years", or the stored label if one was given. */
export function bracketLabel(bracket: Pick<ChildAgeBracket, "minAge" | "maxAge" | "label">): string {
  const trimmed = bracket.label?.trim();
  if (trimmed) return trimmed;
  return `${bracket.minAge}–${bracket.maxAge} years`;
}

/** The single bracket whose [minAge, maxAge] range contains `age`, or null if none does. */
export function matchChildToBracket<T extends ChildAgeBracket>(age: number, brackets: T[]): T | null {
  return brackets.find((b) => age >= b.minAge && age <= b.maxAge) ?? null;
}

export interface ChildBracketMatch<T extends ChildAgeBracket> {
  bracket: T;
  ages: number[];
}

export interface ChildBracketMatchResult<T extends ChildAgeBracket> {
  matched: ChildBracketMatch<T>[];
  /** Ages that didn't fall inside any configured bracket — never guess a price for these. */
  unmatchedAges: number[];
}

/** Groups a list of exact child ages by which bracket (if any) each one matches. */
export function matchChildrenToBrackets<T extends ChildAgeBracket>(
  ages: number[],
  brackets: T[]
): ChildBracketMatchResult<T> {
  const agesByBracketId = new Map<string, number[]>();
  const unmatchedAges: number[] = [];

  for (const age of ages) {
    const bracket = matchChildToBracket(age, brackets);
    if (!bracket) {
      unmatchedAges.push(age);
      continue;
    }
    const list = agesByBracketId.get(bracket.id) ?? [];
    list.push(age);
    agesByBracketId.set(bracket.id, list);
  }

  const matched = brackets
    .filter((b) => agesByBracketId.has(b.id))
    .map((bracket) => ({ bracket, ages: agesByBracketId.get(bracket.id)! }));

  return { matched, unmatchedAges };
}

/** Range validity for a single bracket: 0 <= minAge <= maxAge <= 15. */
export function validateAgeBracketRange(minAge: number, maxAge: number): string | null {
  if (!Number.isInteger(minAge) || !Number.isInteger(maxAge)) {
    return "Ages must be whole numbers.";
  }
  if (minAge < MIN_CHILD_AGE) return `Minimum age cannot be below ${MIN_CHILD_AGE}.`;
  if (maxAge > MAX_CHILD_AGE) return `Maximum age cannot be above ${MAX_CHILD_AGE}.`;
  if (minAge > maxAge) return "Minimum age cannot exceed maximum age.";
  return null;
}

/** Index pairs of brackets whose [minAge, maxAge] ranges overlap. */
export function findOverlappingBracketPairs(
  brackets: { minAge: number; maxAge: number }[]
): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < brackets.length; i++) {
    for (let j = i + 1; j < brackets.length; j++) {
      const a = brackets[i];
      const b = brackets[j];
      if (a.minAge <= b.maxAge && b.minAge <= a.maxAge) pairs.push([i, j]);
    }
  }
  return pairs;
}

/**
 * Validates a full set of brackets: every range must be valid on its own,
 * and no two ranges may overlap (spec: age 5 must not match both 0–5 and
 * 5–10). Returns a friendly message describing the first problem found, or
 * null if the set is valid.
 */
export function validateBracketSet(brackets: { minAge: number; maxAge: number }[]): string | null {
  for (const b of brackets) {
    const err = validateAgeBracketRange(b.minAge, b.maxAge);
    if (err) return err;
  }
  const overlaps = findOverlappingBracketPairs(brackets);
  if (overlaps.length > 0) {
    const [i, j] = overlaps[0];
    const a = brackets[i];
    const b = brackets[j];
    return `Age ${a.minAge}–${a.maxAge} overlaps with ${b.minAge}–${b.maxAge}.`;
  }
  return null;
}
