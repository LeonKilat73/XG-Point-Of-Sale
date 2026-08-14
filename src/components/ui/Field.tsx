import { forwardRef, type InputHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string }
>(function TextField({ label, className = "", ...props }, ref) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>}
      <input ref={ref} className={fieldClass} {...props} />
    </label>
  );
});
