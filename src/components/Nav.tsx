"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ role }: { role: "cashier" | "manager" }) {
  const pathname = usePathname();

  const items = [
    { href: "/checkout", label: "Checkout" },
    { href: "/orders", label: "Orders" },
    { href: "/reports", label: "Reports" },
    ...(role === "manager" ? [{ href: "/staff", label: "Staff" }] : []),
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="flex gap-1">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
