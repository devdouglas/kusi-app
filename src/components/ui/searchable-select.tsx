"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Input } from "./field";

export interface SearchableSelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

/**
 * A typeahead search field: results appear once the user has typed at
 * least `minChars` characters (spec section 25), and an optional pinned
 * option (e.g. "Other / Manual Transfer") always appears first (sections
 * 33 / 35).
 */
export function SearchableSelect({
  placeholder,
  minChars = 2,
  pinnedOption,
  fetchOptions,
  onSelect,
  disabled,
}: {
  placeholder: string;
  minChars?: number;
  pinnedOption?: { label: string; sublabel?: string };
  fetchOptions: (query: string) => Promise<SearchableSelectOption[]>;
  onSelect: (option: SearchableSelectOption | "pinned") => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchableSelectOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < minChars) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      const results = await fetchOptions(query.trim());
      if (!cancelled) {
        setOptions(results);
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, minChars, fetchOptions]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const showDropdown = open && (query.trim().length < minChars ? !!pinnedOption : true);

  return (
    <div ref={containerRef} className="relative">
      <Input
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {showDropdown && (
        <div className="absolute z-40 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-border bg-white py-1.5 shadow-lg">
          {pinnedOption && (
            <button
              type="button"
              onClick={() => {
                onSelect("pinned");
                setQuery(pinnedOption.label);
                setOpen(false);
              }}
              className="block w-full border-b border-border px-3.5 py-2 text-left text-sm font-medium text-sage-700 hover:bg-sage-50"
            >
              {pinnedOption.label}
            </button>
          )}
          {query.trim().length < minChars ? (
            <p className="px-3.5 py-2 text-[13px] text-muted">Type at least {minChars} characters to search…</p>
          ) : loading ? (
            <p className="px-3.5 py-2 text-[13px] text-muted">Searching…</p>
          ) : options.length === 0 ? (
            <p className="px-3.5 py-2 text-[13px] text-muted">No matches found.</p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setQuery(opt.label);
                  setOpen(false);
                }}
                className={clsx("block w-full px-3.5 py-2 text-left text-sm hover:bg-sage-50")}
              >
                <div className="text-foreground">{opt.label}</div>
                {opt.sublabel && <div className="text-[12px] text-muted">{opt.sublabel}</div>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
