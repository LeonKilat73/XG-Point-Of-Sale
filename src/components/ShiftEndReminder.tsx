"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/actions/auth";
import { clockOut } from "@/actions/shifts";
import { useShift } from "./ShiftContext";
import { Button } from "./ui/Button";
import { todayKey, REMINDER_LEAD_MINUTES, type WeekSchedule } from "@/lib/schedule";

function minutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Shows a centered popup once a clocked-in cashier is within
// REMINDER_LEAD_MINUTES of their scheduled shift end for today, per their
// own weekly schedule (set by a manager on /staff -- see ScheduleEditor).
// Relies on the browser's own local clock matching the shop's real time,
// same assumption the rest of this app's local-time-of-day logic makes --
// there's no server-side per-shop timezone config, this is a single
// physical register.
export function ShiftEndReminder({ schedule }: { schedule: WeekSchedule | null }) {
  const { shift } = useShift();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  async function confirmClose() {
    setClosing(true);
    setError(null);
    const result = await clockOut();
    if (result.error) {
      setError(result.error);
      setClosing(false);
      return;
    }
    await signOut(); // redirects to /login on success
    setClosing(false);
  }

  if (!schedule || !shift || dismissed) return null;

  const nowDate = new Date(now);
  const entry = schedule[todayKey(nowDate)];
  if (!entry) return null;

  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const endMinutes = minutesSinceMidnight(entry.end);

  // Only within a window starting REMINDER_LEAD_MINUTES before the
  // scheduled end -- not before (too early to matter), and not forever
  // after (someone working expected overtime shouldn't see a stale "your
  // shift ended" popup hours later; the existing long-shift banner already
  // covers "did you forget" at the 10-hour mark).
  if (nowMinutes < endMinutes - REMINDER_LEAD_MINUTES || nowMinutes > endMinutes + 60) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface-container-low p-6 shadow-lg">
        <h2 className="text-lg font-medium text-on-surface">Shift ending soon</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Your scheduled shift ends at {entry.end} today. Don&apos;t forget to close out.
        </p>
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDismissed(true)} disabled={closing}>
            Dismiss
          </Button>
          <Button variant="danger" onClick={confirmClose} disabled={closing}>
            {closing ? "Closing…" : "Close cashier"}
          </Button>
        </div>
      </div>
    </div>
  );
}
