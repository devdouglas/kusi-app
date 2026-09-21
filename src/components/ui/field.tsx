import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef, type ReactNode } from "react";
import clsx from "clsx";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-foreground/80">
      {children}
    </label>
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-1 text-[12px] text-red-600">{children}</p>;
}

const baseInputClasses =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2 text-sm text-foreground placeholder:text-muted focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-100 disabled:bg-sage-50 disabled:text-muted";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={clsx(baseInputClasses, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={clsx(baseInputClasses, "min-h-20 resize-y", className)} {...props} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select ref={ref} className={clsx(baseInputClasses, "pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export function FormRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
