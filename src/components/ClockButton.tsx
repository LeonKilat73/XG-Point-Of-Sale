"use client";

import { useEffect, useState } from "react";
import { useShift } from "./ShiftContext";

function formatElapsed(clockInIso: string, now: number) {
  const ms = now - new Date(clockInIso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function ClockButton() {
  const { shift, pending, toggle } = useShift();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!shift) return;
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [shift]);

  const elapsed = shift ? formatElapsed(shift.clock_in, now) : "";

  return (
    <div className="flex items-center gap-2">
      {shift && <span className="text-xs text-sidebar-foreground-muted">Clocked in · {elapsed}</span>}
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          shift
            ? "bg-error-container text-on-error-container hover:brightness-95"
            : "bg-primary-container text-on-primary-container hover:brightness-95"
        }`}
      >
        {pending ? "…" : shift ? "Clock out" : "Clock in"}
      </button>
    </div>
  );
}
