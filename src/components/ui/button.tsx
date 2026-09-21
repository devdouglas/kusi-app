import { type ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-sage-500 text-white hover:bg-sage-600 disabled:bg-sage-200 disabled:text-sage-400",
  secondary:
    "bg-white text-foreground border border-border hover:bg-sage-50 disabled:text-muted disabled:bg-white",
  ghost: "text-foreground/70 hover:bg-sage-50 hover:text-foreground disabled:text-muted",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:text-red-200",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[13px] rounded-full",
  md: "px-4 py-2 text-sm rounded-full",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ className, variant = "secondary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 font-medium transition-colors disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  );
});
