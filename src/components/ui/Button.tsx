import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors px-4 py-2.5 disabled:opacity-40 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-sm hover:shadow-md hover:brightness-110",
  secondary: "bg-secondary-container text-on-secondary-container hover:brightness-95",
  danger: "bg-error text-on-error shadow-sm hover:brightness-110",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
