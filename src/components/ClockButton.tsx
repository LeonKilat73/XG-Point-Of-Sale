"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/actions/auth";
import { clockOut } from "@/actions/shifts";
import { useShift } from "./ShiftContext";
import { Button } from "./ui/Button";

function formatElapsed(clockInIso: string, now: number) {
  const ms = now - new Date(clockInIso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

// Single control for the whole shift lifecycle: "Clock in" clocks in
// directly (no confirmation needed), but once clocked in the same pill
// reads "Clock out" and opens a confirm popup instead -- clocking out this
// way also signs the cashier out, since in practice the two always happen
// together at the end of a shift (this used to be two separate controls,
// a bare Clock in/out pill plus a distinct "Close cashier" link elsewhere
// in the header -- merged into one at the user's request).
export function ClockButton() {
  const { shift, pending, toggle } = useShift();
  const [now, setNow] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shift) return;
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [shift]);

  const elapsed = shift ? formatElapsed(shift.clock_in, now) : "";

  function handleClick() {
    if (shift) {
      setError(null);
      setConfirmOpen(true);
    } else {
      void toggle();
    }
  }

  // Calls clockOut() directly rather than toggle() -- toggle() only stores
  // its result in ShiftContext state, which can't be read synchronously
  // right after calling it (still the stale value until the next render),
  // so a failed clock-out could otherwise go unnoticed and sign-out would
  // proceed anyway.
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

  return (
    <>
      <div className="flex items-center gap-2">
        {shift && <span className="text-xs text-sidebar-foreground-muted">Clocked in · {elapsed}</span>}
        <button
          type="button"
          onClick={handleClick}
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

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-container-low p-6 shadow-lg">
            <h2 className="text-lg font-medium text-on-surface">Close cashier?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              This clocks you out for the day and signs you out.
            </p>
            {error && <p className="mt-2 text-sm text-error">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={closing}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmClose} disabled={closing}>
                {closing ? "Closing…" : "Close cashier"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
