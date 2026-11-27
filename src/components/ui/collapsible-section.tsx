"use client";

import { useState, type ReactNode } from "react";

/** An accordion-style section: header (always visible, with a summary slot) toggles the body open/closed. */
export function CollapsibleSection({
  title,
  summary,
  defaultOpen = true,
  headerActions,
  children,
}: {
  title: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={"h-4 w-4 shrink-0 text-muted transition-transform " + (open ? "rotate-90" : "")}
            aria-hidden="true"
          >
            <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="text-[13px] font-medium text-foreground">{title}</span>
            {!open && summary && <span className="ml-2 text-[12px] text-muted">{summary}</span>}
          </span>
        </button>
        {headerActions && <div onClick={(e) => e.stopPropagation()}>{headerActions}</div>}
      </div>
      {open && children}
    </div>
  );
}
