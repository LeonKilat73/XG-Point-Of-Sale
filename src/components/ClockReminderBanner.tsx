"use client";

import { useEffect, useState } from "react";
import { useShift } from "./ShiftContext";
import { LONG_SHIFT_HOURS } from "@/lib/shifts";

// "Not clocked in yet" now surfaces as the centered ClockInPrompt popup
// instead of this banner (more noticeable right after login) -- this
// banner is left covering only the other case, a long-running shift
// someone likely forgot to clock out of.
export function ClockReminderBanner() {
  const { shift, pending, toggle } = useShift();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const hoursSinceClockIn = shift ? (now - new Date(shift.clock_in).getTime()) / 3_600_000 : 0;
  const longShift = shift !== null && hoursSinceClockIn >= LONG_SHIFT_HOURS;

  if (dismissed || !longShift) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b px-6 py-2 text-sm border-error/30 bg-error-container/40 text-on-error-container">
      <span>{`You've been clocked in for ${Math.floor(hoursSinceClockIn)}+ hours -- forgot to clock out?`}</span>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-on-surface underline-offset-2 hover:underline disabled:opacity-50"
        >
          {pending ? "…" : "Clock out"}
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
