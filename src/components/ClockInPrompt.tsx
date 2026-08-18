"use client";

import { useState } from "react";
import { useShift } from "./ShiftContext";
import { Button } from "./ui/Button";
import type { StaffRole } from "@/lib/auth/staff";

// Shown once, centered, right after a signed-in staff member's page loads
// if they have no open shift -- more noticeable than a thin banner since
// it's the first thing they see. Dismissible for a manager/admin (they
// aren't required to clock in to use the system), but not for a cashier --
// clocking in is how a cashier's shift/sales get tracked at all, so they
// can't skip past this one.
export function ClockInPrompt({ role }: { role: StaffRole }) {
  const { shift, pending, toggle } = useShift();
  const [dismissed, setDismissed] = useState(false);
  const canDismiss = role !== "cashier";

  if (shift || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface-container-low p-6 shadow-lg">
        <h2 className="text-lg font-medium text-on-surface">Clock in?</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          You&apos;re signed in but not clocked in for a shift yet.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          {canDismiss && (
            <Button variant="secondary" onClick={() => setDismissed(true)} disabled={pending}>
              Dismiss
            </Button>
          )}
          <Button onClick={() => void toggle()} disabled={pending}>
            {pending ? "…" : "Clock in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
