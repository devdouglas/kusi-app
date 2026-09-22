"use client";

import { useState } from "react";
import { Label } from "@/components/ui/field";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { CHILD_AGE_OPTIONS, childAgeLabel } from "@/lib/calc/children";

async function fetchAgeOptions(query: string): Promise<SearchableSelectOption[]> {
  const q = query.trim().toLowerCase();
  return CHILD_AGE_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q) || String(o.age) === q).map((o) => ({
    id: String(o.age),
    label: o.label,
  }));
}

function AgePicker({ age, onChange }: { age: number; onChange: (age: number) => void }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2 text-sm">
        <span>{childAgeLabel(age)}</span>
        <button type="button" className="text-[12px] font-medium text-sage-700 hover:underline" onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <SearchableSelect
      placeholder={`Search age… (currently ${childAgeLabel(age)})`}
      minChars={0}
      fetchOptions={fetchAgeOptions}
      onSelect={(opt) => {
        if (opt === "pinned") return;
        onChange(Number(opt.id));
        setEditing(false);
      }}
    />
  );
}

/**
 * One searchable "exact age" dropdown per child (spec: ages 0–15, "0 / under
 * 1" through "15"; ages above 15 are treated as adults). Each child's exact
 * age is stored, never only an aggregated bracket, so every supplier can
 * match it against its own age brackets independently.
 */
export function ChildAgesEditor({ ages, onChange }: { ages: number[]; onChange: (ages: number[]) => void }) {
  function setAge(index: number, age: number) {
    const next = [...ages];
    next[index] = age;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {ages.map((age, i) => (
        <div key={i}>
          <Label>Child {i + 1} age</Label>
          <AgePicker age={age} onChange={(newAge) => setAge(i, newAge)} />
        </div>
      ))}
    </div>
  );
}
