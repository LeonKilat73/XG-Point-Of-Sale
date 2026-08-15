"use client";

import { useEffect, useState } from "react";
import { useShift } from "./ShiftContext";
import { LONG_SHIFT_HOURS } from "@/lib/shifts";

export function ClockReminderBanner() {
  const { shift, pending, toggle } = useShift();
  const [now, setNow] = useState(() => Date.now());
  // Dismissing hides the banner for the rest of this page load -- it comes
  // back on the next navigation that remounts this component, and (since
  // it's keyed to whether a shift is open, not stored per-condition) a
  // dismissal from "not clocked in" this morning won't silently suppress
  // "clocked in 10+ hours" later without at least one fresh page load
  // between them.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const hoursSinceClockIn = shift ? (now - new Date(shift.clock_in).getTime()) / 3_600_000 : 0;
  const longShift = shift !== null && hoursSinceClockIn >= LONG_SHIFT_HOURS;
  const notClockedIn = shift === null;

  if (dismissed || (!notClockedIn && !longShift)) return null;

  const tone = longShift
    ? "border-error/30 bg-error-container/40 text-on-error-container"
    : "border-tertiary/30 bg-tertiary-container/40 text-on-tertiary-container";

  return (
    <div className={`flex items-center justify-between gap-4 border-b px-6 py-2 text-sm ${tone}`}>
      <span>
        {longShift
          ? `You've been clocked in for ${Math.floor(hoursSinceClockIn)}+ hours -- forgot to clock out?`
          : "You're signed in but not clocked in for a shift."}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-on-surface underline-offset-2 hover:underline disabled:opacity-50"
        >
          {pending ? "…" : longShift ? "Clock out" : "Clock in"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs underline underline-offset-2"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
