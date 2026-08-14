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
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar-active text-sidebar-active-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-hover"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
