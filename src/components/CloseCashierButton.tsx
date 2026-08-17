"use client";

import { useState } from "react";
import { signOut } from "@/actions/auth";
import { clockOut } from "@/actions/shifts";
import { useShift } from "./ShiftContext";
import { Button } from "./ui/Button";

// Replaces a bare "Sign out" button: for a cashier, ending the day means
// clocking out (closing the shifts row so the shift log's duration/hours
// are correct) *and* signing out, in one action -- doing only one and not
// the other is the exact mistake this exists to prevent.
//
// Calls clockOut() directly rather than going through ShiftContext's
// toggle() -- toggle() only stores its result in context state, which this
// component can't read synchronously right after calling it (still the
// stale value until the next render), so a failed clock-out could
// otherwise go unnoticed and sign-out would proceed anyway.
export function CloseCashierButton() {
  const { shift } = useShift();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmClose() {
    setPending(true);
    setError(null);
    if (shift) {
      const result = await clockOut();
      if (result.error) {
        setError(result.error);
        setPending(false);
        return;
      }
    }
    await signOut(); // redirects to /login on success
    setPending(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-sidebar-foreground underline underline-offset-2 hover:text-white"
      >
        Close cashier
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-container-low p-6 shadow-lg">
            <h2 className="text-lg font-medium text-on-surface">Close cashier?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              {shift
                ? "This clocks you out for the day and signs you out."
                : "You're not clocked in right now -- this will just sign you out."}
            </p>
            {error && <p className="mt-2 text-sm text-error">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmClose} disabled={pending}>
                {pending ? "Closing…" : "Close cashier"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
