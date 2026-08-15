"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffRole } from "@/lib/auth/staff";

export function Nav({ role }: { role: StaffRole }) {
  const pathname = usePathname();

  const items = [
    { href: "/checkout", label: "Checkout" },
    { href: "/catalog", label: "Catalog" },
    { href: "/quotes", label: "Quotes" },
    { href: "/orders", label: "Orders" },
    ...(role === "manager" || role === "admin"
      ? [
          { href: "/staff", label: "Staff" },
          { href: "/shifts", label: "Shifts" },
        ]
      : []),
    ...(role === "admin" ? [{ href: "/admin/analytics", label: "Analytics" }] : []),
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
