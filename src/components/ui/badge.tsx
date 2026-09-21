import type { ReactNode } from "react";
import clsx from "clsx";

const STYLES = {
  sage: "bg-sage-100 text-sage-700",
  neutral: "bg-sage-50 text-muted",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof STYLES }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", STYLES[tone])}>
      {children}
    </span>
  );
}
