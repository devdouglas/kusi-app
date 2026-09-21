"use client";

import Link from "next/link";
import clsx from "clsx";

export function Tabs({
  items,
  active,
}: {
  items: { href: string; label: string }[];
  active: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-white p-1.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={clsx(
            "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            item.href === active ? "bg-sage-500 text-white" : "text-foreground/70 hover:bg-sage-50"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
