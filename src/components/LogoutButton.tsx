"use client";

import { useState } from "react";
import { signOut } from "@/actions/auth";

// A manager/admin isn't required to clock in to use the system, so they
// shouldn't have to fake a clock-in/clock-out cycle just to sign out --
// ClockButton's "Close cashier" flow stays cashier-only (see
// ClockInPrompt/ShiftEndReminder for that side of the logic).
export function LogoutButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await signOut(); // redirects to /login on success
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={pending}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${className}`}
    >
      {pending ? "…" : "Log out"}
    </button>
  );
}
