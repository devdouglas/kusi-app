import { describe, it, expect } from "vitest";
import {
  matchChildToBracket,
  matchChildrenToBrackets,
  validateAgeBracketRange,
  validateBracketSet,
  findOverlappingBracketPairs,
  bracketLabel,
  type ChildAgeBracket,
} from "./child-brackets";

const BRACKETS: ChildAgeBracket[] = [
  { id: "b1", minAge: 0, maxAge: 4, label: null },
  { id: "b2", minAge: 5, maxAge: 11, label: null },
  { id: "b3", minAge: 12, maxAge: 15, label: null },
];

describe("child age matching", () => {
  it("matches age 4 to the 0-4 bracket", () => {
    expect(matchChildToBracket(4, BRACKETS)?.id).toBe("b1");
  });
  it("matches age 5 to the 5-11 bracket", () => {
    expect(matchChildToBracket(5, BRACKETS)?.id).toBe("b2");
  });
  it("matches age 11 to the 5-11 bracket", () => {
    expect(matchChildToBracket(11, BRACKETS)?.id).toBe("b2");
  });
  it("matches age 12 to the 12-15 bracket", () => {
    expect(matchChildToBracket(12, BRACKETS)?.id).toBe("b3");
  });
  it("returns null for an age with no configured bracket", () => {
    const gappy: ChildAgeBracket[] = [{ id: "b1", minAge: 0, maxAge: 3, label: null }];
    expect(matchChildToBracket(7, gappy)).toBeNull();
  });
});

describe("the same age maps to different brackets under different suppliers", () => {
  it("child age 7: accommodation A -> 5-11, accommodation B -> 7-12", () => {
    const accommodationA: ChildAgeBracket[] = [{ id: "a1", minAge: 5, maxAge: 11, label: null }];
    const accommodationB: ChildAgeBracket[] = [{ id: "b1", minAge: 7, maxAge: 12, label: null }];
    expect(matchChildToBracket(7, accommodationA)?.id).toBe("a1");
    expect(matchChildToBracket(7, accommodationB)?.id).toBe("b1");
  });
});

describe("matchChildrenToBrackets", () => {
  it("groups multiple children into the correct brackets and reports unmatched ages", () => {
    const result = matchChildrenToBrackets([4, 9, 11, 20], BRACKETS);
    // 20 is out of range for every bracket here (max 15 anyway, but this
    // also exercises the "no bracket configured" path independent of the
    // 0-15 validation rule, which is enforced separately at input time).
    expect(result.unmatchedAges).toEqual([20]);
    const b2 = result.matched.find((m) => m.bracket.id === "b2");
    expect([...(b2?.ages ?? [])].sort((a, b) => a - b)).toEqual([9, 11]);
    const b1 = result.matched.find((m) => m.bracket.id === "b1");
    expect(b1?.ages).toEqual([4]);
  });

  it("returns no unmatched ages when every child matches a bracket", () => {
    const result = matchChildrenToBrackets([3, 12], BRACKETS);
    expect(result.unmatchedAges).toEqual([]);
    expect(result.matched).toHaveLength(2);
  });
});

describe("bracket range validation", () => {
  it("rejects a minimum age below 0", () => {
    expect(validateAgeBracketRange(-1, 5)).toMatch(/below 0/);
  });
  it("rejects a maximum age above 15", () => {
    expect(validateAgeBracketRange(10, 16)).toMatch(/above 15/);
  });
  it("rejects minimum > maximum", () => {
    expect(validateAgeBracketRange(10, 5)).toMatch(/exceed maximum/);
  });
  it("accepts a valid range", () => {
    expect(validateAgeBracketRange(0, 15)).toBeNull();
  });
});

describe("overlapping bracket detection", () => {
  it("flags 0-5 and 5-10 as overlapping (age 5 would match both)", () => {
    const pairs = findOverlappingBracketPairs([
      { minAge: 0, maxAge: 5 },
      { minAge: 5, maxAge: 10 },
    ]);
    expect(pairs).toEqual([[0, 1]]);
  });
  it("does not flag adjacent non-overlapping brackets", () => {
    const pairs = findOverlappingBracketPairs([
      { minAge: 0, maxAge: 4 },
      { minAge: 5, maxAge: 10 },
    ]);
    expect(pairs).toEqual([]);
  });
  it("validateBracketSet rejects an overlapping set with a friendly message", () => {
    const err = validateBracketSet([
      { minAge: 0, maxAge: 5 },
      { minAge: 5, maxAge: 10 },
    ]);
    expect(err).toMatch(/overlaps/);
  });
  it("validateBracketSet accepts a valid non-overlapping set", () => {
    const err = validateBracketSet([
      { minAge: 0, maxAge: 4 },
      { minAge: 5, maxAge: 11 },
      { minAge: 12, maxAge: 15 },
    ]);
    expect(err).toBeNull();
  });
});

describe("bracketLabel", () => {
  it("uses the stored label when present", () => {
    expect(bracketLabel({ minAge: 0, maxAge: 4, label: "Infants" })).toBe("Infants");
  });
  it("falls back to a generated range label", () => {
    expect(bracketLabel({ minAge: 5, maxAge: 11, label: null })).toBe("5–11 years");
  });
});
