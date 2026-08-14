"use client";

import { useEffect, useState } from "react";
import { clockIn, clockOut } from "@/actions/shifts";

type OpenShift = { id: string; clock_in: string } | null;

function formatElapsed(clockInIso: string, now: number) {
  const ms = now - new Date(clockInIso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function ClockButton({ initialShift }: { initialShift: OpenShift }) {
  const [shift, setShift] = useState<OpenShift>(initialShift);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!shift) return;
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [shift]);

  async function toggle() {
    setPending(true);
    if (shift) {
      const result = await clockOut();
      if (!result.error) setShift(null);
    } else {
      const result = await clockIn();
      if (!result.error) {
        setNow(Date.now());
        setShift({ id: "", clock_in: new Date().toISOString() });
      }
    }
    setPending(false);
  }

  const elapsed = shift ? formatElapsed(shift.clock_in, now) : "";

  return (
    <div className="flex items-center gap-2">
      {shift && <span className="text-xs text-slate-500">Clocked in · {elapsed}</span>}
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          shift ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
        }`}
      >
        {pending ? "…" : shift ? "Clock out" : "Clock in"}
      </button>
    </div>
  );
}
