"use client";

import { createContext, useContext, useState } from "react";
import { clockIn, clockOut } from "@/actions/shifts";

export type OpenShift = { id: string; clock_in: string } | null;

type ShiftContextValue = {
  shift: OpenShift;
  pending: boolean;
  error: string | null;
  toggle: () => Promise<void>;
};

const ShiftContext = createContext<ShiftContextValue | null>(null);

// Single source of truth for "am I currently clocked in", shared by the nav
// bar's ClockButton and the full-width ClockReminderBanner -- both used to
// track this independently from the same initial server value, which meant
// clocking in from one wouldn't tell the other, leaving them showing
// contradictory states until the next hard navigation.
export function ShiftProvider({
  initialShift,
  children,
}: {
  initialShift: OpenShift;
  children: React.ReactNode;
}) {
  // Seeded once from the server's initial fetch; from then on this is the
  // single source of truth, updated only by toggle() below (a genuinely new
  // server value -- e.g. a manager force-closing this person's shift
  // elsewhere -- only takes effect on the next hard navigation, which
  // remounts this provider with a fresh initialShift).
  const [shift, setShift] = useState<OpenShift>(initialShift);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    if (shift) {
      const result = await clockOut();
      if (result.error) setError(result.error);
      else setShift(null);
    } else {
      const result = await clockIn();
      if (result.error) setError(result.error);
      else if (result.shift) setShift(result.shift);
    }
    setPending(false);
  }

  return (
    <ShiftContext.Provider value={{ shift, pending, error, toggle }}>{children}</ShiftContext.Provider>
  );
}

export function useShift(): ShiftContextValue {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be used within a ShiftProvider");
  return ctx;
}
