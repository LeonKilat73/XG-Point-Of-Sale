import { forwardRef, type InputHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-md border border-outline bg-surface px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string }
>(function TextField({ label, className = "", ...props }, ref) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">{label}</span>}
      <input ref={ref} className={fieldClass} {...props} />
    </label>
  );
});
