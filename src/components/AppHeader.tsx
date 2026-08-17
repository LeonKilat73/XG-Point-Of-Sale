"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { StaffRole } from "@/lib/auth/staff";
import { Nav } from "./Nav";
import { ClockButton } from "./ClockButton";
import { ThemeToggle } from "./ThemeToggle";

// Below md the full header (title, nav links, clock button, theme toggle,
// name/role) doesn't fit in one row -- collapses to a compact bar (title +
// hamburger) with everything else in a dropdown panel instead.
export function AppHeader({ fullName, role }: { fullName: string; role: StaffRole }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Navigating closes the mobile menu -- otherwise it'd stay open, covering
  // the page just navigated to. Adjusted during render (React's recommended
  // pattern for this, not a useEffect, which would cause an extra
  // cascading render).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <header className="bg-sidebar">
      <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-base font-medium text-white">XG Point of Sale</p>
            <p className="text-xs text-sidebar-foreground-muted">Car accessories checkout</p>
          </div>
          <div className="hidden md:block">
            <Nav role={role} />
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ClockButton />
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-hover" />
          <div className="text-right text-sm">
            <p className="font-medium text-white">{fullName}</p>
            <p className="capitalize text-sidebar-foreground-muted">{role}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-sidebar-hover md:hidden"
        >
          <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.8" stroke="currentColor" className="h-5 w-5">
            {mobileOpen ? (
              <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
            ) : (
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="space-y-4 border-t border-white/10 px-4 py-4 md:hidden">
          <Nav role={role} className="flex-col items-stretch" />
          <div className="flex items-center justify-between">
            <ClockButton />
            <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-hover" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-white">{fullName}</p>
            <p className="capitalize text-sidebar-foreground-muted">{role}</p>
          </div>
        </div>
      )}
    </header>
  );
}
