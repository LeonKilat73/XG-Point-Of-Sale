import type { InputHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export function TextField({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>}
      <input className={fieldClass} {...props} />
    </label>
  );
}
